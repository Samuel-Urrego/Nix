import { createInterface, type Interface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getStackStatePath, loadStackState, saveStackState } from "../core/config/stack-state.js";
import { getGlobalSkillTargetPath, getOpenCodeCommandsDirectory } from "../core/config/global-paths.js";
import { detectAgentTargets, type AgentDetection } from "../core/config/agent-detection.js";
import { CodexSkillAdapter } from "../core/components/codex-skill-adapter.js";
import { nixCoreSkill } from "../core/components/component-catalog.js";
import { SecurityHooksInstaller } from "../core/security/security-hooks-installer.js";
import { mcpCatalog } from "../core/mcp/mcp-catalog.js";
import { getMcpStatus, installMcp, previewMcp, removeMcp } from "../core/mcp/mcp-service.js";
import { resolveCommandAvailability, workflowCommandCatalog } from "../core/commands/workflow-command-catalog.js";
import { installAgentCommands, removeAgentCommands } from "../core/commands/workflow-command-service.js";
import { specialistAgentCatalog } from "../core/agents/agent-catalog.js";
import { getSpecialistAgentStatus, installSpecialistAgent, previewSpecialistAgent, removeSpecialistAgent } from "../core/agents/agent-installer.js";
import type { SpecialistAgentPlan, SpecialistAgentTarget } from "../core/agents/agent-contracts.js";
import { skillCatalog } from "../core/skills/skill-catalog.js";
import { describeSkillSource } from "../core/skills/skill-contracts.js";
import type { SkillAgent } from "../core/skills/skill-contracts.js";
import { getSkillStatus, installSkill, previewSkill, removeSkill, type SkillInstallerOptions, type SkillPlan } from "../core/skills/skill-installer.js";
import { createUpgradePlan, resolveLatestPublishedVersion, spawnUpgrade, type LatestVersionResolver, type UpgradeRunner } from "../core/system/npm-upgrade.js";
import { projectMetadata } from "../core/system/project-metadata.js";
import { createProgress, multiSelectWithKeyboard, selectWithKeyboard, writeFrame } from "./tui-keyboard.js";

export interface TuiOptions {
  readonly input?: NodeJS.ReadableStream;
  readonly output?: NodeJS.WritableStream;
  readonly ask?: (prompt: string) => Promise<string>;
  readonly select?: (prompt: string, choices: readonly string[]) => Promise<number>;
  readonly multiSelect?: (prompt: string, choices: readonly string[], initialSelected: readonly number[]) => Promise<readonly number[] | undefined>;
  readonly detect?: () => Promise<ReadonlyArray<AgentDetection>>;
  readonly upgrade?: UpgradeRunner;
  readonly latestVersion?: LatestVersionResolver;
  readonly skillOptions?: SkillInstallerOptions;
}

interface TuiTerminal {
  question(prompt: string): Promise<string>;
  select(prompt: string, choices: readonly string[], title?: string, banner?: readonly string[], initialIndex?: number): Promise<number>;
  multiSelect(prompt: string, choices: readonly string[], title: string, initialSelected?: readonly number[]): Promise<readonly number[] | undefined>;
  /** Yes/No selection. Defaults to No so an accidental Enter changes nothing. */
  confirm(prompt: string, yesLabel?: string, noLabel?: string): Promise<boolean>;
  /** Writes a framed report panel. */
  report(title: string, lines: readonly string[]): void;
  /** Clears the screen so the next step replaces the previous one instead of stacking under it. */
  clear(): void;
  close(): void;
}

function writeBanner(output: NodeJS.WritableStream, banner: readonly string[] | undefined): void {
  if (!banner || banner.length === 0) return;
  for (const line of banner) output.write(`${line}\n`);
  output.write("\n");
}

/** Keeps reports inside the frame by showing home-relative paths instead of full ones. */
function shortenPath(value: string): string {
  const home = process.env.USERPROFILE ?? process.env.HOME;
  if (!home) return value;
  return value.split(home).join("~");
}

function matchIndex(answer: string, choices: readonly string[]): number {  const trimmed = answer.trim();
  if (!trimmed) return -1;
  const numeric = Number(trimmed);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= choices.length) return numeric - 1;
  const exact = choices.findIndex((choice) => choice.toLowerCase() === trimmed.toLowerCase());
  if (exact >= 0) return exact;
  const prefixed = choices.filter((choice) => choice.toLowerCase().startsWith(trimmed.toLowerCase()));
  return prefixed.length === 1 ? choices.indexOf(prefixed[0]!) : -1;
}

function parseMultiAnswer(answer: string, choices: readonly string[]): readonly number[] {
  const trimmed = answer.trim().toLowerCase();
  if (!trimmed || trimmed === "none" || trimmed === "ninguna") return [];
  if (trimmed === "all" || trimmed === "todas") return choices.map((_choice, index) => index);
  const selected = new Set<number>();
  for (const token of answer.split(/[,\s]+/).filter(Boolean)) {
    const index = matchIndex(token, choices);
    if (index >= 0) selected.add(index);
  }
  return [...selected].sort((left, right) => left - right);
}

