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

async function sourceFixture() {
  const source = await mkdtemp(path.join(os.tmpdir(), "nix-skill-source-"));
  await writeFile(path.join(source, "SKILL.md"), "---\nname: emil-design-eng\ndescription: fixture\n---\n\n# Fixture\n");
  await writeFile(path.join(source, "LICENSE"), "MIT License\n");
  return source;
}

test("skill CLI lists the catalog and previews provenance without writing", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-cli-skill-"));
  const restoreHome = useProjectHome(root);
  try {
    const list = runCli(["skill:list"]);
    assert.equal(list.status, 0, list.stderr);
    for (const id of ["brag", "grafana-k6", "security-audit", "rea", "emil-design-eng", "design-taste-frontend", "accessibility"]) {
      assert.match(list.stdout, new RegExp(id));
    }

    const preview = runCli(["skill:preview", "--id=brag", "--agent=codex", `--root=${root}`]);
    assert.equal(preview.status, 0, preview.stderr);
    assert.match(preview.stdout, /Scope: global/);
    assert.match(preview.stdout, /Source: https:\/\/github\.com\/latent-spaces\/brag@[a-f0-9]{40}/);
    assert.match(preview.stdout, /License: MIT/);
    assert.match(preview.stdout, /Dependencies:/);
    await assert.rejects(readFile(path.join(root, ".agents", "skills", "brag", "SKILL.md"), "utf8"), /ENOENT/);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("skill CLI installs from an explicit source, reports status, and removes only its target", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-cli-skill-"));
  const source = await sourceFixture();
  const restoreHome = useProjectHome(root);
  try {
    const denied = runCli(["skill:install", "--id=emil-design-eng", "--agent=codex", `--root=${root}`, `--source=${source}`]);
    assert.notEqual(denied.status, 0);
    assert.match(denied.stderr, /--yes/);

    const installed = runCli(["skill:install", "--id=emil-design-eng", "--agent=codex", `--root=${root}`, `--source=${source}`, "--yes"]);
    assert.equal(installed.status, 0, installed.stderr);
    assert.match(installed.stdout, /Installed|installed/);
    assert.match(await readFile(path.join(root, ".agents", "skills", "emil-design-eng", "SKILL.md"), "utf8"), /# Fixture/);

    const status = runCli(["skill:status", `--root=${root}`]);
    assert.equal(status.status, 0, status.stderr);
    assert.match(status.stdout, /emil-design-eng \[codex\]: current/);

    const removed = runCli(["skill:remove", "--id=emil-design-eng", "--agent=codex", `--root=${root}`, "--yes"]);
    assert.equal(removed.status, 0, removed.stderr);
    await assert.rejects(readFile(path.join(root, ".agents", "skills", "emil-design-eng", "SKILL.md"), "utf8"), /ENOENT/);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
    await rm(source, { recursive: true, force: true });
  }
});

test("skill CLI supports Security Audit in Codex, rejects unknown agents, and scaffolds project-authored skills", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-cli-skill-"));
  const restoreHome = useProjectHome(root);
  try {
    const codexPreview = runCli(["skill:preview", "--id=security-audit", "--agent=codex", `--root=${root}`]);
    assert.equal(codexPreview.status, 0, codexPreview.stderr);
    assert.match(codexPreview.stdout, /Source: https:\/\/github\.com\/cloudflare\/security-audit-skill/);

    const unsupported = runCli(["skill:install", "--id=security-audit", "--agent=claude", `--root=${root}`, "--yes"]);
    assert.notEqual(unsupported.status, 0);
    assert.match(unsupported.stderr, /Provide --agent=opencode or --agent=codex/);

    const scaffolded = runCli(["skill:new", "--id=release-notes", `--root=${root}`]);
    assert.equal(scaffolded.status, 0, scaffolded.stderr);
    assert.match(await readFile(path.join(root, ".agents", "skills", "release-notes", "SKILL.md"), "utf8"), /name: release-notes/);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});
