export type WorkflowKind = "sdd" | "tdd";
export type WorkflowStatus = "active" | "completed";
export type WorkflowStepStatus = "pending" | "done" | "skipped";

export interface WorkflowSettings {
  readonly sdd: boolean;
  readonly tdd: boolean;
}

export interface WorkflowStepRecord {
  readonly id: string;
  readonly status: WorkflowStepStatus;
  readonly evidence?: string;
  readonly reason?: string;
  readonly completedAt?: string;
}

export interface WorkflowRecord {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly kind: WorkflowKind;
  readonly title: string;
  readonly status: WorkflowStatus;
  readonly currentStep: string | null;
  readonly steps: ReadonlyArray<WorkflowStepRecord>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const workflowStepIds: Readonly<Record<WorkflowKind, ReadonlyArray<string>>> = {
  sdd: ["idea", "clarification", "specification", "tasks", "handoff", "verification"],
  tdd: ["test-identification", "red", "green", "refactor", "proof"]
};

export function isWorkflowKind(value: unknown): value is WorkflowKind {
  return value === "sdd" || value === "tdd";
}
