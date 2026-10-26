import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getManagedMcpPath } from "../config/global-paths.js";
import type { McpAgent } from "./mcp-contracts.js";

export interface ManagedMcpRecord {
  readonly id: string;
  readonly agent: McpAgent;
  readonly specHash: string;
  readonly installedAt: string;
}

export interface ManagedMcpState {
  readonly schemaVersion: 1;
  readonly entries: Readonly<Record<string, ManagedMcpRecord>>;
}

export const emptyManagedMcpState: ManagedMcpState = { schemaVersion: 1, entries: {} };

export function managedMcpStatePath(_root: string): string {
  return getManagedMcpPath();
}

export function managedMcpKey(agent: McpAgent, id: string): string {
  return `${agent}:${id}`;
}

export async function readManagedMcpState(root: string): Promise<ManagedMcpState> {
  const file = managedMcpStatePath(root);
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyManagedMcpState;
    throw error;
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid managed MCP state JSON at ${file}`);
  }
  return validateManagedMcpState(value);
}

export async function writeManagedMcpState(root: string, state: ManagedMcpState): Promise<void> {
  const validated = validateManagedMcpState(state);
  const file = managedMcpStatePath(root);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
}

export function validateManagedMcpState(value: unknown): ManagedMcpState {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Managed MCP state must be a JSON object");
  const state = value as Record<string, unknown>;
  if (state.schemaVersion !== 1) throw new Error(`Unsupported managed MCP schema version: ${String(state.schemaVersion)}`);
  if (typeof state.entries !== "object" || state.entries === null || Array.isArray(state.entries)) {
    throw new Error("Managed MCP entries must be a JSON object");
  }
  const entries: Record<string, ManagedMcpRecord> = {};
  for (const [key, raw] of Object.entries(state.entries)) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error(`Invalid managed MCP entry: ${key}`);
    const entry = raw as Record<string, unknown>;
    if (typeof entry.id !== "string" || (entry.agent !== "opencode" && entry.agent !== "codex")) {
      throw new Error(`Invalid managed MCP entry identity: ${key}`);
    }
    if (typeof entry.specHash !== "string" || typeof entry.installedAt !== "string") {
      throw new Error(`Invalid managed MCP entry metadata: ${key}`);
    }
    entries[key] = { id: entry.id, agent: entry.agent, specHash: entry.specHash, installedAt: entry.installedAt };
  }
  return { schemaVersion: 1, entries };
}