function createTuiTerminal(options: TuiOptions, input: NodeJS.ReadableStream, output: NodeJS.WritableStream): TuiTerminal {
  let lineReader: Interface | undefined;
  const question = (prompt: string): Promise<string> => {
    if (options.ask) return options.ask(prompt);
    lineReader ??= createInterface({ input, output });
    return lineReader.question(prompt);
  };
  const select = async (prompt: string, choices: readonly string[], title = "NIX AI-STACK", banner?: readonly string[], initialIndex = 0): Promise<number> => {
    if (options.select) {
      writeBanner(output, banner);
      writeFrame(output, title, [prompt, "", ...choices.map((choice) => `  ${choice}`), "", "↑↓ Navigate · Enter Select · Esc Back"]);
      return options.select(prompt, choices);
    }
    if (options.ask) {
      writeBanner(output, banner);
      writeFrame(output, title, [prompt, "", ...choices.map((choice) => `  ${choice}`), "", "Select an item to continue."]);
      const answer = (await options.ask(prompt)).trim();
      if (["q", "b", "back", "escape"].includes(answer.toLowerCase())) return -1;
      return matchIndex(answer, choices);
    }
    lineReader?.close();
    lineReader = undefined;
    return selectWithKeyboard({ input: input as NodeJS.ReadStream, output, prompt, choices, title, initialIndex, ...(banner ? { banner } : {}) });
  };
  const multiSelect = async (
    prompt: string,
    choices: readonly string[],
    title: string,
    initialSelected: readonly number[] = []
  ): Promise<readonly number[] | undefined> => {
    if (options.multiSelect) {
      writeFrame(output, title, [prompt, "", ...choices.map((choice, index) => ` [${initialSelected.includes(index) ? "x" : " "}] ${choice}`), "", "↑↓ Navigate · Space Toggle · Enter Confirm · Esc Back"]);
      return options.multiSelect(prompt, choices, initialSelected);
    }
    if (options.ask) {
      writeFrame(output, title, [
        prompt,
        "",
        ...choices.map((choice, index) => ` [${initialSelected.includes(index) ? "x" : " "}] ${choice}`),
        "",
        "Answer with comma-separated numbers, `all`, or `none`."
      ]);
      return parseMultiAnswer(await options.ask(prompt), choices);
    }    lineReader?.close();
    lineReader = undefined;
    return multiSelectWithKeyboard({ input: input as NodeJS.ReadStream, output, prompt, choices, title, initialSelected });
  };
  return {
    question,
    select,
    multiSelect,
    confirm: async (prompt, yesLabel = "Yes, apply", noLabel = "No, cancel") =>
      (await select(prompt, [yesLabel, noLabel], "CONFIRM", undefined, 1)) === 0,
    report: (title, lines) => writeFrame(output, title, lines),
    clear: () => { output.write("\u001b[2J\u001b[H"); },
    close: () => lineReader?.close()
  };
}


const header = `⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠸⠁⠸⢳⡄⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⠃⠀⠀⢸⠸⠀⡠⣄⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡠⠃⠀⠀⢠⣞⣀⡿⠀⠀⣧⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣠⡖⠁⠀⠀⠀⢸⠈⢈⡇⠀⢀⡏⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⡴⠩⢠⡴⠀⠀⠀⠀⠀⠈⡶⠉⠀⠀⡸⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⢀⠎⢠⣇⠏⠀⠀⠀⠀⠀⠀⠀⠁⠀⢀⠄⡇⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⢠⠏⠀⢸⣿⣴⠀⠀⠀⠀⠀⠀⣆⣀⢾⢟⠴⡇⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⢀⣿⠀⠠⣄⠸⢹⣦⠀⠀⡄⠀⠀⢋⡟⠀⠀⠁⣇⠀⠀⠀⠀⠀
⠀⠀⠀⠀⢀⡾⠁⢠⠀⣿⠃⠘⢹⣦⢠⣼⠀⠀⠉⠀⠀⠀⠀⢸⡀⠀⠀⠀⠀
⠀⠀⢀⣴⠫⠤⣶⣿⢀⡏⠀⠀⠘⢸⡟⠋⠀⠀⠀⠀⠀⠀⠀⠀⢳⠀⠀⠀⠀
⠐⠿⢿⣿⣤⣴⣿⣣⢾⡄⠀⠀⠀⠀⠳⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢣⠀⠀⠀
⠀⠀⠀⣨⣟⡍⠉⠚⠹⣇⡄⠀⠀⠀⠀⠀⠀⠀⠀⠈⢦⠀⠀⢀⡀⣾⡇⠀⠀
⠀⠀⢠⠟⣹⣧⠃⠀⠀⢿⢻⡀⢄⠀⠀⠀⠀⠐⣦⡀⣸⣆⠀⣾⣧⣯⢻⠀⠀
⠀⠀⠘⣰⣿⣿⡄⡆⠀⠀⠀⠳⣼⢦⡘⣄⠀⠀⡟⡷⠃⠘⢶⣿⡎⠻⣆⠀⠀
⠀⠀⠀⡟⡿⢿⡿⠀⠀⠀⠀⠀⠙⠀⠻⢯⢷⣼⠁⠁⠀⠀⠀⠙⢿⡄⡈⢆⠀
⠀⠀⠀⠀⡇⣿⡅⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⠦⠀⠀⠀⠀⠀⠀⡇⢹⢿⡀
⠀⠀⠀⠀⠁⠛⠓⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠼⠇⠁`;

const components = [
  { id: "workflow.sdd", category: "Workflows", name: "Spec-Driven Development", description: "Plan work through a specification and task breakdown." },
  { id: "workflow.tdd", category: "Workflows", name: "Test-Driven Development", description: "Use the RED → GREEN → REFACTOR loop." },
  { id: "mcp.playwright", category: "MCPs", name: "Playwright", description: "Browser automation and end-to-end testing integration." },
  { id: "mcp.codegraph", category: "MCPs", name: "CodeGraph", description: "Code relationship and navigation integration." },
  { id: "mcp.engram", category: "MCPs", name: "Engram", description: "Persistent memory integration." },
  { id: "agent.opencode", category: "Agent targets", name: "OpenCode", description: "Global OpenCode configuration and skill installation target." },
  { id: "agent.codex", category: "Agent targets", name: "Codex", description: "Global Codex configuration and skill installation target." }
] as const;

const welcomeSubtitle = "  Global installer and updater for Codex and OpenCode";

/** The wolf banner is only shown when the terminal can render it without wrapping. */
function welcomeBanner(output: NodeJS.WritableStream): readonly string[] | undefined {
  const columns = (output as NodeJS.WriteStream).columns ?? 80;
  if (columns < 34) return undefined;
  return [...header.split("\n"), "", welcomeSubtitle];
}

