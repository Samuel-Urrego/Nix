import { createHash } from "node:crypto";
import { access } from "node:fs/promises";
import path from "node:path";

import { createCodexMcpAdapter } from "./codex-mcp-adapter.js";
import { createOpenCodeMcpAdapter } from "./opencode-mcp-adapter.js";
import { findMcpEntry, mcpCatalog } from "./mcp-catalog.js";
import type { McpAgent, McpCredentialPolicy, McpLocalServer, McpNetworkAccess, McpScope } from "./mcp-contracts.js";
import type { McpAgentAdapter as Adapter } from "./mcp-agent-adapter.js";
import {
  managedMcpKey,
  readManagedMcpState,
  writeManagedMcpState,
  type ManagedMcpRecord,
  type ManagedMcpState
} from "./managed-mcp-state.js";

export type McpPlanAction = "install" | "update" | "already-current" | "conflict";
export type McpInstallState = "absent" | "current" | "update-available" | "modified" | "conflict" | "invalid";

export interface McpPrerequisiteStatus {
  readonly satisfied: boolean;
  readonly missing: ReadonlyArray<string>;
}

export interface McpPlan {
  readonly id: string;
  readonly agent: McpAgent;
  readonly action: McpPlanAction;
  readonly targetPath: string;
  readonly scope: McpScope;
  readonly networkAccess: McpNetworkAccess;
  readonly credentials: McpCredentialPolicy;
  readonly prerequisites: McpPrerequisiteStatus;
  readonly reason?: string;
}

export interface McpStatusEntry {
  readonly id: string;
  readonly agent: McpAgent;
  readonly state: McpInstallState;
  readonly detail?: string;
}

export async function previewMcp(root: string, id: string, agent: McpAgent): Promise<McpPlan> {
  const entry = requireEntry(id, agent);
  const adapter = adapterFor(agent);
  const targetPath = adapter.configPath(root);
  const prerequisites = await checkPrerequisites(root, entry.prerequisites);
  const base = {
    id,
    agent,
    targetPath,
    scope: entry.scope,
    networkAccess: entry.networkAccess,
    credentials: entry.credentials,
    prerequisites
  } as const;

  let existing: unknown;
  try {
    existing = await adapter.readServer(root, id);
  } catch (error) {
    return { ...base, action: "conflict", reason: message(error) };
  }
  if (existing === undefined) return { ...base, action: "install" };

  const state = await readManagedMcpState(root);
  const record = state.entries[managedMcpKey(agent, id)];
  if (!record) {
    return { ...base, action: "conflict", reason: "An existing server with this name is not managed by Nix." };
  }
  if (hashServer(existing) !== record.specHash) {
    return { ...base, action: "conflict", reason: "The Nix-managed server was modified outside Nix; run mcp:update to restore it." };
  }
  return { ...base, action: hashServer(existing) === hashServer(entry.server) ? "already-current" : "update" };
}

export async function installMcp(root: string, id: string, agent: McpAgent): Promise<{ readonly action: "installed" | "updated" | "already-current"; readonly targetPath: string }> {
  const plan = await previewMcp(root, id, agent);
  if (plan.action === "conflict") throw new Error(plan.reason ?? `Cannot install MCP server ${id}.`);
  if (!plan.prerequisites.satisfied) throw new Error(`Missing prerequisite: ${plan.prerequisites.missing.join("; ")}.`);
  if (plan.action === "already-current") return { action: "already-current", targetPath: plan.targetPath };

  const entry = requireEntry(id, agent);
  const adapter = adapterFor(agent);
  await adapter.writeServer(root, id, entry.server);
  const state = await readManagedMcpState(root);
  await writeManagedMcpState(root, withRecord(state, recordFor(id, agent, entry.server)));
  return { action: plan.action === "update" ? "updated" : "installed", targetPath: plan.targetPath };
}

export async function updateMcp(root: string, id: string, agent: McpAgent): Promise<{ readonly action: "updated"; readonly targetPath: string }> {
  const entry = requireEntry(id, agent);
  const adapter = adapterFor(agent);
  const state = await readManagedMcpState(root);
  const record = state.entries[managedMcpKey(agent, id)];
  if (!record) throw new Error(`MCP server ${id} is not managed by Nix for ${agent}.`);
  await adapter.writeServer(root, id, entry.server);
  await writeManagedMcpState(root, withRecord(state, recordFor(id, agent, entry.server)));
  return { action: "updated", targetPath: adapter.configPath(root) };
}

