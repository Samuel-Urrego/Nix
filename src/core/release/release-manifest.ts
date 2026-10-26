import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export interface ReleaseCompatibility {
  readonly stackStateSchema: 1;
  readonly configFile: "config.json";
  readonly node: ">=20.11.0";
  readonly platforms: ReadonlyArray<"windows">;
  readonly agents: ReadonlyArray<"opencode" | "codex">;
}

export interface ReleaseFile {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
}

export interface ReleaseManifest {
  readonly schemaVersion: 1;
  readonly name: "nix-ai-stack";
  readonly version: string;
  readonly generatedAt: string;
  readonly compatibility: ReleaseCompatibility;
  readonly files: ReadonlyArray<ReleaseFile>;
}

export interface CreateReleaseManifestOptions {
  readonly distDirectory: string;
  readonly version: string;
  readonly generatedAt?: string;
  readonly excludedPaths?: ReadonlyArray<string>;
}

export interface VerifyReleaseManifestOptions {
  readonly excludedPaths?: ReadonlyArray<string>;
}

export interface ReleaseVerification {
  readonly ok: boolean;
  readonly missing: ReadonlyArray<string>;
  readonly modified: ReadonlyArray<string>;
  readonly extra: ReadonlyArray<string>;
}

const MANIFEST_FILE = "release-manifest.json";
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export const releaseCompatibility: ReleaseCompatibility = {
  stackStateSchema: 1,
  configFile: "config.json",
  node: ">=20.11.0",
  platforms: ["windows"],
  agents: ["opencode", "codex"]
};

export async function createReleaseManifest(
  options: CreateReleaseManifestOptions
): Promise<ReleaseManifest> {
  const version = options.version.trim();
  if (!VERSION_PATTERN.test(version)) throw new Error(`Invalid release version: ${options.version}`);
  const files = await collectReleaseFiles(
    options.distDirectory,
    options.excludedPaths ?? []
  );
  return {
    schemaVersion: 1,
    name: "nix-ai-stack",
    version,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    compatibility: releaseCompatibility,
    files
  };
}

export async function writeReleaseManifest(manifest: ReleaseManifest, file: string): Promise<string> {
  validateReleaseManifest(manifest);
  await mkdir(path.dirname(path.resolve(file)), { recursive: true });
  await writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return file;
}

export async function loadReleaseManifest(file: string): Promise<ReleaseManifest> {
  const raw = await readFile(file, "utf8");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(`Release manifest is not valid JSON: ${file}`);
  }
  return validateReleaseManifest(value);
}

export async function verifyReleaseManifest(
  distDirectory: string,
  manifest: ReleaseManifest,
  options: VerifyReleaseManifestOptions = {}
): Promise<ReleaseVerification> {
  validateReleaseManifest(manifest);
  const actual = await collectReleaseFiles(distDirectory, options.excludedPaths ?? []);
  const expected = new Map(manifest.files.map((file) => [file.path, file]));
  const observed = new Map(actual.map((file) => [file.path, file]));
  const missing: string[] = [];
  const modified: string[] = [];
  const extra: string[] = [];

  for (const [filePath, file] of expected) {
    const current = observed.get(filePath);
    if (!current) {
      missing.push(filePath);
      continue;
    }
    if (current.bytes !== file.bytes || current.sha256 !== file.sha256) modified.push(filePath);
  }
  for (const filePath of observed.keys()) {
    if (!expected.has(filePath)) extra.push(filePath);
  }

  missing.sort();
  modified.sort();
  extra.sort();
  return {
    ok: missing.length === 0 && modified.length === 0 && extra.length === 0,
    missing,
    modified,
    extra
  };
}

async function collectReleaseFiles(
  distDirectory: string,
  excludedPaths: ReadonlyArray<string>
): Promise<ReadonlyArray<ReleaseFile>> {
  const root = path.resolve(distDirectory);
  const metadata = await lstat(root);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error("Release dist path must be a real directory");
  }
  const excluded = new Set<string>([MANIFEST_FILE, ...excludedPaths.map(normalizeRelativePath)]);
  const files: ReleaseFile[] = [];
  await collectDirectory(root, "", excluded, files);
  return files.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
}

