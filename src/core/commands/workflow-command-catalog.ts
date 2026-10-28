import type { StackState } from "../config/stack-state.js";
import type { SkillAgent } from "../skills/skill-contracts.js";
import type { WorkflowKind } from "../workflows/workflow-contracts.js";

export type WorkflowCommandId = "new-feat" | "refactor" | "new-idea" | "new-project" | "araxys" | "security-audit";

export interface WorkflowCommandDefinition {
  readonly id: WorkflowCommandId;
  readonly slash: string;
  readonly name: string;
  readonly description: string;
  readonly kind: "workflow" | "skill" | "generator";
  readonly workflowKind?: WorkflowKind;
  readonly skillId?: string;
  readonly codexSkillId?: string;
  readonly requiredComponents: ReadonlyArray<string>;
  readonly slashAgents: ReadonlyArray<SkillAgent>;
  readonly cliAgents: ReadonlyArray<SkillAgent>;
  readonly artifacts: ReadonlyArray<string>;
}

export interface WorkflowCommandAvailability {
  readonly command: WorkflowCommandDefinition;
  readonly selectedAgents: ReadonlyArray<SkillAgent>;
  readonly cliAvailable: boolean;
  readonly slashAvailable: boolean;
  readonly workflowEnabled: boolean;
  readonly missingComponents: ReadonlyArray<string>;
  readonly cliReason: string | null;
  readonly slashReason: string | null;
}

export const workflowCommandCatalog: ReadonlyArray<WorkflowCommandDefinition> = [
  {
    id: "new-feat",
    slash: "/new-feat",
    name: "New feature",
    description: "Start a feature with the SDD workflow.",
    kind: "workflow",
    workflowKind: "sdd",
    requiredComponents: ["workflow.sdd"],
    slashAgents: ["opencode", "codex"],
    cliAgents: ["opencode", "codex"],
    artifacts: ["<nix-home>/projects/<project-key>/workflows/<id>.json"]
  },
  {
    id: "refactor",
    slash: "/refactor",
    name: "Refactor",
    description: "Start a refactor with the TDD workflow.",
    kind: "workflow",
    workflowKind: "tdd",
    requiredComponents: ["workflow.tdd"],
    slashAgents: ["opencode", "codex"],
    cliAgents: ["opencode", "codex"],
    artifacts: ["<nix-home>/projects/<project-key>/workflows/<id>.json"]
  },
  {
    id: "new-idea",
    slash: "/new-idea",
    name: "New idea",
    description: "Evaluate an idea with the isolated blind-judge skill.",
    kind: "skill",
    skillId: "blind-judge",
    requiredComponents: [],
    slashAgents: ["opencode", "codex"],
    cliAgents: ["opencode", "codex"],
    artifacts: ["<nix-home>/projects/<project-key>/ideas/<slug>.json"]
  },
  {
    id: "new-project",
    slash: "/new-project",
    name: "New project",
    description: "Analyze this repository and create its project skill and specialist agents.",
    kind: "generator",
    requiredComponents: [],
    slashAgents: ["opencode", "codex"],
    cliAgents: ["opencode", "codex"],
    artifacts: [".agents/skills/<skill-id>/SKILL.md", ".codex/agents/<agent-id>.toml", ".opencode/agents/<agent-id>.md"]
  },
  {
    id: "araxys",
    slash: "/araxys",
    name: "Araxys integration",
    description: "Integrate the installed Araxys security library into this consuming application.",
    kind: "skill",
    skillId: "araxys-integration",
    // Codex exposes commands as skills, so the wrapper needs its own directory.
    // Sharing the skill id would make the wrapper and the installed skill fight
    // for `.agents/skills/araxys-integration` and block one of them.
    codexSkillId: "nix-command-araxys",
    requiredComponents: [],
    slashAgents: ["opencode", "codex"],
    cliAgents: ["opencode", "codex"],
    artifacts: []
  },
  {
    id: "security-audit",
    slash: "/security-audit",
    name: "Security Audit",
    description: "Run the installed Cloudflare Security Audit skill against this project with explicit scope and coverage-first findings.",
    kind: "skill",
    skillId: "security-audit",
    // Same rule as /araxys: the Codex wrapper never owns the skill directory.
    codexSkillId: "nix-command-security-audit",
    requiredComponents: [],
    slashAgents: ["opencode", "codex"],
    cliAgents: ["opencode", "codex"],
    artifacts: []
  }
];

export function isWorkflowCommandId(value: unknown): value is WorkflowCommandId {
  return value === "new-feat" || value === "refactor" || value === "new-idea" || value === "new-project" || value === "araxys" || value === "security-audit";
}

export function findWorkflowCommand(id: string): WorkflowCommandDefinition | undefined {
  return workflowCommandCatalog.find((command) => command.id === id);
}

export function getCommandAvailability(state: StackState, id: WorkflowCommandId): WorkflowCommandAvailability {
  const command = findWorkflowCommand(id);
  if (!command) throw new Error(`Unknown workflow command: ${id}`);
  return resolveAvailability(command, state);
}

export function resolveCommandAvailability(state: StackState): ReadonlyArray<WorkflowCommandAvailability> {
  return workflowCommandCatalog.map((command) => resolveAvailability(command, state));
}

function resolveAvailability(command: WorkflowCommandDefinition, state: StackState): WorkflowCommandAvailability {
  const selectedAgents = state.agentTargets.filter(isSkillAgent);
  const installedAgents = selectedAgents.filter((agent) => state.selectedComponents.includes(`agent.${agent}`));
  const missingComponents = command.requiredComponents.filter((component) => !state.selectedComponents.includes(component));
  const workflowEnabled = command.workflowKind ? state.workflows[command.workflowKind] : true;

  const agentReason = selectedAgents.length === 0
    ? "Select OpenCode or Codex as an agent target in the TUI or stack state."
    : installedAgents.length === 0
      ? "No installed agent component matches the selected agent targets (expected agent.opencode or agent.codex)."
      : null;
  const componentReason = [
    missingComponents.length > 0 ? `Missing required component(s): ${missingComponents.join(", ")}.` : null,
    command.workflowKind && !workflowEnabled
      ? `${command.workflowKind.toUpperCase()} workflows are disabled. Enable them with nix-ai workflow:configure --${command.workflowKind}=on --yes.`
      : null
  ].filter((reason): reason is string => reason !== null).join(" ") || null;

  const cliAgentReason = installedAgents.some((agent) => command.cliAgents.includes(agent))
    ? null
    : "This command does not support the selected installed agent(s).";
  const slashAgentReason = installedAgents.some((agent) => command.slashAgents.includes(agent))
    ? null
    : "No supported agent component is installed for global workflow commands or Codex skills.";

  const cliReason = joinReasons(agentReason, componentReason, cliAgentReason);
  const slashReason = joinReasons(agentReason, componentReason, slashAgentReason);

  return {
    command,
    selectedAgents,
    cliAvailable: cliReason === null,
    slashAvailable: slashReason === null,
    workflowEnabled,
    missingComponents,
    cliReason,
    slashReason
  };
}

function isSkillAgent(value: unknown): value is SkillAgent {
  return value === "opencode" || value === "codex";
}

function joinReasons(...reasons: ReadonlyArray<string | null>): string | null {
  const present = reasons.filter((reason): reason is string => reason !== null && reason.trim().length > 0);
  return present.length === 0 ? null : present.join(" ");
}
