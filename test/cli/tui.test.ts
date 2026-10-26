import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";

import { runTui } from "../../src/cli/tui.js";
import { getStackStatePath } from "../../src/core/config/stack-state.js";

test("TUI installs a Nix specialist agent through preview and explicit confirmation", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-tui-install-"));
  const prior = {
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
    NIX_AI_HOME: process.env.NIX_AI_HOME
  };
  process.env.HOME = path.join(root, "home");
  process.env.USERPROFILE = path.join(root, "home");
  process.env.XDG_CONFIG_HOME = path.join(root, "config");
  process.env.NIX_AI_HOME = path.join(root, "nix-home");

  const output = new PassThrough() as PassThrough & { isTTY: boolean };
  let transcript = "";
  output.on("data", (chunk: Buffer) => { transcript += chunk.toString("utf8"); });
  const answers = ["10", "1", "1", "1", "yes", "", "b", "12"];

  try {
    await runTui({ output, ask: async (prompt) => {
      output.write(prompt);
      return answers.shift() ?? "";
    } });

    const installed = await readFile(path.join(root, "config", "opencode", "agents", "araxys-specialist.md"), "utf8");
    assert.match(installed, /consuming FastAPI application/i);
    assert.match(transcript, /Preview: install/);
    assert.match(transcript, /installed: Araxys Integration Specialist/i);
    assert.match(transcript, /Manage specialist agents/);
  } finally {
    output.destroy();
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(root, { recursive: true, force: true });
  }
});

test("TUI installs an optional MCP only after showing its network and target preview", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-tui-mcp-"));
  const prior = {
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
    NIX_AI_HOME: process.env.NIX_AI_HOME
  };
  process.env.HOME = path.join(root, "home");
  process.env.USERPROFILE = path.join(root, "home");
  process.env.XDG_CONFIG_HOME = path.join(root, "config");
  process.env.NIX_AI_HOME = path.join(root, "nix-home");
  const output = new PassThrough();
  let transcript = "";
  output.on("data", (chunk: Buffer) => { transcript += chunk.toString("utf8"); });
  const answers = ["2", "1", "1", "1", "yes", "", "b", "12"];

  try {
    await runTui({ output, ask: async (prompt) => { output.write(prompt); return answers.shift() ?? ""; } });
    const config = JSON.parse(await readFile(path.join(root, "config", "opencode", "opencode.json"), "utf8")) as { mcp?: Record<string, unknown> };
    assert.ok((config.mcp as { servers?: Record<string, unknown> } | undefined)?.servers?.playwright);
    assert.match(transcript, /Network: first-run/);
    assert.match(transcript, /Preview: install/);
    assert.match(transcript, /Global MCP integrations/);
  } finally {
    output.destroy();
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(root, { recursive: true, force: true });
  }
});

test("TUI previews and installs Nix commands for the selected agent target", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-tui-commands-"));
  const prior = {
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
    NIX_AI_HOME: process.env.NIX_AI_HOME
  };
  process.env.HOME = path.join(root, "home");
  process.env.USERPROFILE = path.join(root, "home");
  process.env.XDG_CONFIG_HOME = path.join(root, "config");
  process.env.NIX_AI_HOME = path.join(root, "nix-home");
  const output = new PassThrough();
  let transcript = "";
  output.on("data", (chunk: Buffer) => { transcript += chunk.toString("utf8"); });
  const answers = ["9", "1", "yes", "", "12"];

  try {
    const statePath = getStackStatePath();
    await mkdir(path.dirname(statePath), { recursive: true });
    await writeFile(statePath, `${JSON.stringify({
      schemaVersion: 1,
      selectedComponents: ["agent.opencode"],
      agentTargets: ["opencode"],
      workflows: { sdd: true, tdd: true }
    })}\n`, "utf8");
    await runTui({ output, ask: async (prompt) => { output.write(prompt); return answers.shift() ?? ""; } });
    const installed = await readFile(path.join(root, "config", "opencode", "commands", "araxys.md"), "utf8");
    assert.match(installed, /consuming application/i);
    assert.match(transcript, /Installation preview \[opencode\]/i);
    assert.match(transcript, /Unmanaged files are preserved/);
  } finally {
    output.destroy();
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(root, { recursive: true, force: true });
  }
});

test("TUI reports missing MCP prerequisites without offering to apply the change", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-tui-mcp-missing-"));
  const prior = {
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
    NIX_AI_HOME: process.env.NIX_AI_HOME,
    PATH: process.env.PATH
  };
  process.env.HOME = path.join(root, "home");
  process.env.USERPROFILE = path.join(root, "home");
  process.env.XDG_CONFIG_HOME = path.join(root, "config");
  process.env.NIX_AI_HOME = path.join(root, "nix-home");
  process.env.PATH = path.join(root, "empty-path");
  const output = new PassThrough();
  let transcript = "";
  output.on("data", (chunk: Buffer) => { transcript += chunk.toString("utf8"); });
  const answers = ["2", "4", "1", "1", "", "b", "12"];

  try {
    await runTui({ output, ask: async (prompt) => { output.write(prompt); return answers.shift() ?? ""; } });
    assert.match(transcript, /Missing prerequisites:/);
    assert.match(transcript, /Installation is unavailable/);
    assert.doesNotMatch(transcript, /Apply this global change\?/);
    await assert.rejects(readFile(path.join(root, "config", "opencode", "opencode.json"), "utf8"), { code: "ENOENT" });
  } finally {
    output.destroy();
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(root, { recursive: true, force: true });
  }
});

test("declining agent, MCP, and command installs leaves all global targets unchanged", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-tui-declines-"));
  const prior = {
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
    NIX_AI_HOME: process.env.NIX_AI_HOME
  };
  process.env.HOME = path.join(root, "home");
  process.env.USERPROFILE = path.join(root, "home");
  process.env.XDG_CONFIG_HOME = path.join(root, "config");
  process.env.NIX_AI_HOME = path.join(root, "nix-home");
  const output = new PassThrough();
  let transcript = "";
  output.on("data", (chunk: Buffer) => { transcript += chunk.toString("utf8"); });
  const answers = ["10", "1", "1", "1", "no", "", "b", "2", "1", "1", "1", "no", "", "b", "9", "1", "no", "", "12"];

  try {
    const statePath = getStackStatePath();
    await mkdir(path.dirname(statePath), { recursive: true });
    await writeFile(statePath, `${JSON.stringify({
      schemaVersion: 1,
      selectedComponents: ["agent.opencode"],
      agentTargets: ["opencode"],
      workflows: { sdd: true, tdd: true }
    })}\n`, "utf8");
    await runTui({ output, ask: async (prompt) => { output.write(prompt); return answers.shift() ?? ""; } });

    const targets = [
      path.join(root, "config", "opencode", "agents", "araxys-specialist.md"),
      path.join(root, "config", "opencode", "opencode.json"),
      path.join(root, "config", "opencode", "commands", "araxys.md"),
      path.join(root, "nix-home", "managed", "agents.json"),
      path.join(root, "nix-home", "managed", "mcp.json")
    ];
    await Promise.all(targets.map((target) => assert.rejects(readFile(target, "utf8"), { code: "ENOENT" })));
    assert.equal((transcript.match(/No files changed\./g) ?? []).length, 3);
  } finally {
    output.destroy();
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(root, { recursive: true, force: true });
  }
});