async function collectDirectory(
  directory: string,
  relative: string,
  excluded: ReadonlySet<string>,
  files: ReleaseFile[]
): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relativePath = relative ? `${relative}/${entry.name}` : entry.name;
    const absolutePath = path.join(directory, entry.name);
    const metadata = await lstat(absolutePath);
    if (metadata.isSymbolicLink()) throw new Error(`Refusing symlink in release tree: ${relativePath}`);
    if (metadata.isDirectory()) {
      await collectDirectory(absolutePath, relativePath, excluded, files);
      continue;
    }
    if (!metadata.isFile()) throw new Error(`Unsupported file type in release tree: ${relativePath}`);
    if (excluded.has(relativePath)) continue;
    const content = await readFile(absolutePath);
    files.push({
      path: relativePath,
      bytes: content.byteLength,
      sha256: createHash("sha256").update(content).digest("hex")
    });
  }
}

function validateReleaseManifest(value: unknown): ReleaseManifest {
  if (!isRecord(value)) throw new Error("Release manifest must be a JSON object");
  if (value.schemaVersion !== 1) throw new Error(`Unsupported release manifest schema version: ${String(value.schemaVersion)}`);
  if (value.name !== "nix-ai-stack") throw new Error("Release manifest has an unexpected package name");
  if (typeof value.version !== "string" || !VERSION_PATTERN.test(value.version)) {
    throw new Error("Release manifest version must use major.minor.patch");
  }
  if (typeof value.generatedAt !== "string" || value.generatedAt.length === 0) {
    throw new Error("Release manifest generatedAt must be a non-empty string");
  }
  if (!isCompatibility(value.compatibility)) throw new Error("Release manifest compatibility is invalid");
  if (!Array.isArray(value.files)) throw new Error("Release manifest files must be an array");

  const files = value.files.map((file) => validateFile(file));
  const seen = new Set<string>();
  for (const file of files) {
    if (seen.has(file.path)) throw new Error(`Release manifest contains a duplicate file: ${file.path}`);
    seen.add(file.path);
  }
  return {
    schemaVersion: 1,
    name: "nix-ai-stack",
    version: value.version,
    generatedAt: value.generatedAt,
    compatibility: value.compatibility,
    files
  };
}

function validateFile(value: unknown): ReleaseFile {
  if (!isRecord(value)) throw new Error("Release manifest file entry must be an object");
  if (typeof value.path !== "string") throw new Error("Release manifest file path must be a string");
  const filePath = normalizeRelativePath(value.path);
  if (typeof value.bytes !== "number" || !Number.isInteger(value.bytes) || value.bytes < 0) {
    throw new Error(`Release manifest byte count is invalid for ${filePath}`);
  }
  if (typeof value.sha256 !== "string" || !SHA256_PATTERN.test(value.sha256)) {
    throw new Error(`Release manifest checksum is invalid for ${filePath}`);
  }
  return { path: filePath, bytes: value.bytes, sha256: value.sha256 };
}

function isCompatibility(value: unknown): value is ReleaseCompatibility {
  if (!isRecord(value)) return false;
  if (value.stackStateSchema !== 1) return false;
  if (value.configFile !== "config.json") return false;
  if (value.node !== ">=20.11.0") return false;
  if (!Array.isArray(value.platforms) || !value.platforms.every((item) => item === "windows")) return false;
  if (!Array.isArray(value.agents) || !value.agents.every((item) => item === "opencode" || item === "codex")) return false;
  return true;
}

function normalizeRelativePath(value: string): string {
  const normalized = value.replaceAll("\\", "/").replace(/^\.\//, "");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    /^[A-Za-z]:/.test(normalized) ||
    normalized.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`Invalid release path: ${value}`);
  }
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
