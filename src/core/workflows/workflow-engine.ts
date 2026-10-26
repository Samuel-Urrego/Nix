import { randomUUID } from "node:crypto";

import {
  isWorkflowKind,
  workflowStepIds,
  type WorkflowKind,
  type WorkflowRecord,
  type WorkflowStepRecord
} from "./workflow-contracts.js";

export function createWorkflow(kind: WorkflowKind, title: string): WorkflowRecord {
  if (!isWorkflowKind(kind)) throw new Error(`Unsupported workflow kind: ${String(kind)}`);
  const normalizedTitle = title.trim();
  if (!normalizedTitle) throw new Error("A workflow title is required.");
  const now = new Date().toISOString();
  const steps = workflowStepIds[kind].map<WorkflowStepRecord>((id) => ({ id, status: "pending" }));
  return {
    schemaVersion: 1,
    id: randomUUID(),
    kind,
    title: normalizedTitle,
    status: "active",
    currentStep: steps[0]?.id ?? null,
    steps,
    createdAt: now,
    updatedAt: now
  };
}

export function advanceWorkflow(record: WorkflowRecord, evidence: string): WorkflowRecord {
  if (record.status === "completed") throw new Error("Workflow is already complete.");
  const normalizedEvidence = evidence.trim();
  if (!normalizedEvidence) throw new Error("Evidence is required to advance a workflow step.");
  const index = record.steps.findIndex((step) => step.id === record.currentStep);
  if (index < 0) throw new Error(`Workflow has an unknown current step: ${String(record.currentStep)}`);
  return completeCurrentStep(record, index, (step) => ({
    ...step,
    status: "done",
    evidence: normalizedEvidence,
    completedAt: new Date().toISOString()
  }));
}

export function skipWorkflowStep(record: WorkflowRecord, reason: string): WorkflowRecord {
  if (record.status === "completed") throw new Error("Workflow is already complete.");
  const normalizedReason = reason.trim();
  if (!normalizedReason) throw new Error("A reason is required to skip the RED step.");
  if (record.kind !== "tdd" || record.currentStep !== "red") {
    throw new Error("Only the TDD RED step can be skipped when a meaningful test is unavailable.");
  }
  const index = record.steps.findIndex((step) => step.id === "red");
  return completeCurrentStep(record, index, (step) => ({
    ...step,
    status: "skipped",
    reason: normalizedReason,
    completedAt: new Date().toISOString()
  }));
}

export function describeNextAction(record: WorkflowRecord): string {
  if (record.status === "completed" || record.currentStep === null) {
    return "Workflow complete; no further step is required.";
  }
  return `Current step: ${record.currentStep}. Record evidence and run workflow:advance --id=${record.id} --evidence="..." --yes.`;
}

function completeCurrentStep(
  record: WorkflowRecord,
  index: number,
  update: (step: WorkflowStepRecord) => WorkflowStepRecord
): WorkflowRecord {
  const current = record.steps[index];
  if (!current) throw new Error("Workflow has no current step.");
  const steps = record.steps.map((step, position) => (position === index ? update(step) : step));
  const next = steps.find((step) => step.status === "pending");
  return {
    ...record,
    status: next ? "active" : "completed",
    currentStep: next?.id ?? null,
    steps,
    updatedAt: new Date().toISOString()
  };
}
