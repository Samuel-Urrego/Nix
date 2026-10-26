import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rmdir,
  unlink,
  writeFile
} from "node:fs/promises";
import path from "node:path";

import { getCodexUserSkillsDirectory, getComponentBackupsDirectory } from "../config/global-paths.js";
import { componentCatalog, type ComponentFile, type ComponentManifest } from "./component-catalog.js";
import type {
  AgentAdapter,
  ComponentBackup,
  ComponentInstaller,
  LifecycleOperation,
  LifecyclePlan,
  LifecycleResult
} from "../contracts/component-lifecycle.js";

const OWNER_FILE = ".nix-ai-managed.json";
const backupIdPattern = /^\d{8}T\d{6}Z-[0-9a-f-]{36}$/;

interface FileDigest {
  readonly path: string;
  readonly sha256: string;
}

interface OwnerRecord {
  readonly schemaVersion: 1;
  readonly componentId: string;
  readonly version: string;
  readonly files: ReadonlyArray<FileDigest>;
}

interface BackupRecord {
  readonly schemaVersion: 1;
  readonly backupId: string;
  readonly componentId: string;
  readonly version: string;
  readonly targetRelativePath: string;
  readonly createdAt: string;
  readonly files: ReadonlyArray<FileDigest>;
}

interface Snapshot {
  readonly owner: OwnerRecord;
  readonly files: ReadonlyMap<string, Buffer>;
}

interface TreeEntry {
  readonly path: string;
  readonly kind: "file" | "directory";
}

export class ComponentLifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComponentLifecycleError";
  }
}

export class CodexSkillAdapter implements AgentAdapter, ComponentInstaller {
  readonly agentId = "codex";

  constructor(
    private readonly sourceRoot: string,
    private readonly catalog: ReadonlyArray<ComponentManifest> = componentCatalog
  ) {}

  supports(component: ComponentManifest): boolean {
    return component.kind === "skill" && component.agentTargets.includes("codex");
  }

  targetPath(_projectRoot: string, component: ComponentManifest): string {
    validateManifest(component);
    return resolveWithin(this.targetRoot(), targetRelative(component));
  }

  private targetRoot(): string {
    return getCodexUserSkillsDirectory();
  }

  private backupRoot(): string {
    return getComponentBackupsDirectory();
  }

  async preview(
    _projectRoot: string,
    componentId: string,
    operation: LifecycleOperation = "install",
    backupId?: string
  ): Promise<LifecyclePlan> {
    const component = this.requireComponent(componentId);
    const root = await inspectSafeRoot(this.targetRoot());
    const targetPath = this.targetPath(root, component);
    if (!this.supports(component)) return { componentId, operation, action: "conflict", targetPath, reason: "Component is not supported by the Codex adapter" };

    if (operation === "restore") {
      if (!backupId) return { componentId, operation, action: "conflict", targetPath, reason: "A backup ID is required for restore" };
      try {
        await this.readBackup(component, backupId);
        await assertSafePath(root, targetRelative(component));
        const existing = await lstatOrMissing(targetPath);
        return existing
          ? { componentId, operation, action: "conflict", targetPath, reason: "Restore refuses to overwrite an existing destination" }
          : { componentId, operation, action: "restore", targetPath };
      } catch (error) {
        return { componentId, operation, action: "conflict", targetPath, reason: errorMessage(error) };
      }
    }

    let current: Snapshot | undefined;
    try {
      await assertSafePath(root, targetRelative(component));
      current = await this.readOwnedTarget(root, component);
    } catch (error) {
      if (!isMissing(error)) return { componentId, operation, action: "conflict", targetPath, reason: errorMessage(error) };
    }

    if (!current) {
      return operation === "install"
        ? { componentId, operation, action: "install", targetPath }
        : { componentId, operation, action: "not-installed", targetPath };
    }

    if (operation === "uninstall" || operation === "backup") return { componentId, operation, action: operation, targetPath };

    const source = await this.readSourceFiles(component);
    const versionOrder = compareVersions(component.version, current.owner.version);
    const contentMatches = sameDigests(source.map(({ path: filePath, sha256 }) => ({ path: filePath, sha256 })), current.owner.files);
    if (versionOrder === 0 && contentMatches) return { componentId, operation, action: "already-current", targetPath };
    if (versionOrder <= 0) return { componentId, operation, action: "conflict", targetPath, reason: "Installed content differs or is newer; refusing a same-version replacement or downgrade" };
    return operation === "update" || operation === "install"
      ? { componentId, operation, action: "update", targetPath }
      : { componentId, operation, action: "conflict", targetPath, reason: `Unsupported operation: ${operation}` };
  }

