import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";

import { runTui } from "../../src/cli/tui.js";
import { getStackStatePath } from "../../src/core/config/stack-state.js";

test("TUI opens with a small framed keyboard menu instead of numbered actions", async () => {
  const output = new PassThrough();
  let transcript = "";
  let choices: readonly string[] = [];
  output.on("data", (chunk: Buffer) => { transcript += chunk.toString("utf8"); });

  try {
    await runTui({
      output,
      select: async (_prompt, items) => {
        choices = items;
        return 3;
      }
    });

    assert.deepEqual(choices, ["Install AI-STACK", "Update AI-STACK", "Advanced management", "Quit"]);
    assert.match(transcript, /╭ NIX AI-STACK/);
    assert.match(transcript, /↑↓ Navigate · Enter Select · Esc Back/);
    assert.doesNotMatch(transcript, /\b1\. Install or configure/);
  } finally {
    output.destroy();
  }
});

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
  const answers = ["3", "10", "1", "1", "1", "yes", "", "b", "12", "4"];

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
  const answers = ["3", "2", "1", "1", "1", "yes", "", "b", "12", "4"];

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
  const answers = ["3", "9", "1", "yes", "", "12", "4"];

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
  const answers = ["3", "2", "4", "1", "1", "", "b", "12", "4"];

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
  const answers = ["3", "10", "1", "1", "1", "no", "", "b", "2", "1", "1", "1", "no", "", "b", "9", "1", "no", "", "12", "4"];

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

interface TuiSandbox {
  readonly root: string;
  readonly environment: NodeJS.ProcessEnv;
  restore(): Promise<void>;
}

