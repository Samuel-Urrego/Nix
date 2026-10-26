import { mkdir, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  getCodexUserSkillsDirectory,
  getGlobalSkillTargetPath,
  getHomeDirectory,
  getOpenCodeCommandsDirectory,
  getProjectIdeasDirectory
} from "../config/global-paths.js";
import type { StackState } from "../config/stack-state.js";
import {
  getCommandAvailability,
  resolveCommandAvailability,
  workflowCommandCatalog,
  type WorkflowCommandDefinition,
  type WorkflowCommandId
} from "./workflow-command-catalog.js";
import type { SkillAgent } from "../skills/skill-contracts.js";
import { createWorkflow } from "../workflows/workflow-engine.js";
import { saveWorkflowRecord } from "../workflows/workflow-store.js";
import type { WorkflowRecord } from "../workflows/workflow-contracts.js";

export interface WorkflowCommandRun {
  readonly command: WorkflowCommandDefinition;
  readonly workflow: WorkflowRecord | null;
  readonly prompt: string;
}

export interface AgentCommandSkip {
  readonly path: string;
  readonly reason: string;
}

export interface AgentCommandInstallResult {
  readonly agent: SkillAgent;
  readonly installed: ReadonlyArray<string>;
  readonly removed: ReadonlyArray<string>;
  readonly skipped: ReadonlyArray<AgentCommandSkip>;
}

export async function runWorkflowCommand(
  root: string,
  state: StackState,
  id: WorkflowCommandId,
  title: string
): Promise<WorkflowCommandRun> {
  const availability = getCommandAvailability(state, id);
  const normalizedTitle = title.trim();
  if (!normalizedTitle) throw new Error(`A title is required for ${availability.command.slash}.`);
  if (!availability.cliAvailable) {
    throw new Error(`Command ${availability.command.slash} is unavailable: ${availability.cliReason ?? "unknown reason"}`);
  }

  if (availability.command.kind === "workflow") {
    const kind = availability.command.workflowKind;
    if (!kind) throw new Error(`Workflow command ${availability.command.slash} has no workflow kind.`);
    if (!state.workflows[kind]) {
      throw new Error(
        `${kind.toUpperCase()} workflows are disabled. Enable them with nix-ai workflow:configure --${kind}=on --yes.`
      );
    }
    const workflow = createWorkflow(kind, normalizedTitle);
    await saveWorkflowRecord(root, workflow);
    return {
      command: availability.command,
      workflow,
      prompt: `Follow the ${availability.command.slash} workflow for: ${normalizedTitle}`
    };
  }

  return {
    command: availability.command,
    workflow: null,
    prompt: renderIdeaPrompt(root, normalizedTitle)
  };
}

export function renderAgentCommand(command: WorkflowCommandDefinition, agent: SkillAgent = "opencode"): string {
  return agent === "codex" ? renderCodexSkill(command) : renderOpenCodeCommand(command);
}

function renderOpenCodeCommand(command: WorkflowCommandDefinition): string {
  const header = [
    "---",
    `description: ${command.description}`,
    "---",
    `<!-- nix-ai:workflow-command id=${command.id} -->`,
    `# ${command.slash}`,
    "",
    "This command is Nix-managed. Do not edit it by hand; rerun `nix-ai workflow:install-commands --agent=opencode --yes`.",
    ""
  ].join("\n");

  if (command.id === "new-feat") {
    return `${header}Start the SDD workflow before planning or editing code:\n\n\`\`\`text\nnix-ai workflow:command --id=new-feat --title="$ARGUMENTS" --root=. --yes\n\`\`\`\n\nIf the command reports that SDD is disabled or unavailable, stop and report the exact message. Do not continue with an ad-hoc plan.\n\nAfter the workflow starts, follow the SDD steps and record evidence with \`nix-ai workflow:advance --id=<id> --evidence="..." --root=. --yes\`.\n`;
  }
  if (command.id === "refactor") {
    return `${header}Start the TDD workflow before changing code:\n\n\`\`\`text\nnix-ai workflow:command --id=refactor --title="$ARGUMENTS" --root=. --yes\n\`\`\`\n\nIf the command reports that TDD is disabled or unavailable, stop and report the exact message. Do not continue with an ad-hoc refactor.\n\nFollow the TDD steps and record evidence with \`nix-ai workflow:advance --id=<id> --evidence="..." --root=. --yes\`. RED is the only skippable step and requires a persisted reason via \`nix-ai workflow:skip\`.\n`;
  }
  return `${header}Run the isolated blind-judge workflow and follow its returned prompt exactly:\n\n\`\`\`text\nnix-ai workflow:command --id=new-idea --title="$ARGUMENTS" --root=. --yes\n\`\`\`\n\nDo not start an SDD/TDD workflow. If the command reports that the skill or runtime contract is unavailable, stop and report the missing path.\n`;
}

