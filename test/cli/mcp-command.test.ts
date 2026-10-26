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
    encoding: "utf8",
  });
}

test("MCP CLI lists the catalog and previews without writing", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-cli-mcp-"));
  const restoreHome = useProjectHome(root);
  try {
    const list = runCli(["mcp:list"]);
    assert.equal(list.status, 0, list.stderr);
    assert.match(list.stdout, /playwright/);
    assert.match(list.stdout, /codegraph/);
    assert.match(list.stdout, /engram/);

    const preview = runCli(["mcp:preview", "--id=codegraph", "--agent=opencode", `--root=${root}`]);
    assert.equal(preview.status, 0, preview.stderr);
    assert.match(preview.stdout, /Scope: global/);
    assert.match(preview.stdout, /Network: none/);
    assert.match(preview.stdout, /Credentials: none required/);
    assert.match(preview.stdout, /Missing prerequisites/);
    await assert.rejects(readFile(path.join(root, ".config", "opencode", "opencode.json")), /ENOENT/);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("MCP CLI requires confirmation and prerequisites before installing", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-cli-mcp-"));
  const restoreHome = useProjectHome(root);
  const configPath = path.join(root, ".config", "opencode", "opencode.json");
  try {
    const denied = runCli(["mcp:install", "--id=codegraph", "--agent=codex", `--root=${root}`]);
    assert.notEqual(denied.status, 0);
    assert.match(denied.stderr, /--yes/);

    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(configPath, JSON.stringify({ mcp: { servers: { existing: { type: "remote", url: "https://example.test/mcp" } } } }, null, 2));
    const missing = runCli(["mcp:install", "--id=codegraph", "--agent=opencode", "--yes", `--root=${root}`]);
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /prerequisite/i);

    const prerequisite = path.join(root, "node_modules", "@astudioplus", "codegraph-mcp", "bin", "codegraph-mcp.js");
    await mkdir(path.dirname(prerequisite), { recursive: true });
    await writeFile(prerequisite, "// fixture\n");

    const installed = runCli(["mcp:install", "--id=codegraph", "--agent=opencode", "--yes", `--root=${root}`]);
    assert.equal(installed.status, 0, installed.stderr);
    assert.match(installed.stdout, /Installed|installed/);

    const status = runCli(["mcp:status", `--root=${root}`]);
    assert.equal(status.status, 0, status.stderr);
    assert.match(status.stdout, /codegraph.*current/i);

    const config = JSON.parse(await readFile(configPath, "utf8"));
    assert.ok(config.mcp.servers.codegraph);
    assert.deepEqual(config.mcp.servers.existing, { type: "remote", url: "https://example.test/mcp" });

    const removed = runCli(["mcp:remove", "--id=codegraph", "--agent=opencode", "--yes", `--root=${root}`]);
    assert.equal(removed.status, 0, removed.stderr);
    const after = JSON.parse(await readFile(configPath, "utf8"));
    assert.equal(after.mcp.servers.codegraph, undefined);
    assert.ok(after.mcp.servers.existing);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});
