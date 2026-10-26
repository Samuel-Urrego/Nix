import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { loadStackState, saveStackState, type StackState } from "../../src/core/config/stack-state.js";

test("missing state returns versioned empty defaults without creating a file", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nix-state-"));
  try {
    const file = path.join(directory, "state.json");
    assert.deepEqual(await loadStackState(file), { schemaVersion: 1, selectedComponents: [], agentTargets: [], workflows: { sdd: false, tdd: false } });
    await assert.rejects(readFile(file));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("state round-trips and preserves the previous versioned file as a backup", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nix-state-"));
  try {
    const file = path.join(directory, "state.json");
    const state: StackState = { schemaVersion: 1, selectedComponents: ["workflow.sdd"], agentTargets: ["codex"], workflows: { sdd: true, tdd: false } };
    await saveStackState(file, state);
    await saveStackState(file, { ...state, agentTargets: ["codex", "opencode"] });
    assert.deepEqual(await loadStackState(file), { ...state, agentTargets: ["codex", "opencode"] });
    assert.deepEqual(JSON.parse(await readFile(`${file}.bak`, "utf8")), state);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("older state without workflow settings derives independent SDD and TDD flags", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nix-state-"));
  try {
    const file = path.join(directory, "state.json");
    const { writeFile } = await import("node:fs/promises");
    await writeFile(file, JSON.stringify({ schemaVersion: 1, selectedComponents: ["workflow.tdd", "other"], agentTargets: [] }));
    assert.deepEqual((await loadStackState(file)).workflows, { sdd: false, tdd: true });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("workflow settings round-trip independently", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nix-state-"));
  try {
    const file = path.join(directory, "state.json");
    await saveStackState(file, { schemaVersion: 1, selectedComponents: ["workflow.tdd"], agentTargets: [], workflows: { sdd: false, tdd: true } });
    assert.deepEqual((await loadStackState(file)).workflows, { sdd: false, tdd: true });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("unsupported schema versions and malformed selections fail without overwriting", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nix-state-"));
  try {
    const file = path.join(directory, "state.json");
    await import("node:fs/promises").then(({ writeFile }) => writeFile(file, '{"schemaVersion":9,"selectedComponents":[],"agentTargets":[]}'));
    await assert.rejects(loadStackState(file), /Unsupported stack state schema version: 9/);
    await import("node:fs/promises").then(({ writeFile }) => writeFile(file, '{"schemaVersion":1,"selectedComponents":[4],"agentTargets":[]}'));
    await assert.rejects(loadStackState(file), /selectedComponents must contain only strings/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
