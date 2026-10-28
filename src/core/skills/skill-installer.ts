import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, lstat, mkdir, mkdtemp, readFile, readdir, rm, rmdir, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getGlobalSkillTargetPath, getManagedSkillsPath } from "../config/global-paths.js";
import { skillCatalog } from "./skill-catalog.js";
import type { SkillAgent, SkillCatalogEntry, SkillDependency, SkillFileMap, SkillFetcher } from "./skill-contracts.js";

export type SkillPlanAction = "install" | "update" | "already-current" | "conflict" | "incompatible";
export type SkillInstallState = "absent" | "current" | "update-available" | "modified" | "conflict" | "incompatible" | "invalid";

export interface SkillDependencyStatus {
  readonly description: string;
  readonly required: boolean;
  readonly satisfied: boolean;
}

export interface SkillPlan {
  readonly id: string;
  readonly agent: SkillAgent;
  readonly action: SkillPlanAction;
  readonly targetPath: string;
  readonly repo: string;
  readonly ref: string;
  readonly version: string;
  readonly license: string;
  readonly dependencies: ReadonlyArray<SkillDependencyStatus>;
  readonly missing: ReadonlyArray<string>;
  readonly network: boolean;
  readonly reason?: string;
}

export interface SkillStatusEntry {
  readonly id: string;
  readonly agent: SkillAgent;
  readonly state: SkillInstallState;
  readonly detail?: string;
}

export interface SkillInstallerOptions {
  readonly catalog?: ReadonlyArray<SkillCatalogEntry>;
  readonly fetcher?: SkillFetcher;
  readonly now?: () => Date;
  readonly packageRoot?: string;
}

interface FileDigest {
  readonly path: string;
  readonly sha256: string;
}

interface ManagedSkillRecord {
  readonly id: string;
  readonly agent: SkillAgent;
  readonly version: string;
  readonly ref: string;
  readonly installedAt: string;
  readonly files: ReadonlyArray<FileDigest>;
}

interface ManagedSkillState {
  readonly schemaVersion: 1;
  readonly entries: Readonly<Record<string, ManagedSkillRecord>>;
}

interface TargetSnapshot {
  readonly files: ReadonlyMap<string, Buffer>;
  readonly directories: ReadonlyArray<string>;
}

const emptyState: ManagedSkillState = { schemaVersion: 1, entries: {} };

function sourceIdentity(entry: SkillCatalogEntry): string {
  return entry.source.kind === "git" ? entry.source.ref : `bundled:${entry.source.path}`;
}

export function managedSkillStatePath(_root: string): string {
  return getManagedSkillsPath();
}

export function globalSkillTargetPath(agent: SkillAgent, id: string): string {
  return getGlobalSkillTargetPath(agent, id);
}

function targetPathFor(entry: SkillCatalogEntry, agent: SkillAgent): string {
  return globalSkillTargetPath(agent, entry.id);
}

export function managedSkillKey(agent: SkillAgent, id: string): string {
  return `${agent}:${id}`;
}

export async function previewSkill(
  root: string,
  id: string,
  agent: SkillAgent,
  options: SkillInstallerOptions = {}
): Promise<SkillPlan> {
  const entry = requireEntry(options, id);
  const targetPath = targetPathFor(entry, agent);
  const dependencies = await dependencyStatuses(root, entry.dependencies);
  const missing = dependencies.filter((item) => item.required && !item.satisfied).map((item) => item.description);
  const base = {
    id,
    agent,
    targetPath,
    repo: entry.source.kind === "git" ? entry.source.repo : "Nix package",
    ref: sourceIdentity(entry),
    version: entry.version,
    license: entry.license,
    dependencies,
    missing,
    network: entry.source.kind === "git"
  } as const;

  if (!entry.compatibleAgents.includes(agent)) {
    return { ...base, action: "incompatible", reason: `${entry.name} is not compatible with ${agent}.` };
  }

  let snapshot: TargetSnapshot | undefined;
  try {
    snapshot = await readTargetSnapshot(targetPath);
  } catch (error) {
    return { ...base, action: "conflict", reason: message(error) };
  }

  const state = await readManagedState(root);
  const record = state.entries[managedSkillKey(agent, id)];
  if (!snapshot) {
    return record ? { ...base, action: "update", reason: "The ownership record exists but the installed files are missing." } : { ...base, action: "install" };
  }
  if (!record) {
    return { ...base, action: "conflict", reason: "An existing skill directory with this id is not managed by Nix." };
  }
  if (!matchesRecord(snapshot, record)) {
    return { ...base, action: "conflict", reason: "The Nix-managed skill was modified outside Nix; run skill:update to restore it." };
  }
  if (record.version !== entry.version || record.ref !== sourceIdentity(entry)) {
    return { ...base, action: "update" };
  }
  return { ...base, action: "already-current" };
}

