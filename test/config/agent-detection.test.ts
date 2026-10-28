import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { detectAgentTargets } from "../../src/core/config/agent-detection.js";

async function withSandbox(run: (root: string, environment: NodeJS.ProcessEnv) => Promise<void>): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-detect-"));
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: path.join(root, "home"),
    USERPROFILE: path.join(root, "home"),
    APPDATA: path.join(root, "appdata"),
    XDG_CONFIG_HOME: path.join(root, "config"),
    CODEX_HOME: path.join(root, "codex"),
    PATH: path.join(root, "empty-path")
  };
  try {
    await run(root, environment);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("detection reports no installed target when only constructible paths exist", async () => {
  await withSandbox(async (_root, environment) => {
    const detections = await detectAgentTargets({ environment });
    assert.deepEqual(detections.map((item) => item.agent), ["opencode", "codex"]);
    assert.equal(detections.every((item) => !item.detected), true);
    assert.equal(detections.every((item) => item.evidence.length === 0), true);
  });
});

test("detection reports an installed target from an existing app config file", async () => {
  await withSandbox(async (_root, environment) => {
    await mkdir(path.join(environment.XDG_CONFIG_HOME!, "opencode"), { recursive: true });
    await writeFile(path.join(environment.XDG_CONFIG_HOME!, "opencode", "opencode.json"), "{}\n", "utf8");

    const detections = await detectAgentTargets({ environment });
    const opencode = detections.find((item) => item.agent === "opencode");
    const codex = detections.find((item) => item.agent === "codex");
    assert.equal(opencode?.detected, true);
    assert.match(opencode?.evidence.join("\n") ?? "", /config: .*opencode\.json/);
    assert.equal(codex?.detected, false);
  });
});

test("detection reports a target from a CLI executable found on PATH", async () => {
  await withSandbox(async (root, environment) => {
    const bin = path.join(root, "bin");
    await mkdir(bin, { recursive: true });
    const executable = process.platform === "win32" ? "codex.cmd" : "codex";
    await writeFile(path.join(bin, executable), "", "utf8");

    const detections = await detectAgentTargets({ environment: { ...environment, PATH: bin } });
    const codex = detections.find((item) => item.agent === "codex");
    assert.equal(codex?.detected, true);
    assert.match(codex?.evidence.join("\n") ?? "", /cli: .*codex/);
  });
});

test("detection keeps both targets when both are installed and labels each with evidence", async () => {
  await withSandbox(async (root, environment) => {
    await mkdir(path.join(environment.CODEX_HOME!), { recursive: true });
    await writeFile(path.join(environment.CODEX_HOME!, "config.toml"), "", "utf8");
    const bin = path.join(root, "bin");
    await mkdir(bin, { recursive: true });
    await writeFile(path.join(bin, process.platform === "win32" ? "opencode.cmd" : "opencode"), "", "utf8");

    const detections = await detectAgentTargets({ environment: { ...environment, PATH: bin } });
    assert.deepEqual(detections.map((item) => item.detected), [true, true]);
  });
});
