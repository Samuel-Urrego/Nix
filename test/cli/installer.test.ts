import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = process.cwd();

test("package builds its CLI during the prepare lifecycle", async () => {
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as {
    scripts?: Record<string, string>;
    bin?: Record<string, string>;
  };
  assert.equal(pkg.scripts?.prepare, "npm run build");
  assert.equal(pkg.bin?.["nix-ai"], "./dist/cli/index.js");
});

test("PowerShell installer assigns stable error codes to each handled failure", async () => {
  const script = await readFile(path.join(root, "scripts", "install.ps1"), "utf8");
  const cases = [
    "NIX-INST-001", "NIX-INST-002", "NIX-INST-003", "NIX-INST-004",
    "NIX-INST-005", "NIX-INST-006", "NIX-INST-007", "NIX-INST-008",
    "NIX-INST-009", "NIX-INST-010", "NIX-INST-011", "NIX-INST-012",
    "NIX-INST-013", "NIX-INST-014", "NIX-INST-015", "NIX-INST-016",
    "NIX-INST-017", "NIX-INST-999"
  ];
  for (const code of cases) assert.ok(script.includes(code), `Missing installer error code ${code}`);
  const handledCodes = [...script.matchAll(/Stop-WithError\s+"(NIX-INST-\d{3})"/g)].map((match) => match[1]);
  for (const code of cases.slice(3, -1)) assert.ok(handledCodes.includes(code), `${code} is not attached to a handled failure`);
  assert.match(script, /Require-Command\s+"node"\s+"NIX-INST-001"/);
  assert.match(script, /Require-Command\s+"npm"\s+"NIX-INST-002"/);
  assert.match(script, /Require-Command\s+"git"\s+"NIX-INST-003"/);
  assert.match(script, /catch\s*\{[\s\S]*NIX-INST-999/);
});

test("PowerShell installer only installs the latest release tag and never runs lifecycle scripts", async () => {
  const script = await readFile(path.join(root, "scripts", "install.ps1"), "utf8");
  assert.match(script, /git ls-remote --tags --refs --sort=-v:refname \$repository "refs\/tags\/v\*"/);
  assert.match(script, /--global", "--prefix", \$installPrefix, "--ignore-scripts"/);
  assert.match(script, /releases\/download\/\$tag\/\$assetName/);
  assert.doesNotMatch(script, /--allow-scripts/);
  assert.doesNotMatch(script, /--foreground-scripts/);
  assert.doesNotMatch(script, /git\+https:\/\/github\.com\/Samuel-Urrego\/Nix\.git#/);
  assert.doesNotMatch(script, /\[string\]\$Ref/);
});

test("PowerShell installer dry run reports the tag install plan without downloading", { skip: process.platform !== "win32" }, () => {
  const script = path.join(root, "scripts", "install.ps1");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-DryRun"], {
    cwd: root,
    encoding: "utf8",
    timeout: 15_000
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = result.stdout;
  assert.match(output, /dry run/i);
  assert.match(output, /git ls-remote --tags --refs --sort=-v:refname/);
  assert.match(output, /releases\/download\//);
  assert.match(output, /--ignore-scripts/);
  assert.doesNotMatch(output, /--allow-scripts/);
  assert.doesNotMatch(output, /Downloading the prebuilt release artifact/);
});