export async function runTui(options: TuiOptions = {}): Promise<void> {
  const input = options.input ?? stdin;
  const output = options.output ?? stdout;
  const interactive = Boolean(options.ask || options.select || options.multiSelect || ((input as NodeJS.ReadStream).isTTY && (output as NodeJS.WriteStream).isTTY));
  if (!interactive) {
    output.write(`${header}\n\n`);
    output.write("The nix-ai TUI requires an interactive terminal. Run `nix-ai` from Windows Terminal or PowerShell.\n");
    process.exitCode = 1;
    return;
  }

  const statePath = getStackStatePath();
  const terminal = createTuiTerminal(options, input, output);
  const detect = options.detect ?? (() => detectAgentTargets());
  const upgrade = options.upgrade ?? spawnUpgrade;
  const latestVersion = options.latestVersion ?? resolveLatestPublishedVersion;

  try {
    let done = false;
    let firstHome = true;
    while (!done) {
      if (!firstHome) terminal.clear();
      const banner = firstHome ? welcomeBanner(output) : undefined;
      firstHome = false;
      const homeAction = await terminal.select(
        "What would you like to do?",
        ["Install AI-STACK", "Update AI-STACK", "Advanced management", "Quit"],
        "NIX AI-STACK",
        banner
      );
      if (homeAction === 3 || homeAction < 0) {
        done = true;
        continue;
      }
      terminal.clear();
      if (homeAction === 0) {
        await runGuidedInstall(terminal, output, detect, statePath, options.skillOptions);
        continue;
      }
      if (homeAction === 1) {
        await runUpdate(terminal, output, upgrade, latestVersion);
        continue;
      }
      await runAdvancedManagement(terminal, output, statePath);
    }
  } finally {
    terminal.close();
  }
}

/** Shows a framed report and waits for the user before continuing. */
async function pause(
  terminal: TuiTerminal,
  output: NodeJS.WritableStream,
  title: string,
  lines: readonly string[],
  footer = "Press Enter to return to the home screen."
): Promise<void> {
  terminal.clear();
  terminal.report(title, [...lines, "", footer]);
  await terminal.question("");
}

