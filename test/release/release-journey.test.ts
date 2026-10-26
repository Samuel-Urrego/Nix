import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { CodexSkillAdapter } from "../../src/core/components/codex-skill-adapter.js";
import type { ComponentManifest } from "../../src/core/components/component-catalog.js";
import { useProjectHome } from "../helpers/home.js";

const componentId = "skill.nix-core";
const targetRelativePath = ".agents/skills/nix-core";

async function createFixture(version = "1.0.0") {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nix-release-journey-"));
  const sourceRoot = path.join(directory, "repository");
  const projectRoot = path.join(directory, "project");
  await mkdir(path.join(sourceRoot, "source", "skill"), { recursive: true });
  await mkdir(projectRoot, { recursive: true });
  await writeFile(
    path.join(sourceRoot, "source", "skill", "SKILL.md"),
    `---\nname: nix-core\n---\n\nVersion ${version}\n`,
    "utf8"
  );
  const component: ComponentManifest = {
    id: componentId,
    name: "Nix Core",
    version,
    kind: "skill",
    agentTargets: ["codex"],
    installRelativePath: targetRelativePath,
    source: { kind: "nix-authored", relativePath: "source/skill", license: "Apache-2.0", dependencies: [] },
    files: [{ sourcePath: "source/skill/SKILL.md", targetPath: "SKILL.md" }]
  };
  return {
    directory,
    sourceRoot,
    projectRoot,
    component,
    adapter: new CodexSkillAdapter(sourceRoot, [component]),
    targetPath: path.join(projectRoot, ...targetRelativePath.split("/"))
  };
}

async function missing(file: string): Promise<boolean> {
  return (await lstat(file).catch(() => undefined)) === undefined;
}

test("release journey covers clean install, upgrade, backup/restore, and uninstall", async () => {
  const fixture = await createFixture("1.0.0");
  const restoreHome = useProjectHome(fixture.projectRoot);
  try {
    assert.equal((await fixture.adapter.preview(fixture.projectRoot, componentId)).action, "install");
    assert.equal((await fixture.adapter.install(fixture.projectRoot, componentId)).action, "installed");
    assert.match(await readFile(path.join(fixture.targetPath, "SKILL.md"), "utf8"), /Version 1\.0\.0/);

    await writeFile(
      path.join(fixture.sourceRoot, "source", "skill", "SKILL.md"),
      "---\nname: nix-core\n---\n\nVersion 2.0.0\n",
      "utf8"
    );
    const v2 = new CodexSkillAdapter(fixture.sourceRoot, [{ ...fixture.component, version: "2.0.0" }]);
    assert.equal((await v2.preview(fixture.projectRoot, componentId)).action, "update");
    const update = await v2.update(fixture.projectRoot, componentId);
    assert.equal(update.action, "updated");
    assert.ok(update.backupId);
    assert.match(await readFile(path.join(fixture.targetPath, "SKILL.md"), "utf8"), /Version 2\.0\.0/);

    const removal = await v2.uninstall(fixture.projectRoot, componentId);
    assert.equal(removal.action, "uninstalled");
    assert.ok(removal.backupId);
    assert.equal(await missing(fixture.targetPath), true);

    assert.equal((await v2.restore(fixture.projectRoot, componentId, removal.backupId!)).action, "restored");
    assert.match(await readFile(path.join(fixture.targetPath, "SKILL.md"), "utf8"), /Version 2\.0\.0/);

    assert.equal((await v2.uninstall(fixture.projectRoot, componentId)).action, "uninstalled");
    assert.equal(await missing(fixture.targetPath), true);
  } finally {
    restoreHome();
    await rm(fixture.directory, { recursive: true, force: true });
  }
});

test("a mid-write install failure cleans up the partial managed target", async () => {
  const fixture = await createFixture("1.0.0");
  const restoreHome = useProjectHome(fixture.projectRoot);
  try {
    await writeFile(path.join(fixture.sourceRoot, "source", "skill", "first"), "first\n", "utf8");
    await writeFile(path.join(fixture.sourceRoot, "source", "skill", "second"), "second\n", "utf8");
    const component: ComponentManifest = {
      ...fixture.component,
      files: [
        { sourcePath: "source/skill/first", targetPath: "a" },
        { sourcePath: "source/skill/second", targetPath: "a/b" }
      ]
    };
    const adapter = new CodexSkillAdapter(fixture.sourceRoot, [component]);

    await assert.rejects(
      adapter.install(fixture.projectRoot, componentId),
      /real directory|not a directory/i
    );
    assert.equal(await missing(fixture.targetPath), true);
  } finally {
    restoreHome();
    await rm(fixture.directory, { recursive: true, force: true });
  }
});

test("downgrades and same-version content replacements are refused", async () => {
  const fixture = await createFixture("2.0.0");
  const restoreHome = useProjectHome(fixture.projectRoot);
  try {
    await fixture.adapter.install(fixture.projectRoot, componentId);
    await writeFile(
      path.join(fixture.sourceRoot, "source", "skill", "SKILL.md"),
      "---\nname: nix-core\n---\n\nVersion 1.0.0\n",
      "utf8"
    );
    const v1 = new CodexSkillAdapter(fixture.sourceRoot, [{ ...fixture.component, version: "1.0.0" }]);
    const plan = await v1.preview(fixture.projectRoot, componentId);
    assert.equal(plan.action, "conflict");
    assert.match(plan.reason ?? "", /newer|downgrade/i);
    await assert.rejects(v1.update(fixture.projectRoot, componentId), /newer|downgrade|conflict/i);
    assert.match(await readFile(path.join(fixture.targetPath, "SKILL.md"), "utf8"), /Version 2\.0\.0/);
  } finally {
    restoreHome();
    await rm(fixture.directory, { recursive: true, force: true });
  }
});
