import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { scaffoldProjectAgent } from "../../src/core/agents/agent-authoring.js";

test("project agents are written where each runtime reads them", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-project-agent-"));
  try {
    const opencode = await scaffoldProjectAgent(root, "billing-specialist", "opencode");
    assert.match(opencode.targetPath, /\.opencode[\\/]agent[\\/]billing-specialist\.md$/);
    const markdown = await readFile(opencode.targetPath, "utf8");
    assert.match(markdown, /^---\ndescription: /);
    assert.match(markdown, /mode: subagent/);
    assert.match(markdown, /<!-- nix-ai:agent id=billing-specialist scope=project -->/);
    assert.match(markdown, /## Report/);

    const codex = await scaffoldProjectAgent(root, "billing-specialist", "codex");
    assert.match(codex.targetPath, /\.codex[\\/]agents[\\/]billing-specialist\.toml$/);
    const toml = await readFile(codex.targetPath, "utf8");
    assert.match(toml, /^# nix-ai:agent id=billing-specialist scope=project\nname = "billing-specialist"/);
    assert.match(toml, /developer_instructions = "/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("project agents never overwrite an existing file and reject unsafe ids", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-project-agent-"));
  try {
    await scaffoldProjectAgent(root, "billing-specialist", "opencode");
    await assert.rejects(scaffoldProjectAgent(root, "billing-specialist", "opencode"), /already exists/i);
    await assert.rejects(scaffoldProjectAgent(root, "Billing Specialist", "opencode"), /invalid/i);
    await assert.rejects(scaffoldProjectAgent(root, "../escape", "codex"), /invalid/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
