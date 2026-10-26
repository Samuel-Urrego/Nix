import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { scaffoldGlobalSkill } from "../../src/core/skills/skill-authoring.js";
import { useProjectHome } from "../helpers/home.js";

test("skill authoring scaffolds the normative global user-skill structure", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-skill-authoring-"));
  const restoreHome = useProjectHome(root);
  try {
    const result = await scaffoldGlobalSkill("release-notes", "codex");
    assert.match(result.targetPath, /\.agents[\\/]skills[\\/]release-notes$/);
    const skill = await readFile(path.join(result.targetPath, "SKILL.md"), "utf8");
    assert.match(skill, /^---\nname: release-notes\n/m);
    assert.match(skill, /license: Apache-2\.0/);
    assert.match(skill, /## Activation Contract/);
    assert.match(skill, /## Hard Rules/);
    assert.match(skill, /## Decision Gates/);
    assert.match(skill, /## Execution Steps/);
    assert.match(skill, /## Output Contract/);
    assert.match(skill, /## References/);
    assert.equal(await readFile(path.join(result.targetPath, "references", ".gitkeep"), "utf8"), "");
    assert.equal(await readFile(path.join(result.targetPath, "assets", ".gitkeep"), "utf8"), "");
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("skill authoring rejects invalid ids and existing targets", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-skill-authoring-"));
  const restoreHome = useProjectHome(root);
  try {
    await assert.rejects(scaffoldGlobalSkill("Bad Id", "codex"), /invalid/i);
    await scaffoldGlobalSkill("release-notes", "codex");
    await assert.rejects(scaffoldGlobalSkill("release-notes", "codex"), /exists/i);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});
