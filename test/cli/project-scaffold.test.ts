import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { useProjectHome } from "../helpers/home.js";

const repoRoot = process.cwd();
const cliPath = path.join(repoRoot, "src", "cli", "index.ts");

function runCli(args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", cliPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
}

test("skill:new --scope=project and agent:new write into the project, never over it", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-cli-project-"));
  const restoreHome = useProjectHome(root);
  try {
    const skill = runCli(["skill:new", "--id=checkout-flow", "--scope=project", "--agent=codex", `--root=${root}`]);
    assert.equal(skill.status, 0, skill.stderr);
    assert.match(skill.stdout, /Created project skill: checkout-flow \[codex\]/);
    const projectSkill = await readFile(path.join(root, ".agents", "skills", "checkout-flow", "SKILL.md"), "utf8");
    assert.match(projectSkill, /## Project facts/);
    assert.match(projectSkill, /Test command:/);

    const opencodeSkill = runCli(["skill:new", "--id=checkout-flow", "--scope=project", "--agent=opencode", `--root=${root}`]);
    assert.equal(opencodeSkill.status, 0, opencodeSkill.stderr);
    await readFile(path.join(root, ".opencode", "skills", "checkout-flow", "SKILL.md"), "utf8");

    const agent = runCli(["agent:new", "--id=billing-specialist", "--target=opencode", `--root=${root}`]);
    assert.equal(agent.status, 0, agent.stderr);
    assert.match(agent.stdout, /Created project agent: billing-specialist \[opencode\]/);
    assert.match(await readFile(path.join(root, ".opencode", "agent", "billing-specialist.md"), "utf8"), /mode: subagent/);

    const codexAgent = runCli(["agent:new", "--id=billing-specialist", "--target=codex", `--root=${root}`]);
    assert.equal(codexAgent.status, 0, codexAgent.stderr);
    assert.match(await readFile(path.join(root, ".codex", "agents", "billing-specialist.toml"), "utf8"), /name = "billing-specialist"/);

    const again = runCli(["skill:new", "--id=checkout-flow", "--scope=project", "--agent=codex", `--root=${root}`]);
    assert.notEqual(again.status, 0, "an existing project skill must not be overwritten");
    assert.match(again.stderr, /already exists/i);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});
