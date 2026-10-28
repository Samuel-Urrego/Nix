import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = process.cwd();
const cliPath = path.join(repoRoot, "src", "cli", "index.ts");

function runCli(args: string[], appData: string) {
  return spawnSync(process.execPath, ["--import", "tsx", cliPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, APPDATA: appData }
  });
}

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nix-cli-first-run-"));
  const projectRoot = path.join(directory, "project");
  const appData = path.join(directory, "appdata");
  await mkdir(projectRoot, { recursive: true });
  await mkdir(appData, { recursive: true });
  return { directory, projectRoot, appData };
}

test("clean-machine first run diagnoses, configures, installs, backs up, restores, and removes a component", async () => {
  const value = await fixture();
  const target = path.join(process.env.HOME ?? "", ".agents", "skills", "nix-core", "SKILL.md");
  const configPath = path.join(process.env.NIX_AI_HOME ?? path.join(value.appData, "Nix AI Stack"), "config.json");
  try {
    const doctor = runCli(["doctor", `--root=${value.projectRoot}`], value.appData);
    assert.equal(doctor.status, 0, doctor.stderr);
    assert.match(doctor.stdout, /Status: bootstrap-ready/);
    const packageVersion = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8")) as { version: string };
    assert.ok(doctor.stdout.includes(`Version: ${packageVersion.version}`), doctor.stdout);

    const config = runCli(["config:init", `--root=${value.projectRoot}`], value.appData);
    assert.equal(config.status, 0, config.stderr);
    assert.match(await readFile(configPath, "utf8"), /projectName/);

    const preview = runCli(["component", "--action=preview", "--component=skill.nix-core", `--root=${value.projectRoot}`], value.appData);
    assert.equal(preview.status, 0, preview.stderr);
    assert.match(preview.stdout, /Would install Nix Core/);

    const install = runCli(["component", "--action=install", "--component=skill.nix-core", "--yes", `--root=${value.projectRoot}`], value.appData);
    assert.equal(install.status, 0, install.stderr);
    assert.match(install.stdout, /Installed Nix Core/);
    assert.match(await readFile(target, "utf8"), /name: nix-core/);

    const backup = runCli(["component", "--action=backup", "--component=skill.nix-core", "--yes", `--root=${value.projectRoot}`], value.appData);
    assert.equal(backup.status, 0, backup.stderr);
    const backupId = backup.stdout.match(/Backup: (\S+)/)?.[1];
    assert.ok(backupId);

    const uninstall = runCli(["component", "--action=uninstall", "--component=skill.nix-core", "--yes", `--root=${value.projectRoot}`], value.appData);
    assert.equal(uninstall.status, 0, uninstall.stderr);
    await assert.rejects(readFile(target));

    const restore = runCli(
      ["component", "--action=restore", "--component=skill.nix-core", `--backup=${backupId}`, "--yes", `--root=${value.projectRoot}`],
      value.appData
    );
    assert.equal(restore.status, 0, restore.stderr);
    assert.match(await readFile(target, "utf8"), /name: nix-core/);

    const finalRemove = runCli(["component", "--action=uninstall", "--component=skill.nix-core", "--yes", `--root=${value.projectRoot}`], value.appData);
    assert.equal(finalRemove.status, 0, finalRemove.stderr);
    await assert.rejects(readFile(target));
  } finally {
    await rm(value.directory, { recursive: true, force: true });
  }
});
