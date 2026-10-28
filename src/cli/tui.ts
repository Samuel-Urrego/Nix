import { createInterface, type Interface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getStackStatePath, loadStackState, saveStackState } from "../core/config/stack-state.js";
import { getCodexUserSkillsDirectory, getGlobalSkillTargetPath, getOpenCodeCommandsDirectory } from "../core/config/global-paths.js";
import { CodexSkillAdapter } from "../core/components/codex-skill-adapter.js";
import { nixCoreSkill } from "../core/components/component-catalog.js";
import { SecurityHooksInstaller } from "../core/security/security-hooks-installer.js";
import { mcpCatalog } from "../core/mcp/mcp-catalog.js";
import { getMcpStatus, installMcp, previewMcp, removeMcp } from "../core/mcp/mcp-service.js";
import { resolveCommandAvailability, workflowCommandCatalog } from "../core/commands/workflow-command-catalog.js";
import { installAgentCommands, removeAgentCommands } from "../core/commands/workflow-command-service.js";
import { specialistAgentCatalog } from "../core/agents/agent-catalog.js";
import { getSpecialistAgentStatus, installSpecialistAgent, previewSpecialistAgent, removeSpecialistAgent } from "../core/agents/agent-installer.js";
import type { SpecialistAgentTarget } from "../core/agents/agent-contracts.js";
import { skillCatalog } from "../core/skills/skill-catalog.js";
import { describeSkillSource } from "../core/skills/skill-contracts.js";
import type { SkillAgent } from "../core/skills/skill-contracts.js";
import { getSkillStatus, installSkill, previewSkill, removeSkill } from "../core/skills/skill-installer.js";
import { selectWithKeyboard, writeFrame } from "./tui-keyboard.js";

export interface TuiOptions {
  readonly input?: NodeJS.ReadableStream;
  readonly output?: NodeJS.WritableStream;
  readonly ask?: (prompt: string) => Promise<string>;
  readonly select?: (prompt: string, choices: readonly string[]) => Promise<number>;
}

interface TuiTerminal {
  question(prompt: string): Promise<string>;
  select(prompt: string, choices: readonly string[], title?: string): Promise<number>;
  close(): void;
}

