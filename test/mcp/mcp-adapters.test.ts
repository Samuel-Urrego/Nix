import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createOpenCodeMcpAdapter } from "../../src/core/mcp/opencode-mcp-adapter.js";
import { createCodexMcpAdapter } from "../../src/core/mcp/codex-mcp-adapter.js";
import { useProjectHome } from "../helpers/home.js";

const server = {
  type: "local" as const,
  command: ["npx", "-y", "@playwright/mcp@latest"],
  environment: { LOG_LEVEL: "info" },
  timeout: 30000,
};

async function fixture(prefix: string) {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  const restoreHome = useProjectHome(root);
  return { root, restoreHome };
}

function openCodeConfigPath(root: string): string {
  return path.join(root, ".config", "opencode", "opencode.json");
}

test("OpenCode adapter writes one server and preserves unrelated settings", async () => {
  const { root, restoreHome } = await fixture("nix-mcp-opencode-");
  try {
    await mkdir(path.dirname(openCodeConfigPath(root)), { recursive: true });
    await writeFile(openCodeConfigPath(root), JSON.stringify({ $schema: "https://opencode.ai/config.json", model: "keep-me", mcp: { servers: { existing: { type: "remote", url: "https://example.test/mcp" } } } }, null, 2));
    const adapter = createOpenCodeMcpAdapter();
    await adapter.writeServer(root, "playwright", server);
    const config = JSON.parse(await readFile(openCodeConfigPath(root), "utf8"));
    assert.equal(config.model, "keep-me");
    assert.equal(config.$schema, "https://opencode.ai/config.json");
    assert.deepEqual(config.mcp.servers.existing, { type: "remote", url: "https://example.test/mcp" });
    assert.deepEqual(await adapter.readServer(root, "playwright"), server);
    assert.deepEqual(await adapter.listServers(root), ["existing", "playwright"]);

    await adapter.removeServer(root, "playwright");
    const after = JSON.parse(await readFile(openCodeConfigPath(root), "utf8"));
    assert.deepEqual(Object.keys(after.mcp.servers), ["existing"]);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("OpenCode adapter refuses malformed JSON and detects legacy duplicates", async () => {
  const { root, restoreHome } = await fixture("nix-mcp-opencode-");
  try {
    await mkdir(path.dirname(openCodeConfigPath(root)), { recursive: true });
    const adapter = createOpenCodeMcpAdapter();
    await writeFile(openCodeConfigPath(root), "{");
    await assert.rejects(adapter.readServer(root, "playwright"), /invalid OpenCode (JSONC|configuration)/i);

    await writeFile(openCodeConfigPath(root), JSON.stringify({ mcp: { playwright: server } }, null, 2));
    assert.deepEqual(await adapter.readServer(root, "playwright"), server);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("Codex adapter writes, reads, and removes only the managed section", async () => {
  const { root, restoreHome } = await fixture("nix-mcp-codex-");
  try {
    await mkdir(path.join(root, ".codex"), { recursive: true });
    const configPath = path.join(root, ".codex", "config.toml");
    await writeFile(configPath, '# user comment\nmodel = "keep-me"\n\n[mcp_servers.existing]\ncommand = "keep"\n');
    const adapter = createCodexMcpAdapter();
    await adapter.writeServer(root, "playwright", server);
    const written = await readFile(configPath, "utf8");
    assert.match(written, /# user comment/);
    assert.match(written, /model = "keep-me"/);
    assert.match(written, /\[mcp_servers\.existing\]/);
    assert.deepEqual(await adapter.readServer(root, "playwright"), server);

    await adapter.removeServer(root, "playwright");
    const after = await readFile(configPath, "utf8");
    assert.doesNotMatch(after, /mcp_servers\.playwright/);
    assert.match(after, /\[mcp_servers\.existing\]/);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});

test("Codex adapter rejects duplicate managed sections", async () => {
  const { root, restoreHome } = await fixture("nix-mcp-codex-");
  try {
    await mkdir(path.join(root, ".codex"), { recursive: true });
    await writeFile(path.join(root, ".codex", "config.toml"), '[mcp_servers.playwright]\ncommand = "a"\n[mcp_servers.playwright]\ncommand = "b"\n');
    const adapter = createCodexMcpAdapter();
    await assert.rejects(adapter.readServer(root, "playwright"), /duplicate/i);
  } finally {
    restoreHome();
    await rm(root, { recursive: true, force: true });
  }
});