export async function installSkill(
  root: string,
  id: string,
  agent: SkillAgent,
  options: SkillInstallerOptions = {}
): Promise<{ readonly action: "installed" | "updated" | "already-current"; readonly targetPath: string; readonly fileCount: number }> {
  const plan = await previewSkill(root, id, agent, options);
  if (plan.action === "incompatible" || plan.action === "conflict") throw new Error(plan.reason ?? `Cannot install skill ${id}.`);
  if (plan.missing.length > 0) throw new Error(`Missing dependency: ${plan.missing.join("; ")}.`);
  if (plan.action === "already-current") return { action: "already-current", targetPath: plan.targetPath, fileCount: 0 };

  const entry = requireEntry(options, id);
  const targetPath = targetPathFor(entry, agent);
  const fetched = validateFiles(await fetcherFor(options)(entry));
  const previous = plan.action === "update" ? await readTargetSnapshot(targetPath) : undefined;

  if (previous) await removeSnapshot(targetPath, previous);
  try {
    await writeSkillTree(targetPath, fetched);
  } catch (error) {
    if (previous) await writeSkillTree(targetPath, previous.files).catch(() => undefined);
    throw error;
  }
  await recordInstall(root, entry, agent, fetched, options);
  return { action: plan.action === "update" ? "updated" : "installed", targetPath, fileCount: fetched.size };
}

export async function updateSkill(
  root: string,
  id: string,
  agent: SkillAgent,
  options: SkillInstallerOptions = {}
): Promise<{ readonly action: "updated"; readonly targetPath: string; readonly fileCount: number }> {
  const entry = requireEntry(options, id);
  const targetPath = targetPathFor(entry, agent);
  const state = await readManagedState(root);
  const record = state.entries[managedSkillKey(agent, id)];
  if (!record) throw new Error(`Skill ${id} is not managed by Nix for ${agent}.`);
  const previous = await readTargetSnapshot(targetPath);
  // Explicit update is the recovery path for a managed target modified outside Nix.
  // The ownership record proves Nix created this directory; unrelated directories stay protected.
  const fetched = validateFiles(await fetcherFor(options)(entry));
  if (previous) await removeSnapshot(targetPath, previous);
  try {
    await writeSkillTree(targetPath, fetched);
  } catch (error) {
    if (previous) await writeSkillTree(targetPath, previous.files).catch(() => undefined);
    throw error;
  }
  await recordInstall(root, entry, agent, fetched, options);
  return { action: "updated", targetPath, fileCount: fetched.size };
}

export async function removeSkill(
  root: string,
  id: string,
  agent: SkillAgent,
  options: SkillInstallerOptions = {}
): Promise<{ readonly action: "removed"; readonly targetPath: string }> {
  const entry = requireEntry(options, id);
  const targetPath = targetPathFor(entry, agent);
  const state = await readManagedState(root);
  const key = managedSkillKey(agent, id);
  const record = state.entries[key];
  if (!record) throw new Error(`Skill ${id} is not managed by Nix for ${agent}.`);
  const snapshot = await readTargetSnapshot(targetPath);
  if (snapshot && !matchesRecord(snapshot, record)) {
    throw new Error(`The Nix-managed skill ${id} was modified outside Nix; refusing to remove it.`);
  }
  if (snapshot) await removeSnapshot(targetPath, snapshot);
  const entries = { ...state.entries };
  delete entries[key];
  await writeManagedState(root, { schemaVersion: 1, entries });
  return { action: "removed", targetPath };
}

