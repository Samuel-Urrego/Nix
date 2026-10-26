import assert from "node:assert/strict";
import test from "node:test";

import { mcpCatalog, findMcpEntry } from "../../src/core/mcp/mcp-catalog.js";

test("MCP catalog declares independent global integrations", () => {
  assert.deepEqual(mcpCatalog.map((entry) => entry.id), ["playwright", "codegraph", "engram", "rea"]);
  for (const entry of mcpCatalog) {
    assert.equal(entry.scope, "global");
    assert.deepEqual([...entry.supportedAgents].sort(), ["codex", "opencode"]);
    assert.equal(entry.credentials.required, false);
    assert.deepEqual(entry.credentials.envVars, []);
    assert.ok(entry.purpose.length > 20);
    assert.ok(entry.removal.length > 20);
    assert.ok(entry.server.command.length > 0);
  }
});

test("MCP catalog records pinned commands, network access, and prerequisites", () => {
  const playwright = findMcpEntry("playwright");
  assert.deepEqual(playwright?.server.command, ["npx", "-y", "@playwright/mcp@latest"]);
  assert.equal(playwright?.networkAccess, "first-run");

  const codegraph = findMcpEntry("codegraph");
  assert.match(codegraph?.server.command.join(" ") ?? "", /node_modules\/@astudioplus\/codegraph-mcp/);
  assert.equal(codegraph?.networkAccess, "none");
  assert.ok(codegraph?.prerequisites.some((item) => item.kind === "file"));

  const engram = findMcpEntry("engram");
  assert.deepEqual(engram?.server.command, ["engram", "mcp", "--tools=agent"]);
  assert.ok(engram?.prerequisites.some((item) => item.kind === "command"));

  const rea = findMcpEntry("rea");
  assert.deepEqual(rea?.server.command, ["npx", "-y", "rea-agents@6.8.0", "mcp"]);
  assert.equal(rea?.networkAccess, "first-run");
  assert.ok(rea?.prerequisites.some((item) => item.kind === "command" && item.name === "node"));
});