  async install(projectRoot: string, componentId: string): Promise<LifecycleResult> {
    const component = this.requireComponent(componentId);
    const plan = await this.preview(projectRoot, componentId, "install");
    if (plan.action === "already-current") return result(componentId, "already-current", plan.targetPath);
    if (plan.action === "update") return this.update(projectRoot, componentId);
    this.requirePlan(plan, "install");
    const root = await ensureSafeRoot(this.targetRoot());
    const files = await this.readSourceFiles(component);
    const owner = makeOwner(component, files);
    await this.writeTarget(root, component, owner, files);
    return result(componentId, "installed", plan.targetPath);
  }

  async update(projectRoot: string, componentId: string): Promise<LifecycleResult> {
    const component = this.requireComponent(componentId);
    const plan = await this.preview(projectRoot, componentId, "update");
    if (plan.action === "already-current") return result(componentId, "already-current", plan.targetPath);
    this.requirePlan(plan, "update");
    const root = await ensureSafeRoot(this.targetRoot());
    const previous = await this.readOwnedTarget(root, component);
    const backup = await this.createBackup(component, previous);
    await this.removeOwnedTarget(root, component, previous);
    try {
      const files = await this.readSourceFiles(component);
      await this.writeTarget(root, component, makeOwner(component, files), files);
    } catch (error) {
      try {
        await this.writeTarget(root, component, previous.owner, [...previous.files].map(([filePath, content]) => ({ path: filePath, content, sha256: hash(content) })));
      } catch (restoreError) {
        throw new ComponentLifecycleError(`Update failed; recovery backup ${backup.backupId} is available. Automatic restore failed: ${errorMessage(restoreError)}`);
      }
      throw new ComponentLifecycleError(`Update failed; prior version was restored from backup ${backup.backupId}: ${errorMessage(error)}`);
    }
    return { ...result(componentId, "updated", plan.targetPath), backupId: backup.backupId };
  }

  async backup(projectRoot: string, componentId: string): Promise<LifecycleResult> {
    const component = this.requireComponent(componentId);
    const plan = await this.preview(projectRoot, componentId, "backup");
    this.requirePlan(plan, "backup");
    const root = await ensureSafeRoot(this.targetRoot());
    const snapshot = await this.readOwnedTarget(root, component);
    const backup = await this.createBackup(component, snapshot);
    return { ...result(componentId, "backed-up", plan.targetPath), backupId: backup.backupId };
  }

  async listBackups(_projectRoot: string, componentId: string): Promise<ReadonlyArray<ComponentBackup>> {
    const component = this.requireComponent(componentId);
    const root = await inspectSafeRoot(this.backupRoot());
    if (!(await lstatOrMissing(root))) return [];
    const relative = component.id;
    await assertSafePath(root, relative);
    const directory = resolveWithin(root, relative);
    const metadata = await lstatOrMissing(directory);
    if (!metadata) return [];
    if (!metadata.isDirectory()) throw new ComponentLifecycleError("Backup path is not a directory");
    const entries = await readdir(directory, { withFileTypes: true });
    const backups: ComponentBackup[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) throw new ComponentLifecycleError("Unexpected file in component backup directory");
      const backup = await this.readBackup(component, entry.name);
      backups.push({ backupId: backup.record.backupId, componentId: backup.record.componentId, version: backup.record.version, createdAt: backup.record.createdAt });
    }
    return backups.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async restore(projectRoot: string, componentId: string, backupId: string): Promise<LifecycleResult> {
    const component = this.requireComponent(componentId);
    const plan = await this.preview(projectRoot, componentId, "restore", backupId);
    this.requirePlan(plan, "restore");
    const root = await ensureSafeRoot(this.targetRoot());
    const snapshot = await this.readBackup(component, backupId);
    const owner = makeOwner(component, [...snapshot.files].map(([filePath, content]) => ({ path: filePath, content, sha256: hash(content) })), snapshot.record.version);
    const files = [...snapshot.files].map(([filePath, content]) => ({ path: filePath, content, sha256: hash(content) }));
    await this.writeTarget(root, component, owner, files);
    return result(componentId, "restored", plan.targetPath);
  }

