import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { StackState } from "../../src/core/config/stack-state.js";
import { getProjectWorkflowsDirectory } from "../../src/core/config/global-paths.js";
import {
  installAgentCommands,
  removeAgentCommands,
  runWorkflowCommand
} from "../../src/core/commands/workflow-command-service.js";
import { useProjectHome } from "../helpers/home.js";

function state(overrides: Partial<StackState> = {}): StackState {
  return {
    schemaVersion: 1,
    selectedComponents: ["agent.opencode", "workflow.sdd"],
    agentTargets: ["opencode"],
    workflows: { sdd: true, tdd: false },
    ...overrides
  };
}

async function fixture(): Promise<{ root: string; restoreHome: () => void }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-command-service-"));
  const restoreHome = useProjectHome(root);
  return { root, restoreHome };
}

async function fileList(directory: string): Promise<string[]> {
  try {
    return (await readdir(directory)).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

test("new-feat starts an SDD workflow and persists the record", async () => {
  const { root, restoreHome } = await fixture();
  try {
    const result = await runWorkflowCommand(root, state(), "new-feat", "Guided onboarding");
    assert.ok(result.workflow);
    assert.equal(result.workflow.kind, "sdd");
    assert.equal(result.workflow.title, "Guided onboarding");

    const saved = JSON.parse(
      await readFile(path.join(getProjectWorkflowsDirectory(root), `${result.workflow.id}.json`), "utf8")
    );
    assert.equal(saved.kind, "sdd");
    assert.equal(saved.currentStep, "idea");
    assert.match(result.prompt, /\/new-feat/);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("a disabled or unavailable workflow command is refused before any record is written", async () => {
  const { root, restoreHome } = await fixture();
  try {
    await assert.rejects(
      runWorkflowCommand(root, state({ selectedComponents: ["agent.opencode"], workflows: { sdd: false, tdd: false } }), "new-feat", "Plan"),
      /unavailable|disabled/i
    );
    assert.deepEqual(await fileList(getProjectWorkflowsDirectory(root)), []);

    await assert.rejects(
      runWorkflowCommand(
        root,
        { schemaVersion: 1, selectedComponents: [], agentTargets: [], workflows: { sdd: true, tdd: true } },
        "new-feat",
        "Plan"
      ),
      /agent/i
    );
    assert.deepEqual(await fileList(getProjectWorkflowsDirectory(root)), []);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("new-idea renders the blind-judge path without creating a workflow record", async () => {
  const { root, restoreHome } = await fixture();
  try {
    const result = await runWorkflowCommand(
      root,
      state({ selectedComponents: ["agent.opencode"], workflows: { sdd: false, tdd: false } }),
      "new-idea",
      "Adopt a new onboarding flow"
    );
    assert.equal(result.workflow, null);
    assert.match(result.prompt, /blind-judge[\\/]SKILL\.md/);
    assert.match(result.prompt, /ideas[\\/]<slug>\.json/);
    assert.match(result.prompt, /five neutral evaluators/i);
    assert.deepEqual(await fileList(getProjectWorkflowsDirectory(root)), []);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("new-project generates an evidence-first project skill and native agent blueprint without creating a workflow", async () => {
  const { root, restoreHome } = await fixture();
  try {
    const result = await runWorkflowCommand(
      root,
      state({ selectedComponents: ["agent.opencode"], workflows: { sdd: false, tdd: false } }),
      "new-project",
      ""
    );
    assert.equal(result.workflow, null);
    assert.match(result.prompt, /\.agents\/skills\/<skill-id>\/SKILL\.md/);
    assert.match(result.prompt, /\.codex\/agents\//);
    assert.match(result.prompt, /\.opencode\/agents\//);
    assert.match(result.prompt, /evidence/i);
    assert.match(result.prompt, /Do not overwrite/i);
    assert.match(result.prompt, /preview/i);
    assert.deepEqual(await fileList(getProjectWorkflowsDirectory(root)), []);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("araxys command routes to the consumer-only integration skill without creating a workflow", async () => {
  const { root, restoreHome } = await fixture();
  try {
    const result = await runWorkflowCommand(
      root,
      state({ selectedComponents: ["agent.opencode"], workflows: { sdd: false, tdd: false } }),
      "araxys",
      ""
    );
    assert.equal(result.workflow, null);
    assert.match(result.prompt, /araxys-integration/);
    assert.match(result.prompt, /installed Araxys version/i);
    assert.match(result.prompt, /ask one concise question/i);
    assert.match(result.prompt, /consuming application/i);
    assert.match(result.prompt, /Never create, edit, or commit files in the Araxys library repository/i);
    assert.deepEqual(await fileList(getProjectWorkflowsDirectory(root)), []);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("security-audit routes to the installed skill with project scope and coverage-first instructions", async () => {
  const { root, restoreHome } = await fixture();
  try {
    const result = await runWorkflowCommand(root, state({ selectedComponents: ["agent.opencode"], workflows: { sdd: false, tdd: false } }), "security-audit", "authentication routes");
    assert.equal(result.workflow, null);
    assert.match(result.prompt, /Cloudflare Security Audit skill/);
    assert.match(result.prompt, /Project scope:/);
    assert.match(result.prompt, /coverage/i);
    assert.match(result.prompt, /security-audit[\\/]SKILL\.md/);
    assert.doesNotMatch(result.prompt, /hunt\d|full upstream/i);
    assert.deepEqual(await fileList(getProjectWorkflowsDirectory(root)), []);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("OpenCode command installation writes only available managed commands", async () => {
  const { root, restoreHome } = await fixture();
  try {
    const result = await installAgentCommands(root, state(), "opencode");
    assert.deepEqual(result.installed, [
      ".config/opencode/commands/new-feat.md",
      ".config/opencode/commands/new-idea.md",
      ".config/opencode/commands/new-project.md",
      ".config/opencode/commands/araxys.md",
      ".config/opencode/commands/security-audit.md"
    ]);
    assert.deepEqual(result.removed, []);
    assert.equal(result.skipped.some((item) => item.path.endsWith("refactor.md")), true);

    const content = await readFile(path.join(root, ".config", "opencode", "commands", "new-feat.md"), "utf8");
    assert.match(content, /^---\ndescription: /);
    assert.match(content, /<!-- nix-ai:workflow-command id=new-feat -->/);
    assert.match(content, /\$ARGUMENTS/);
    assert.match(content, /nix-ai workflow:command --id=new-feat/);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("installation refuses to overwrite unmanaged command files and removal preserves them", async () => {
  const { root, restoreHome } = await fixture();
  try {
    const target = path.join(root, ".config", "opencode", "commands", "new-feat.md");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, "user-owned command\n", "utf8");

    await assert.rejects(installAgentCommands(root, state(), "opencode"), /unmanaged|overwrite/i);
    assert.equal(await readFile(target, "utf8"), "user-owned command\n");

    const removed = await removeAgentCommands(root, "opencode");
    assert.deepEqual(removed.removed, []);
    assert.equal(removed.skipped.some((item) => item.path.endsWith("new-feat.md")), true);
    assert.equal(await readFile(target, "utf8"), "user-owned command\n");
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("reinstalling after a workflow changes state reconciles managed command files", async () => {
  const { root, restoreHome } = await fixture();
  try {
    await installAgentCommands(root, state(), "opencode");
    const refactor = path.join(root, ".config", "opencode", "commands", "refactor.md");
    await assert.rejects(readFile(refactor));

    const tddState = state({
      selectedComponents: ["agent.opencode", "workflow.tdd"],
      workflows: { sdd: false, tdd: true }
    });
    const result = await installAgentCommands(root, tddState, "opencode");
    assert.ok(result.removed.includes(".config/opencode/commands/new-feat.md"));
    assert.ok(result.installed.includes(".config/opencode/commands/refactor.md"));
    await assert.rejects(readFile(path.join(root, ".config", "opencode", "commands", "new-feat.md")));
    assert.match(await readFile(refactor, "utf8"), /nix-ai workflow:command --id=refactor/);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("a stale Codex command wrapper at the skill path is migrated, not preserved", async () => {
  const { root, restoreHome } = await fixture();
  try {
    // Simulates an install from an older build that wrote /araxys into the skill dir.
    const legacy = path.join(root, ".agents", "skills", "araxys-integration");
    await mkdir(legacy, { recursive: true });
    await writeFile(
      path.join(legacy, "SKILL.md"),
      "---\nname: araxys-integration\n---\n<!-- nix-ai:workflow-command id=araxys -->\n# /araxys\n",
      "utf8"
    );

    const installed = await installAgentCommands(root, state(), "codex");
    assert.ok(installed.removed.includes(".agents/skills/araxys-integration"));
    await assert.rejects(readFile(path.join(legacy, "SKILL.md"), "utf8"), { code: "ENOENT" });
    assert.match(
      await readFile(path.join(root, ".agents", "skills", "nix-command-araxys", "SKILL.md"), "utf8"),
      /<!-- nix-ai:workflow-command id=araxys -->/
    );
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("an unmanaged directory at the skill path is never deleted", async () => {
  const { root, restoreHome } = await fixture();
  try {
    const target = path.join(root, ".agents", "skills", "araxys-integration");
    await mkdir(target, { recursive: true });
    await writeFile(path.join(target, "SKILL.md"), "---\nname: araxys-integration\n---\n# User owned\n", "utf8");

    await installAgentCommands(root, state(), "codex");
    assert.equal(await readFile(path.join(target, "SKILL.md"), "utf8"), "---\nname: araxys-integration\n---\n# User owned\n");
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("Codex command installation writes and removes user skills", async () => {
  const { root, restoreHome } = await fixture();
  try {
    const installed = await installAgentCommands(root, state(), "codex");
    assert.deepEqual(installed.installed, [
      ".agents/skills/new-feat/SKILL.md",
      ".agents/skills/new-idea/SKILL.md",
      ".agents/skills/new-project/SKILL.md",
      ".agents/skills/nix-command-araxys/SKILL.md",
      ".agents/skills/nix-command-security-audit/SKILL.md"
    ]);
    assert.equal(installed.skipped.some((item) => item.path.endsWith("refactor/SKILL.md")), true);

    const content = await readFile(path.join(root, ".agents", "skills", "new-feat", "SKILL.md"), "utf8");
    assert.match(content, /^---\nname: new-feat\ndescription: /);
    assert.match(content, /<!-- nix-ai:workflow-command id=new-feat -->/);
    const wrapper = await readFile(path.join(root, ".agents", "skills", "nix-command-araxys", "SKILL.md"), "utf8");
    assert.match(wrapper, /^---\nname: araxys\ndescription: /);

    const removed = await removeAgentCommands(root, "codex");
    assert.ok(removed.removed.includes(".agents/skills/new-feat/SKILL.md"));
    await assert.rejects(readFile(path.join(root, ".agents", "skills", "new-feat", "SKILL.md")));
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});
