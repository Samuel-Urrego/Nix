import { lstat, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { getCodexHome, getCodexHooksPath, getOpenCodePluginsDirectory } from "../config/global-paths.js";

const CODEX_MATCHER = "Bash|PowerShell|Cmd";

export interface SecurityHooksPlan {
  readonly action: "install" | "already-current" | "conflict";
  readonly targets: { readonly codex: string; readonly opencode: string; readonly shells: ReadonlyArray<string> };
  readonly reason?: string;
}

export interface SecurityHooksStatus {
  readonly enabled: boolean;
  readonly codexEnabled: boolean;
  readonly opencodeEnabled: boolean;
}

interface CodexHookEntry { readonly matcher?: unknown; readonly hooks?: unknown }
interface CodexConfig { readonly hooks?: unknown; readonly [key: string]: unknown }

export class SecurityHooksInstaller {
  static readonly runtimeFiles = [
    "security-policy.js",
    "codex-hook-adapter.js",
    "opencode-v1-hook-adapter.js",
    "opencode-v2-hook-adapter.js",
    "codex-hook-runtime.js",
    "opencode-plugin.js"
  ] as const;

  constructor(private readonly sourceRoot: string) {}

  private codexAssetDirectory(): string {
    return path.join(getCodexHome(), "hooks", "nix-ai-security");
  }

  private opencodeAssetDirectory(): string {
    return path.join(getOpenCodePluginsDirectory(), "nix-ai-security");
  }

  private codexCommand(): string {
    const runtime = path.join(this.codexAssetDirectory(), "codex-hook-runtime.js");
    return `node "${runtime.replace(/"/g, '\\"')}"`;
  }

  async preview(_projectRoot: string): Promise<SecurityHooksPlan> {
    const codexPath = getCodexHooksPath();
    const opencodePath = this.opencodeAssetDirectory();
    const targets = { codex: codexPath, opencode: opencodePath, shells: ["PowerShell", "cmd.exe", "Git Bash/MSYS"] };
    try {
      const assets = await this.readRuntimeAssets();
      const command = this.codexCommand();
      const config = await readCodexConfig(codexPath);
      const existingCodex = findManagedCodexEntry(config, command);
      const codexAssets = await readExistingAssets(this.codexAssetDirectory());
      const opencodeAssets = await readExistingAssets(opencodePath);
      if (codexAssets.size > 0 && !isCompatibleAssetSubset(codexAssets, assets)) {
        return { action: "conflict", targets, reason: "Existing Nix security hook assets differ from this build." };
      }
      if (opencodeAssets.size > 0 && !isCompatibleAssetSubset(opencodeAssets, assets)) {
        return { action: "conflict", targets, reason: "The global Nix OpenCode plugin target contains unowned or modified files." };
      }
      if (existingCodex && sameAssetSet(codexAssets, assets) && sameAssetSet(opencodeAssets, assets)) {
        return { action: "already-current", targets };
      }
      return { action: "install", targets };
    } catch (error) {
      return { action: "conflict", targets, reason: error instanceof Error ? error.message : String(error) };
    }
  }

  async status(_projectRoot: string): Promise<SecurityHooksStatus> {
    const command = this.codexCommand();
    const codexConfig = await readCodexConfig(getCodexHooksPath()).catch(() => undefined);
    const codexEnabled = codexConfig !== undefined && findManagedCodexEntry(codexConfig, command) !== undefined
      && await directoryHasFiles(this.codexAssetDirectory(), SecurityHooksInstaller.runtimeFiles);
    const opencodeEnabled = await directoryHasFiles(this.opencodeAssetDirectory(), ["opencode-plugin.js"]);
    return { enabled: codexEnabled && opencodeEnabled, codexEnabled, opencodeEnabled };
  }

  async install(_projectRoot: string): Promise<{ readonly action: "installed" | "already-current" }> {
    const plan = await this.preview(_projectRoot);
    if (plan.action === "conflict") throw new Error(`Security hooks install conflict: ${plan.reason ?? "unknown conflict"}`);
    if (plan.action === "already-current") return { action: "already-current" };
    const assets = await this.readRuntimeAssets();
    const configPath = getCodexHooksPath();
    const command = this.codexCommand();
    const config = await readCodexConfig(configPath);
    const nextConfig = addManagedCodexEntry(config, command);
    await ensureSafeDirectoryAbsolute(this.codexAssetDirectory());
    await ensureSafeDirectoryAbsolute(this.opencodeAssetDirectory());
    await writeAssetSet(this.codexAssetDirectory(), assets);
    await writeAssetSet(this.opencodeAssetDirectory(), assets);
    await writeJsonAtomically(configPath, nextConfig);
    return { action: "installed" };
  }

  async uninstall(_projectRoot: string): Promise<void> {
    const configPath = getCodexHooksPath();
    const config = await readCodexConfig(configPath);
    const assets = await this.readRuntimeAssets();
    const command = this.codexCommand();
    await ensureSafeDirectoryAbsolute(this.codexAssetDirectory(), false);
    await ensureSafeDirectoryAbsolute(this.opencodeAssetDirectory(), false);
    await preflightAssetRemoval(this.codexAssetDirectory(), assets);
    await preflightAssetRemoval(this.opencodeAssetDirectory(), assets);
    const entry = findManagedCodexEntry(config, command);
    if (entry) await writeJsonAtomically(configPath, removeManagedCodexEntry(config, command));
    await removeMatchingAssetSet(this.codexAssetDirectory(), assets);
    await removeMatchingAssetSet(this.opencodeAssetDirectory(), assets);
  }

  private async readRuntimeAssets(): Promise<ReadonlyMap<string, Buffer>> {
    const directory = path.join(this.sourceRoot, "dist", "core", "security");
    const entries = await Promise.all(SecurityHooksInstaller.runtimeFiles.map(async (name) => {
      const source = path.join(directory, name);
      const info = await lstat(source);
      if (!info.isFile()) throw new Error(`Security hook runtime asset is not a regular file: ${name}`);
      return [name, await readFile(source)] as const;
    }));
    return new Map(entries);
  }
}

async function readCodexConfig(configPath: string): Promise<CodexConfig> {
  try {
    const content = await readFile(configPath, "utf8");
    const value: unknown = JSON.parse(content);
    if (!isRecord(value) || (value.hooks !== undefined && !isRecord(value.hooks))) throw new Error("Codex hooks.json has an unsupported structure; preserving it without changes.");
    return value as CodexConfig;
  } catch (error) {
    if (isMissing(error)) return {};
    if (error instanceof SyntaxError) throw new Error("Codex hooks.json is malformed JSON; preserving it without changes.");
    throw error;
  }
}

function findManagedCodexEntry(config: CodexConfig, command: string): CodexHookEntry | undefined {
  if (!isRecord(config.hooks)) return undefined;
  const entries = config.hooks.PreToolUse;
  if (!Array.isArray(entries)) return undefined;
  return entries.find((entry) => isRecord(entry) && entry.matcher === CODEX_MATCHER
    && Array.isArray(entry.hooks) && entry.hooks.some((hook) => isRecord(hook) && hook.command === command)) as CodexHookEntry | undefined;
}

function addManagedCodexEntry(config: CodexConfig, command: string): CodexConfig {
  const hooks = isRecord(config.hooks) ? { ...config.hooks } : {};
  const entries = Array.isArray(hooks.PreToolUse) ? [...hooks.PreToolUse] : [];
  if (!findManagedCodexEntry(config, command)) entries.push({ matcher: CODEX_MATCHER, hooks: [{ type: "command", command }] });
  hooks.PreToolUse = entries;
  return { ...config, hooks };
}

function removeManagedCodexEntry(config: CodexConfig, command: string): CodexConfig {
  if (!isRecord(config.hooks) || !Array.isArray(config.hooks.PreToolUse)) return config;
  const entries = config.hooks.PreToolUse.filter((entry) => !(isRecord(entry) && entry.matcher === CODEX_MATCHER
    && Array.isArray(entry.hooks) && entry.hooks.some((hook) => isRecord(hook) && hook.command === command)));
  const hooks: Record<string, unknown> = { ...config.hooks, PreToolUse: entries };
  if (entries.length === 0) delete hooks.PreToolUse;
  if (Object.keys(hooks).length === 0) {
    const { hooks: _ignored, ...rest } = config;
    return rest;
  }
  return { ...config, hooks };
}

async function writeAssetSet(directory: string, assets: ReadonlyMap<string, Buffer>): Promise<void> {
  await mkdir(directory, { recursive: true });
  for (const [name, contents] of assets) await writeFile(path.join(directory, name), contents);
}

async function readExistingAssets(directory: string): Promise<ReadonlyMap<string, Buffer>> {
  let entries: string[];
  try { entries = await readdir(directory); } catch (error) { if (isMissing(error)) return new Map(); throw error; }
  const result = new Map<string, Buffer>();
  for (const name of entries) {
    const filePath = path.join(directory, name);
    const info = await lstat(filePath);
    if (!info.isFile()) throw new Error(`Security hook target contains a non-file entry: ${name}`);
    result.set(name, await readFile(filePath));
  }
  return result;
}

function sameAssetSet(existing: ReadonlyMap<string, Buffer>, expected: ReadonlyMap<string, Buffer>): boolean {
  return existing.size === expected.size && [...expected].every(([name, contents]) => {
    const actual = existing.get(name);
    return actual !== undefined && actual.equals(contents);
  });
}

function isCompatibleAssetSubset(existing: ReadonlyMap<string, Buffer>, expected: ReadonlyMap<string, Buffer>): boolean {
  return [...existing].every(([name, contents]) => expected.get(name)?.equals(contents) === true);
}

async function removeMatchingAssetSet(directory: string, expected: ReadonlyMap<string, Buffer>): Promise<void> {
  let entries: string[];
  try { entries = await readdir(directory); } catch (error) { if (isMissing(error)) return; throw error; }
  for (const name of expected.keys()) {
    if (!entries.includes(name)) continue;
    await rm(path.join(directory, name));
  }
  const parent = path.dirname(directory);
  try { if ((await readdir(directory)).length === 0) await rm(directory, { recursive: false }); } catch (error) { if (!isMissing(error)) throw error; }
  try { if ((await readdir(parent)).length === 0) await rm(parent, { recursive: false }); } catch (error) { if (!isMissing(error)) throw error; }
}

async function preflightAssetRemoval(directory: string, expected: ReadonlyMap<string, Buffer>): Promise<void> {
  let entries: string[];
  try { entries = await readdir(directory); } catch (error) { if (isMissing(error)) return; throw error; }
  for (const name of expected.keys()) {
    if (!entries.includes(name)) continue;
    const expectedContent = expected.get(name);
    const info = await lstat(path.join(directory, name));
    if (!info.isFile() || expectedContent === undefined || !(await readFile(path.join(directory, name))).equals(expectedContent)) {
      throw new Error(`Refusing to remove modified security hook file ${name}.`);
    }
  }
}

async function ensureSafeDirectoryAbsolute(directory: string, createMissing = true): Promise<void> {
  const absolute = path.resolve(directory);
  const { root } = path.parse(absolute);
  let current = root;
  await assertRealDirectory(current, directory);

  for (const segment of path.relative(root, absolute).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      const info = await lstat(current);
      if (!info.isDirectory() || info.isSymbolicLink()) {
        throw new Error(`Refusing a non-directory or symlink in global security hook target: ${directory}`);
      }
    } catch (error) {
      if (!isMissing(error) || !createMissing) {
        if (isMissing(error) && !createMissing) return;
        throw error;
      }
      try {
        await mkdir(current);
      } catch (mkdirError) {
        if (!isExists(mkdirError)) throw mkdirError;
      }
      await assertRealDirectory(current, directory);
    }
  }
}

async function assertRealDirectory(current: string, target: string): Promise<void> {
  const info = await lstat(current);
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error(`Refusing a non-directory or symlink in global security hook target: ${target}`);
  }
}

async function directoryHasFiles(directory: string, names: ReadonlyArray<string>): Promise<boolean> {
  try { const entries = await readdir(directory); return names.every((name) => entries.includes(name)); }
  catch (error) { if (isMissing(error)) return false; throw error; }
}

async function writeJsonAtomically(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function isMissing(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT"; }
function isExists(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && (error as NodeJS.ErrnoException).code === "EEXIST"; }
