import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";

import { multiSelectWithKeyboard, selectWithKeyboard, writeFrame } from "../../src/cli/tui-keyboard.js";

test("keyboard selector moves with arrow keys and returns the highlighted option", async () => {
  const input = new PassThrough() as PassThrough & {
    isTTY: boolean;
    isRaw: boolean;
    setRawMode: (mode: boolean) => PassThrough;
  };
  input.isTTY = true;
  input.isRaw = false;
  input.setRawMode = (mode) => {
    input.isRaw = mode;
    return input;
  };
  const output = new PassThrough() as PassThrough & { columns: number };
  output.columns = 48;
  let transcript = "";
  output.on("data", (chunk: Buffer) => { transcript += chunk.toString("utf8"); });

  try {
    const pendingSelection = selectWithKeyboard({
      input: input as unknown as NodeJS.ReadStream,
      output,
      prompt: "Choose an action",
      choices: ["Install", "Update", "Quit"]
    });
    await new Promise((resolve) => setImmediate(resolve));
    input.write("\u001b[B\r");

    assert.equal(await pendingSelection, 1);
    assert.equal(input.isRaw, false);
    assert.match(transcript, /Choose an action/);
    assert.match(transcript, /↑↓/);
    assert.match(transcript, /› Update/);
    const frameRows = transcript.split("\n").filter((line) => line.startsWith("╭") || line.startsWith("│") || line.startsWith("╰"));
    assert.ok(frameRows.every((line) => line.length <= 48));
  } finally {
    input.destroy();
    output.destroy();
  }
});

test("multi-select toggles items with space and returns only the checked indexes", async () => {
  const input = new PassThrough() as PassThrough & {
    isTTY: boolean;
    isRaw: boolean;
    setRawMode: (mode: boolean) => PassThrough;
  };
  input.isTTY = true;
  input.isRaw = false;
  input.setRawMode = (mode) => {
    input.isRaw = mode;
    return input;
  };
  const output = new PassThrough() as PassThrough & { columns: number };
  output.columns = 60;
  let transcript = "";
  output.on("data", (chunk: Buffer) => { transcript += chunk.toString("utf8"); });

  try {
    const pendingSelection = multiSelectWithKeyboard({
      input: input as unknown as NodeJS.ReadStream,
      output,
      prompt: "Where should Nix install?",
      choices: ["OpenCode", "Codex", "Both"],
      initialSelected: [1]
    });
    await new Promise((resolve) => setImmediate(resolve));
    input.write(" ");
    input.write("\u001b[B");
    input.write(" ");
    input.write(" ");
    input.write("\r");

    assert.deepEqual(await pendingSelection, [0, 1]);
    assert.equal(input.isRaw, false);
    assert.match(transcript, /\[x\] Codex/);
    assert.match(transcript, /Space Toggle/);
  } finally {
    input.destroy();
    output.destroy();
  }
});

test("multi-select returns an empty selection when escaped", async () => {
  const input = new PassThrough() as PassThrough & {
    isTTY: boolean;
    isRaw: boolean;
    setRawMode: (mode: boolean) => PassThrough;
  };
  input.isTTY = true;
  input.isRaw = false;
  input.setRawMode = (mode) => {
    input.isRaw = mode;
    return input;
  };
  const output = new PassThrough();

  try {
    const pendingSelection = multiSelectWithKeyboard({
      input: input as unknown as NodeJS.ReadStream,
      output,
      prompt: "Choose skills",
      choices: ["One", "Two"]
    });
    await new Promise((resolve) => setImmediate(resolve));
    input.write("\u001b");

    assert.deepEqual(await pendingSelection, []);
  } finally {
    input.destroy();
    output.destroy();
  }
});

test("selector renders its banner above the frame", async () => {
  const input = new PassThrough() as PassThrough & {
    isTTY: boolean;
    isRaw: boolean;
    setRawMode: (mode: boolean) => PassThrough;
  };
  input.isTTY = true;
  input.isRaw = false;
  input.setRawMode = (mode) => {
    input.isRaw = mode;
    return input;
  };
  const output = new PassThrough() as PassThrough & { columns: number };
  output.columns = 80;
  let transcript = "";
  output.on("data", (chunk: Buffer) => { transcript += chunk.toString("utf8"); });

  try {
    const pendingSelection = selectWithKeyboard({
      input: input as unknown as NodeJS.ReadStream,
      output,
      prompt: "Choose",
      choices: ["One"],
      banner: ["⠀⣀⡀⠀"]
    });
    await new Promise((resolve) => setImmediate(resolve));
    input.write("\r");
    await pendingSelection;

    const bannerIndex = transcript.indexOf("⠀⣀⡀⠀");
    assert.ok(bannerIndex >= 0, "banner is rendered");
    assert.ok(bannerIndex < transcript.indexOf("╭ NIX AI-STACK"), "banner precedes the frame");
  } finally {
    input.destroy();
    output.destroy();
  }
});

