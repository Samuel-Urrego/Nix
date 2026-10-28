export type SpecialistAgentTarget = "opencode" | "codex";
/** OpenCode agent mode. Codex has no equivalent field, so it is ignored there. */
export type SpecialistAgentMode = "primary" | "subagent";

export interface SpecialistAgentDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly instructions: string;
  readonly source: "nix-catalog";
  readonly ownership: "nix";
  readonly supportedAgents: ReadonlyArray<SpecialistAgentTarget>;
  /** Defaults to `subagent`: a role is delegated to, not the default entry point. */
  readonly mode?: SpecialistAgentMode;
}

export type SpecialistAgentAction = "install" | "update" | "already-current" | "conflict" | "incompatible";
export type SpecialistAgentState = "absent" | "current" | "update-available" | "modified" | "conflict" | "incompatible";

export interface SpecialistAgentPlan {
  readonly id: string;
  readonly agent: SpecialistAgentTarget;
  readonly action: SpecialistAgentAction;
  readonly targetPath: string;
  readonly version: string;
  readonly reason?: string;
}

export interface SpecialistAgentStatus {
  readonly id: string;
  readonly agent: SpecialistAgentTarget;
  readonly state: SpecialistAgentState;
  readonly detail?: string;
}