export async function removeMcp(root: string, id: string, agent: McpAgent): Promise<{ readonly action: "removed" }> {
  requireEntry(id, agent);
  const adapter = adapterFor(agent);
  const state = await readManagedMcpState(root);
  const key = managedMcpKey(agent, id);
  const record = state.entries[key];
  if (!record) throw new Error(`MCP server ${id} is not managed by Nix for ${agent}.`);
  const existing = await adapter.readServer(root, id);
  if (existing !== undefined && hashServer(existing) !== record.specHash) {
    throw new Error(`The Nix-managed server ${id} was modified outside Nix; refusing to remove it.`);
  }
  await adapter.removeServer(root, id);
  const entries = { ...state.entries };
  delete entries[key];
  await writeManagedMcpState(root, { schemaVersion: 1, entries });
  return { action: "removed" };
}

export async function getMcpStatus(root: string): Promise<ReadonlyArray<McpStatusEntry>> {
  const state = await readManagedMcpState(root).catch(() => undefined);
  const result: McpStatusEntry[] = [];
  for (const entry of mcpCatalog) {
    for (const agent of entry.supportedAgents) {
      const adapter = adapterFor(agent);
      let existing: unknown;
      try {
        existing = await adapter.readServer(root, entry.id);
      } catch (error) {
        result.push({ id: entry.id, agent, state: "invalid", detail: message(error) });
        continue;
      }
      if (existing === undefined) {
        result.push({ id: entry.id, agent, state: "absent" });
        continue;
      }
      const record = state?.entries[managedMcpKey(agent, entry.id)];
      if (!record) {
        result.push({ id: entry.id, agent, state: "conflict", detail: "Existing server is not managed by Nix." });
        continue;
      }
      const currentHash = hashServer(existing);
      if (currentHash !== record.specHash) {
        result.push({ id: entry.id, agent, state: "modified", detail: "Managed server differs from its recorded spec." });
        continue;
      }
      result.push({
        id: entry.id,
        agent,
        state: currentHash === hashServer(entry.server) ? "current" : "update-available"
      });
    }
  }
  return result;
}

function requireEntry(id: string, agent: McpAgent) {
  const entry = findMcpEntry(id);
  if (!entry) throw new Error(`Unknown MCP integration: ${id}.`);
  if (!entry.supportedAgents.includes(agent)) throw new Error(`MCP integration ${id} does not support agent ${agent}.`);
  return entry;
}

function adapterFor(agent: McpAgent): Adapter {
  return agent === "opencode" ? createOpenCodeMcpAdapter() : createCodexMcpAdapter();
}

function recordFor(id: string, agent: McpAgent, server: McpLocalServer): ManagedMcpRecord {
  return { id, agent, specHash: hashServer(server), installedAt: new Date().toISOString() };
}

function withRecord(state: ManagedMcpState, record: ManagedMcpRecord): ManagedMcpState {
  return {
    schemaVersion: 1,
    entries: { ...state.entries, [managedMcpKey(record.agent, record.id)]: record }
  };
}

export function hashServer(server: unknown): string {
  return createHash("sha256").update(JSON.stringify(stable(server))).digest("hex");
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stable(item)]));
  }
  return value;
}

async function checkPrerequisites(root: string, prerequisites: McpCatalogEntryPrerequisites): Promise<McpPrerequisiteStatus> {
  const missing: string[] = [];
  for (const prerequisite of prerequisites) {
    if (prerequisite.kind === "file") {
      const target = path.join(path.resolve(root), ...prerequisite.path.split("/"));
      if (!(await exists(target))) missing.push(prerequisite.description);
    } else if (!(await findExecutable(prerequisite.name))) {
      missing.push(prerequisite.description);
    }
  }
  return { satisfied: missing.length === 0, missing };
}

type McpCatalogEntryPrerequisites = import("./mcp-contracts.js").McpCatalogEntry["prerequisites"];

async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function findExecutable(name: string): Promise<boolean> {
  if (name.includes("/") || name.includes("\\")) return exists(name);
  const pathValue = process.env.PATH ?? "";
  const extensions = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const directory of pathValue.split(path.delimiter)) {
    if (!directory) continue;
    for (const extension of extensions) {
      if (await exists(path.join(directory, `${name}${extension}`))) return true;
    }
  }
  return false;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