export async function getSkillStatus(
  root: string,
  options: SkillInstallerOptions = {}
): Promise<ReadonlyArray<SkillStatusEntry>> {
  const catalog = options.catalog ?? skillCatalog;
  let state: ManagedSkillState | undefined;
  let stateError: string | undefined;
  try {
    state = await readManagedState(root);
  } catch (error) {
    stateError = message(error);
  }
  const result: SkillStatusEntry[] = [];
  for (const entry of catalog) {
    for (const agent of ["opencode", "codex"] as const) {
      if (!entry.compatibleAgents.includes(agent)) {
        result.push({ id: entry.id, agent, state: "incompatible", detail: `${entry.name} requires ${entry.compatibleAgents.join(", ")}.` });
        continue;
      }
      if (stateError) {
        result.push({ id: entry.id, agent, state: "invalid", detail: stateError });
        continue;
      }
      let snapshot: TargetSnapshot | undefined;
      try {
        snapshot = await readTargetSnapshot(targetPathFor(entry, agent));
      } catch (error) {
        result.push({ id: entry.id, agent, state: "invalid", detail: message(error) });
        continue;
      }
      const record = state?.entries[managedSkillKey(agent, entry.id)];
      if (!snapshot) {
        result.push({
          id: entry.id,
          agent,
          state: record ? "modified" : "absent",
          ...(record ? { detail: "Ownership record exists but installed files are missing." } : {})
        });
        continue;
      }
      if (!record) {
        result.push({ id: entry.id, agent, state: "conflict", detail: "Existing skill directory is not managed by Nix." });
        continue;
      }
      if (!matchesRecord(snapshot, record)) {
        result.push({ id: entry.id, agent, state: "modified", detail: "Managed files differ from the ownership record." });
        continue;
      }
      result.push({
        id: entry.id,
        agent,
        state: record.version === entry.version && record.ref === sourceIdentity(entry) ? "current" : "update-available"
      });
    }
  }
  return result;
}

export function createLocalSkillFetcher(sourceDirectory: string): SkillFetcher {
  return async () => {
    const files = await readSkillDirectory(path.resolve(sourceDirectory));
    await attachRepositoryFiles(files, path.resolve(sourceDirectory));
    return files;
  };
}

export function createBundledSkillFetcher(packageRoot: string): SkillFetcher {
  return async (entry) => {
    if (entry.source.kind !== "bundled") throw new Error(`Skill ${entry.id} is not bundled in the Nix package.`);
    const skillDirectory = resolveWithin(path.resolve(packageRoot), entry.source.path);
    return readSkillDirectory(skillDirectory);
  };
}

function fetcherFor(options: SkillInstallerOptions): SkillFetcher {
  if (options.fetcher) return options.fetcher;
  const bundledRoot = options.packageRoot ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  return async (entry) => entry.source.kind === "bundled"
    ? createBundledSkillFetcher(bundledRoot)(entry)
    : fetchPinnedSkill(entry);
}

function requireEntry(options: SkillInstallerOptions, id: string): SkillCatalogEntry {
  const catalog = options.catalog ?? skillCatalog;
  const entry = catalog.find((item) => item.id === id);
  if (!entry) throw new Error(`Unknown skill: ${id}.`);
  assertSafeRelativePath(entry.id, "skill id");
  return entry;
}

async function fetchPinnedSkill(entry: SkillCatalogEntry): Promise<SkillFileMap> {
  if (entry.source.kind !== "git") throw new Error(`Skill ${entry.id} does not use a Git source.`);
  const directory = await mkdtemp(path.join(os.tmpdir(), "nix-skill-fetch-"));
  try {
    await runGit(directory, ["init", "-q"]);
    await runGit(directory, ["remote", "add", "origin", entry.source.repo]);
    await runGit(directory, ["fetch", "--depth", "1", "origin", entry.source.ref]);
    await runGit(directory, ["checkout", "-q", "FETCH_HEAD"]);
    const source = path.join(directory, ...entry.source.path.split("/"));
    const files = await readSkillDirectory(source);
    await attachRepositoryFiles(files, directory, entry.source.licensePath, entry.source.noticePath);
    return files;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function attachRepositoryFiles(files: Map<string, Buffer>, repositoryRoot: string, licensePath = "LICENSE", noticePath?: string): Promise<void> {
  const license = path.join(repositoryRoot, ...licensePath.split("/"));
  if (await fileExists(license)) files.set("LICENSE", await readFile(license));
  if (noticePath) {
    const notice = path.join(repositoryRoot, ...noticePath.split("/"));
    if (await fileExists(notice)) files.set("NOTICE", await readFile(notice));
  }
}

async function readSkillDirectory(directory: string): Promise<Map<string, Buffer>> {
  const metadata = await lstat(directory);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) throw new Error(`Skill source is not a real directory: ${directory}`);
  const files = new Map<string, Buffer>();
  await walk(directory, "", files);
  if (!files.has("SKILL.md")) throw new Error(`Skill source is missing SKILL.md: ${directory}`);
  return files;
}

async function walk(root: string, relative: string, files: Map<string, Buffer>): Promise<void> {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const relativePath = relative ? `${relative}/${entry.name}` : entry.name;
    const fullPath = path.join(root, entry.name);
    const metadata = await lstat(fullPath);
    if (metadata.isSymbolicLink()) throw new Error(`Refusing to follow skill source symlink: ${relativePath}`);
    if (metadata.isDirectory()) {
      await walk(fullPath, relativePath, files);
    } else if (metadata.isFile()) {
      assertSafeRelativePath(relativePath, "skill file path");
      files.set(relativePath, await readFile(fullPath));
    } else {
      throw new Error(`Unsupported skill source entry: ${relativePath}`);
    }
  }
}

