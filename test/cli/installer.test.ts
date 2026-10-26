import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = process.cwd();

test("Git installation builds the CLI during npm's prepare lifecycle", async () => {
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
    bin?: Record<string, string>;
  };
  assert.equal(pkg.scripts?.prepare, "npm run build");
  assert.equal(pkg.bin?.["nix-ai"], "./dist/cli/index.js");
});

test("PowerShell installer dry run reports its pinned source without installing", { skip: process.platform !== "win32" }, () => {
  const script = path.join(root, "scripts", "install.ps1");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-DryRun", "-Ref", "main"], {
    cwd: root,
    encoding: "utf8",
    timeout: 15_000
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /git\+https:\/\/github\.com\/Samuel-Urrego\/Nix\.git#main/i);
  assert.match(result.stdout, /dry run/i);
  const npmVersion = /npm:\s+v(\d+)\./i.exec(result.stdout)?.[1] ?? "0";
  const npmMajor = Number.parseInt(npmVersion, 10);
  if (npmMajor >= 11) assert.match(result.stdout, /--allow-scripts nix-ai-stack/);
});
