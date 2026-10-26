import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createWorkflow } from "../../src/core/workflows/workflow-engine.js";
import { getProjectWorkflowsDirectory } from "../../src/core/config/global-paths.js";
import {
  listWorkflowRecords,
  loadWorkflowRecord,
  saveWorkflowRecord,
  workflowRecordPath,
} from "../../src/core/workflows/workflow-store.js";
import { useProjectHome } from "../helpers/home.js";

test("workflow records persist under the global Nix home and survive a reload", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-workflow-store-"));
  const restoreHome = useProjectHome(root);
  try {
    const record = createWorkflow("sdd", "Persist the plan");
    const file = await saveWorkflowRecord(root, record);
    assert.equal(file, workflowRecordPath(root, record.id));
    assert.match(file, /[\\/]\.nix-ai[\\/]projects[\\/][a-f0-9]{16}[\\/]workflows[\\/]/);
    assert.deepEqual(await loadWorkflowRecord(root, record.id), record);
    assert.deepEqual((await listWorkflowRecords(root)).map((item) => item.id), [record.id]);
    assert.match(await readFile(file, "utf8"), /"kind": "sdd"/);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("missing directories list as empty and unsafe ids are rejected", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-workflow-store-"));
  const restoreHome = useProjectHome(root);
  try {
    assert.deepEqual(await listWorkflowRecords(root), []);
    await assert.rejects(loadWorkflowRecord(root, "../escape"), /invalid workflow id/i);
    assert.throws(() => workflowRecordPath(root, "..\\escape"), /invalid workflow id/i);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("malformed or unsupported records fail validation", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-workflow-store-"));
  const restoreHome = useProjectHome(root);
  try {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const directory = getProjectWorkflowsDirectory(root);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "bad.json"), JSON.stringify({ schemaVersion: 2 }));
    await assert.rejects(loadWorkflowRecord(root, "bad"), /schema version/i);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});