function validateFiles(files: SkillFileMap): Map<string, Buffer> {
  const validated = new Map<string, Buffer>();
  for (const [relative, content] of files) {
    assertSafeRelativePath(relative, "skill file path");
    if (validated.has(relative)) throw new Error(`Duplicate skill file: ${relative}`);
    validated.set(relative, content);
  }
  if (!validated.has("SKILL.md")) throw new Error("A skill must contain SKILL.md.");
  return validated;
}

async function writeSkillTree(targetPath: string, files: ReadonlyMap<string, Buffer>): Promise<void> {
  const target = path.resolve(targetPath);
  await mkdir(path.dirname(target), { recursive: true });
  try {
    await mkdir(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("Skill destination already exists; refusing to overwrite it.");
    throw error;
  }
  try {
    for (const [relative, content] of files) {
      const filePath = resolveWithin(target, relative);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, content, { flag: "wx" });
    }
  } catch (error) {
    await rm(target, { recursive: true, force: true });
    throw error;
  }
}

async function readTargetSnapshot(targetPath: string): Promise<TargetSnapshot | undefined> {
  const target = path.resolve(targetPath);
  let metadata;
  try {
    metadata = await lstat(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) throw new Error(`Skill destination is not a real directory: ${targetPath}`);
  const files = new Map<string, Buffer>();
  const directories: string[] = [];
  await walkTarget(target, "", files, directories);
  return { files, directories };
}

async function walkTarget(root: string, relative: string, files: Map<string, Buffer>, directories: string[]): Promise<void> {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const relativePath = relative ? `${relative}/${entry.name}` : entry.name;
    const fullPath = path.join(root, entry.name);
    const metadata = await lstat(fullPath);
    if (metadata.isSymbolicLink()) throw new Error(`Refusing to follow installed skill symlink: ${relativePath}`);
    if (metadata.isDirectory()) {
      directories.push(relativePath);
      await walkTarget(fullPath, relativePath, files, directories);
    } else if (metadata.isFile()) {
      files.set(relativePath, await readFile(fullPath));
    } else {
      throw new Error(`Unsupported installed skill entry: ${relativePath}`);
    }
  }
}

async function removeSnapshot(targetPath: string, snapshot: TargetSnapshot): Promise<void> {
  const target = path.resolve(targetPath);
  for (const relative of snapshot.files.keys()) await unlink(resolveWithin(target, relative));
  for (const directory of [...snapshot.directories].sort((left, right) => right.split("/").length - left.split("/").length)) {
    await rmdir(resolveWithin(target, directory));
  }
  await rmdir(target);
}

async function recordInstall(
  root: string,
  entry: SkillCatalogEntry,
  agent: SkillAgent,
  files: ReadonlyMap<string, Buffer>,
  options: SkillInstallerOptions
): Promise<void> {
  const state = await readManagedState(root);
  const record: ManagedSkillRecord = {
    id: entry.id,
    agent,
    version: entry.version,
    ref: sourceIdentity(entry),
    installedAt: (options.now ?? (() => new Date()))().toISOString(),
    files: [...files].map(([relative, content]) => ({ path: relative, sha256: hash(content) })).sort((left, right) => left.path.localeCompare(right.path))
  };
  await writeManagedState(root, {
    schemaVersion: 1,
    entries: { ...state.entries, [managedSkillKey(agent, entry.id)]: record }
  });
}

