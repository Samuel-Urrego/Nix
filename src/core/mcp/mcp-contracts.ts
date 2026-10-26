export type McpAgent = "opencode" | "codex";
export type McpScope = "global" | "project";
export type McpNetworkAccess = "none" | "first-run";

export interface McpLocalServer {
  readonly type: "local";
  readonly command: ReadonlyArray<string>;
  readonly cwd?: string;
  readonly environment?: Readonly<Record<string, string>>;
  readonly timeout?: number;
}

export type McpPrerequisite =
  | { readonly kind: "file"; readonly path: string; readonly description: string }
  | { readonly kind: "command"; readonly name: string; readonly description: string };

export interface McpCredentialPolicy {
  readonly required: boolean;
  readonly envVars: ReadonlyArray<string>;
  readonly note: string;
}

export interface McpCatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly purpose: string;
  readonly supportedAgents: ReadonlyArray<McpAgent>;
  readonly scope: McpScope;
  readonly networkAccess: McpNetworkAccess;
  readonly prerequisites: ReadonlyArray<McpPrerequisite>;
  readonly credentials: McpCredentialPolicy;
  readonly server: McpLocalServer;
  readonly removal: string;
}
