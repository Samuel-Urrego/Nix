import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parseTaskRows, readProjectTasks } from "../../src/core/tasks/task-documents.js";

const document = `# Feature one

Objective: prove the parser.

## Tasks

| ID | Specs | Route | Status | Commit / Evidence |
|----|-------|-------|--------|-------------------|
| T1 | S1 | Inline | Done - shipped | \`abc1234\` |
| T2 | S1, S2 | Inline | Pending | - |
| T3 | S3 | Delegated | Done - reviewed | \`def5678\` |

## Log

- L1 — something that is not a task row.
`;

test("task rows carry their id, specs, route and done state", () => {
  const tasks = parseTaskRows(document);
  assert.deepEqual(tasks.map((task) => [task.id, task.specs, task.done]), [
    ["T1", "S1", true],
    ["T2", "S1, S2", false],
    ["T3", "S3", true]
  ]);
  assert.equal(tasks[0]?.route, "Inline");
  assert.match(tasks[0]?.status ?? "", /^Done/);
});

test("a project with no task directory reports no tasks instead of failing", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-tasks-"));
  try {
    assert.deepEqual(await readProjectTasks(root), []);
    await mkdir(path.join(root, "odd", "tasks"), { recursive: true });
    await writeFile(path.join(root, "odd", "tasks", "feature.md"), document, "utf8");
    const documents = await readProjectTasks(root);
    assert.equal(documents.length, 1);
    assert.equal(documents[0]?.title, "Feature one");
    assert.equal(documents[0]?.file, "feature.md");
    assert.equal(documents[0]?.tasks.length, 3);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