  async uninstall(projectRoot: string, componentId: string): Promise<LifecycleResult> {
    const component = this.requireComponent(componentId);
    const plan = await this.preview(projectRoot, componentId, "uninstall");
    this.requirePlan(plan, "uninstall");
    const root = await ensureSafeRoot(this.targetRoot());
    const snapshot = await this.readOwnedTarget(root, component);
    const backup = await this.createBackup(component, snapshot);
    await this.removeOwnedTarget(root, component, snapshot);
    return { ...result(componentId, "uninstalled", plan.targetPath), backupId: backup.backupId };
  }

  private requireComponent(componentId: string): ComponentManifest {
    const component = this.catalog.find((entry) => entry.id === componentId);
    if (!component) throw new ComponentLifecycleError(`Unknown component: ${componentId}`);
    validateManifest(component);
    if (!this.supports(component)) throw new ComponentLifecycleError(`Component ${componentId} is not supported by Codex`);
    return component;
  }

  private requirePlan(plan: LifecyclePlan, expected: LifecyclePlan["action"]): void {
    if (plan.action !== expected) throw new ComponentLifecycleError(plan.reason ?? `Cannot ${expected} ${plan.componentId}: plan is ${plan.action}`);
  }

  private async readSourceFiles(component: ComponentManifest): Promise<ReadonlyArray<{ readonly path: string; readonly content: Buffer; readonly sha256: string }>> {
    const seen = new Set<string>();
    const files: Array<{ path: string; content: Buffer; sha256: string }> = [];
    for (const file of component.files) {
      validateFile(file);
      if (file.targetPath === OWNER_FILE || seen.has(file.targetPath)) throw new ComponentLifecycleError(`Duplicate or reserved target file: ${file.targetPath}`);
      seen.add(file.targetPath);
      const source = resolveWithin(this.sourceRoot, file.sourcePath);
      await assertSafePath(this.sourceRoot, file.sourcePath);
      const metadata = await lstat(source);
      if (!metadata.isFile()) throw new ComponentLifecycleError(`Component source is not a regular file: ${file.sourcePath}`);
      const content = await readFile(source);
      files.push({ path: file.targetPath, content, sha256: hash(content) });
    }
    if (files.length === 0) throw new ComponentLifecycleError(`Component ${component.id} has no files`);
    return files.sort((left, right) => left.path.localeCompare(right.path));
  }

