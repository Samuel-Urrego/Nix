import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import type { StackState } from "../../src/core/config/stack-state.js";
import { getProjectWorkflowsDirectory } from "../../src/core/config/global-paths.js";

const repoRoot = process.cwd();
const cliPath = path.join(repoRoot, "src", "cli", "index.ts");

function runCli(args: string[], appData: string) {
  return spawnSync(process.execPath, ["--import", "tsx", cliPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, APPDATA: appData }
  });
}

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nix-cli-commands-"));
  return {
    directory,
    projectRoot: path.join(directory, "project"),
    appData: path.join(directory, "appdata")
  };
}

async function writeState(appData: string, state: StackState): Promise<void> {
  const nixHome = process.env.NIX_AI_HOME ?? path.join(appData, "Nix AI Stack");
  const file = path.join(nixHome, "state.json");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function state(overrides: Partial<StackState> = {}): StackState {
  return {
    schemaVersion: 1,
    selectedComponents: ["agent.opencode", "workflow.sdd"],
    agentTargets: ["opencode"],
    workflows: { sdd: true, tdd: false },
    ...overrides
  };
}

test("workflow:commands reports the catalog and surface availability as JSON", async () => {
  const value = await fixture();
  try {
    await mkdir(value.projectRoot, { recursive: true });
    await writeState(value.appData, state());

    const result = runCli(["workflow:commands", "--json"], value.appData);
    assert.equal(result.status, 0, result.stderr);
    const catalog = JSON.parse(result.stdout) as Array<{
      command: { slash: string };
      cliAvailable: boolean;
      slashAvailable: boolean;
    }>;
    assert.equal(catalog.length, 6);
    const newFeat = catalog.find((item) => item.command.slash === "/new-feat");
    assert.ok(newFeat);
    assert.equal(newFeat.cliAvailable, true);
    assert.equal(newFeat.slashAvailable, true);
    const refactor = catalog.find((item) => item.command.slash === "/refactor");
    assert.ok(refactor);
    assert.equal(refactor.cliAvailable, false);
    const newProject = catalog.find((item) => item.command.slash === "/new-project");
    assert.ok(newProject);
    assert.equal(newProject.cliAvailable, true);
    const araxys = catalog.find((item) => item.command.slash === "/araxys");
    assert.ok(araxys);
    assert.equal(araxys.cliAvailable, true);
    assert.equal(araxys.slashAvailable, true);
    const securityAudit = catalog.find((item) => item.command.slash === "/security-audit");
    assert.ok(securityAudit);
    assert.equal(securityAudit.cliAvailable, true);
    assert.equal(securityAudit.slashAvailable, true);
  } finally {
    await rm(value.directory, { recursive: true, force: true });
  }
});

test("workflow:command runs new-project without a title and returns the project blueprint", async () => {
  const value = await fixture();
  try {
    await mkdir(value.projectRoot, { recursive: true });
    await writeState(value.appData, state({ workflows: { sdd: false, tdd: false } }));
    const result = runCli(
      ["workflow:command", "--id=new-project", "--yes", `--root=${value.projectRoot}`],
      value.appData
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\.agents\/skills\/<skill-id>\/SKILL\.md/);
    assert.match(result.stdout, /wait for explicit user confirmation/i);
  } finally {
    await rm(value.directory, { recursive: true, force: true });
  }
});

test("workflow:command starts an enabled workflow and refuses a disabled one", async () => {
  const value = await fixture();
  try {
    await mkdir(value.projectRoot, { recursive: true });
    await writeState(value.appData, state());

    const started = runCli(
      ["workflow:command", "--id=new-feat", "--title=Guided onboarding", "--yes", `--root=${value.projectRoot}`],
      value.appData
    );
    assert.equal(started.status, 0, started.stderr);
    assert.match(started.stdout, /Started SDD workflow: Guided onboarding/);
    const id = started.stdout.match(/ID: (\S+)/)?.[1];
    assert.ok(id);
    const saved = JSON.parse(await readFile(path.join(getProjectWorkflowsDirectory(value.projectRoot), `${id}.json`), "utf8"));
    assert.equal(saved.kind, "sdd");

    await writeState(value.appData, state({ selectedComponents: ["agent.opencode"], workflows: { sdd: false, tdd: false } }));
    const refused = runCli(
      ["workflow:command", "--id=new-feat", "--title=Blocked", "--yes", `--root=${value.projectRoot}`],
      value.appData
    );
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /unavailable|disabled/i);
  } finally {
    await rm(value.directory, { recursive: true, force: true });
  }
});

test("workflow:install-commands installs and removes OpenCode commands", async () => {
  const value = await fixture();
  try {
    await mkdir(value.projectRoot, { recursive: true });
    await writeState(value.appData, state());

    const installed = runCli(
      ["workflow:install-commands", "--agent=opencode", `--root=${value.projectRoot}`, "--yes"],
      value.appData
    );
    assert.equal(installed.status, 0, installed.stderr);
    assert.match(installed.stdout, /new-feat/);
    const commandsRoot = path.join(process.env.XDG_CONFIG_HOME ?? path.join(process.env.HOME ?? "", ".config"), "opencode", "commands");
    const commandPath = path.join(commandsRoot, "new-feat.md");
    assert.match(await readFile(commandPath, "utf8"), /nix-ai workflow:command --id=new-feat/);

    const removed = runCli(
      ["workflow:install-commands", "--agent=opencode", `--root=${value.projectRoot}`, "--remove", "--yes"],
      value.appData
    );
    assert.equal(removed.status, 0, removed.stderr);
    await assert.rejects(readFile(commandPath));

    const codex = runCli(
      ["workflow:install-commands", "--agent=codex", `--root=${value.projectRoot}`, "--yes"],
      value.appData
    );
    assert.equal(codex.status, 0, codex.stderr);
    const codexSkill = path.join(process.env.HOME ?? "", ".agents", "skills", "new-feat", "SKILL.md");
    assert.match(await readFile(codexSkill, "utf8"), /name: new-feat/);

    const codexRemoved = runCli(
      ["workflow:install-commands", "--agent=codex", `--root=${value.projectRoot}`, "--remove", "--yes"],
      value.appData
    );
    assert.equal(codexRemoved.status, 0, codexRemoved.stderr);
    await assert.rejects(readFile(codexSkill));
  } finally {
    await rm(value.directory, { recursive: true, force: true });
  }
});