test("multi-select filters with the search text and toggles all visible rows", async () => {
  const input = new PassThrough() as PassThrough & {
    isTTY: boolean;
    isRaw: boolean;
    setRawMode: (mode: boolean) => PassThrough;
  };
  input.isTTY = true;
  input.isRaw = false;
  input.setRawMode = (mode) => {
    input.isRaw = mode;
    return input;
  };
  const output = new PassThrough() as PassThrough & { columns: number };
  output.columns = 80;
  let transcript = "";
  output.on("data", (chunk: Buffer) => { transcript += chunk.toString("utf8"); });

  try {
    const pendingSelection = multiSelectWithKeyboard({
      input: input as unknown as NodeJS.ReadStream,
      output,
      prompt: "Which skills?",
      choices: ["Brag video", "Python FastAPI", "Araxys integration"],
      initialSelected: [0, 1, 2]
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.match(transcript, /3\/3 selected/);
    input.write("python");
    input.write(" ");
    input.write("\r");

    assert.deepEqual(await pendingSelection, [0, 2]);
    assert.match(transcript, /Search: python/);
    assert.match(transcript, /Next → {2}\(2\/3 selected\)/);
  } finally {
    input.destroy();
    output.destroy();
  }
});

test("multi-select toggles every visible row with `a`", async () => {
  const input = new PassThrough() as PassThrough & {
    isTTY: boolean;
    isRaw: boolean;
    setRawMode: (mode: boolean) => PassThrough;
  };
  input.isTTY = true;
  input.isRaw = false;
  input.setRawMode = (mode) => {
    input.isRaw = mode;
    return input;
  };
  const output = new PassThrough() as PassThrough & { columns: number };
  output.columns = 80;

  try {
    const pendingSelection = multiSelectWithKeyboard({
      input: input as unknown as NodeJS.ReadStream,
      output,
      prompt: "Targets",
      choices: ["One", "Two"],
      initialSelected: [0, 1]
    });
    await new Promise((resolve) => setImmediate(resolve));
    input.write("a");
    input.write("\r");

    assert.deepEqual(await pendingSelection, []);
  } finally {
    input.destroy();
    output.destroy();
  }
});

test("redrawing a selection does not clear the screen again", async () => {
  const input = new PassThrough() as PassThrough & {
    isTTY: boolean;
    isRaw: boolean;
    setRawMode: (mode: boolean) => PassThrough;
  };
  input.isTTY = true;
  input.isRaw = false;
  input.setRawMode = (mode) => {
    input.isRaw = mode;
    return input;
  };
  const output = new PassThrough() as PassThrough & { columns: number };
  output.columns = 80;
  let transcript = "";
  output.on("data", (chunk: Buffer) => { transcript += chunk.toString("utf8"); });

  try {
    const pendingSelection = selectWithKeyboard({
      input: input as unknown as NodeJS.ReadStream,
      output,
      prompt: "Choose",
      choices: ["One", "Two"]
    });
    await new Promise((resolve) => setImmediate(resolve));
    input.write("\u001b[B");
    input.write("\u001b[B");
    input.write("\r");
    await pendingSelection;

    assert.doesNotMatch(transcript, /\u001b\[2J/, "no full-screen clear is used");
    assert.match(transcript, /\u001b\[\d+A/, "rows are redrawn in place");
    assert.match(transcript, /› One/, "first frame highlights the first row");
    assert.match(transcript, /› One[\s\S]*› Two/, "later frames highlight the moved row");
  } finally {
    input.destroy();
    output.destroy();
  }
});

test("frame stays within narrow terminal width", () => {  const output = new PassThrough() as PassThrough & { columns: number };
  output.columns = 20;
  let transcript = "";
  output.on("data", (chunk: Buffer) => { transcript += chunk.toString("utf8"); });

  try {
    writeFrame(output, "GLOBAL SECURITY HOOKS", ["A long option that needs wrapping"]);
    const frameRows = transcript.split("\n").filter((line) => line.startsWith("╭") || line.startsWith("│") || line.startsWith("╰"));
    assert.ok(frameRows.every((line) => line.length <= 20));
  } finally {
    output.destroy();
  }
});