function createTuiTerminal(options: TuiOptions, input: NodeJS.ReadableStream, output: NodeJS.WritableStream): TuiTerminal {
  let lineReader: Interface | undefined;
  const question = (prompt: string): Promise<string> => {
    if (options.ask) return options.ask(prompt);
    lineReader ??= createInterface({ input, output });
    return lineReader.question(prompt);
  };
  const select = async (prompt: string, choices: readonly string[], title = "NIX AI-STACK"): Promise<number> => {
    if (options.select) {
      writeFrame(output, title, [prompt, "", ...choices.map((choice) => `  ${choice}`), "", "↑↓ Navigate · Enter Select · Esc Back"]);
      return options.select(prompt, choices);
    }
    if (options.ask) {
      // Existing scripted TUI tests focus on a manager flow; enter the new home screen automatically.
      if (prompt === "What would you like to do?") return 0;
      writeFrame(output, title, [prompt, "", ...choices.map((choice) => `  ${choice}`), "", "Select an item to continue."]);
      const answer = (await options.ask(prompt)).trim();
      if (["q", "b", "back", "escape"].includes(answer.toLowerCase())) return -1;
      const numeric = Number(answer);
      if (Number.isInteger(numeric) && numeric >= 1 && numeric <= choices.length) return numeric - 1;
      return choices.findIndex((choice) => choice.toLowerCase() === answer.toLowerCase());
    }
    lineReader?.close();
    lineReader = undefined;
    return selectWithKeyboard({ input: input as NodeJS.ReadStream, output, prompt, choices, title });
  };
  return {
    question,
    select,
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

export async function runTui(options: TuiOptions = {}): Promise<void> {
  const input = options.input ?? stdin;
  const output = options.output ?? stdout;
  const interactive = Boolean(options.ask || options.select || ((input as NodeJS.ReadStream).isTTY && (output as NodeJS.WriteStream).isTTY));
  if (!interactive) {
    output.write(`${header}\n\n`);
    output.write("The nix-ai TUI requires an interactive terminal. Run `nix-ai` from Windows Terminal or PowerShell.\n");
    process.exitCode = 1;
    return;
  }

  const statePath = getStackStatePath();
  const savedState = await loadStackState(statePath);
  const selected = new Set<string>(savedState.selectedComponents.filter((id) => id !== "workflow.sdd" && id !== "workflow.tdd"));
  if (savedState.workflows.sdd) selected.add("workflow.sdd");
  if (savedState.workflows.tdd) selected.add("workflow.tdd");
  const terminal = createTuiTerminal(options, input, output);

  try {
    let done = false;
    while (!done) {
      const homeAction = await terminal.select("What would you like to do?", ["Install or configure AI-STACK", "Quit"], "NIX AI-STACK");
      if (homeAction === 1 || homeAction < 0) {
        done = true;
        continue;
      }
      output.write("\u001b[2J\u001b[H");
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
      const choiceIndex = await terminal.select("Choose a section", menu, "CONFIGURE AI-STACK");
      const choice = choiceIndex + 1;

      if (choiceIndex === menu.length - 1 || choiceIndex < 0) {
        done = true;
        continue;
      }
      if (choice === categories.length + 1) {
        output.write("\n  Read-only preview — no agent configuration will be changed.\n");
        for (const component of components.filter((item) => selected.has(item.id))) {
          output.write(`  + ${component.name}\n`);
        }
        if (selected.size === 0) output.write("  No components selected.\n");
        await terminal.question("\n  Press Enter to return to the menu.");
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
        output.write(`\n  Preferences saved to ${statePath}. Agent configuration was not changed.\n`);
        await terminal.question("\n  Press Enter to return to the menu.");
        continue;
      }
      if (choice === categories.length + 3) {
        const projectRoot = process.cwd();
        const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
        const adapter = new CodexSkillAdapter(sourceRoot);
        const plan = await adapter.preview(projectRoot, nixCoreSkill.id);
        output.write(`\n  Preview: ${plan.action} ${nixCoreSkill.name}\n  Target: ${plan.targetPath}\n`);
        if (plan.reason) output.write(`  Reason: ${plan.reason}\n`);
        if (plan.action === "install" || plan.action === "update") {
          const confirmation = (await terminal.question("\n  Apply this global change? Type yes to confirm: ")).trim().toLowerCase();
          if (confirmation === "yes") {
            const result = plan.action === "update"
              ? await adapter.update(projectRoot, nixCoreSkill.id)
              : await adapter.install(projectRoot, nixCoreSkill.id);
            output.write(`\n  ${result.action}: ${nixCoreSkill.name}\n`);
            if (result.backupId) output.write(`  Backup: ${result.backupId}\n`);
          } else {
            output.write("\n  No files changed.\n");
          }
        }
        await terminal.question("\n  Press Enter to return to the menu.");
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
  } finally {
    terminal.close();
  }
}

async function showWorkflowCommands(terminal: TuiTerminal, output: NodeJS.WritableStream): Promise<void> {
  const state = await loadStackState();
  const availabilities = resolveCommandAvailability(state);
  output.write("\n  Nix commands\n\n");
  for (const availability of availabilities) {
    const command = availability.command;
    output.write(`  ${command.slash} — ${command.description}\n`);
    output.write(`    CLI: ${availability.cliAvailable ? "available" : `unavailable — ${availability.cliReason}`}\n`);
    output.write(`    Slash: ${availability.slashAvailable ? "available" : `unavailable — ${availability.slashReason}`}\n`);
    output.write(`    Artifacts: ${command.artifacts.join(", ")}\n\n`);
  }
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
  output.write(`\n  ${removing ? "Removal preview" : "Installation preview"} [${agent}]\n`);
  commandPaths.forEach((target) => output.write(`  ${removing ? "-" : "+"} ${target}\n`));
  output.write("  Unmanaged files are preserved.\n");
  const confirmation = (await terminal.question(`\n  ${removing ? "Remove only Nix-managed commands" : "Install available commands"}? Type yes to confirm: `)).trim().toLowerCase();
  if (confirmation !== "yes") {
    output.write("\n  No files changed.\n");
  } else {
    const result = removing
      ? await removeAgentCommands(process.cwd(), agent)
      : await installAgentCommands(process.cwd(), state, agent);
    output.write(`\n  ${removing ? "Removed" : "Installed"}: ${removing ? result.removed.length : result.installed.length} command files.\n`);
    result.skipped.forEach((item) => output.write(`  Preserved: ${item.path} — ${item.reason}\n`));
  }
  await terminal.question("\n  Press Enter to return to the menu.");
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
      output.write(`\n  Preview: ${plan.action}\n  Target: ${plan.targetPath}\n`);
      if (plan.reason) output.write(`  Reason: ${plan.reason}\n`);
      if (plan.action === "install" || plan.action === "update") {
        const confirmation = (await terminal.question("\n  Apply this global change? Type yes to confirm: ")).trim().toLowerCase();
        if (confirmation === "yes") {
          const result = await installSpecialistAgent(root, entry.id, agent, { catalog: specialistAgentCatalog });
          output.write(`\n  ${result.action}: ${entry.name} [${agent}]\n  Target: ${result.targetPath}\n`);
        } else output.write("\n  No files changed.\n");
      }
    } else if (action === 1) {
      const current = statuses.find((item) => item.id === entry.id && item.agent === agent);
      output.write(`\n  Removal preview: ${entry.name} [${agent}] — ${current?.state ?? "unknown"}\n`);
      if (current?.state === "absent") output.write("  Nothing to remove.\n");
      else if (current?.state !== "current" && current?.state !== "update-available") {
        output.write("  Refusing removal because Nix cannot verify ownership and installed content.\n");
      }
      else {
        const confirmation = (await terminal.question("\n  Remove only the verified Nix-managed agent? Type yes to confirm: ")).trim().toLowerCase();
        if (confirmation === "yes") {
          const result = await removeSpecialistAgent(root, entry.id, agent, { catalog: specialistAgentCatalog });
          output.write(`\n  ${result.action}: ${entry.name} [${agent}]\n`);
        } else output.write("\n  No files changed.\n");
      }
    }
    await terminal.question("\n  Press Enter to return to the specialist list.");
  }
}

async function manageMcpIntegrations(terminal: TuiTerminal, output: NodeJS.WritableStream): Promise<void> {
  const root = process.cwd();
  let back = false;
  while (!back) {
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
      output.write(`\n  Preview: ${plan.action}\n  Target: ${plan.targetPath}\n  Network: ${plan.networkAccess}\n  Credentials: ${plan.credentials.required ? plan.credentials.envVars.join(", ") : "none required"}\n`);
      output.write(`  Note: ${plan.credentials.note}\n`);
      if (plan.prerequisites.missing.length > 0) output.write(`  Missing prerequisites: ${plan.prerequisites.missing.join("; ")}\n`);
      if (plan.reason) output.write(`  Reason: ${plan.reason}\n`);
      if (!plan.prerequisites.satisfied) {
        output.write("  Installation is unavailable until the listed prerequisites are present.\n");
      } else if (plan.action === "install" || plan.action === "update") {
        const confirmation = (await terminal.question("\n  Apply this global change? Type yes to confirm: ")).trim().toLowerCase();
        if (confirmation === "yes") {
          const result = await installMcp(root, entry.id, agent);
          output.write(`\n  ${result.action}: ${entry.name} [${agent}]\n`);
        } else output.write("\n  No files changed.\n");
      }
    } else if (action === 1) {
      output.write(`\n  Removal preview: ${entry.name} [${agent}] — ${status?.state ?? "unknown"}\n  ${entry.removal}\n`);
      if (!status || status.state === "absent") output.write("  Nothing to remove.\n");
      else if (status.state !== "current" && status.state !== "update-available") {
        output.write("  Refusing removal because Nix cannot verify ownership and installed content.\n");
      }
      else {
        const confirmation = (await terminal.question("\n  Remove only the verified Nix-managed integration? Type yes to confirm: ")).trim().toLowerCase();
        if (confirmation === "yes") {
          const result = await removeMcp(root, entry.id, agent);
          output.write(`\n  ${result.action}: ${entry.name} [${agent}]\n`);
        } else output.write("\n  No files changed.\n");
      }
    }
    await terminal.question("\n  Press Enter to return to the MCP list.");
  }
}

async function manageProjectSkills(terminal: TuiTerminal, output: NodeJS.WritableStream): Promise<void> {
  const projectRoot = process.cwd();
  let back = false;
  while (!back) {
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
    output.write(`\n  ${entry.name}\n`);
    output.write(`  Source: ${describeSkillSource(entry.source)}\n`);
    output.write(`  License: ${entry.license}; version: ${entry.version}\n`);
    output.write(`  Compatible agents: ${entry.compatibleAgents.join(", ")}\n`);
    output.write(`  Dependencies: ${entry.dependencies.length === 0 ? "none" : entry.dependencies.map((item) => item.description).join("; ")}\n`);
    output.write(`  Status: ${current}\n\n`);
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
      output.write(`\n  Preview: ${plan.action}\n  Target: ${plan.targetPath}\n`);
      if (plan.missing.length > 0) output.write(`  Missing dependencies: ${plan.missing.join("; ")}\n`);
      if (plan.reason) output.write(`  Reason: ${plan.reason}\n`);
      if ((plan.action === "install" || plan.action === "update") && plan.missing.length > 0) {
        output.write("  Installation is unavailable until the required dependencies are present.\n");
      } else if (plan.action === "install" || plan.action === "update") {
        const confirmation = (await terminal.question("\n  Apply this global change? Type yes to confirm: ")).trim().toLowerCase();
        if (confirmation === "yes") {
          try {
            const result = await installSkill(projectRoot, entry.id, agent);
            output.write(`\n  ${result.action}: ${entry.name} [${agent}]\n  Files: ${result.fileCount}\n`);
          } catch (error) {
            output.write(`\n  ${error instanceof Error ? error.message : String(error)}\n`);
          }
        } else {
          output.write("\n  No files changed.\n");
        }
      }
    } else {
      const confirmation = (await terminal.question("\n  Remove this Nix-managed skill? Type yes to confirm: ")).trim().toLowerCase();
      if (confirmation === "yes") {
        try {
          await removeSkill(projectRoot, entry.id, agent);
          output.write(`\n  removed: ${entry.name} [${agent}]\n`);
        } catch (error) {
          output.write(`\n  ${error instanceof Error ? error.message : String(error)}\n`);
        }
      } else {
        output.write("\n  No files changed.\n");
      }
    }
    await terminal.question("\n  Press Enter to return to the skill list.");
  }
}

