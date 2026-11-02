import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  listCodexModels,
  listOpenCodeModels,
  parseCodexConfigModels,
  parseModelLines,
  parseOpenCodeConfigModels
} from "../../src/core/agents/model-catalog.js";

test("model ids are parsed from the opencode CLI output without decoration", () => {
  const output = [
    "opencode/big-pickle",
    "anthropic/claude-sonnet-4-5",
    "  github-copilot/gpt-4o  ",
    "not a model line",
    "opencode/big-pickle"
  ].join("\n");
  assert.deepEqual(parseModelLines(output), [
    "anthropic/claude-sonnet-4-5",
    "github-copilot/gpt-4o",
    "opencode/big-pickle"
  ]);
});

test("the CLI wins over configuration, and configuration is the fallback", async () => {
  const fromCli = await listOpenCodeModels({}, async () => "openai/gpt-5\n");
  assert.deepEqual(fromCli, { models: ["openai/gpt-5"], source: "opencode CLI" });

  const root = await mkdtemp(path.join(os.tmpdir(), "nix-models-"));
  try {
    const environment = { HOME: root, USERPROFILE: root, XDG_CONFIG_HOME: path.join(root, "config") };
    const configDirectory = path.join(root, "config", "opencode");
    await mkdir(configDirectory, { recursive: true });
    await writeFile(
      path.join(configDirectory, "opencode.json"),
      JSON.stringify({
        model: "opencode/big-pickle",
        provider: { anthropic: { models: { "claude-sonnet-4-5": {} } } }
      }),
      "utf8"
    );

    const fallback = await listOpenCodeModels(environment, async () => undefined);
    assert.equal(fallback.source, "opencode config");
    assert.deepEqual(fallback.models, ["anthropic/claude-sonnet-4-5", "opencode/big-pickle"]);

    const empty = await listOpenCodeModels(environment, async () => undefined);
    assert.ok(empty.models.length > 0, "config fallback must still answer");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("an unreadable or absent source reports an empty list instead of inventing ids", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-models-"));
  try {
    const environment = { HOME: root, USERPROFILE: root, XDG_CONFIG_HOME: path.join(root, "config"), CODEX_HOME: path.join(root, "codex") };
    const opencode = await listOpenCodeModels(environment, async () => undefined);
    assert.deepEqual(opencode, { models: [], source: "none" });
    const codex = await listCodexModels(environment);
    assert.deepEqual(codex, { models: [], source: "none" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("codex models come from the model keys in its configuration", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-models-"));
  try {
    const environment = { HOME: root, USERPROFILE: root, CODEX_HOME: path.join(root, "codex") };
    await mkdir(path.join(root, "codex"), { recursive: true });
    await writeFile(
      path.join(root, "codex", "config.toml"),
      ['model = "gpt-5-codex"', "", "[profiles.fast]", 'model = "gpt-5-mini"', ""].join("\n"),
      "utf8"
    );
    const codex = await listCodexModels(environment);
    assert.deepEqual(codex, { models: ["gpt-5-codex", "gpt-5-mini"], source: "codex config" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("configuration parsers ignore malformed input", () => {
  assert.deepEqual(parseOpenCodeConfigModels("{ not json"), []);
  assert.deepEqual(parseCodexConfigModels("# model = \"commented\"\n"), []);
  assert.deepEqual(parseModelLines(""), []);
});