async function withTuiSandbox(run: (sandbox: TuiSandbox) => Promise<void>): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-tui-flow-"));
  const prior = {
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
    APPDATA: process.env.APPDATA,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
    CODEX_HOME: process.env.CODEX_HOME,
    NIX_AI_HOME: process.env.NIX_AI_HOME,
    PATH: process.env.PATH
  };
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: path.join(root, "home"),
    USERPROFILE: path.join(root, "home"),
    APPDATA: path.join(root, "appdata"),
    XDG_CONFIG_HOME: path.join(root, "config"),
    CODEX_HOME: path.join(root, "codex"),
    NIX_AI_HOME: path.join(root, "nix-home"),
    PATH: path.join(root, "empty-path")
  };
  Object.assign(process.env, environment);
  try {
    await run({
      root,
      environment,
      restore: async () => {
        for (const [key, value] of Object.entries(prior)) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
      }
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function scriptedOutput(): { readonly output: PassThrough; transcript(): string } {
  const output = new PassThrough();
  let transcript = "";
  output.on("data", (chunk: Buffer) => { transcript += chunk.toString("utf8"); });
  return { output, transcript: () => transcript };
}

async function writeDetectedTargets(environment: NodeJS.ProcessEnv): Promise<void> {
  await mkdir(path.join(environment.XDG_CONFIG_HOME!, "opencode"), { recursive: true });
  await writeFile(path.join(environment.XDG_CONFIG_HOME!, "opencode", "opencode.json"), "{}\n", "utf8");
  await mkdir(environment.CODEX_HOME!, { recursive: true });
  await writeFile(path.join(environment.CODEX_HOME!, "config.toml"), "", "utf8");
}

test("guided install detects targets and only writes the selected application", async () => {
  await withTuiSandbox(async ({ root, environment, restore }) => {
    try {
      await writeDetectedTargets(environment);
      const { output, transcript } = scriptedOutput();
      const answers = ["1", "1", "8", "yes", "", "4"];
      await runTui({ output, ask: async (prompt) => { output.write(prompt); return answers.shift() ?? ""; } });

      const command = await readFile(path.join(root, "config", "opencode", "commands", "araxys.md"), "utf8");
      assert.match(command, /consuming application/i);
      const skill = await readFile(path.join(root, "config", "opencode", "skills", "python-fastapi", "SKILL.md"), "utf8");
      assert.match(skill, /FastAPI/);
      await assert.rejects(readFile(path.join(root, "home", ".agents", "skills", "python-fastapi", "SKILL.md"), "utf8"), { code: "ENOENT" });

      const text = transcript();
      assert.match(text, /OpenCode: detected/);
      assert.match(text, /Codex: detected/);
      assert.match(text, /Global installation preview/);
      assert.match(text, /Apply these global changes\?/);
      assert.match(text, /Installed: \d+/);
    } finally {
      await restore();
    }
  });
});

test("guided install writes nothing when the confirmation is declined", async () => {
  await withTuiSandbox(async ({ root, environment, restore }) => {
    try {
      await writeDetectedTargets(environment);
      const declined = scriptedOutput();
      const answers = ["1", "1", "none", "no", "", "4"];
      await runTui({ output: declined.output, ask: async (prompt) => { declined.output.write(prompt); return answers.shift() ?? ""; } });
      assert.match(declined.transcript(), /No files changed\./);
      await assert.rejects(readFile(path.join(root, "config", "opencode", "commands", "araxys.md"), "utf8"), { code: "ENOENT" });
      await assert.rejects(readFile(path.join(root, "config", "opencode", "skills", "python-fastapi", "SKILL.md"), "utf8"), { code: "ENOENT" });
    } finally {
      await restore();
    }
  });
});

test("guided install refuses to claim a target that is not installed", async () => {
  await withTuiSandbox(async ({ root, restore }) => {
    try {
      const { output, transcript } = scriptedOutput();
      const answers = ["1", "", "4"];
      await runTui({ output, ask: async (prompt) => { output.write(prompt); return answers.shift() ?? ""; } });

      assert.match(transcript(), /OpenCode: not detected/);
      assert.match(transcript(), /Nix will not install into an application it cannot detect/);
      await assert.rejects(readFile(path.join(root, "config", "opencode", "commands", "araxys.md"), "utf8"), { code: "ENOENT" });
    } finally {
      await restore();
    }
  });
});

test("in-TUI update shows current and target versions, then reports the upgrade result", async () => {
  await withTuiSandbox(async ({ restore }) => {
    try {
      const { output, transcript } = scriptedOutput();
      const answers = ["2", "", "2", "", "4"];
      const plans: string[] = [];
      await runTui({
        output,
        ask: async (prompt) => {
          output.write(prompt);
          if (prompt.includes("Update the globally installed AI-STACK")) return "yes";
          return answers.shift() ?? "";
        },
        latestVersion: async () => "9.9.9",
        upgrade: async (plan) => {
          plans.push(plan.commandLine);
          return plans.length === 1 ? 0 : 2;
        }
      });

      assert.deepEqual(plans, ["npm install --global nix-ai-stack@latest", "npm install --global nix-ai-stack@latest"]);
      const text = transcript();
      assert.match(text, /Current version: 0\.1\.2/);
      assert.match(text, /Target version: 9\.9\.9/);
      assert.match(text, /Upgrade finished\. Confirm it with: nix-ai --version/);
      assert.match(text, /Upgrade failed with exit code 2\./);
    } finally {
      await restore();
    }
  });
});

test("in-TUI update reports an unresolved target instead of guessing a version", async () => {
  await withTuiSandbox(async ({ restore }) => {
    try {
      const { output, transcript } = scriptedOutput();
      const answers = ["2", "no", "", "4"];
      await runTui({
        output,
        ask: async (prompt) => { output.write(prompt); return answers.shift() ?? ""; },
        latestVersion: async () => undefined,
        upgrade: async () => 0
      });

      const text = transcript();
      assert.match(text, /Target version: latest published version \(registry unavailable\)/);
      assert.match(text, /No changes applied\./);
    } finally {
      await restore();
    }
  });
});