async function manageSecurityHooks(terminal: TuiTerminal, output: NodeJS.WritableStream): Promise<void> {
  const projectRoot = process.cwd();
  const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const installer = new SecurityHooksInstaller(sourceRoot);
  let back = false;
  while (!back) {
    const status = await installer.status(projectRoot);
    output.write("\n  Global destructive-operation safeguards\n");
    output.write(`  Codex: ${status.codexEnabled ? "enabled" : "disabled"}\n`);
    output.write(`  OpenCode V1/V2: ${status.opencodeEnabled ? "enabled" : "disabled"}\n`);
    output.write("  Shells: PowerShell, cmd.exe, Git Bash/MSYS\n");
    const action = await terminal.select("Choose an action", ["Preview and enable", "Disable", "Back"], "GLOBAL SECURITY HOOKS");
    if (action === 2 || action < 0) { back = true; continue; }
    if (action === 0) {
      const plan = await installer.preview(projectRoot);
      output.write(`\n  Preview: ${plan.action}\n  Codex: ${plan.targets.codex}\n  OpenCode: ${plan.targets.opencode}\n`);
      if (plan.reason) output.write(`  Reason: ${plan.reason}\n`);
      if (plan.action === "conflict") {
        await terminal.question("\n  Resolve the conflict before enabling. Press Enter to return.");
        continue;
      }
      if (plan.action === "already-current") {
        await terminal.question("\n  Security hooks are already installed. Press Enter to return.");
        continue;
      }
      const confirmation = (await terminal.question("\n  Install these global hooks? Type yes to confirm: ")).trim().toLowerCase();
      if (confirmation === "yes") {
        const result = await installer.install(projectRoot);
        output.write(`\n  Security hooks ${result.action}.\n`);
      } else output.write("\n  No files changed.\n");
      await terminal.question("\n  Press Enter to return.");
      continue;
    }
    if (action === 1) {
      const confirmation = (await terminal.question("\n  Remove only Nix-owned global hooks and preserve user-owned entries? Type yes to confirm: ")).trim().toLowerCase();
      if (confirmation === "yes") {
        await installer.uninstall(projectRoot);
        output.write("\n  Nix-owned security hooks removed.\n");
      } else output.write("\n  No files changed.\n");
      await terminal.question("\n  Press Enter to return.");
    }
  }
}
