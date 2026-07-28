export interface AgentCapability {
  readonly name: string;
  readonly description: string;
}

export interface AgentSpec {
  readonly id: string;
  readonly name: string;
  readonly domain: string;
  readonly responsibilities: ReadonlyArray<string>;
  readonly capabilities: ReadonlyArray<AgentCapability>;
}