async function runGuidedInstall(
  terminal: TuiTerminal,
  output: NodeJS.WritableStream,
  detect: () => Promise<ReadonlyArray<AgentDetection>>,
  statePath: string,
  skillOptions: SkillInstallerOptions | undefined
): Promise<void> {
  const root = process.cwd();
  const catalog = skillOptions?.catalog ?? skillCatalog;
  const detections = await detect();

  const detectionLines: string[] = [];
  for (const detection of detections) {
    detectionLines.push(`${detection.label}: ${detection.detected ? "detected" : "not detected"}`);
    for (const evidence of detection.evidence) detectionLines.push(`  ${shortenPath(evidence)}`);
    if (!detection.detected) detectionLines.push("  No application configuration or CLI was found on this machine.");
  }
  writeFrame(output, "TARGET DETECTION", detectionLines);

  const available = detections.filter((detection) => detection.detected);
  if (available.length === 0) {
    await pause(terminal, output, "NOTHING TO INSTALL", [
      "Nix will not install into an application it cannot detect.",
      "Nothing was changed."
    ]);
    return;
  }

  terminal.clear();
  const mode = await terminal.select(
    "How do you want to install?",
    ["Install everything (recommended)", "Choose targets and skills"],
    "INSTALL MODE",
    undefined,
    0
  );
  if (mode < 0) {
    await pause(terminal, output, "INSTALL CANCELLED", ["Nothing was changed."]);
    return;
  }
  const installEverything = mode === 0;

  let targets: readonly SkillAgent[];
  if (installEverything) {
    targets = available.map((detection) => detection.agent);
  } else {
    const targetChoices = available.map((detection) => `${detection.label} — signalled by ${detection.evidence[0]}`);
    terminal.clear();
    const targetPicks = await terminal.multiSelect(
      "Where should Nix install? (all targets are global)",
      targetChoices,
      "INSTALL TARGETS",
      available.map((_detection, index) => index)
    );
    if (targetPicks === undefined) {
      await pause(terminal, output, "INSTALL CANCELLED", ["Back to the previous step. No files changed."]);
      return;
    }
    targets = targetPicks.map((index) => available[index]?.agent).filter((agent): agent is SkillAgent => agent !== undefined);
    if (targets.length === 0) {
      await pause(terminal, output, "INSTALL CANCELLED", ["No target selected. No files changed."]);
      return;
    }
  }

  const statuses = await getSkillStatus(root, skillOptions);
  const skillEntries = catalog.filter((entry) => targets.some((agent) => entry.compatibleAgents.includes(agent)));
  let skills: ReadonlyArray<(typeof skillEntries)[number]>;
  if (installEverything) {
    skills = skillEntries;
  } else {
    const skillChoices = skillEntries.map((entry) => {
      const state = statuses
        .filter((status) => status.id === entry.id && targets.includes(status.agent))
        .map((status) => `${status.agent}: ${status.state}`)
        .join(", ");
      return `${entry.name} — ${entry.description} (compatible: ${entry.compatibleAgents.join(", ")}; ${state || "not installed"})`;
    });
    // Everything starts checked: the user only unchecks what they do not want.
    terminal.clear();
    const skillPicks = await terminal.multiSelect(
      "Which skills should Nix install? (space to toggle, search to filter, Next to continue)",
      skillChoices,
      "GLOBAL SKILLS",
      skillEntries.map((_entry, index) => index)
    );
    if (skillPicks === undefined) {
      await pause(terminal, output, "INSTALL CANCELLED", ["Back to the previous step. No files changed."]);
      return;
    }
    skills = skillPicks.map((index) => skillEntries[index]).filter((entry) => entry !== undefined);
  }

  const state = await loadStackState(statePath);
  const workflows = state.workflows.sdd || state.workflows.tdd ? state.workflows : { sdd: true, tdd: true };
  const selectedComponents = [...new Set([
    ...state.selectedComponents.filter((id) => !id.startsWith("agent.") && id !== "workflow.sdd" && id !== "workflow.tdd"),
    ...targets.map((agent) => `agent.${agent}`),
    ...(workflows.sdd ? ["workflow.sdd"] : []),
    ...(workflows.tdd ? ["workflow.tdd"] : [])
  ])];
  const effectiveState = { ...state, selectedComponents, workflows, agentTargets: [...targets] };
  const availabilities = resolveCommandAvailability(effectiveState);

  const previewLines: string[] = [
    `Targets: ${targets.join(", ")}`,
    `Workflows: SDD ${workflows.sdd ? "enabled" : "disabled"} · TDD ${workflows.tdd ? "enabled" : "disabled"} (core Nix workflows)`,
    ""
  ];
  for (const agent of targets) {
    const installed: string[] = [];
    const skipped: string[] = [];
    for (const availability of availabilities) {
      const command = availability.command;
      const target = agent === "opencode"
        ? path.join(getOpenCodeCommandsDirectory(), `${command.id}.md`)
        : path.join(getGlobalSkillTargetPath("codex", command.codexSkillId ?? command.id), "SKILL.md");
      if (availability.slashAvailable) installed.push(agent === "opencode" ? path.basename(target) : path.basename(path.dirname(target)));
      else skipped.push(`${command.id}: ${availability.slashReason ?? "unavailable"}`);
    }
    const directory = agent === "opencode"
      ? getOpenCodeCommandsDirectory()
      : path.dirname(getGlobalSkillTargetPath("codex", "example"));
    previewLines.push(`Commands [${agent}] → ${shortenPath(directory)}`);
    if (installed.length > 0) previewLines.push(`  + ${installed.join(", ")}`);
    for (const entry of skipped) previewLines.push(`  - ${entry}`);
    previewLines.push("");
  }

  const skillPlans: Array<{ readonly plan: SkillPlan; readonly agent: SkillAgent; readonly name: string }> = [];
  const runtimeNotes = new Set<string>();
  for (const entry of skills) {
    for (const agent of targets) {
      if (!entry.compatibleAgents.includes(agent)) continue;
      const plan = await previewSkill(root, entry.id, agent, skillOptions);
      skillPlans.push({ plan, agent, name: entry.name });
      const advisory = plan.dependencies.filter((dependency) => !dependency.required && !dependency.satisfied);
      for (const item of advisory) runtimeNotes.add(item.description);
    }
  }
  for (const agent of targets) {
    const group = skillPlans.filter((item) => item.agent === agent);
    if (group.length === 0) continue;
    previewLines.push(`Skills [${agent}] → ${shortenPath(path.dirname(group[0]!.plan.targetPath))}`);
    const byAction = new Map<string, string[]>();
    for (const item of group) {
      const names = byAction.get(item.plan.action) ?? [];
      names.push(item.name);
      byAction.set(item.plan.action, names);
    }
    for (const [action, names] of byAction) previewLines.push(`  ${action}: ${names.join(", ")}`);
    for (const item of group) {
      if (item.plan.reason) previewLines.push(`  ${item.name}: ${item.plan.reason}`);
      if (item.plan.missing.length > 0) previewLines.push(`  ${item.name}: blocking dependencies — ${item.plan.missing.join("; ")}`);
    }
    previewLines.push("");
  }

  // Nix-owned specialist agents are part of the same one-step install: an orchestrator
  // that cannot invoke its specialists is only half installed.
  const agentPlans: Array<{ readonly plan: SpecialistAgentPlan; readonly agent: SpecialistAgentTarget; readonly name: string }> = [];
  for (const agent of targets) {
    for (const entry of specialistAgentCatalog) {
      if (!entry.supportedAgents.includes(agent)) continue;
      const plan = await previewSpecialistAgent(root, entry.id, agent, { catalog: specialistAgentCatalog });
      agentPlans.push({ plan, agent, name: entry.name });
    }
  }
  for (const agent of targets) {
    const group = agentPlans.filter((item) => item.agent === agent);
    if (group.length === 0) continue;
    previewLines.push(`Agents [${agent}] → ${shortenPath(path.dirname(group[0]!.plan.targetPath))}`);
    for (const item of group) {
      previewLines.push(`  ${item.plan.action}: ${item.name}${item.plan.reason ? ` — ${item.plan.reason}` : ""}`);
    }
    previewLines.push("");
  }
  if (runtimeNotes.size > 0) {
    previewLines.push("Runtime tools these skills use (install them only when you need the skill):");
    for (const note of runtimeNotes) previewLines.push(`  · ${note}`);
    previewLines.push("");
  }
  previewLines.push("Unmanaged files are always preserved.");
  terminal.clear();
  writeFrame(output, "INSTALL PREVIEW", previewLines);

  const confirmed = await terminal.select(
    "Apply these global changes?",
    ["Yes, install", "No, cancel"],
    "CONFIRM",
    undefined,
    1
  );
  if (confirmed !== 0) {
    await pause(terminal, output, "INSTALL CANCELLED", ["No files changed."]);
    return;
  }

  terminal.clear();
  const progress = createProgress(output, "INSTALLING", targets.length + skillPlans.length + agentPlans.length);
  let completed = 0;
  let installedCount = 0;
  let skippedCount = 0;
  const failures: string[] = [];

  for (const agent of targets) {
    progress.update(completed, `Workflow commands for ${agent}`);
    try {
      const result = await installAgentCommands(root, effectiveState, agent);
      installedCount += result.installed.length;
      skippedCount += result.skipped.length;
      for (const skipped of result.skipped) failures.push(`preserved ${skipped.path} — ${skipped.reason}`);
    } catch (error) {
      failures.push(`commands [${agent}]: ${error instanceof Error ? error.message : String(error)}`);
    }
    completed += 1;
    progress.update(completed, `Workflow commands for ${agent}`);
  }

  for (const { plan, agent } of skillPlans) {
    const label = `Skill ${plan.id} [${agent}]`;
    progress.update(completed, label);
    try {
      if (plan.action === "already-current" || plan.action === "conflict" || plan.action === "incompatible") {
        skippedCount += 1;
        if (plan.reason) failures.push(`${label}: ${plan.action} — ${plan.reason}`);
        else failures.push(`${label}: ${plan.action}`);
      } else if (plan.missing.length > 0) {
        skippedCount += 1;
        failures.push(`${label}: skipped — missing dependencies`);
      } else {
        const result = await installSkill(root, plan.id, agent, skillOptions);
        installedCount += result.fileCount;
      }
    } catch (error) {
      failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
    completed += 1;
    progress.update(completed, label);
  }

  for (const { plan, agent } of agentPlans) {
    const label = `Agent ${plan.id} [${agent}]`;
    progress.update(completed, label);
    try {
      if (plan.action === "already-current") {
        skippedCount += 1;
      } else if (plan.action === "install" || plan.action === "update") {
        await installSpecialistAgent(root, plan.id, agent, { catalog: specialistAgentCatalog });
        installedCount += 1;
      } else {
        skippedCount += 1;
        failures.push(`${label}: ${plan.action}${plan.reason ? ` — ${plan.reason}` : ""}`);
      }
    } catch (error) {
      failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
    completed += 1;
    progress.update(completed, label);
  }

  await saveStackState(statePath, {
    schemaVersion: 1,
    selectedComponents: effectiveState.selectedComponents,
    agentTargets: [...targets],
    workflows: { sdd: effectiveState.workflows.sdd, tdd: effectiveState.workflows.tdd }
  });

  const report = [
    `Installed: ${installedCount} files · Preserved: ${skippedCount} · Failed: ${failures.length}`,
    ...(failures.length > 0 ? ["", ...failures.map((failure) => `Failure: ${failure}`)] : []),
    ...(runtimeNotes.size > 0
      ? ["", "Runtime tools these skills use (install them only when you need the skill):", ...[...runtimeNotes].map((note) => `  · ${note}`)]
      : []),
    "",
    "These changes are global; re-run the installer anytime to update them.",
    "",
    "Press Enter to return to the home screen."
  ];
  progress.finish(report, "INSTALL COMPLETE");
  await terminal.question("");
}

async function runUpdate(
  terminal: TuiTerminal,
  output: NodeJS.WritableStream,
  upgrade: UpgradeRunner,
  latestVersion: LatestVersionResolver
): Promise<void> {
  const plan = createUpgradePlan(projectMetadata.packageName);
  let target: string | undefined;
  try {
    target = await latestVersion(projectMetadata.packageName);
  } catch {
    target = undefined;
  }

  terminal.clear();
  writeFrame(output, "AI-STACK UPDATE", [
    `Current version: ${projectMetadata.version}`,
    `Target version: ${target ?? "latest published version (registry unavailable)"}`,
    `Command: ${plan.commandLine}`
  ]);

  if (target !== undefined && target === projectMetadata.version) {
    await pause(terminal, output, "AI-STACK UPDATE", [
      "The installed version is already the latest published version. Nothing to do."
    ]);
    return;
  }

  const confirmed = await terminal.select(
    "Update the globally installed AI-STACK now?",
    ["Yes, update", "No, cancel"],
    "CONFIRM",
    undefined,
    1
  );
  if (confirmed !== 0) {
    await pause(terminal, output, "AI-STACK UPDATE", ["No changes applied."]);
    return;
  }

  let exitCode: number;
  let failureDetail: string | undefined;
  terminal.clear();
  writeFrame(output, "AI-STACK UPDATE", ["Running the upgrade through npm..."]);
  try {
    exitCode = await upgrade(plan);
  } catch (error) {
    exitCode = 1;
    failureDetail = error instanceof Error ? error.message : String(error);
  }
  if (exitCode === 0) {
    await pause(terminal, output, "AI-STACK UPDATED", ["Upgrade finished. Confirm it with: nix-ai --version"]);
    return;
  }
  await pause(terminal, output, "AI-STACK UPDATE FAILED", [
    ...(failureDetail ? [`Upgrade failed: ${failureDetail}`] : []),
    `Upgrade failed with exit code ${exitCode}. Run the printed command manually to see the npm output.`
  ]);
}

async function runAdvancedManagement(
  terminal: TuiTerminal,
  output: NodeJS.WritableStream,
  statePath: string
): Promise<void> {
  const savedState = await loadStackState(statePath);
  const selected = new Set<string>(savedState.selectedComponents.filter((id) => id !== "workflow.sdd" && id !== "workflow.tdd"));
  if (savedState.workflows.sdd) selected.add("workflow.sdd");
  if (savedState.workflows.tdd) selected.add("workflow.tdd");

  const categories = [...new Set(components.map((component) => component.category))];
  const menu = [
    ...categories,
    "Preview selections",
    "Save preferences",
    "Install Nix Core skill globally (Codex user skills)",
    "Manage global security hooks",
    "Manage global skills",
    "Workflow commands",
    "Manage specialist agents",
    "Manage MCP integrations",
    "Exit"
  ];
  while (true) {
    const choiceIndex = await terminal.select("Choose a section", menu, "CONFIGURE AI-STACK");
    if (choiceIndex === menu.length - 1 || choiceIndex < 0) return;
    const choice = choiceIndex + 1;

    if (choice === categories.length + 1) {
      const chosen = components.filter((item) => selected.has(item.id));
      terminal.report("SELECTION PREVIEW", [
        "Read-only preview — no agent configuration will be changed.",
        "",
        ...(chosen.length > 0 ? chosen.map((component) => `+ ${component.name}`) : ["No components selected."])
      ]);
      await terminal.question("");
      continue;
    }
    if (choice === categories.length + 2) {
      const agentTargets = [...selected].filter((id) => id.startsWith("agent.")).map((id) => id.slice("agent.".length));
      await saveStackState(statePath, {
        schemaVersion: 1,
        selectedComponents: [...selected],
        agentTargets,
        workflows: {
          sdd: selected.has("workflow.sdd"),
          tdd: selected.has("workflow.tdd")
        }
      });
      terminal.report("PREFERENCES SAVED", [
        `Preferences saved to ${shortenPath(statePath)}.`,
        "Agent configuration was not changed."
      ]);
      await terminal.question("");
      continue;
    }
    if (choice === categories.length + 3) {
      const projectRoot = process.cwd();
      const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
      const adapter = new CodexSkillAdapter(sourceRoot);
      const plan = await adapter.preview(projectRoot, nixCoreSkill.id);
      terminal.report("NIX CORE SKILL", [
        `Preview: ${plan.action} ${nixCoreSkill.name}`,
        `Target: ${shortenPath(plan.targetPath)}`,
        ...(plan.reason ? [`Reason: ${plan.reason}`] : [])
      ]);
      if (plan.action === "install" || plan.action === "update") {
        if (await terminal.confirm("Apply this global change?")) {
          const result = plan.action === "update"
            ? await adapter.update(projectRoot, nixCoreSkill.id)
            : await adapter.install(projectRoot, nixCoreSkill.id);
          terminal.report("NIX CORE SKILL", [
            `${result.action}: ${nixCoreSkill.name}`,
            ...(result.backupId ? [`Backup: ${result.backupId}`] : [])
          ]);
        } else {
          terminal.report("NIX CORE SKILL", ["No files changed."]);
        }
      }
      await terminal.question("");
      continue;
    }
    if (choice === categories.length + 4) {
      await manageSecurityHooks(terminal, output);
      continue;
    }
    if (choice === categories.length + 5) {
      await manageProjectSkills(terminal, output);
      continue;
    }
    if (choice === categories.length + 6) {
      await showWorkflowCommands(terminal, output);
      continue;
    }
    if (choice === categories.length + 7) {
      await manageSpecialistAgents(terminal, output);
      continue;
    }
    if (choice === categories.length + 8) {
      await manageMcpIntegrations(terminal, output);
      continue;
    }

    const category = categories[choice - 1];
    if (!category) continue;
    if (category === "MCPs") {
      await manageMcpIntegrations(terminal, output);
      continue;
    }
    const entries = components.filter((component) => component.category === category);
    let back = false;
    while (!back) {
      terminal.clear();
      const choices = entries.map((component) => {
        const mark = selected.has(component.id) ? "x" : " ";
        const stateLabel = component.id.startsWith("workflow.")
          ? `enabled: ${selected.has(component.id) ? "yes" : "no"}`
          : `selected preference: ${selected.has(component.id) ? "yes" : "no"}`;
        return `[${mark}] ${component.name} — ${component.description} (${stateLabel})`;
      });
      choices.push("Done");
      const itemChoice = await terminal.select("Choose an item to toggle", choices, category.toUpperCase());
      if (itemChoice < 0 || itemChoice === entries.length) {
        back = true;
        continue;
      }
      const item = entries[itemChoice];
      if (item) selected.has(item.id) ? selected.delete(item.id) : selected.add(item.id);
    }
  }
}

async function showWorkflowCommands(terminal: TuiTerminal, output: NodeJS.WritableStream): Promise<void> {
  const state = await loadStackState();
  const availabilities = resolveCommandAvailability(state);
  terminal.report("NIX COMMANDS", availabilities.flatMap((availability) => {
    const command = availability.command;
    return [
      `${command.slash} — ${command.description}`,
      `  CLI: ${availability.cliAvailable ? "available" : `unavailable — ${availability.cliReason}`}`,
      `  Slash: ${availability.slashAvailable ? "available" : `unavailable — ${availability.slashReason}`}`,
      `  Artifacts: ${command.artifacts.join(", ")}`,
      ""
    ];
  }));
  const action = await terminal.select("Choose an action", [
    "Install/update commands for OpenCode",
    "Install/update commands for Codex",
    "Remove Nix-managed commands from OpenCode",
    "Remove Nix-managed commands from Codex",
    "Back"
  ], "WORKFLOW COMMANDS");
  if (action === 4 || action < 0) return;
  const agent: SpecialistAgentTarget | undefined = [0, 2].includes(action)
    ? "opencode"
    : [1, 3].includes(action)
      ? "codex"
      : undefined;
  if (!agent) return;

  const removing = action === 2 || action === 3;
  const commandPaths = workflowCommandCatalog.map((command) => agent === "opencode"
    ? path.join(getOpenCodeCommandsDirectory(), `${command.id}.md`)
    : path.join(getGlobalSkillTargetPath("codex", command.codexSkillId ?? command.id), "SKILL.md"));
  const previewTitle = removing ? "COMMAND REMOVAL" : "COMMAND INSTALL";
  terminal.report(previewTitle, [
    `[${agent}] ${removing ? "Removal preview" : "Installation preview"}`,
    "",
    ...commandPaths.map((target) => `${removing ? "-" : "+"} ${shortenPath(target)}`),
    "",
    "Unmanaged files are preserved."
  ]);
  if (await terminal.confirm(`${removing ? "Remove only Nix-managed commands" : "Install available commands"}?`)) {
    const result = removing
      ? await removeAgentCommands(process.cwd(), agent)
      : await installAgentCommands(process.cwd(), state, agent);
    terminal.report(previewTitle, [
      `${removing ? "Removed" : "Installed"}: ${removing ? result.removed.length : result.installed.length} command files.`,
      ...result.skipped.map((item) => `Preserved: ${shortenPath(item.path)} — ${item.reason}`)
    ]);
  } else {
    terminal.report(previewTitle, ["No files changed."]);
  }
  await terminal.question("");
}

async function chooseAgentTarget(
  terminal: TuiTerminal,
  output: NodeJS.WritableStream,
  label: string
): Promise<SpecialistAgentTarget | undefined> {
  const choice = await terminal.select(`Select the ${label} target`, ["OpenCode", "Codex", "Back"], `${label.toUpperCase()} TARGET`);
  return choice === 0
    ? "opencode"
    : choice === 1
      ? "codex"
      : undefined;
}

async function manageSpecialistAgents(terminal: TuiTerminal, output: NodeJS.WritableStream): Promise<void> {
  const root = process.cwd();
  let back = false;
  while (!back) {
    terminal.clear();
    const statuses = await getSpecialistAgentStatus(root, { catalog: specialistAgentCatalog });
    const choices = specialistAgentCatalog.map((entry) => {
      const state = statuses.filter((item) => item.id === entry.id).map((item) => `${item.agent}: ${item.state}`).join(", ");
      return `${entry.name} — ${entry.description} (${state})`;
    });
    choices.push("Back");
    const specialistIndex = await terminal.select("Choose a specialist", choices, "SPECIALIST AGENTS");
    if (specialistIndex < 0 || specialistIndex === specialistAgentCatalog.length) { back = true; continue; }
    const entry = specialistAgentCatalog[specialistIndex];
    if (!entry) continue;
    const agent = await chooseAgentTarget(terminal, output, "installation");
    if (!agent) continue;

    const action = await terminal.select("Choose an action", ["Preview and install/update", "Remove Nix-managed specialist", "Back"], entry.name.toUpperCase());
    if (action === 2 || action < 0) continue;
    if (action === 0) {
      const plan = await previewSpecialistAgent(root, entry.id, agent, { catalog: specialistAgentCatalog });
      terminal.report(entry.name.toUpperCase(), [
        `Preview: ${plan.action}`,
        `Target: ${shortenPath(plan.targetPath)}`,
        ...(plan.reason ? [`Reason: ${plan.reason}`] : [])
      ]);
      if (plan.action === "install" || plan.action === "update") {
        if (await terminal.confirm("Apply this global change?")) {
          const result = await installSpecialistAgent(root, entry.id, agent, { catalog: specialistAgentCatalog });
          terminal.report(entry.name.toUpperCase(), [
            `${result.action}: ${entry.name} [${agent}]`,
            `Target: ${shortenPath(result.targetPath)}`
          ]);
        } else terminal.report(entry.name.toUpperCase(), ["No files changed."]);
      }
    } else if (action === 1) {
      const current = statuses.find((item) => item.id === entry.id && item.agent === agent);
      terminal.report(entry.name.toUpperCase(), [
        `Removal preview: ${entry.name} [${agent}] — ${current?.state ?? "unknown"}`,
        ...(current?.state === "absent"
          ? ["Nothing to remove."]
          : current?.state !== "current" && current?.state !== "update-available"
            ? ["Refusing removal because Nix cannot verify ownership and installed content."]
            : [])
      ]);
      if (current?.state === "current" || current?.state === "update-available") {
        if (await terminal.confirm("Remove only the verified Nix-managed agent?")) {
          const result = await removeSpecialistAgent(root, entry.id, agent, { catalog: specialistAgentCatalog });
          terminal.report(entry.name.toUpperCase(), [`${result.action}: ${entry.name} [${agent}]`]);
        } else terminal.report(entry.name.toUpperCase(), ["No files changed."]);
      }
    }
    await terminal.question("");
  }
}

async function manageMcpIntegrations(terminal: TuiTerminal, output: NodeJS.WritableStream): Promise<void> {
  const root = process.cwd();
  let back = false;
  while (!back) {
    terminal.clear();
    const statuses = await getMcpStatus(root);
    const choices = mcpCatalog.map((entry) => {
      const state = statuses.filter((item) => item.id === entry.id).map((item) => `${item.agent}: ${item.state}`).join(", ");
      return `${entry.name} — ${entry.purpose} (${state})`;
    });
    choices.push("Back");
    const integrationIndex = await terminal.select("Choose an integration", choices, "Global MCP integrations");
    if (integrationIndex < 0 || integrationIndex === mcpCatalog.length) { back = true; continue; }
    const entry = mcpCatalog[integrationIndex];
    if (!entry) continue;
    const agent = await chooseAgentTarget(terminal, output, "MCP");
    if (!agent || !entry.supportedAgents.includes(agent)) continue;

    const status = statuses.find((item) => item.id === entry.id && item.agent === agent);
    const action = await terminal.select("Choose an action", ["Preview and install/update", "Remove Nix-managed integration", "Back"], entry.name.toUpperCase());
    if (action === 2 || action < 0) continue;
    if (action === 0) {
      const plan = await previewMcp(root, entry.id, agent);
      const panelTitle = entry.name.toUpperCase();
      terminal.report(panelTitle, [
        `Preview: ${plan.action}`,
        `Target: ${shortenPath(plan.targetPath)}`,
        `Network: ${plan.networkAccess}`,
        `Credentials: ${plan.credentials.required ? plan.credentials.envVars.join(", ") : "none required"}`,
        `Note: ${plan.credentials.note}`,
        ...(plan.prerequisites.missing.length > 0 ? [`Missing prerequisites: ${plan.prerequisites.missing.join("; ")}`] : []),
        ...(plan.reason ? [`Reason: ${plan.reason}`] : []),
        ...(!plan.prerequisites.satisfied ? ["Installation is unavailable until the listed prerequisites are present."] : [])
      ]);
      if (!plan.prerequisites.satisfied) {
        // Nothing to apply: the missing prerequisites make the install impossible.
      } else if (plan.action === "install" || plan.action === "update") {
        if (await terminal.confirm("Apply this global change?")) {
          const result = await installMcp(root, entry.id, agent);
          terminal.report(panelTitle, [`${result.action}: ${entry.name} [${agent}]`]);
        } else terminal.report(panelTitle, ["No files changed."]);
      }
    } else if (action === 1) {
      const panelTitle = entry.name.toUpperCase();
      terminal.report(panelTitle, [
        `Removal preview: ${entry.name} [${agent}] — ${status?.state ?? "unknown"}`,
        entry.removal,
        ...(!status || status.state === "absent"
          ? ["Nothing to remove."]
          : status.state !== "current" && status.state !== "update-available"
            ? ["Refusing removal because Nix cannot verify ownership and installed content."]
            : [])
      ]);
      if (status && (status.state === "current" || status.state === "update-available")) {
        if (await terminal.confirm("Remove only the verified Nix-managed integration?")) {
          const result = await removeMcp(root, entry.id, agent);
          terminal.report(panelTitle, [`${result.action}: ${entry.name} [${agent}]`]);
        } else terminal.report(panelTitle, ["No files changed."]);
      }
    }
    await terminal.question("");
  }
}

async function manageProjectSkills(terminal: TuiTerminal, output: NodeJS.WritableStream): Promise<void> {
  const projectRoot = process.cwd();
  let back = false;
  while (!back) {
    terminal.clear();
    const statuses = await getSkillStatus(projectRoot);
    const choices = skillCatalog.map((entry) => {
      const state = statuses
        .filter((status) => status.id === entry.id)
        .map((status) => `${status.agent}: ${status.state}`)
        .join(", ");
      const dependencies = entry.dependencies.length === 0
        ? "none"
        : entry.dependencies.map((item) => `${item.description}${item.required ? "" : " (optional)"}`).join("; ");
      return `${entry.name} — ${entry.description} (compatible: ${entry.compatibleAgents.join(", ")}; dependencies: ${dependencies}; ${state || "not installed"})`;
    });
    choices.push("Back");
    const skillIndex = await terminal.select("Choose a skill", choices, "GLOBAL SKILLS");
    if (skillIndex < 0 || skillIndex === skillCatalog.length) {
      back = true;
      continue;
    }
    const entry = skillCatalog[skillIndex];
    if (!entry) continue;

    const current = statuses
      .filter((status) => status.id === entry.id)
      .map((status) => `${status.agent}: ${status.state}`)
      .join(", ");
    terminal.report(entry.name.toUpperCase(), [
      `Source: ${describeSkillSource(entry.source)}`,
      `License: ${entry.license}; version: ${entry.version}`,
      `Compatible agents: ${entry.compatibleAgents.join(", ")}`,
      `Dependencies: ${entry.dependencies.length === 0 ? "none" : entry.dependencies.map((item) => item.description).join("; ")}`,
      `Status: ${current}`
    ]);
    const action = await terminal.select("Choose a skill action", [
      "Preview/install for OpenCode",
      "Preview/install for Codex",
      "Remove OpenCode",
      "Remove Codex",
      "Back"
    ], entry.name.toUpperCase());
    if (action === 4 || action < 0) continue;
    const agent: SkillAgent | undefined = action === 0 || action === 2
      ? "opencode"
      : action === 1 || action === 3
        ? "codex"
        : undefined;
    if (!agent) continue;

    if (action === 0 || action === 1) {
      const plan = await previewSkill(projectRoot, entry.id, agent);
      const panelTitle = entry.name.toUpperCase();
      terminal.report(panelTitle, [
        `Preview: ${plan.action}`,
        `Target: ${shortenPath(plan.targetPath)}`,
        ...(plan.missing.length > 0 ? [`Blocking dependencies: ${plan.missing.join("; ")}`] : []),
        ...(plan.reason ? [`Reason: ${plan.reason}`] : []),
        ...(plan.action === "install" || plan.action === "update" ? [] : [])
      ]);
      if ((plan.action === "install" || plan.action === "update") && plan.missing.length > 0) {
        terminal.report(panelTitle, ["Installation is unavailable until the required dependencies are present."]);
      } else if (plan.action === "install" || plan.action === "update") {
        if (await terminal.confirm("Apply this global change?")) {
          try {
            const result = await installSkill(projectRoot, entry.id, agent);
            terminal.report(panelTitle, [`${result.action}: ${entry.name} [${agent}]`, `Files: ${result.fileCount}`]);
          } catch (error) {
            terminal.report(panelTitle, [error instanceof Error ? error.message : String(error)]);
          }
        } else {
          terminal.report(panelTitle, ["No files changed."]);
        }
      }
    } else {
      if (await terminal.confirm("Remove this Nix-managed skill?")) {
        try {
          await removeSkill(projectRoot, entry.id, agent);
          terminal.report(entry.name.toUpperCase(), [`removed: ${entry.name} [${agent}]`]);
        } catch (error) {
          terminal.report(entry.name.toUpperCase(), [error instanceof Error ? error.message : String(error)]);
        }
      } else {
        terminal.report(entry.name.toUpperCase(), ["No files changed."]);
      }
    }
    await terminal.question("");
  }
}

async function manageSecurityHooks(terminal: TuiTerminal, output: NodeJS.WritableStream): Promise<void> {
  const projectRoot = process.cwd();
  const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const installer = new SecurityHooksInstaller(sourceRoot);
  let back = false;
  while (!back) {
    terminal.clear();
    const status = await installer.status(projectRoot);
    terminal.report("GLOBAL SECURITY HOOKS", [
      "Global destructive-operation safeguards",
      `Codex: ${status.codexEnabled ? "enabled" : "disabled"}`,
      `OpenCode V1/V2: ${status.opencodeEnabled ? "enabled" : "disabled"}`,
      "Shells: PowerShell, cmd.exe, Git Bash/MSYS"
    ]);
    const action = await terminal.select("Choose an action", ["Preview and enable", "Disable", "Back"], "GLOBAL SECURITY HOOKS");
    if (action === 2 || action < 0) { back = true; continue; }
    if (action === 0) {
      const plan = await installer.preview(projectRoot);
      terminal.report("SECURITY HOOKS", [
        `Preview: ${plan.action}`,
        `Codex: ${shortenPath(plan.targets.codex)}`,
        `OpenCode: ${shortenPath(plan.targets.opencode)}`,
        ...(plan.reason ? [`Reason: ${plan.reason}`] : [])
      ]);
      if (plan.action === "conflict") {
        await terminal.question("");
        continue;
      }
      if (plan.action === "already-current") {
        terminal.report("SECURITY HOOKS", ["Security hooks are already installed."]);
        await terminal.question("");
        continue;
      }
      if (await terminal.confirm("Install these global hooks?")) {
        const result = await installer.install(projectRoot);
        terminal.report("SECURITY HOOKS", [`Security hooks ${result.action}.`]);
      } else terminal.report("SECURITY HOOKS", ["No files changed."]);
      await terminal.question("");
      continue;
    }
    if (action === 1) {
      if (await terminal.confirm("Remove only Nix-owned global hooks and preserve user-owned entries?")) {
        await installer.uninstall(projectRoot);
        terminal.report("SECURITY HOOKS", ["Nix-owned security hooks removed."]);
      } else terminal.report("SECURITY HOOKS", ["No files changed."]);
      await terminal.question("");
    }
  }
}