  private async readOwnedTarget(projectRoot: string, component: ComponentManifest): Promise<Snapshot> {
    const relativeTarget = targetRelative(component);
    await assertSafePath(projectRoot, relativeTarget);
    const target = resolveWithin(projectRoot, relativeTarget);
    const targetMetadata = await lstat(target);
    if (!targetMetadata.isDirectory()) throw new ComponentLifecycleError("Component destination is not a directory");
    const tree = await walkTree(target);
    const filePaths = tree.filter((entry) => entry.kind === "file").map((entry) => entry.path).sort();
    if (!filePaths.includes(OWNER_FILE)) throw new ComponentLifecycleError("Component destination is unowned; refusing to change it");
    const ownerContent = await readFile(path.join(target, OWNER_FILE), "utf8");
    const owner = parseOwner(ownerContent, component.id);
    const expectedFiles = owner.files.map((file) => file.path).sort();
    if (new Set(expectedFiles).size !== expectedFiles.length || expectedFiles.includes(OWNER_FILE)) throw new ComponentLifecycleError("Ownership record contains duplicate or reserved file paths");
    const expectedAllFiles = [...expectedFiles, OWNER_FILE].sort();
    if (!sameStrings(filePaths, expectedAllFiles)) throw new ComponentLifecycleError("Managed directory contents differ from the ownership record; refusing to change user data");
    const expectedDirectories = parentDirectories(expectedAllFiles).sort();
    const actualDirectories = tree.filter((entry) => entry.kind === "directory").map((entry) => entry.path).sort();
    if (!sameStrings(actualDirectories, expectedDirectories)) throw new ComponentLifecycleError("Managed directory structure differs from the ownership record; refusing to change user data");

    const files = new Map<string, Buffer>();
    for (const file of owner.files) {
      validateFile({ sourcePath: file.path, targetPath: file.path });
      const content = await readFile(resolveWithin(target, file.path));
      if (hash(content) !== file.sha256) throw new ComponentLifecycleError(`Managed file was modified: ${file.path}`);
      files.set(file.path, content);
    }
    return { owner, files };
  }

