import type { McpCatalogEntry } from "./mcp-contracts.js";

/** Global MCP integrations that Nix can install without writing credentials. */
export const mcpCatalog: ReadonlyArray<McpCatalogEntry> = [
  {
    id: "playwright",
    name: "Playwright MCP",
    purpose: "Browser automation, page inspection, and end-to-end testing tools.",
    supportedAgents: ["opencode", "codex"],
    scope: "global",
    networkAccess: "first-run",
    prerequisites: [],
    credentials: {
      required: false,
      envVars: [],
      note: "No credentials are written. The first run may download the package from the npm registry."
    },
    server: {
      type: "local",
      command: ["npx", "-y", "@playwright/mcp@latest"]
    },
    removal: "Removes only the Nix-managed server entry; unrelated MCP servers and settings are preserved."
  },
  {
    id: "codegraph",
    name: "CodeGraph MCP",
    purpose: "Code relationship navigation, call graphs, and impact analysis for the project.",
    supportedAgents: ["opencode", "codex"],
    scope: "global",
    networkAccess: "none",
    prerequisites: [
      {
        kind: "file",
        path: "node_modules/@astudioplus/codegraph-mcp/bin/codegraph-mcp.js",
        description: "CodeGraph MCP package is installed in this project"
      }
    ],
    credentials: {
      required: false,
      envVars: [],
      note: "No credentials are written. Telemetry is disabled in the server environment."
    },
    server: {
      type: "local",
      command: [
        "node",
        "node_modules/@astudioplus/codegraph-mcp/bin/codegraph-mcp.js",
        "--workspace",
        ".",
        "--profile",
        "core",
        "--graph-only"
      ],
      cwd: ".",
      environment: { CODEGRAPH_TELEMETRY: "off" },
      timeout: 30000
    },
    removal: "Removes only the Nix-managed server entry; unrelated MCP servers and settings are preserved."
  },
  {
    id: "engram",
    name: "Engram MCP",
    purpose: "Persistent project memory for decisions, discoveries, and session continuity.",
    supportedAgents: ["opencode", "codex"],
    scope: "global",
    networkAccess: "none",
    prerequisites: [
      {
        kind: "command",
        name: "engram",
        description: "Engram is available on PATH"
      }
    ],
    credentials: {
      required: false,
      envVars: [],
      note: "No credentials are written. Engram stores memory locally."
    },
    server: {
      type: "local",
      command: ["engram", "mcp", "--tools=agent"]
    },
    removal: "Removes only the Nix-managed server entry; the local Engram data store is never deleted."
  },
  {
    id: "rea",
    name: "REA MCP",
    purpose: "Evidence-backed reverse engineering across binaries, applications, and runtime behavior.",
    supportedAgents: ["opencode", "codex"],
    scope: "global",
    networkAccess: "first-run",
    prerequisites: [
      { kind: "command", name: "node", description: "Node.js 22.23.4+, 24.22.1+, or 26.12.1+ is required by rea-agents" },
      { kind: "command", name: "npx", description: "npx downloads and launches the pinned rea-agents package" }
    ],
    credentials: {
      required: false,
      envVars: [],
      note: "No credentials are required. Native analysis providers and tools are separately configured when needed."
    },
    server: {
      type: "local",
      command: ["npx", "-y", "rea-agents@6.8.0", "mcp"]
    },
    removal: "Removes only the Nix-managed server entry; REA package files, analysis data, and user configuration are preserved."
  }
];

export function findMcpEntry(id: string): McpCatalogEntry | undefined {
  return mcpCatalog.find((entry) => entry.id === id);
}
