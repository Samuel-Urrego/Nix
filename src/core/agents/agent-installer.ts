import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { getCodexAgentsDirectory, getManagedAgentsPath, getOpenCodeAgentsDirectory } from "../config/global-paths.js";
import type { SpecialistAgentDefinition, SpecialistAgentPlan, SpecialistAgentState, SpecialistAgentStatus, SpecialistAgentTarget } from "./agent-contracts.js";

interface AgentRecord { readonly id: string; readonly agent: SpecialistAgentTarget; readonly version: string; readonly sha256: string; readonly installedAt: string }
interface AgentState { readonly schemaVersion: 1; readonly entries: Readonly<Record<string, AgentRecord>> }
export interface AgentInstallerOptions { readonly catalog?: ReadonlyArray<SpecialistAgentDefinition>; readonly now?: () => Date }
const emptyState: AgentState = { schemaVersion: 1, entries: {} };

export const managedAgentKey = (agent: SpecialistAgentTarget, id: string): string => `${agent}:${id}`;
export const managedAgentStatePath = (_root: string): string => getManagedAgentsPath();

function targetFor(agent: SpecialistAgentTarget, id: string): string {
  const directory = agent === "opencode" ? getOpenCodeAgentsDirectory() : getCodexAgentsDirectory();
  return path.join(directory, `${id}.${agent === "opencode" ? "md" : "toml"}`);
}

function validateDefinition(entry: SpecialistAgentDefinition): void {
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(entry.id)) throw new Error(`Invalid specialist agent id: ${entry.id}`);
  if (!entry.name.trim() || !entry.description.trim() || !entry.instructions.trim() || !entry.version.trim()) {
    throw new Error(`Specialist agent ${entry.id} is missing required metadata.`);
  }
  if (entry.supportedAgents.length === 0 || entry.supportedAgents.some((item) => item !== "opencode" && item !== "codex")) {
    throw new Error(`Specialist agent ${entry.id} has invalid supported agents.`);
  }
}

function findEntry(options: AgentInstallerOptions, id: string): SpecialistAgentDefinition {
  const matches = (options.catalog ?? []).filter((entry) => entry.id === id);
  if (matches.length !== 1) throw new Error(matches.length ? `Duplicate specialist agent id: ${id}` : `Unknown specialist agent: ${id}`);
  validateDefinition(matches[0]!);
  return matches[0]!;
}

