import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { CodexSkillAdapter } from "../../src/core/components/codex-skill-adapter.js";
import type { ComponentManifest } from "../../src/core/components/component-catalog.js";
import { useProjectHome } from "../helpers/home.js";

const componentId = "skill.nix-core";

async function createFixture(version = "1.0.0") {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nix-codex-adapter-"));
  const sourceRoot = path.join(directory, "repository");
  const projectRoot = path.join(directory, "project");
  await mkdir(path.join(sourceRoot, "source", "skill"), { recursive: true });
  await mkdir(projectRoot, { recursive: true });
  const restoreHome = useProjectHome(projectRoot);
  await writeFile(path.join(sourceRoot, "source", "skill", "SKILL.md"), `---\nname: nix-core\n---\n\nVersion ${version}\n`);
  const component: ComponentManifest = {
    id: componentId,
    name: "Nix Core",
    version,
    kind: "skill",
    agentTargets: ["codex"],
    installRelativePath: ".agents/skills/nix-core",
    source: { kind: "nix-authored", relativePath: "source/skill", license: "Apache-2.0", dependencies: [] },
    files: [{ sourcePath: "source/skill/SKILL.md", targetPath: "SKILL.md" }]
  };
  return { directory, sourceRoot, projectRoot, component, restoreHome, adapter: new CodexSkillAdapter(sourceRoot, [component]) };
}

async function cleanup(fixture: { readonly directory: string; readonly restoreHome: () => void }): Promise<void> {
  fixture.restoreHome();
  await rm(fixture.directory, { recursive: true, force: true });
}

test("preview is read-only and reports a fresh project-local install", async () => {
  const fixture = await createFixture();
  try {
    await writeFile(path.join(fixture.projectRoot, "AGENTS.md"), "user instructions\n");
    const preview = await fixture.adapter.preview(fixture.projectRoot, componentId);
    assert.equal(preview.action, "install");
    assert.match(preview.targetPath, /\.agents[\\/]skills[\\/]nix-core$/);
    assert.equal((await readdir(fixture.projectRoot)).join(","), "AGENTS.md");
  } finally {
    await cleanup(fixture);
  }
});

test("install is idempotent and leaves unrelated project files unchanged", async () => {
  const fixture = await createFixture();
  try {
    await mkdir(path.join(fixture.projectRoot, ".agents", "skills", "other"), { recursive: true });
    await writeFile(path.join(fixture.projectRoot, "AGENTS.md"), "user instructions\n");
    await writeFile(path.join(fixture.projectRoot, ".agents", "skills", "other", "SKILL.md"), "user skill\n");
    const first = await fixture.adapter.install(fixture.projectRoot, componentId);
    const second = await fixture.adapter.install(fixture.projectRoot, componentId);
    assert.equal(first.action, "installed");
    assert.equal(second.action, "already-current");
    assert.equal(await readFile(path.join(fixture.projectRoot, ".agents", "skills", "nix-core", "SKILL.md"), "utf8"), "---\nname: nix-core\n---\n\nVersion 1.0.0\n");
    assert.equal(await readFile(path.join(fixture.projectRoot, "AGENTS.md"), "utf8"), "user instructions\n");
    assert.equal(await readFile(path.join(fixture.projectRoot, ".agents", "skills", "other", "SKILL.md"), "utf8"), "user skill\n");
  } finally {
    await cleanup(fixture);
  }
});

test("install refuses an unowned destination without changing its contents", async () => {
  const fixture = await createFixture();
  try {
    const target = path.join(fixture.projectRoot, ".agents", "skills", "nix-core");
    await mkdir(target, { recursive: true });
    await writeFile(path.join(target, "SKILL.md"), "user-owned skill\n");
    assert.equal((await fixture.adapter.preview(fixture.projectRoot, componentId)).action, "conflict");
    await assert.rejects(fixture.adapter.install(fixture.projectRoot, componentId), /unowned|conflict/i);
    assert.equal(await readFile(path.join(target, "SKILL.md"), "utf8"), "user-owned skill\n");
  } finally {
    await cleanup(fixture);
  }
});

