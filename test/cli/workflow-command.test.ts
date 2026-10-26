import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { getProjectWorkflowsDirectory } from "../../src/core/config/global-paths.js";

const repoRoot = process.cwd();
const cliPath = path.join(repoRoot, "src", "cli", "index.ts");

function runCli(args: string[], appData: string) {
  return spawnSync(process.execPath, ["--import", "tsx", cliPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, APPDATA: appData },
  });
}

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nix-cli-workflow-"));
  return {
    directory,
    projectRoot: path.join(directory, "project"),
    appData: path.join(directory, "appdata"),
  };
}

test("workflow settings are independent and disabled workflows refuse to start", async () => {
  const value = await fixture();
  try {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(value.projectRoot, { recursive: true });

    const refused = runCli(["workflow:start", "--kind=sdd", "--title=Plan", "--yes", `--root=${value.projectRoot}`], value.appData);
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /disabled/i);

    const configured = runCli(["workflow:configure", "--sdd=on", `--yes`, `--root=${value.projectRoot}`], value.appData);
    assert.equal(configured.status, 0, configured.stderr);
    const status = runCli(["workflow:status", `--root=${value.projectRoot}`], value.appData);
    assert.equal(status.status, 0, status.stderr);
    assert.match(status.stdout, /SDD: enabled/);
    assert.match(status.stdout, /TDD: disabled/);

    const stillRefused = runCli(["workflow:start", "--kind=tdd", "--title=Guard", "--yes", `--root=${value.projectRoot}`], value.appData);
    assert.notEqual(stillRefused.status, 0);
    assert.match(stillRefused.stderr, /disabled/i);
  } finally {
    await rm(value.directory, { recursive: true, force: true });
  }
});

test("SDD workflow advances with evidence, resumes after restart, and completes", async () => {
  const value = await fixture();
  try {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(value.projectRoot, { recursive: true });
    assert.equal(runCli(["workflow:configure", "--sdd=on", "--yes", `--root=${value.projectRoot}`], value.appData).status, 0);

    const start = runCli(["workflow:start", "--kind=sdd", "--title=Optional workflows", "--yes", `--root=${value.projectRoot}`], value.appData);
    assert.equal(start.status, 0, start.stderr);
    const id = start.stdout.match(/ID: (\S+)/)?.[1];
    assert.ok(id);

    const noEvidence = runCli(["workflow:advance", `--id=${id}`, "--yes", `--root=${value.projectRoot}`], value.appData);
    assert.notEqual(noEvidence.status, 0);
    assert.match(noEvidence.stderr, /evidence/i);

    const resumed = runCli(["workflow:resume", `--id=${id}`, `--root=${value.projectRoot}`], value.appData);
    assert.equal(resumed.status, 0, resumed.stderr);
    assert.match(resumed.stdout, /Current step: idea/);

    for (const step of ["idea", "clarification", "specification", "tasks", "handoff", "verification"]) {
      const advanced = runCli(["workflow:advance", `--id=${id}`, `--evidence=evidence for ${step}`, "--yes", `--root=${value.projectRoot}`], value.appData);
      assert.equal(advanced.status, 0, advanced.stderr);
    }

    const finalStatus = runCli(["workflow:status", `--root=${value.projectRoot}`], value.appData);
    assert.equal(finalStatus.status, 0, finalStatus.stderr);
    assert.match(finalStatus.stdout, /No active workflows/);
    const saved = JSON.parse(await readFile(path.join(getProjectWorkflowsDirectory(value.projectRoot, { ...process.env, APPDATA: value.appData }), `${id}.json`), "utf8"));
    assert.equal(saved.status, "completed");
  } finally {
    await rm(value.directory, { recursive: true, force: true });
  }
});

test("TDD workflow records unavailable RED with a reason and requires confirmation", async () => {
  const value = await fixture();
  try {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(value.projectRoot, { recursive: true });
    const configured = runCli(["workflow:configure", "--tdd=on", "--yes", `--root=${value.projectRoot}`], value.appData);
    assert.equal(configured.status, 0, configured.stderr);

    const denied = runCli(["workflow:start", "--kind=tdd", "--title=Guard", `--root=${value.projectRoot}`], value.appData);
    assert.notEqual(denied.status, 0);
    assert.match(denied.stderr, /--yes/);

    const start = runCli(["workflow:start", "--kind=tdd", "--title=Guard", "--yes", `--root=${value.projectRoot}`], value.appData);
    assert.equal(start.status, 0, start.stderr);
    const id = start.stdout.match(/ID: (\S+)/)?.[1];
    assert.ok(id);

    const noReason = runCli(["workflow:skip", `--id=${id}`, "--yes", `--root=${value.projectRoot}`], value.appData);
    assert.notEqual(noReason.status, 0);
    assert.match(noReason.stderr, /reason/i);

    const skippedTooEarly = runCli(["workflow:skip", `--id=${id}`, "--reason=no runner", "--yes", `--root=${value.projectRoot}`], value.appData);
    assert.notEqual(skippedTooEarly.status, 0);
    assert.match(skippedTooEarly.stderr, /RED/i);

    assert.equal(runCli(["workflow:advance", `--id=${id}`, "--evidence=test selected", "--yes", `--root=${value.projectRoot}`], value.appData).status, 0);
    const skip = runCli(["workflow:skip", `--id=${id}`, "--reason=Docs-only change; no runnable test.", "--yes", `--root=${value.projectRoot}`], value.appData);
    assert.equal(skip.status, 0, skip.stderr);
    const saved = JSON.parse(await readFile(path.join(getProjectWorkflowsDirectory(value.projectRoot, { ...process.env, APPDATA: value.appData }), `${id}.json`), "utf8"));
    assert.equal(saved.steps.find((step: { id: string }) => step.id === "red").status, "skipped");
    assert.match(saved.steps.find((step: { id: string }) => step.id === "red").reason, /Docs-only/);
  } finally {
    await rm(value.directory, { recursive: true, force: true });
  }
});
