import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { useProjectHome } from "../helpers/home.js";

const repoRoot = process.cwd();
const cliPath = path.join(repoRoot, "src", "cli", "index.ts");

function runCli(args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", cliPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
}

test("component lifecycle CLI previews without writing and requires explicit confirmation", async () => {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), "nix-cli-component-"));
  const restoreHome = useProjectHome(projectRoot);
  try {
    await mkdir(path.join(projectRoot, ".agents", "skills", "unrelated"), { recursive: true });
    await writeFile(path.join(projectRoot, "AGENTS.md"), "user instructions\n");
    await writeFile(path.join(projectRoot, ".agents", "skills", "unrelated", "SKILL.md"), "user skill\n");
    const preview = runCli(["component", "--action=preview", "--component=skill.nix-core", `--root=${projectRoot}`]);
    assert.equal(preview.status, 0, preview.stderr);
    assert.match(preview.stdout, /Would install Nix Core/);

    const denied = runCli(["component", "--action=install", "--component=skill.nix-core", `--root=${projectRoot}`]);
    assert.notEqual(denied.status, 0);
    assert.match(denied.stderr, /--yes/);

    const target = path.join(projectRoot, ".agents", "skills", "nix-core", "SKILL.md");
    await assert.rejects(readFile(target));

    const install = runCli(["component", "--action=install", "--component=skill.nix-core", "--yes", `--root=${projectRoot}`]);
    assert.equal(install.status, 0, install.stderr);
    assert.match(install.stdout, /Installed Nix Core/);
    assert.match(await readFile(target, "utf8"), /name: nix-core/);
    assert.equal((await readFile(path.join(projectRoot, "AGENTS.md"), "utf8")), "user instructions\n");
    assert.equal((await readFile(path.join(projectRoot, ".agents", "skills", "unrelated", "SKILL.md"), "utf8")), "user skill\n");

    const backup = runCli(["component", "--action=backup", "--component=skill.nix-core", "--yes", `--root=${projectRoot}`]);
    assert.equal(backup.status, 0, backup.stderr);
    const backupId = backup.stdout.match(/Backup: (\S+)/)?.[1];
    assert.ok(backupId);
    const listed = runCli(["component", "--action=list-backups", "--component=skill.nix-core", `--root=${projectRoot}`]);
    assert.equal(listed.status, 0, listed.stderr);
    assert.match(listed.stdout, new RegExp(backupId!));

    const uninstall = runCli(["component", "--action=uninstall", "--component=skill.nix-core", "--yes", `--root=${projectRoot}`]);
    assert.equal(uninstall.status, 0, uninstall.stderr);
    await assert.rejects(readFile(target));
    const restore = runCli(["component", "--action=restore", "--component=skill.nix-core", `--backup=${backupId}`, "--yes", `--root=${projectRoot}`]);
    assert.equal(restore.status, 0, restore.stderr);
    assert.match(await readFile(target, "utf8"), /name: nix-core/);
  } finally {
    restoreHome();
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("CLI help documents component actions and the confirmation boundary", () => {
  const help = runCli(["help"]);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /--action=preview\|install\|update\|backup\|list-backups\|restore\|uninstall/);
  assert.match(help.stdout, /Mutating actions require --yes and write to global agent targets/);
});
