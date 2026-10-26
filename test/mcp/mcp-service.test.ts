import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { findMcpEntry } from "../../src/core/mcp/mcp-catalog.js";
import {
  getMcpStatus,
  installMcp,
  previewMcp,
  removeMcp,
  updateMcp,
} from "../../src/core/mcp/mcp-service.js";
import { useProjectHome } from "../helpers/home.js";

const codegraphPrerequisite = "node_modules/@astudioplus/codegraph-mcp/bin/codegraph-mcp.js";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-mcp-service-"));
  const restoreHome = useProjectHome(root);
  return { root, restoreHome };
}

function openCodeConfigPath(root: string): string {
  return path.join(root, ".config", "opencode", "opencode.json");
}

async function satisfyCodegraph(root: string) {
  const file = path.join(root, ...codegraphPrerequisite.split("/"));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, "// fixture\n");
}

test("preview is read-only and discloses scope, network, credentials, and prerequisites", async () => {
  const { root, restoreHome } = await fixture();
  try {
    const plan = await previewMcp(root, "codegraph", "opencode");
    assert.equal(plan.action, "install");
    assert.equal(plan.scope, "global");
    assert.equal(plan.networkAccess, "none");
    assert.equal(plan.credentials.required, false);
    assert.deepEqual(plan.prerequisites.missing, ["CodeGraph MCP package is installed in this project"]);
    assert.match(plan.targetPath, /opencode\.json$/);
    await assert.rejects(readFile(openCodeConfigPath(root)), /ENOENT/);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("install requires prerequisites, then reports current and preserves unrelated servers", async () => {
  const { root, restoreHome } = await fixture();
  try {
    await assert.rejects(installMcp(root, "codegraph", "opencode"), /prerequisite/i);
    await satisfyCodegraph(root);
    await mkdir(path.dirname(openCodeConfigPath(root)), { recursive: true });
    await writeFile(openCodeConfigPath(root), JSON.stringify({ mcp: { servers: { existing: { type: "remote", url: "https://example.test/mcp" } } } }, null, 2));

    const installed = await installMcp(root, "codegraph", "opencode");
    assert.equal(installed.action, "installed");
    assert.equal((await previewMcp(root, "codegraph", "opencode")).action, "already-current");
    const status = await getMcpStatus(root);
    assert.equal(status.find((item) => item.id === "codegraph" && item.agent === "opencode")?.state, "current");
    const config = JSON.parse(await readFile(openCodeConfigPath(root), "utf8"));
    assert.deepEqual(config.mcp.servers.existing, { type: "remote", url: "https://example.test/mcp" });
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("a same-name user-owned server is a conflict, never an overwrite", async () => {
  const { root, restoreHome } = await fixture();
  try {
    await satisfyCodegraph(root);
    const userServer = { type: "local", command: ["user-owned"] };
    await mkdir(path.dirname(openCodeConfigPath(root)), { recursive: true });
    await writeFile(openCodeConfigPath(root), JSON.stringify({ mcp: { servers: { codegraph: userServer } } }, null, 2));
    assert.equal((await previewMcp(root, "codegraph", "opencode")).action, "conflict");
    await assert.rejects(installMcp(root, "codegraph", "opencode"), /not managed|user-owned/i);
    assert.deepEqual(JSON.parse(await readFile(openCodeConfigPath(root), "utf8")).mcp.servers.codegraph, userServer);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("update rewrites only a managed and modified entry; remove refuses modified content", async () => {
  const { root, restoreHome } = await fixture();
  try {
    await satisfyCodegraph(root);
    await installMcp(root, "codegraph", "codex");
    const configPath = path.join(root, ".codex", "config.toml");
    const tampered = (await readFile(configPath, "utf8")).replace('command = "node"', 'command = "tampered"');
    await writeFile(configPath, tampered);
    assert.equal((await previewMcp(root, "codegraph", "codex")).action, "conflict");
    assert.equal((await getMcpStatus(root)).find((item) => item.id === "codegraph" && item.agent === "codex")?.state, "modified");
    await assert.rejects(removeMcp(root, "codegraph", "codex"), /modified/i);

    const updated = await updateMcp(root, "codegraph", "codex");
    assert.equal(updated.action, "updated");
    assert.match(await readFile(configPath, "utf8"), /command = "node"/);
    assert.equal((await removeMcp(root, "codegraph", "codex")).action, "removed");
    assert.equal((await getMcpStatus(root)).find((item) => item.id === "codegraph" && item.agent === "codex")?.state, "absent");
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("invalid OpenCode configuration is diagnosed without writing", async () => {
  const { root, restoreHome } = await fixture();
  try {
    await mkdir(path.dirname(openCodeConfigPath(root)), { recursive: true });
    await writeFile(openCodeConfigPath(root), "{");
    const status = await getMcpStatus(root);
    assert.ok(status.some((item) => item.agent === "opencode" && item.state === "invalid"));
    const plan = await previewMcp(root, "playwright", "opencode");
    assert.equal(plan.action, "conflict");
    assert.match(plan.reason ?? "", /invalid OpenCode (JSONC|configuration)/i);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("Playwright preview reports first-run network access without writing", async () => {
  const { root, restoreHome } = await fixture();
  try {
    const plan = await previewMcp(root, "playwright", "codex");
    assert.equal(plan.action, "install");
    assert.equal(plan.networkAccess, "first-run");
    assert.deepEqual(plan.prerequisites.missing, []);
    assert.ok(findMcpEntry("playwright"));
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});
