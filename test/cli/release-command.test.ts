import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
  const directory = await mkdtemp(path.join(os.tmpdir(), "nix-cli-release-"));
  const projectRoot = path.join(directory, "project");
  const appData = path.join(directory, "appdata");
  await mkdir(path.join(projectRoot, "dist", "cli"), { recursive: true });
  await mkdir(appData, { recursive: true });
  await writeFile(path.join(projectRoot, "dist", "cli", "index.js"), "console.log('nix');\n", "utf8");
  await writeFile(path.join(projectRoot, "dist", "README.txt"), "release\n", "utf8");
  return { directory, projectRoot, appData };
}

test("--version prints the package version", async () => {
  const value = await fixture();
  try {
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8")) as { version: string };
    const result = runCli(["--version"], value.appData);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), packageJson.version);
  } finally {
    await rm(value.directory, { recursive: true, force: true });
  }
});

test("release:manifest writes a checksum manifest and release:verify accepts it", async () => {
  const value = await fixture();
  try {
    const json = runCli(["release:manifest", `--root=${value.projectRoot}`, "--json"], value.appData);
    assert.equal(json.status, 0, json.stderr);
    const manifest = JSON.parse(json.stdout) as { files: Array<{ path: string }>; version: string };
    assert.equal(manifest.version, "0.1.0");
    assert.deepEqual(manifest.files.map((file) => file.path), ["README.txt", "cli/index.js"]);

    const written = runCli(
      ["release:manifest", `--root=${value.projectRoot}`, "--out=dist/release-manifest.json"],
      value.appData
    );
    assert.equal(written.status, 0, written.stderr);
    assert.match(await readFile(path.join(value.projectRoot, "dist", "release-manifest.json"), "utf8"), /"schemaVersion": 1/);

    const verified = runCli(
      ["release:verify", `--root=${value.projectRoot}`, "--manifest=dist/release-manifest.json"],
      value.appData
    );
    assert.equal(verified.status, 0, verified.stderr);
    assert.match(verified.stdout, /verified|OK/i);

    await writeFile(path.join(value.projectRoot, "dist", "cli", "index.js"), "tampered\n", "utf8");
    const broken = runCli(
      ["release:verify", `--root=${value.projectRoot}`, "--manifest=dist/release-manifest.json"],
      value.appData
    );
    assert.notEqual(broken.status, 0);
    assert.match(broken.stderr, /modified/i);
  } finally {
    await rm(value.directory, { recursive: true, force: true });
  }
});