function matchesRecord(snapshot: TargetSnapshot, record: ManagedSkillRecord): boolean {
  const expected = [...record.files].sort((left, right) => left.path.localeCompare(right.path));
  const actual = [...snapshot.files].sort(([left], [right]) => left.localeCompare(right));
  if (expected.length !== actual.length) return false;
  return expected.every((file, index) => file.path === actual[index]?.[0] && file.sha256 === hash(actual[index]![1]));
}

async function readManagedState(root: string): Promise<ManagedSkillState> {
  const file = managedSkillStatePath(root);
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyState;
    throw error;
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid managed skill state JSON at ${file}`);
  }
  return validateManagedState(value);
}

async function writeManagedState(root: string, state: ManagedSkillState): Promise<void> {
  const validated = validateManagedState(state);
  const file = managedSkillStatePath(root);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
}

function validateManagedState(value: unknown): ManagedSkillState {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.entries)) throw new Error("Managed skill state is invalid.");
  const entries: Record<string, ManagedSkillRecord> = {};
  for (const [key, raw] of Object.entries(value.entries)) {
    if (!isRecord(raw) || typeof raw.id !== "string" || (raw.agent !== "opencode" && raw.agent !== "codex")) throw new Error(`Invalid managed skill record: ${key}`);
    if (typeof raw.version !== "string" || typeof raw.ref !== "string" || typeof raw.installedAt !== "string" || !Array.isArray(raw.files)) throw new Error(`Invalid managed skill metadata: ${key}`);
    const files = raw.files.map((file) => {
      if (!isRecord(file) || typeof file.path !== "string" || typeof file.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error(`Invalid managed skill file record: ${key}`);
      assertSafeRelativePath(file.path, "recorded skill file path");
      return { path: file.path, sha256: file.sha256 };
    });
    entries[key] = { id: raw.id, agent: raw.agent, version: raw.version, ref: raw.ref, installedAt: raw.installedAt, files };
  }
  return { schemaVersion: 1, entries };
}

async function dependencyStatuses(root: string, dependencies: ReadonlyArray<SkillDependency>): Promise<ReadonlyArray<SkillDependencyStatus>> {
  const result: SkillDependencyStatus[] = [];
  for (const dependency of dependencies) {
    result.push({
      description: dependency.description,
      required: dependency.required,
      satisfied: await dependencySatisfied(root, dependency)
    });
  }
  return result;
}

async function dependencySatisfied(root: string, dependency: SkillDependency): Promise<boolean> {
  switch (dependency.kind) {
    case "network":
      return true;
    case "file":
      return fileExists(path.join(path.resolve(root), ...dependency.path.split("/")));
    case "command":
      return findExecutable(dependency.name);
    case "runtime":
      if (dependency.name === "chrome") return (await findExecutable("chrome")) || (await findExecutable("msedge")) || (await findExecutable("chromium")) || (await findExecutable("google-chrome"));
      return findExecutable(dependency.name);
  }
}

async function findExecutable(name: string): Promise<boolean> {
  if (name.includes("/") || name.includes("\\")) return fileExists(name);
  const pathValue = process.env.PATH ?? "";
  const extensions = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const directory of pathValue.split(path.delimiter)) {
    if (!directory) continue;
    for (const extension of extensions) {
      if (await fileExists(path.join(directory, `${name}${extension}`))) return true;
    }
  }
  return false;
}

async function fileExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function runGit(cwd: string, args: ReadonlyArray<string>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`git ${args[0] ?? ""} failed (${code ?? "unknown"}): ${stderr.trim() || "no stderr"}`));
    });
  });
}

function assertSafeRelativePath(relativePath: string, label: string): void {
  const segments = relativePath.split("/");
  if (!relativePath || relativePath.includes("\\") || relativePath.startsWith("/") || /^[a-zA-Z]:/.test(relativePath) || segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`Unsafe ${label}: ${relativePath}`);
  }
}

function resolveWithin(root: string, relativePath: string): string {
  assertSafeRelativePath(relativePath, "path");
  const absoluteRoot = path.resolve(root);
  const target = path.resolve(absoluteRoot, ...relativePath.split("/"));
  const relative = path.relative(absoluteRoot, target);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Path escapes its allowed root: ${relativePath}`);
  }
  return target;
}

function hash(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
