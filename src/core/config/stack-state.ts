import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { WorkflowSettings } from "../workflows/workflow-contracts.js";
import { getNixHome } from "./global-paths.js";

export interface StackState {
  readonly schemaVersion: 1;
  readonly selectedComponents: ReadonlyArray<string>;
  readonly agentTargets: ReadonlyArray<string>;
  readonly workflows: WorkflowSettings;
}

export const defaultWorkflowSettings: WorkflowSettings = {
  sdd: false,
  tdd: false
};

export const defaultStackState: StackState = {
  schemaVersion: 1,
  selectedComponents: [],
  agentTargets: [],
  workflows: defaultWorkflowSettings
};

export function getStackStatePath(environment: NodeJS.ProcessEnv = process.env): string {
  return path.join(getNixHome(environment), "state.json");
}

export async function loadStackState(filePath = getStackStatePath()): Promise<StackState> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return defaultStackState;
    throw error;
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid stack state JSON at ${filePath}`);
  }
  return validateStackState(value);
}

export async function saveStackState(filePath: string, state: StackState): Promise<void> {
  const validated = validateStackState(state);
  await mkdir(path.dirname(filePath), { recursive: true });
  let hasBackup = false;
  try {
    await copyFile(filePath, `${filePath}.bak`);
    hasBackup = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  try {
    await writeFile(filePath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
  } catch (error) {
    if (hasBackup) await copyFile(`${filePath}.bak`, filePath);
    throw error;
  }
}

function validateStackState(value: unknown): StackState {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Stack state must be a JSON object");
  }
  const state = value as Record<string, unknown>;
  if (state.schemaVersion !== 1) throw new Error(`Unsupported stack state schema version: ${String(state.schemaVersion)}`);
  if (!Array.isArray(state.selectedComponents) || !state.selectedComponents.every((item) => typeof item === "string")) {
    throw new Error("selectedComponents must contain only strings");
  }
  if (!Array.isArray(state.agentTargets) || !state.agentTargets.every((item) => typeof item === "string")) {
    throw new Error("agentTargets must contain only strings");
  }
  const selectedComponents = [...new Set(state.selectedComponents)];
  const workflows = validateWorkflowSettings(state.workflows) ?? {
    sdd: selectedComponents.includes("workflow.sdd"),
    tdd: selectedComponents.includes("workflow.tdd")
  };
  return {
    schemaVersion: 1,
    selectedComponents,
    agentTargets: [...new Set(state.agentTargets)],
    workflows
  };
}

function validateWorkflowSettings(value: unknown): WorkflowSettings | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("workflows must be a JSON object");
  }
  const settings = value as Record<string, unknown>;
  if (typeof settings.sdd !== "boolean" || typeof settings.tdd !== "boolean") {
    throw new Error("workflows.sdd and workflows.tdd must be booleans");
  }
  return { sdd: settings.sdd, tdd: settings.tdd };
}
