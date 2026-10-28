import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";

import { runTui } from "../../src/cli/tui.js";
import { getStackStatePath } from "../../src/core/config/stack-state.js";
import { skillCatalog } from "../../src/core/skills/skill-catalog.js";

const bundledSkillsOnly = { catalog: skillCatalog.filter((entry) => entry.source.kind === "bundled") };

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
  const answers = ["3", "10", "2", "1", "1", "yes", "", "b", "12", "4"];

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
    assert.match(transcript, /\[opencode\] Installation preview/i);
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
      const answers = ["1", "2", "1", "8", "1", "", "4"];
      await runTui({ output, ask: async (prompt) => { output.write(prompt); return answers.shift() ?? ""; } });

      const command = await readFile(path.join(root, "config", "opencode", "commands", "araxys.md"), "utf8");
      assert.match(command, /consuming application/i);
      const skill = await readFile(path.join(root, "config", "opencode", "skills", "python-fastapi", "SKILL.md"), "utf8");
      assert.match(skill, /FastAPI/);
      await assert.rejects(readFile(path.join(root, "home", ".agents", "skills", "python-fastapi", "SKILL.md"), "utf8"), { code: "ENOENT" });

      const text = transcript();
      assert.match(text, /OpenCode: detected/);
      assert.match(text, /Codex: detected/);
      assert.match(text, /╭ INSTALL PREVIEW/);
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
      const answers = ["1", "2", "1", "8", "2", "", "4"];
      await runTui({ output: declined.output, ask: async (prompt) => { declined.output.write(prompt); return answers.shift() ?? ""; } });
      assert.match(declined.transcript(), /No files changed\./);
      await assert.rejects(readFile(path.join(root, "config", "opencode", "commands", "araxys.md"), "utf8"), { code: "ENOENT" });
      await assert.rejects(readFile(path.join(root, "config", "opencode", "skills", "python-fastapi", "SKILL.md"), "utf8"), { code: "ENOENT" });
    } finally {
      await restore();
    }
  });
});

test("install everything installs every target and skill in one confirmed step", async () => {
  await withTuiSandbox(async ({ root, environment, restore }) => {
    try {
      await writeDetectedTargets(environment);
      const { output, transcript } = scriptedOutput();
      const answers = ["1", "1", "1", "", "4"];
      await runTui({
        output,
        ask: async (prompt) => { output.write(prompt); return answers.shift() ?? ""; },
        skillOptions: bundledSkillsOnly
      });

      const text = transcript();
      for (const title of ["TARGET DETECTION", "INSTALL MODE", "INSTALL PREVIEW", "INSTALLING", "INSTALL COMPLETE"]) {
        assert.ok(text.includes(`╭ ${title}`), `${title} is rendered inside a frame`);
      }
      assert.match(text, /█/);
      assert.doesNotMatch(text, /Type yes to confirm/);
      assert.doesNotMatch(text, /Failure:/, "one-step installation must not report failures");
      for (const id of ["python-fastapi", "araxys-integration"]) {
        const bundled = await readFile(path.resolve("skills", id, "SKILL.md"), "utf8");
        const opencode = await readFile(path.join(root, "config", "opencode", "skills", id, "SKILL.md"), "utf8");
        const codex = await readFile(path.join(root, "home", ".agents", "skills", id, "SKILL.md"), "utf8");
        assert.equal(opencode, bundled, `${id} installs its real content for OpenCode`);
        assert.equal(codex, bundled, `${id} installs its real content for Codex`);
      }
      assert.match(text, /Installed: \d+/);
    } finally {
      await restore();
    }
  });
});

