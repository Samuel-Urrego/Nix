import assert from "node:assert/strict";
import test from "node:test";

import {
  getCommandAvailability,
  isWorkflowCommandId,
  resolveCommandAvailability,
  workflowCommandCatalog
} from "../../src/core/commands/workflow-command-catalog.js";
import type { StackState } from "../../src/core/config/stack-state.js";

function state(overrides: Partial<StackState> = {}): StackState {
  return {
    schemaVersion: 1,
    selectedComponents: ["agent.opencode", "workflow.sdd"],
    agentTargets: ["opencode"],
    workflows: { sdd: true, tdd: false },
    ...overrides
  };
}

test("the command catalog declares the supported commands and their mappings", () => {
  assert.equal(workflowCommandCatalog.length, 6);
  assert.deepEqual(workflowCommandCatalog.map((command) => command.slash), ["/new-feat", "/refactor", "/new-idea", "/new-project", "/araxys", "/security-audit"]);

  const newFeat = getCommandAvailability(state(), "new-feat");
  assert.equal(newFeat.command.workflowKind, "sdd");
  assert.equal(newFeat.command.kind, "workflow");
  assert.deepEqual(newFeat.command.requiredComponents, ["workflow.sdd"]);

  const refactor = getCommandAvailability(state(), "refactor");
  assert.equal(refactor.command.workflowKind, "tdd");
  assert.deepEqual(refactor.command.requiredComponents, ["workflow.tdd"]);

  const newIdea = getCommandAvailability(state(), "new-idea");
  assert.equal(newIdea.command.kind, "skill");
  assert.equal(newIdea.command.skillId, "blind-judge");
  assert.deepEqual(newIdea.command.requiredComponents, []);
  assert.equal(isWorkflowCommandId("new-feat"), true);
  assert.equal(isWorkflowCommandId("new-project"), true);
  assert.equal(getCommandAvailability(state(), "araxys").command.skillId, "araxys-integration");
  assert.equal(isWorkflowCommandId("araxys"), true);
  assert.equal(getCommandAvailability(state(), "security-audit").command.skillId, "security-audit");
  assert.equal(getCommandAvailability(state(), "security-audit").command.codexSkillId, undefined);
  assert.equal(isWorkflowCommandId("security-audit"), true);
  assert.equal(isWorkflowCommandId("unknown"), false);
});

test("new-project is available to OpenCode and Codex without enabling SDD or TDD", () => {
  const openCode = getCommandAvailability(state({ workflows: { sdd: false, tdd: false } }), "new-project");
  assert.equal(openCode.cliAvailable, true);
  assert.equal(openCode.slashAvailable, true);

  const codex = getCommandAvailability(state({
    selectedComponents: ["agent.codex"],
    agentTargets: ["codex"],
    workflows: { sdd: false, tdd: false }
  }), "new-project");
  assert.equal(codex.cliAvailable, true);
  assert.equal(codex.slashAvailable, true);
});

test("availability requires a selected and installed agent component", () => {
  const noAgent = resolveCommandAvailability({
    schemaVersion: 1,
    selectedComponents: [],
    agentTargets: [],
    workflows: { sdd: false, tdd: false }
  });
  assert.ok(noAgent.every((item) => !item.cliAvailable && !item.slashAvailable));
  assert.ok(noAgent.every((item) => /agent/i.test(item.cliReason ?? "")));

  const selectedButNotInstalled = resolveCommandAvailability({
    schemaVersion: 1,
    selectedComponents: [],
    agentTargets: ["opencode"],
    workflows: { sdd: true, tdd: true }
  });
  assert.ok(selectedButNotInstalled.every((item) => !item.cliAvailable));
  assert.ok(selectedButNotInstalled.every((item) => /installed agent component/i.test(item.cliReason ?? "")));
});

test("workflow commands require both the component and the enabled setting", () => {
  const missingComponent = getCommandAvailability(
    state({ selectedComponents: ["agent.opencode"], workflows: { sdd: true, tdd: false } }),
    "new-feat"
  );
  assert.equal(missingComponent.cliAvailable, false);
  assert.deepEqual(missingComponent.missingComponents, ["workflow.sdd"]);
  assert.match(missingComponent.cliReason ?? "", /Missing required component/i);

  const disabled = getCommandAvailability(
    state({ selectedComponents: ["agent.opencode", "workflow.sdd"], workflows: { sdd: false, tdd: false } }),
    "new-feat"
  );
  assert.equal(disabled.cliAvailable, false);
  assert.equal(disabled.workflowEnabled, false);
  assert.match(disabled.cliReason ?? "", /disabled/i);
});

test("OpenCode and Codex both support workflow command surfaces", () => {
  const openCode = getCommandAvailability(state(), "new-feat");
  assert.equal(openCode.cliAvailable, true);
  assert.equal(openCode.slashAvailable, true);
  assert.equal(openCode.cliReason, null);
  assert.equal(openCode.slashReason, null);

  const codex = getCommandAvailability(
    state({
      selectedComponents: ["agent.codex", "workflow.sdd"],
      agentTargets: ["codex"]
    }),
    "new-feat"
  );
  assert.equal(codex.cliAvailable, true);
  assert.equal(codex.slashAvailable, true);
  assert.equal(codex.slashReason, null);
});

test("skill commands do not require an SDD or TDD workflow", () => {
  const newIdea = getCommandAvailability(
    state({ selectedComponents: ["agent.opencode"], workflows: { sdd: false, tdd: false } }),
    "new-idea"
  );
  assert.equal(newIdea.cliAvailable, true);
  assert.equal(newIdea.slashAvailable, true);
  assert.equal(newIdea.workflowEnabled, true);
});