function renderCodexSkill(command: WorkflowCommandDefinition): string {
  const name = command.id === "new-feat" ? "new-feat" : command.id;
  const header = [
    "---",
    `name: ${name}`,
    `description: ${JSON.stringify(command.description)}`,
    "---",
    `<!-- nix-ai:workflow-command id=${command.id} -->`,
    `# ${command.slash}`,
    "",
    "This skill is Nix-managed. Do not edit it by hand; rerun `nix-ai workflow:install-commands --agent=codex --yes`.",
    "",
    "Use the title or idea text from the current user request. If it is missing, ask one question and stop.",
    ""
  ].join("\n");

  if (command.id === "new-feat") {
    return `${header}Start the SDD workflow before planning or editing code:\n\n\`\`\`text\nnix-ai workflow:command --id=new-feat --title="<feature title>" --root=. --yes\n\`\`\`\n\nIf the command reports that SDD is disabled or unavailable, stop and report the exact message. Do not continue with an ad-hoc plan.\n\nAfter the workflow starts, follow the SDD steps and record evidence with \`nix-ai workflow:advance --id=<id> --evidence="..." --root=. --yes\`.\n`;
  }
  if (command.id === "refactor") {
    return `${header}Start the TDD workflow before changing code:\n\n\`\`\`text\nnix-ai workflow:command --id=refactor --title="<refactor title>" --root=. --yes\n\`\`\`\n\nIf the command reports that TDD is disabled or unavailable, stop and report the exact message. Do not continue with an ad-hoc refactor.\n\nFollow the TDD steps and record evidence with \`nix-ai workflow:advance --id=<id> --evidence="..." --root=. --yes\`. RED is the only skippable step and requires a persisted reason via \`nix-ai workflow:skip\`.\n`;
  }
  return `${header}Run the isolated blind-judge workflow and follow its returned prompt exactly:\n\n\`\`\`text\nnix-ai workflow:command --id=new-idea --title="<idea text>" --root=. --yes\n\`\`\`\n\nDo not start an SDD/TDD workflow. If the command reports that the skill or runtime contract is unavailable, stop and report the missing path.\n`;
}

function renderIdeaPrompt(root: string, title: string): string {
  const ideaDirectory = getProjectIdeasDirectory(root);
  const codexSkill = path.join(getGlobalSkillTargetPath("codex", "blind-judge"), "SKILL.md");
  const opencodeSkill = path.join(getGlobalSkillTargetPath("opencode", "blind-judge"), "SKILL.md");
  return [
    "# /new-idea",
    "",
    "Evaluate the idea with the `blind-judge` skill.",
    "",
    `Idea: ${title}`,
    "",
    "Read the skill from one of these global paths before starting:",
    `- Codex: \`${codexSkill}\``,
    `- OpenCode: \`${opencodeSkill}\``,
    "",
    "Run the isolated protocol: separate pro and con groups, five neutral evaluators with the same evidence bundle, then a bounded synthesis.",
    "Do not start an SDD/TDD workflow and do not bypass the skill.",
    "",
    `Save the final JudgmentResult JSON to \`${path.join(ideaDirectory, "<slug>.json")}\` and report the path.`,
    "If the skill or runtime contract is unavailable, stop and report the missing path."
  ].join("\n");
}

