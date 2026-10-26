import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { componentCatalog, getComponent } from "../../src/core/components/component-catalog.js";

test("Nix Core catalog entry declares Codex project scope and Apache provenance", () => {
  const component = getComponent("skill.nix-core");
  assert.ok(component);
  assert.equal(component.name, "Nix Core");
  assert.equal(component.version, "1.0.0");
  assert.equal(component.source.license, "Apache-2.0");
  assert.equal(component.source.kind, "nix-authored");
  assert.deepEqual(component.agentTargets, ["codex"]);
  assert.equal(component.installRelativePath, ".agents/skills/nix-core");
  assert.deepEqual(component.files, [{ sourcePath: "skills/nix-core/SKILL.md", targetPath: "SKILL.md" }]);
  assert.equal(componentCatalog.length, 1);
});

test("Nix Core source skill has required metadata and operational sections", async () => {
  const source = await readFile(path.join(process.cwd(), "skills", "nix-core", "SKILL.md"), "utf8");
  assert.match(source, /^---\r?\nname: nix-core\r?\ndescription: ".+"\r?\nlicense: Apache-2\.0\r?\nmetadata:\r?\n  author: "surre"\r?\n  version: "1\.0"\r?\n---/);
  for (const section of ["Activation Contract", "Hard Rules", "Decision Gates", "Execution Steps", "Output Contract", "References"]) {
    assert.ok(source.includes(`## ${section}`), `missing section: ${section}`);
  }
});