test("update and uninstall create recoverable backups; restore refuses to overwrite", async () => {
  const fixture = await createFixture();
  try {
    await fixture.adapter.install(fixture.projectRoot, componentId);
    const v2 = { ...fixture.component, version: "2.0.0" };
    await writeFile(path.join(fixture.sourceRoot, "source", "skill", "SKILL.md"), "---\nname: nix-core\n---\n\nVersion 2.0.0\n");
    const v2Adapter = new CodexSkillAdapter(fixture.sourceRoot, [v2]);
    assert.equal((await v2Adapter.preview(fixture.projectRoot, componentId)).action, "update");
    const update = await v2Adapter.update(fixture.projectRoot, componentId);
    assert.equal(update.action, "updated");
    assert.ok(update.backupId);
    await assert.rejects(v2Adapter.restore(fixture.projectRoot, componentId, update.backupId!), /destination.*exists|overwrite/i);

    const removal = await v2Adapter.uninstall(fixture.projectRoot, componentId);
    assert.equal(removal.action, "uninstalled");
    assert.ok(removal.backupId);
    assert.equal((await lstat(path.join(fixture.projectRoot, ".agents", "skills", "nix-core")).catch(() => undefined)), undefined);
    assert.equal((await readdir(path.join(fixture.projectRoot, ".agents", "skills"))).includes("nix-core"), false);
    assert.ok((await readdir(path.join(fixture.projectRoot, ".nix-ai", "backups", "components", "skill.nix-core"))).length >= 2);
    assert.equal((await v2Adapter.restore(fixture.projectRoot, componentId, removal.backupId!)).action, "restored");
    assert.equal(await readFile(path.join(fixture.projectRoot, ".agents", "skills", "nix-core", "SKILL.md"), "utf8"), "---\nname: nix-core\n---\n\nVersion 2.0.0\n");
  } finally {
    await cleanup(fixture);
  }
});

test("modified managed content blocks update and uninstall", async () => {
  const fixture = await createFixture();
  try {
    await fixture.adapter.install(fixture.projectRoot, componentId);
    const skillPath = path.join(fixture.projectRoot, ".agents", "skills", "nix-core", "SKILL.md");
    await writeFile(skillPath, "user edits\n");
    const v2 = new CodexSkillAdapter(fixture.sourceRoot, [{ ...fixture.component, version: "2.0.0" }]);
    await assert.rejects(v2.update(fixture.projectRoot, componentId), /modified|ownership|digest/i);
    await assert.rejects(v2.uninstall(fixture.projectRoot, componentId), /modified|ownership|digest/i);
    assert.equal(await readFile(skillPath, "utf8"), "user edits\n");
    assert.deepEqual(await v2.listBackups(fixture.projectRoot, componentId), []);
  } finally {
    await cleanup(fixture);
  }
});

test("restore rejects a tampered backup payload", async () => {
  const fixture = await createFixture();
  try {
    await fixture.adapter.install(fixture.projectRoot, componentId);
    const { backupId } = await fixture.adapter.backup(fixture.projectRoot, componentId);
    assert.ok(backupId);
    await fixture.adapter.uninstall(fixture.projectRoot, componentId);
    const payloadPath = path.join(fixture.projectRoot, ".nix-ai", "backups", "components", componentId, backupId!, "payload", "SKILL.md");
    await writeFile(payloadPath, "tampered backup\n");
    await assert.rejects(fixture.adapter.restore(fixture.projectRoot, componentId, backupId!), /backup.*invalid|digest/i);
    assert.equal((await readdir(path.join(fixture.projectRoot, ".agents", "skills"))).includes("nix-core"), false);
  } finally {
    await cleanup(fixture);
  }
});

test("symlinked target ancestors are rejected without writing outside the project", async (t) => {
  const fixture = await createFixture();
  try {
    const outside = path.join(fixture.directory, "outside");
    await mkdir(outside);
    await mkdir(path.join(fixture.projectRoot, ".agents"), { recursive: true });
    try {
      await symlink(outside, path.join(fixture.projectRoot, ".agents", "skills"), "junction");
    } catch (error) {
      if (["EPERM", "EACCES"].includes((error as NodeJS.ErrnoException).code ?? "")) {
        t.skip("Windows symlink creation is unavailable in this environment");
        return;
      }
      throw error;
    }
    await assert.rejects(fixture.adapter.install(fixture.projectRoot, componentId), /symlink/i);
    assert.equal((await readdir(outside)).length, 0);
  } finally {
    await cleanup(fixture);
  }
});

test("manifest traversal paths are rejected", async () => {
  const fixture = await createFixture();
  try {
    const unsafe: ComponentManifest = { ...fixture.component, installRelativePath: "../outside" };
    const adapter = new CodexSkillAdapter(fixture.sourceRoot, [unsafe]);
    await assert.rejects(adapter.install(fixture.projectRoot, componentId), /path|relative|traversal/i);
    assert.equal((await readdir(fixture.projectRoot)).length, 0);
  } finally {
    await cleanup(fixture);
  }
});
