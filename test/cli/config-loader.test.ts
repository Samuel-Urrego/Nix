import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { loadNixConfig, writeDefaultNixConfig } from "../../src/core/config/config-loader.js";
import { getNixConfigPath } from "../../src/core/config/global-paths.js";

async function withConfigHome(run: (environment: NodeJS.ProcessEnv) => Promise<void>): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-config-loader-"));
  const environment = { NIX_AI_HOME: path.join(root, "nix-home") };
  try {
    await run(environment);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("loadNixConfig preserves unknown keys for forward compatibility", async () => {
  await withConfigHome(async (environment) => {
    const configPath = getNixConfigPath(environment);
    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(configPath, JSON.stringify({
      projectName: "Existing project",
      futureFeature: { enabled: true }
    }), "utf8");

    const { config, source } = await loadNixConfig(".", environment);

    assert.equal(source, configPath);
    assert.equal(config.projectName, "Existing project");
    assert.deepEqual((config as typeof config & { futureFeature: unknown }).futureFeature, { enabled: true });
  });
});

test("writeDefaultNixConfig preserves existing settings and unknown keys", async () => {
  await withConfigHome(async (environment) => {
    const configPath = getNixConfigPath(environment);
    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(configPath, JSON.stringify({
      projectName: "Existing project",
      defaultArchitecture: "layered",
      reviewerSources: ["builtin", "custom-reviewers.json"],
      scanRoots: ["src"],
      futureFeature: { enabled: true }
    }), "utf8");

    await writeDefaultNixConfig(".", { projectName: "Updated project" }, environment);

    const written = JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>;
    assert.equal(written.projectName, "Updated project");
    assert.equal(written.defaultArchitecture, "layered");
    assert.deepEqual(written.reviewerSources, ["builtin", "custom-reviewers.json"]);
    assert.deepEqual(written.scanRoots, ["src"]);
    assert.deepEqual(written.futureFeature, { enabled: true });
  });
});

test("writeDefaultNixConfig refuses malformed existing config without overwriting it", async () => {
  await withConfigHome(async (environment) => {
    const configPath = getNixConfigPath(environment);
    await mkdir(path.dirname(configPath), { recursive: true });
    const original = "{ this is not valid JSON\n";
    await writeFile(configPath, original, "utf8");

    await assert.rejects(writeDefaultNixConfig(".", {}, environment));
    assert.equal(await readFile(configPath, "utf8"), original);
  });
});