export async function installAgentCommands(
  root: string,
  state: StackState,
  agent: SkillAgent
): Promise<AgentCommandInstallResult> {
  const plan = await planInstall(root, state, agent);
  for (const operation of plan.operations) {
    if (operation.kind === "write") {
      await mkdir(path.dirname(operation.absolutePath), { recursive: true });
      await writeFile(operation.absolutePath, operation.content, "utf8");
    } else {
      await rm(operation.absolutePath, { force: true });
      await rmdir(path.dirname(operation.absolutePath)).catch(() => undefined);
    }
  }
  return {
    agent,
    installed: plan.installed,
    removed: plan.removed,
    skipped: plan.skipped
  };
}

export async function removeAgentCommands(root: string, agent: SkillAgent): Promise<AgentCommandInstallResult> {
  const removed: string[] = [];
  const skipped: AgentCommandSkip[] = [];
  for (const command of workflowCommandCatalog) {
    const absolute = commandAbsolutePath(root, command.id, agent);
    const existing = await readOptional(absolute);
    if (existing === null) continue;
    if (!isManagedCommand(existing, command.id)) {
      skipped.push({ path: displayPath(absolute), reason: "unmanaged file preserved" });
      continue;
    }
    await rm(absolute, { force: true });
    await rmdir(path.dirname(absolute)).catch(() => undefined);
    removed.push(displayPath(absolute));
  }
  return { agent, installed: [], removed, skipped };
}

type InstallOperation =
  | {
      readonly kind: "write";
      readonly absolutePath: string;
      readonly content: string;
    }
  | {
      readonly kind: "remove";
      readonly absolutePath: string;
    };

interface InstallPlan {
  readonly operations: ReadonlyArray<InstallOperation>;
  readonly installed: ReadonlyArray<string>;
  readonly removed: ReadonlyArray<string>;
  readonly skipped: ReadonlyArray<AgentCommandSkip>;
}

async function planInstall(root: string, state: StackState, agent: SkillAgent): Promise<InstallPlan> {
  const operations: InstallOperation[] = [];
  const installed: string[] = [];
  const removed: string[] = [];
  const skipped: AgentCommandSkip[] = [];

  for (const availability of resolveCommandAvailability(state)) {
    const command = availability.command;
    const absolute = commandAbsolutePath(root, command.id, agent);
    const display = displayPath(absolute);
    const existing = await readOptional(absolute);

    if (availability.slashAvailable) {
      if (existing !== null && !isManagedCommand(existing, command.id)) {
        throw new Error(`Refusing to overwrite unmanaged workflow command file: ${display}.`);
      }
      operations.push({ kind: "write", absolutePath: absolute, content: renderAgentCommand(command, agent) });
      installed.push(display);
      continue;
    }

    if (existing === null) {
      skipped.push({ path: display, reason: availability.slashReason ?? "command is unavailable" });
      continue;
    }
    if (!isManagedCommand(existing, command.id)) {
      skipped.push({ path: display, reason: "unmanaged file preserved" });
      continue;
    }
    operations.push({ kind: "remove", absolutePath: absolute });
    removed.push(display);
  }

  return { operations, installed, removed, skipped };
}

function commandAbsolutePath(_root: string, id: WorkflowCommandId, agent: SkillAgent): string {
  if (agent === "codex") return path.join(getCodexUserSkillsDirectory(), id, "SKILL.md");
  return path.join(getOpenCodeCommandsDirectory(), `${id}.md`);
}

function displayPath(absolutePath: string): string {
  const relative = path.relative(getHomeDirectory(), absolutePath);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    return relative.split(path.sep).join("/");
  }
  return absolutePath;
}

function isManagedCommand(content: string, id: WorkflowCommandId): boolean {
  return content.includes(`<!-- nix-ai:workflow-command id=${id} -->`);
}

async function readOptional(file: string): Promise<string | null> {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
