import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceWorkflow,
  createWorkflow,
  describeNextAction,
  skipWorkflowStep,
} from "../../src/core/workflows/workflow-engine.js";

test("SDD workflow records the six roadmap steps in order", () => {
  const record = createWorkflow("sdd", "Add optional workflows");
  assert.equal(record.kind, "sdd");
  assert.equal(record.status, "active");
  assert.equal(record.currentStep, "idea");
  assert.deepEqual(record.steps.map((step) => step.id), [
    "idea",
    "clarification",
    "specification",
    "tasks",
    "handoff",
    "verification",
  ]);
  assert.ok(record.steps.every((step) => step.status === "pending"));
});

test("SDD advances only with evidence and completes after verification", () => {
  let record = createWorkflow("sdd", "Add optional workflows");
  assert.throws(() => advanceWorkflow(record, "  "), /evidence/i);
  for (const step of ["idea", "clarification", "specification", "tasks", "handoff", "verification"]) {
    assert.equal(record.currentStep, step);
    record = advanceWorkflow(record, `evidence for ${step}`);
    assert.equal(record.steps.find((item) => item.id === step)?.status, "done");
  }
  assert.equal(record.status, "completed");
  assert.equal(record.currentStep, null);
  assert.match(describeNextAction(record), /complete/i);
});

test("TDD workflow permits skipping RED only with a persisted reason", () => {
  let record = createWorkflow("tdd", "Add a testable guard");
  assert.equal(record.currentStep, "test-identification");
  assert.throws(() => skipWorkflowStep(record, ""), /reason/i);
  assert.throws(() => skipWorkflowStep(record, "no runner"), /RED/i);
  record = advanceWorkflow(record, "test file selected");
  assert.equal(record.currentStep, "red");
  record = skipWorkflowStep(record, "No runnable test exists for this docs-only change.");
  const red = record.steps.find((step) => step.id === "red");
  assert.equal(red?.status, "skipped");
  assert.match(red?.reason ?? "", /docs-only/);
  assert.equal(record.currentStep, "green");
});

test("TDD completes after proof and rejects skipping another step", () => {
  let record = createWorkflow("tdd", "Add a testable guard");
  record = advanceWorkflow(record, "test selected");
  record = skipWorkflowStep(record, "RED unavailable");
  record = advanceWorkflow(record, "GREEN: 3/3 pass");
  assert.throws(() => skipWorkflowStep(record, "skip refactor"), /RED/i);
  record = advanceWorkflow(record, "refactored without behavior change");
  record = advanceWorkflow(record, "proof: npm test 3/3");
  assert.equal(record.status, "completed");
  assert.equal(describeNextAction(record), "Workflow complete; no further step is required.");
});

test("workflow creation rejects an empty title and an unknown kind", () => {
  assert.throws(() => createWorkflow("sdd", "   "), /title/i);
  assert.throws(() => createWorkflow("unknown" as never, "title"), /kind/i);
});