  private async writeTarget(
    projectRoot: string,
    component: ComponentManifest,
    owner: OwnerRecord,
    files: ReadonlyArray<{ readonly path: string; readonly content: Buffer; readonly sha256: string }>
  ): Promise<void> {
    const relativeTarget = targetRelative(component);
    const relativeParent = path.posix.dirname(relativeTarget);
    if (relativeParent !== ".") await ensureDirectoryTree(projectRoot, relativeParent);
    const target = resolveWithin(projectRoot, relativeTarget);
    try {
      await mkdir(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new ComponentLifecycleError("Component destination already exists; refusing to overwrite it");
      throw error;
    }

    const createdFiles: string[] = [];
    const createdDirectories: string[] = [];
    try {
      for (const file of files) {
        const directory = path.posix.dirname(file.path);
        if (directory !== ".") await ensureDirectoryTree(target, directory, createdDirectories);
        const filePath = resolveWithin(target, file.path);
        await writeFile(filePath, file.content, { flag: "wx" });
        createdFiles.push(filePath);
      }
      await writeFile(path.join(target, OWNER_FILE), `${JSON.stringify(owner, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
      createdFiles.push(path.join(target, OWNER_FILE));
    } catch (error) {
      await cleanupCreated(target, createdFiles, createdDirectories);
      throw error;
    }
  }

  private async removeOwnedTarget(projectRoot: string, component: ComponentManifest, expected: Snapshot): Promise<void> {
    const fresh = await this.readOwnedTarget(projectRoot, component);
    if (fresh.owner.version !== expected.owner.version || !sameDigests(fresh.owner.files, expected.owner.files)) {
      throw new ComponentLifecycleError("Managed component changed during the operation; refusing to remove it");
    }
    const target = resolveWithin(projectRoot, targetRelative(component));
    const filePaths = [...expected.files.keys()].map((filePath) => resolveWithin(target, filePath)).concat(path.join(target, OWNER_FILE));
    const removed: Array<{ readonly path: string; readonly content: Buffer }> = [];
    try {
      for (const filePath of filePaths) {
        const relative = path.relative(target, filePath).split(path.sep).join("/");
        const content = relative === OWNER_FILE ? Buffer.from(`${JSON.stringify(expected.owner, null, 2)}\n`) : expected.files.get(relative);
        if (!content) throw new ComponentLifecycleError(`Missing owned file content for ${relative}`);
        await unlink(filePath);
        removed.push({ path: relative, content });
      }
      const directories = parentDirectories([...expected.files.keys(), OWNER_FILE]).sort((left, right) => right.length - left.length);
      for (const directory of directories) await rmdir(resolveWithin(target, directory));
      await rmdir(target);
    } catch (error) {
      await this.restoreRemovedFiles(target, removed, expected.owner);
      throw new ComponentLifecycleError(`Could not remove the complete Nix-owned directory; user content was preserved: ${errorMessage(error)}`);
    }
  }

  private async restoreRemovedFiles(target: string, removed: ReadonlyArray<{ readonly path: string; readonly content: Buffer }>, owner: OwnerRecord): Promise<void> {
    try {
      for (const file of removed) {
        const directory = path.posix.dirname(file.path);
        if (directory !== ".") await ensureDirectoryTree(target, directory);
        await writeFile(resolveWithin(target, file.path), file.content, { flag: "wx" });
      }
      if (!removed.some((file) => file.path === OWNER_FILE)) {
        await writeFile(path.join(target, OWNER_FILE), `${JSON.stringify(owner, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
      }
    } catch {
      // The recovery backup remains available; never overwrite content that appeared during rollback.
    }
  }

  private async createBackup(component: ComponentManifest, snapshot: Snapshot): Promise<ComponentBackup> {
    const backupId = `${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "").replace("Z", "Z")}-${randomUUID()}`;
    const root = await ensureSafeRoot(this.backupRoot());
    const relativeParent = component.id;
    await ensureDirectoryTree(root, relativeParent);
    const backupDirectory = resolveWithin(root, `${relativeParent}/${backupId}`);
    await mkdir(backupDirectory);
    const payload = path.join(backupDirectory, "payload");
    await mkdir(payload);
    try {
      for (const [filePath, content] of snapshot.files) {
        const directory = path.posix.dirname(filePath);
        if (directory !== ".") await ensureDirectoryTree(payload, directory);
        await writeFile(resolveWithin(payload, filePath), content, { flag: "wx" });
      }
      const createdAt = new Date().toISOString();
      const record: BackupRecord = {
        schemaVersion: 1,
        backupId,
        componentId: component.id,
        version: snapshot.owner.version,
        targetRelativePath: component.installRelativePath,
        createdAt,
        files: snapshot.owner.files
      };
      await writeFile(path.join(backupDirectory, "backup.json"), `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
      return { backupId, componentId: component.id, version: record.version, createdAt };
    } catch (error) {
      // This directory is uniquely created by this operation; removing only it cannot touch an existing backup.
      await import("node:fs/promises").then(({ rm }) => rm(backupDirectory, { recursive: true, force: true }));
      throw error;
    }
  }

  private async readBackup(component: ComponentManifest, backupId: string): Promise<{ readonly record: BackupRecord; readonly files: ReadonlyMap<string, Buffer> }> {
    if (!backupIdPattern.test(backupId)) throw new ComponentLifecycleError("Invalid backup ID");
    const root = await inspectSafeRoot(this.backupRoot());
    const relative = `${component.id}/${backupId}`;
    await assertSafePath(root, relative);
    const directory = resolveWithin(root, relative);
    const tree = await walkTree(directory);
    const metadataPath = path.join(directory, "backup.json");
    const metadataExists = tree.some((entry) => entry.kind === "file" && entry.path === "backup.json");
    if (!metadataExists) throw new ComponentLifecycleError("Backup metadata is missing");
    const record = parseBackup(await readFile(metadataPath, "utf8"), component, backupId);
    const expectedPayloadFiles = record.files.map((file) => `payload/${file.path}`).sort();
    const actualFiles = tree.filter((entry) => entry.kind === "file").map((entry) => entry.path).filter((entry) => entry !== "backup.json").sort();
    if (!sameStrings(actualFiles, expectedPayloadFiles)) throw new ComponentLifecycleError("Backup contents are invalid or include unexpected files");
    const expectedDirs = parentDirectories(["backup.json", ...expectedPayloadFiles]).sort();
    const actualDirs = tree.filter((entry) => entry.kind === "directory").map((entry) => entry.path).sort();
    if (!sameStrings(actualDirs, expectedDirs)) throw new ComponentLifecycleError("Backup directory structure is invalid");
    const files = new Map<string, Buffer>();
    for (const file of record.files) {
      validateFile({ sourcePath: file.path, targetPath: file.path });
      const content = await readFile(resolveWithin(directory, `payload/${file.path}`));
      if (hash(content) !== file.sha256) throw new ComponentLifecycleError(`Backup digest mismatch for ${file.path}`);
      files.set(file.path, content);
    }
    return { record, files };
  }
}

function result(componentId: string, action: LifecycleResult["action"], targetPath: string): LifecycleResult {
  return { componentId, action, targetPath };
}

function targetRelative(component: ComponentManifest): string {
  return path.posix.basename(component.installRelativePath);
}

function validateManifest(component: ComponentManifest): void {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(component.id)) throw new ComponentLifecycleError("Invalid component ID");
  if (!component.version || !/^\d+\.\d+\.\d+$/.test(component.version)) throw new ComponentLifecycleError(`Invalid component version: ${component.version}`);
  if (!component.agentTargets.includes("codex")) throw new ComponentLifecycleError("Component does not target Codex");
  assertSafeRelativePath(component.installRelativePath, "install path");
  assertSafeRelativePath(component.source.relativePath, "source path");
  for (const file of component.files) validateFile(file);
}

function validateFile(file: ComponentFile): void {
  assertSafeRelativePath(file.sourcePath, "source file path");
  assertSafeRelativePath(file.targetPath, "target file path");
}

function assertSafeRelativePath(relativePath: string, label: string): void {
  const segments = relativePath.split("/");
  if (!relativePath || relativePath.includes("\\") || relativePath.startsWith("/") || /^[a-zA-Z]:/.test(relativePath) || segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new ComponentLifecycleError(`Unsafe relative ${label}: ${relativePath}`);
  }
}

function resolveWithin(root: string, relativePath: string): string {
  assertSafeRelativePath(relativePath, "path");
  const absoluteRoot = path.resolve(root);
  const target = path.resolve(absoluteRoot, ...relativePath.split("/"));
  const relative = path.relative(absoluteRoot, target);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    if (!relative) throw new ComponentLifecycleError("A component path cannot target the project root");
    throw new ComponentLifecycleError(`Path escapes its allowed root: ${relativePath}`);
  }
  return target;
}

async function inspectSafeRoot(rootPath: string): Promise<string> {
  const root = path.resolve(rootPath);
  const metadata = await lstatOrMissing(root);
  if (metadata && (metadata.isSymbolicLink() || !metadata.isDirectory())) {
    throw new ComponentLifecycleError("Global target root must be a real directory, not a symlink");
  }
  return root;
}

async function ensureSafeRoot(rootPath: string): Promise<string> {
  const root = path.resolve(rootPath);
  await mkdir(root, { recursive: true });
  const metadata = await lstat(root);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) throw new ComponentLifecycleError("Global target root must be a real directory, not a symlink");
  return root;
}

async function assertSafePath(root: string, relativePath: string): Promise<void> {
  assertSafeRelativePath(relativePath, "path");
  const rootInfo = await lstat(root);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) throw new ComponentLifecycleError("Operation root must be a real directory");
  let current = root;
  for (const segment of relativePath.split("/")) {
    current = path.join(current, segment);
    const metadata = await lstatOrMissing(current);
    if (!metadata) return;
    if (metadata.isSymbolicLink()) throw new ComponentLifecycleError(`Refusing to follow symlink: ${current}`);
  }
}

async function ensureDirectoryTree(root: string, relativePath: string, createdDirectories: string[] = []): Promise<void> {
  const rootInfo = await lstat(root);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) throw new ComponentLifecycleError("Directory root must be a real directory");
  assertSafeRelativePath(relativePath, "directory path");
  let current = root;
  for (const segment of relativePath.split("/")) {
    current = path.join(current, segment);
    let metadata = await lstatOrMissing(current);
    if (!metadata) {
      try {
        await mkdir(current);
        createdDirectories.push(current);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      metadata = await lstat(current);
    }
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) throw new ComponentLifecycleError(`Expected a real directory at ${current}`);
  }
}

async function cleanupCreated(root: string, files: ReadonlyArray<string>, directories: ReadonlyArray<string>): Promise<void> {
  for (const file of [...files].reverse()) await unlink(file).catch(() => undefined);
  for (const directory of [...directories].reverse()) await rmdir(directory).catch(() => undefined);
  await rmdir(root).catch(() => undefined);
}

async function walkTree(root: string, relative = ""): Promise<ReadonlyArray<TreeEntry>> {
  const metadata = await lstat(root);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) throw new ComponentLifecycleError(`Expected a real directory at ${root}`);
  const entries: TreeEntry[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const relativePath = relative ? `${relative}/${entry.name}` : entry.name;
    const fullPath = path.join(root, entry.name);
    const info = await lstat(fullPath);
    if (info.isSymbolicLink()) throw new ComponentLifecycleError(`Refusing to follow symlink: ${fullPath}`);
    if (info.isDirectory()) {
      entries.push({ path: relativePath, kind: "directory" });
      entries.push(...await walkTree(fullPath, relativePath));
    } else if (info.isFile()) {
      entries.push({ path: relativePath, kind: "file" });
    } else {
      throw new ComponentLifecycleError(`Unsupported file type: ${fullPath}`);
    }
  }
  return entries;
}

function parseOwner(raw: string, expectedComponent: string): OwnerRecord {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new ComponentLifecycleError("Ownership record is invalid JSON"); }
  if (!isRecord(value) || value.schemaVersion !== 1 || value.componentId !== expectedComponent || typeof value.version !== "string" || !Array.isArray(value.files)) {
    throw new ComponentLifecycleError("Ownership record is invalid or belongs to another component");
  }
  const files = value.files.map(parseDigest);
  return { schemaVersion: 1, componentId: expectedComponent, version: value.version, files };
}

function parseBackup(raw: string, component: ComponentManifest, expectedBackupId: string): BackupRecord {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new ComponentLifecycleError("Backup metadata is invalid JSON"); }
  if (!isRecord(value) || value.schemaVersion !== 1 || value.backupId !== expectedBackupId || value.componentId !== component.id || value.targetRelativePath !== component.installRelativePath || typeof value.version !== "string" || typeof value.createdAt !== "string" || !Array.isArray(value.files)) {
    throw new ComponentLifecycleError("Backup metadata is invalid or does not match this component");
  }
  return {
    schemaVersion: 1,
    backupId: expectedBackupId,
    componentId: component.id,
    version: value.version,
    targetRelativePath: component.installRelativePath,
    createdAt: value.createdAt,
    files: value.files.map(parseDigest)
  };
}

function parseDigest(value: unknown): FileDigest {
  if (!isRecord(value) || typeof value.path !== "string" || typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.sha256)) {
    throw new ComponentLifecycleError("File digest record is invalid");
  }
  assertSafeRelativePath(value.path, "recorded file path");
  return { path: value.path, sha256: value.sha256 };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function lstatOrMissing(target: string) {
  try { return await lstat(target); } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
}

function isMissing(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === "ENOENT" || code === "ENOTDIR";
}

function makeOwner(
  component: ComponentManifest,
  files: ReadonlyArray<{ readonly path: string; readonly sha256: string }>,
  version = component.version
): OwnerRecord {
  return { schemaVersion: 1, componentId: component.id, version, files: files.map(({ path: filePath, sha256 }) => ({ path: filePath, sha256 })) };
}

function parentDirectories(files: ReadonlyArray<string>): string[] {
  const directories = new Set<string>();
  for (const file of files) {
    let parent = path.posix.dirname(file);
    while (parent !== ".") {
      directories.add(parent);
      parent = path.posix.dirname(parent);
    }
  }
  return [...directories];
}

function hash(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function sameStrings(left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameDigests(left: ReadonlyArray<FileDigest>, right: ReadonlyArray<FileDigest>): boolean {
  const normalize = (items: ReadonlyArray<FileDigest>) => items.map(({ path: filePath, sha256 }) => `${filePath}:${sha256}`).sort();
  return sameStrings(normalize(left), normalize(right));
}

function compareVersions(left: string, right: string): number {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (a[index]! > b[index]!) return 1;
    if (a[index]! < b[index]!) return -1;
  }
  return 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
