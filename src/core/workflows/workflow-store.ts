import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getProjectWorkflowsDirectory } from "../config/global-paths.js";
import {
  isWorkflowKind,
  workflowStepIds,
  type WorkflowRecord,
  type WorkflowStepRecord
} from "./workflow-contracts.js";

const WORKFLOW_ID = /^[A-Za-z0-9][A-Za-z0-9-]*$/;

export function getWorkflowsDirectory(root: string): string {
  return getProjectWorkflowsDirectory(root);
}

export function workflowRecordPath(root: string, id: string): string {
  if (!WORKFLOW_ID.test(id)) throw new Error(`Invalid workflow id: ${id}`);
  return path.join(getWorkflowsDirectory(root), `${id}.json`);
}

export async function saveWorkflowRecord(root: string, record: WorkflowRecord): Promise<string> {
  const validated = validateWorkflowRecord(record);
  const file = workflowRecordPath(root, validated.id);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
  return file;
}

export async function loadWorkflowRecord(root: string, id: string): Promise<WorkflowRecord> {
  const file = workflowRecordPath(root, id);
  const raw = await readFile(file, "utf8");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid workflow JSON at ${file}`);
  }
  return validateWorkflowRecord(value);
}

export async function listWorkflowRecords(root: string): Promise<ReadonlyArray<WorkflowRecord>> {
  let entries: string[];
  try {
    entries = await readdir(getWorkflowsDirectory(root));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const records: WorkflowRecord[] = [];
  for (const entry of entries.filter((name) => name.endsWith(".json")).sort()) {
    records.push(await loadWorkflowRecord(root, entry.slice(0, -".json".length)));
  }
  return records.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function validateWorkflowRecord(value: unknown): WorkflowRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Workflow record must be a JSON object");
  }
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== 1) throw new Error(`Unsupported workflow schema version: ${String(record.schemaVersion)}`);
  if (!isWorkflowKind(record.kind)) throw new Error(`Unsupported workflow kind: ${String(record.kind)}`);
  if (typeof record.id !== "string" || !WORKFLOW_ID.test(record.id)) throw new Error("Workflow record has an invalid id");
  if (typeof record.title !== "string" || !record.title.trim()) throw new Error("Workflow record has no title");
  if (record.status !== "active" && record.status !== "completed") throw new Error("Workflow record has an invalid status");
  if (!Array.isArray(record.steps)) throw new Error("Workflow record has no steps");
  if (typeof record.createdAt !== "string" || typeof record.updatedAt !== "string") {
    throw new Error("Workflow record has invalid timestamps");
  }

  const expectedIds = workflowStepIds[record.kind];
  if (record.steps.length !== expectedIds.length) {
    throw new Error(`Workflow ${record.id} does not contain the expected ${record.kind} steps`);
  }
  const steps = record.steps.map((step, index) => validateStep(step, expectedIds[index] ?? ""));
  const active = steps.filter((step) => step.status === "pending");
  if (record.status === "completed") {
    if (record.currentStep !== null || active.length > 0) throw new Error("Completed workflow must have no pending step");
  } else {
    if (typeof record.currentStep !== "string" || !steps.some((step) => step.id === record.currentStep && step.status === "pending")) {
      throw new Error("Active workflow must name a pending current step");
    }
    if (steps[steps.findIndex((step) => step.id === record.currentStep)] !== active[0]) {
      throw new Error("Workflow steps must advance in their declared order");
    }
  }

  return {
    schemaVersion: 1,
    id: record.id,
    kind: record.kind,
    title: record.title,
    status: record.status,
    currentStep: record.currentStep as string | null,
    steps,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function validateStep(value: unknown, expectedId: string): WorkflowStepRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Workflow step must be an object");
  const step = value as Record<string, unknown>;
  if (step.id !== expectedId) throw new Error(`Workflow step ${String(step.id)} is out of order; expected ${expectedId}`);
  if (step.status !== "pending" && step.status !== "done" && step.status !== "skipped") {
    throw new Error(`Workflow step ${expectedId} has an invalid status`);
  }
  if (step.evidence !== undefined && typeof step.evidence !== "string") throw new Error(`Workflow step ${expectedId} has invalid evidence`);
  if (step.reason !== undefined && typeof step.reason !== "string") throw new Error(`Workflow step ${expectedId} has invalid reason`);
  if (step.completedAt !== undefined && typeof step.completedAt !== "string") throw new Error(`Workflow step ${expectedId} has invalid completion time`);
  return {
    id: expectedId,
    status: step.status,
    ...(typeof step.evidence === "string" ? { evidence: step.evidence } : {}),
    ...(typeof step.reason === "string" ? { reason: step.reason } : {}),
    ...(typeof step.completedAt === "string" ? { completedAt: step.completedAt } : {})
  };
}
