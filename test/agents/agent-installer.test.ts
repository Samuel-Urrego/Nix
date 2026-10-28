import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { SpecialistAgentDefinition } from "../../src/core/agents/agent-contracts.js";
import {
  getSpecialistAgentStatus,
  installSpecialistAgent,
  previewSpecialistAgent,
  removeSpecialistAgent,
  updateSpecialistAgent
} from "../../src/core/agents/agent-installer.js";
import { getManagedAgentsPath } from "../../src/core/config/global-paths.js";
import { useProjectHome } from "../helpers/home.js";

function definition(overrides: Partial<SpecialistAgentDefinition> = {}): SpecialistAgentDefinition {
  return {
    id: "demo-specialist",
    name: "Demo Specialist",
    description: "A demo specialist used by installer tests.",
    version: "1.0.0",
    instructions: "Use evidence from the current consumer project.\n",
    source: "nix-catalog",
    ownership: "nix",
    supportedAgents: ["opencode", "codex"],
    ...overrides
  };
}

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-agent-installer-"));
  const restoreHome = useProjectHome(root);
  return { root, restoreHome };
}

function options(agent: SpecialistAgentDefinition) {
  return { catalog: [agent] };
}

test("preview is read-only and uses each agent's global native path", async () => {
  const { root, restoreHome } = await fixture();
  try {
    const specialist = definition();
    const openCode = await previewSpecialistAgent(root, specialist.id, "opencode", options(specialist));
    const codex = await previewSpecialistAgent(root, specialist.id, "codex", options(specialist));
    assert.equal(openCode.action, "install");
    assert.match(openCode.targetPath, /\.config[\\/]opencode[\\/]agents[\\/]demo-specialist\.md$/);
    assert.equal(codex.action, "install");
    assert.match(codex.targetPath, /\.codex[\\/]agents[\\/]demo-specialist\.toml$/);
    await assert.rejects(readFile(openCode.targetPath, "utf8"), /ENOENT/);
    await assert.rejects(readFile(codex.targetPath, "utf8"), /ENOENT/);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("install writes native definitions and records managed status", async () => {
  const { root, restoreHome } = await fixture();
  try {
    const specialist = definition();
    const openCode = await installSpecialistAgent(root, specialist.id, "opencode", options(specialist));
    const codex = await installSpecialistAgent(root, specialist.id, "codex", options(specialist));
    const openCodeText = await readFile(openCode.targetPath, "utf8");
    const codexText = await readFile(codex.targetPath, "utf8");

    assert.match(openCodeText, /^---\ndescription: /);
    assert.match(openCodeText, /mode: subagent/);
    assert.match(openCodeText, /<!-- nix-ai:agent id=demo-specialist -->/);
    assert.match(codexText, /name = "demo-specialist"/);
    assert.match(codexText, /developer_instructions = /);
    assert.match(codexText, /# nix-ai:agent id=demo-specialist/);
    assert.deepEqual(
      (await getSpecialistAgentStatus(root, options(specialist))).map((item) => item.state),
      ["current", "current"]
    );
    assert.equal(await readFile(getManagedAgentsPath(), "utf8").then((text) => JSON.parse(text).schemaVersion), 1);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("a primary agent renders as the OpenCode entry point instead of a subagent", async () => {
  const { root, restoreHome } = await fixture();
  try {
    const specialist = definition({ id: "demo-orchestrator", mode: "primary" });
    const openCode = await installSpecialistAgent(root, specialist.id, "opencode", options(specialist));
    const text = await readFile(openCode.targetPath, "utf8");
    assert.match(text, /^---\ndescription: /);
    assert.match(text, /mode: primary/);
    assert.doesNotMatch(text, /mode: subagent/);

    const delegated = definition({ id: "demo-delegated" });
    const delegatedFile = await installSpecialistAgent(root, delegated.id, "opencode", options(delegated));
    assert.match(await readFile(delegatedFile.targetPath, "utf8"), /mode: subagent/);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("a changed definition is an update even when its version did not move", async () => {
  const { root, restoreHome } = await fixture();
  try {
    const original = definition();
    await installSpecialistAgent(root, original.id, "opencode", options(original));
    const changed = definition({ instructions: "Use the new catalog instructions.\n" });
    const plan = await previewSpecialistAgent(root, changed.id, "opencode", options(changed));
    assert.equal(plan.action, "update");
    await updateSpecialistAgent(root, changed.id, "opencode", options(changed));
    assert.match(await readFile(plan.targetPath, "utf8"), /new catalog instructions/);
    assert.equal((await previewSpecialistAgent(root, changed.id, "opencode", options(changed))).action, "already-current");
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("an unmanaged global agent file is never overwritten or removed", async () => {
  const { root, restoreHome } = await fixture();
  try {
    const specialist = definition();
    const plan = await previewSpecialistAgent(root, specialist.id, "opencode", options(specialist));
    await mkdir(path.dirname(plan.targetPath), { recursive: true });
    await writeFile(plan.targetPath, "user-owned agent\n", "utf8");

    const conflict = await previewSpecialistAgent(root, specialist.id, "opencode", options(specialist));
    assert.equal(conflict.action, "conflict");
    await assert.rejects(installSpecialistAgent(root, specialist.id, "opencode", options(specialist)), /not managed|unmanaged/i);
    await assert.rejects(removeSpecialistAgent(root, specialist.id, "opencode", options(specialist)), /not managed/i);
    assert.equal(await readFile(plan.targetPath, "utf8"), "user-owned agent\n");
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("modified managed agents conflict until explicit update; removal preserves edited targets", async () => {
  const { root, restoreHome } = await fixture();
  try {
    const specialist = definition();
    const installed = await installSpecialistAgent(root, specialist.id, "codex", options(specialist));
    await writeFile(installed.targetPath, "user edit\n", "utf8");

    const plan = await previewSpecialistAgent(root, specialist.id, "codex", options(specialist));
    assert.equal(plan.action, "conflict");
    await assert.rejects(updateSpecialistAgent(root, specialist.id, "codex", options(specialist)), /modified|conflict/i);
    await assert.rejects(removeSpecialistAgent(root, specialist.id, "codex", options(specialist)), /modified|refus/i);
    assert.equal(await readFile(installed.targetPath, "utf8"), "user edit\n");
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("managed updates preserve a recovery copy and reinstall is idempotent", async () => {
  const { root, restoreHome } = await fixture();
  try {
    const first = definition();
    const installed = await installSpecialistAgent(root, first.id, "opencode", options(first));
    const second = definition({ version: "1.1.0", instructions: "Use the current consumer project as evidence.\n" });
    const plan = await previewSpecialistAgent(root, second.id, "opencode", options(second));
    assert.equal(plan.action, "update");

    const updated = await updateSpecialistAgent(root, second.id, "opencode", options(second));
    assert.equal(updated.action, "updated");
    assert.notEqual(updated.backupPath, undefined);
    assert.equal(await readFile(updated.backupPath!, "utf8"), await readFile(installed.targetPath, "utf8").then((text) => text.replace("Use the current consumer project as evidence.", "Use evidence from the current consumer project.")));

    const again = await installSpecialistAgent(root, second.id, "opencode", options(second));
    assert.equal(again.action, "already-current");
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});