test("each guided install step replaces the previous screen instead of stacking panels", async () => {
  await withTuiSandbox(async ({ root, environment, restore }) => {
    try {
      await writeDetectedTargets(environment);
      const { output, transcript } = scriptedOutput();
      const answers = ["1", "1", "1", "", "4"];
      await runTui({
        output,
        ask: async (prompt) => { output.write(prompt); return answers.shift() ?? ""; },
        skillOptions: bundledSkillsOnly
      });

      const segments = transcript().split("\u001b[2J\u001b[H");
      const screenWith = (title: string) => segments.filter((segment) => segment.includes(`╭ ${title}`));
      for (const title of ["TARGET DETECTION", "INSTALL MODE", "INSTALL PREVIEW", "INSTALLING", "INSTALL COMPLETE"]) {
        assert.equal(screenWith(title).length, 1, `${title} must be drawn exactly once`);
      }
      for (const [current, previous] of [
        ["INSTALL MODE", "TARGET DETECTION"],
        ["INSTALL PREVIEW", "INSTALL MODE"],
        ["INSTALLING", "INSTALL PREVIEW"]
      ]) {
        const screen = screenWith(current!)[0] ?? "";
        assert.ok(!screen.includes(`╭ ${previous}`), `${current} must not share a screen with ${previous}`);
      }
      assert.ok(
        (screenWith("INSTALL COMPLETE")[0] ?? "").indexOf("╭ INSTALL PREVIEW") === -1,
        "the final report must not be stacked under the preview"
      );
      assert.ok(
        (screenWith("NIX AI-STACK").pop() ?? "").indexOf("╭ INSTALL COMPLETE") === -1,
        "returning to the home screen must clear the install result"
      );
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
      const answers = ["2", "1", "", "2", "1", "", "4"];
      const plans: string[] = [];
      await runTui({
        output,
        ask: async (prompt) => { output.write(prompt); return answers.shift() ?? ""; },
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
      const answers = ["2", "2", "", "4"];
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

test("the wolf banner appears once on the first home screen", async () => {
  await withTuiSandbox(async ({ environment, restore }) => {    try {
      await writeDetectedTargets(environment);
      const { output, transcript } = scriptedOutput();
      const answers = ["1", "1", "2", "", "4"];
      await runTui({ output, ask: async (prompt) => { output.write(prompt); return answers.shift() ?? ""; } });

      const text = transcript();
      const wolfLines = text.split("\n").filter((line) => line.includes("⢀⣴⠫⠤⣶⣿"));
      assert.equal(wolfLines.length, 1, "the wolf is printed exactly once");
      assert.ok(text.indexOf("⢀⣴⠫⠤⣶⣿") < text.indexOf("╭ NIX AI-STACK"), "the wolf precedes the first menu");
      assert.ok(text.lastIndexOf("What would you like to do?") > text.indexOf("⢀⣴⠫⠤⣶⣿"), "the menu still renders");
    } finally {
      await restore();
    }
  });
});

interface FakeTty extends PassThrough {
  isTTY: boolean;
  isRaw: boolean;
  columns: number;
  setRawMode: (mode: boolean) => FakeTty;
}

function createFakeTty(columns = 80): FakeTty {
  const stream = new PassThrough() as FakeTty;
  stream.isTTY = true;
  stream.isRaw = false;
  stream.columns = columns;
  stream.setRawMode = (mode) => {
    stream.isRaw = mode;
    return stream;
  };
  return stream;
}

async function waitForMarker(pending: () => string, marker: string): Promise<void> {  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (pending().includes(marker)) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Timed out waiting for marker: ${marker}`);
}

test("real keyboard selection drives the guided install end to end", async () => {
  await withTuiSandbox(async ({ root, environment, restore }) => {
    try {
      await writeDetectedTargets(environment);
      const input = createFakeTty();
      const output = createFakeTty();
      let transcript = "";
      let pending = "";
      output.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        transcript += text;
        pending += text;
      });
      const expect = async (marker: string): Promise<void> => {
        await waitForMarker(() => pending, marker);
        pending = "";
      };

      const run = runTui({ input, output });

      await expect("What would you like to do?");
      input.write("\r");
      await expect("How do you want to install?");
      input.write("\u001b[B\r");
      await expect("Where should Nix install?");
      input.write("\r");
      await expect("Which skills should Nix install?");
      input.write("a");
      input.write("python");
      await expect("Search: python");
      input.write(" ");
      await expect("› [x] Python and FastAPI");
      input.write("\r");
      await expect("Apply these global changes?");
      input.write("\u001b[A\r");
      await expect("These changes are global");
      input.write("\r");
      await expect("What would you like to do?");
      input.write("\u001b[B\u001b[B\u001b[B\r");

      await run;

      assert.match(transcript, /╭ NIX AI-STACK/);
      assert.match(transcript, /› Install AI-STACK/);
      assert.match(transcript, /\[x\] OpenCode — signalled by config:/);
      assert.match(transcript, /\[x\] Codex — signalled by config:/);
      const command = await readFile(path.join(root, "config", "opencode", "commands", "new-feat.md"), "utf8");
      assert.match(command, /nix-ai:workflow-command id=new-feat/);
      const codexSkill = await readFile(path.join(root, "home", ".agents", "skills", "new-feat", "SKILL.md"), "utf8");
      assert.match(codexSkill, /nix-ai:workflow-command id=new-feat/);
      const filteredSkill = await readFile(path.join(root, "config", "opencode", "skills", "python-fastapi", "SKILL.md"), "utf8");
      assert.match(filteredSkill, /FastAPI/);
      await assert.rejects(readFile(path.join(root, "home", ".agents", "skills", "brag", "SKILL.md"), "utf8"), { code: "ENOENT" });
      assert.equal(input.isRaw, false);
    } finally {
      await restore();
    }
  });
});

test("the wolf banner is skipped on a terminal too narrow to render it", async () => {
  await withTuiSandbox(async ({ restore }) => {
    try {
      const input = createFakeTty(24);
      const output = createFakeTty(24);
      let transcript = "";
      let pending = "";
      output.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        transcript += text;
        pending += text;
      });

      const run = runTui({ input, output });
      await waitForMarker(() => pending, "╭ NIX AI-STACK");
      pending = "";
      input.write("\u001b[B\u001b[B\u001b[B\r");
      await run;

      assert.doesNotMatch(transcript, /⢀⣴⠫⠤⣶⣿/);
      assert.match(transcript, /Quit/);
      const frameRows = transcript.split("\n").filter((line) => line.startsWith("╭") || line.startsWith("│") || line.startsWith("╰"));
      assert.ok(frameRows.length > 0);
    } finally {
      await restore();
    }
  });
});