function sha256(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function toml(value: string): string { return JSON.stringify(value); }

export function renderSpecialistAgent(entry: SpecialistAgentDefinition, agent: SpecialistAgentTarget): string {
  validateDefinition(entry);
  if (!entry.supportedAgents.includes(agent)) throw new Error(`${entry.name} is not compatible with ${agent}.`);
  if (agent === "codex") {
    return `# nix-ai:agent id=${entry.id}\nname = ${toml(entry.id)}\ndescription = ${toml(entry.description)}\ndeveloper_instructions = ${toml(entry.instructions)}\n`;
  }
  const description = entry.description.replace(/\n/g, " ").replace(/"/g, "\\\"");
  const mode = entry.mode ?? "subagent";
  return `---\ndescription: "${description}"\nmode: ${mode}\n---\n<!-- nix-ai:agent id=${entry.id} -->\n\n${entry.instructions.trimEnd()}\n`;
}

async function readState(): Promise<AgentState> {
  try {
    const value = JSON.parse(await readFile(getManagedAgentsPath(), "utf8")) as AgentState;
    if (value.schemaVersion !== 1 || !value.entries || typeof value.entries !== "object") throw new Error("Unsupported managed-agent state format.");
    return value;
  } catch (error) {
    if (isMissing(error)) return emptyState;
    throw error;
  }
}

function isMissing(error: unknown): boolean { return (error as NodeJS.ErrnoException).code === "ENOENT"; }
async function readTarget(file: string): Promise<string | undefined> {
  try {
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Refusing non-regular agent target: ${file}`);
    return await readFile(file, "utf8");
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
}

async function writeState(state: AgentState): Promise<void> {
  const file = getManagedAgentsPath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function recordMatches(content: string, record: AgentRecord): boolean { return sha256(content) === record.sha256; }

export async function previewSpecialistAgent(root: string, id: string, agent: SpecialistAgentTarget, options: AgentInstallerOptions = {}): Promise<SpecialistAgentPlan> {
  void root;
  const entry = findEntry(options, id);
  const targetPath = targetFor(agent, id);
  const base = { id, agent, targetPath, version: entry.version } as const;
  if (!entry.supportedAgents.includes(agent)) return { ...base, action: "incompatible", reason: `${entry.name} is not compatible with ${agent}.` };
  const [content, state] = await Promise.all([readTarget(targetPath), readState()]);
  const record = state.entries[managedAgentKey(agent, id)];
  if (content === undefined) return { ...base, action: record ? "update" : "install", ...(record ? { reason: "The ownership record exists but the installed agent file is missing." } : {}) };
  if (!record) return { ...base, action: "conflict", reason: "An existing agent file with this id is not managed by Nix." };
  if (!recordMatches(content, record)) return { ...base, action: "conflict", reason: "The Nix-managed agent was modified outside Nix; run agent:update to replace it." };
  if (record.version !== entry.version) return { ...base, action: "update" };
  return { ...base, action: "already-current" };
}

async function install(root: string, id: string, agent: SpecialistAgentTarget, options: AgentInstallerOptions): Promise<{ action: "installed" | "updated" | "already-current"; targetPath: string }> {
  const plan = await previewSpecialistAgent(root, id, agent, options);
  if (plan.action === "conflict" || plan.action === "incompatible") throw new Error(plan.reason);
  if (plan.action === "already-current") return { action: "already-current", targetPath: plan.targetPath };
  return writeManaged(root, findEntry(options, id), agent, plan.targetPath, plan.action === "update", options);
}

export function installSpecialistAgent(root: string, id: string, agent: SpecialistAgentTarget, options: AgentInstallerOptions = {}) {
  return install(root, id, agent, options);
}

export async function updateSpecialistAgent(root: string, id: string, agent: SpecialistAgentTarget, options: AgentInstallerOptions = {}): Promise<{ action: "updated"; targetPath: string; backupPath?: string }> {
  void root;
  const entry = findEntry(options, id);
  const targetPath = targetFor(agent, id);
  if (!entry.supportedAgents.includes(agent)) throw new Error(`${entry.name} is not compatible with ${agent}.`);
  const state = await readState();
  const key = managedAgentKey(agent, id);
  const record = state.entries[key];
  if (!record) throw new Error(`Specialist agent ${id} is not managed by Nix for ${agent}.`);
  const content = await readTarget(targetPath);
  if (content === undefined) throw new Error(`The Nix-managed agent ${id} is missing; refusing update because its installed hash cannot be verified.`);
  if (!recordMatches(content, record)) throw new Error(`The Nix-managed agent ${id} was modified outside Nix; refusing to replace it.`);
  const result = await writeManaged(root, entry, agent, targetPath, true, options);
  return { action: "updated", targetPath: result.targetPath, ...(result.backupPath ? { backupPath: result.backupPath } : {}) };
}

async function writeManaged(root: string, entry: SpecialistAgentDefinition, agent: SpecialistAgentTarget, targetPath: string, backup: boolean, options: AgentInstallerOptions): Promise<{ action: "installed" | "updated"; targetPath: string; backupPath?: string }> {
  void root;
  const state = await readState();
  const key = managedAgentKey(agent, entry.id);
  const previous = await readTarget(targetPath);
  const record = state.entries[key];
  if (previous !== undefined && (!record || !recordMatches(previous, record))) throw new Error(`Refusing to overwrite unowned or modified agent file: ${targetPath}`);
  const backupPath = backup && previous !== undefined ? `${targetPath}.bak-${Date.now()}` : undefined;
  if (backupPath) await writeFile(backupPath, previous!, { encoding: "utf8", flag: "wx" });
  await mkdir(path.dirname(targetPath), { recursive: true });
  const content = renderSpecialistAgent(entry, agent);
  await writeFile(targetPath, content, "utf8");
  const entries = { ...state.entries, [key]: { id: entry.id, agent, version: entry.version, sha256: sha256(content), installedAt: (options.now ?? (() => new Date()))().toISOString() } };
  await writeState({ schemaVersion: 1, entries });
  return { action: backup ? "updated" : "installed", targetPath, ...(backupPath ? { backupPath } : {}) };
}

export async function removeSpecialistAgent(root: string, id: string, agent: SpecialistAgentTarget, options: AgentInstallerOptions = {}): Promise<{ action: "removed"; targetPath: string }> {
  void root;
  findEntry(options, id);
  const targetPath = targetFor(agent, id);
  const state = await readState();
  const key = managedAgentKey(agent, id);
  const record = state.entries[key];
  if (!record) throw new Error(`Specialist agent ${id} is not managed by Nix for ${agent}.`);
  const content = await readTarget(targetPath);
  if (content !== undefined && !recordMatches(content, record)) throw new Error(`The Nix-managed agent ${id} was modified outside Nix; refusing to remove it.`);
  if (content !== undefined) await rm(targetPath);
  const entries = { ...state.entries };
  delete entries[key];
  await writeState({ schemaVersion: 1, entries });
  return { action: "removed", targetPath };
}

export async function getSpecialistAgentStatus(root: string, options: AgentInstallerOptions = {}): Promise<ReadonlyArray<SpecialistAgentStatus>> {
  const result: SpecialistAgentStatus[] = [];
  for (const entry of options.catalog ?? []) {
    validateDefinition(entry);
    for (const agent of entry.supportedAgents) {
      const targetPath = targetFor(agent, entry.id);
      const content = await readTarget(targetPath);
      const record = (await readState()).entries[managedAgentKey(agent, entry.id)];
      let state: SpecialistAgentState;
      if (content === undefined) state = record ? "modified" : "absent";
      else if (!record) state = "conflict";
      else if (!recordMatches(content, record)) state = "modified";
      else state = record.version === entry.version ? "current" : "update-available";
      result.push({ id: entry.id, agent, state });
    }
  }
  return result;
}
