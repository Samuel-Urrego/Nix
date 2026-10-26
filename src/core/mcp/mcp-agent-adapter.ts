import type { McpAgent, McpLocalServer } from "./mcp-contracts.js";

export interface McpAgentAdapter {
  readonly agent: McpAgent;
  configPath(root: string): string;
  readServer(root: string, id: string): Promise<unknown | undefined>;
  listServers(root: string): Promise<ReadonlyArray<string>>;
  writeServer(root: string, id: string, server: McpLocalServer): Promise<void>;
  removeServer(root: string, id: string): Promise<void>;
}
