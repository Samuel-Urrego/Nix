import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getStackStatePath, loadStackState, saveStackState } from "../core/config/stack-state.js";
import { CodexSkillAdapter } from "../core/components/codex-skill-adapter.js";
import { nixCoreSkill } from "../core/components/component-catalog.js";
import { SecurityHooksInstaller } from "../core/security/security-hooks-installer.js";
import { getMcpStatus } from "../core/mcp/mcp-service.js";
import { resolveCommandAvailability } from "../core/commands/workflow-command-catalog.js";
import { skillCatalog } from "../core/skills/skill-catalog.js";
import type { SkillAgent } from "../core/skills/skill-contracts.js";
import { getSkillStatus, installSkill, previewSkill, removeSkill } from "../core/skills/skill-installer.js";

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

export async function runTui(): Promise<void> {
  if (!stdin.isTTY || !stdout.isTTY) {
    stdout.write(`${header}\n\n`);
    stdout.write("The nix-ai TUI requires an interactive terminal. Run `nix-ai` from Windows Terminal or PowerShell.\n");
    process.exitCode = 1;
    return;
  }

  const statePath = getStackStatePath();
  const savedState = await loadStackState(statePath);
  const selected = new Set<string>(savedState.selectedComponents.filter((id) => id !== "workflow.sdd" && id !== "workflow.tdd"));
  if (savedState.workflows.sdd) selected.add("workflow.sdd");
  if (savedState.workflows.tdd) selected.add("workflow.tdd");
  const terminal = createInterface({ input: stdin, output: stdout });

  try {
    let done = false;
    while (!done) {
      stdout.write("\u001b[2J\u001b[H");
      stdout.write(`${header}\n\n  NIX-AI  |  Configure your AI development stack\n\n`);
      const categories = [...new Set(components.map((component) => component.category))];
      categories.forEach((category, index) => stdout.write(`  ${index + 1}. ${category}\n`));
      stdout.write(`  ${categories.length + 1}. Preview selections\n`);
      stdout.write(`  ${categories.length + 2}. Save preferences\n`);
      stdout.write(`  ${categories.length + 3}. Install Nix Core skill globally (Codex user skills)\n`);
      stdout.write(`  ${categories.length + 4}. Manage global security hooks\n`);
      stdout.write(`  ${categories.length + 5}. Manage global skills\n`);
      stdout.write(`  ${categories.length + 6}. Workflow commands\n`);
      stdout.write(`  ${categories.length + 7}. Exit\n\n`);
      const answer = (await terminal.question("  Choose an option: ")).trim();
      const choice = Number(answer);

      if (choice === categories.length + 7 || answer.toLowerCase() === "q") {
        done = true;
        continue;
      }
      if (choice === categories.length + 1) {
        stdout.write("\n  Read-only preview — no agent configuration will be changed.\n");
        for (const component of components.filter((item) => selected.has(item.id))) {
          stdout.write(`  + ${component.name}\n`);
        }
        if (selected.size === 0) stdout.write("  No components selected.\n");
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
        stdout.write(`\n  Preferences saved to ${statePath}. Agent configuration was not changed.\n`);
        await terminal.question("\n  Press Enter to return to the menu.");
        continue;
      }
      if (choice === categories.length + 3) {
        const projectRoot = process.cwd();
        const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
        const adapter = new CodexSkillAdapter(sourceRoot);
        const plan = await adapter.preview(projectRoot, nixCoreSkill.id);
        stdout.write(`\n  Preview: ${plan.action} ${nixCoreSkill.name}\n  Target: ${plan.targetPath}\n`);
        if (plan.reason) stdout.write(`  Reason: ${plan.reason}\n`);
        if (plan.action === "install" || plan.action === "update") {
          const confirmation = (await terminal.question("\n  Apply this global change? Type yes to confirm: ")).trim().toLowerCase();
          if (confirmation === "yes") {
            const result = plan.action === "update"
              ? await adapter.update(projectRoot, nixCoreSkill.id)
              : await adapter.install(projectRoot, nixCoreSkill.id);
            stdout.write(`\n  ${result.action}: ${nixCoreSkill.name}\n`);
            if (result.backupId) stdout.write(`  Backup: ${result.backupId}\n`);
          } else {
            stdout.write("\n  No files changed.\n");
          }
        }
        await terminal.question("\n  Press Enter to return to the menu.");
        continue;
      }
      if (choice === categories.length + 4) {
        await manageSecurityHooks(terminal);
        continue;
      }
      if (choice === categories.length + 5) {
        await manageProjectSkills(terminal);
        continue;
      }
      if (choice === categories.length + 6) {
        await showWorkflowCommands(terminal);
        continue;
      }
      const category = categories[choice - 1];
      if (!category) continue;
      const entries = components.filter((component) => component.category === category);
      const mcpStatuses = category === "MCPs" ? await getMcpStatus(process.cwd()) : [];
      if (category === "MCPs") stdout.write("\n  MCP entries are global; use `nix-ai mcp:preview|install|remove` to change them.\n");
      let back = false;
      while (!back) {
        stdout.write(`\n  ${category}\n`);
        entries.forEach((component, index) => {
          const mark = selected.has(component.id) ? "x" : " ";
          const stateLabel = component.id.startsWith("workflow.")
            ? `enabled: ${selected.has(component.id) ? "yes" : "no"}`
            : component.id.startsWith("mcp.")
              ? mcpStatuses
                .filter((status) => status.id === component.id.slice("mcp.".length))
                .map((status) => `${status.agent}: ${status.state}`)
                .join(", ") || "not configured"
              : "installed: no; installers are not implemented yet";
          stdout.write(`  ${index + 1}. [${mark}] ${component.name} — ${component.description} (${stateLabel})\n`);
        });
        stdout.write("  0. Back\n");
        const itemAnswer = (await terminal.question("\n  Toggle an item: ")).trim();
        const itemChoice = Number(itemAnswer);
        if (itemChoice === 0 || itemAnswer.toLowerCase() === "q") {
          back = true;
          continue;
        }
        const item = entries[itemChoice - 1];
        if (item) selected.has(item.id) ? selected.delete(item.id) : selected.add(item.id);
      }
    }
  } finally {
    terminal.close();
  }
}

async function showWorkflowCommands(terminal: ReturnType<typeof createInterface>): Promise<void> {
  const state = await loadStackState();
  const availabilities = resolveCommandAvailability(state);
  stdout.write("\n  Workflow commands\n\n");
  for (const availability of availabilities) {
    const command = availability.command;
    stdout.write(`  ${command.slash} — ${command.description}\n`);
    stdout.write(`    CLI: ${availability.cliAvailable ? "available" : `unavailable — ${availability.cliReason}`}\n`);
    stdout.write(`    Slash: ${availability.slashAvailable ? "available" : `unavailable — ${availability.slashReason}`}\n`);
    stdout.write(`    Artifacts: ${command.artifacts.join(", ")}\n\n`);
  }
  stdout.write("  Install global OpenCode commands or Codex skills with `nix-ai workflow:install-commands --agent=opencode|codex --root=. --yes`.\n");
  await terminal.question("\n  Press Enter to return to the menu.");
}

async function manageProjectSkills(terminal: ReturnType<typeof createInterface>): Promise<void> {
  const projectRoot = process.cwd();
  let back = false;
  while (!back) {
    const statuses = await getSkillStatus(projectRoot);
    stdout.write("\n  Global skills — pinned upstream sources, user-scope installs\n\n");
    skillCatalog.forEach((entry, index) => {
      const state = statuses
        .filter((status) => status.id === entry.id)
        .map((status) => `${status.agent}: ${status.state}`)
        .join(", ");
      const dependencies = entry.dependencies.length === 0
        ? "none"
        : entry.dependencies.map((item) => `${item.description}${item.required ? "" : " (optional)"}`).join("; ");
      stdout.write(`  ${index + 1}. ${entry.name} — ${entry.description}\n`);
      stdout.write(`     dependencies: ${dependencies}\n`);
      stdout.write(`     ${state}\n`);
    });
    stdout.write(`  ${skillCatalog.length + 1}. Back\n\n`);
    const answer = (await terminal.question("  Choose a skill: ")).trim();
    if (answer.toLowerCase() === "b" || Number(answer) === skillCatalog.length + 1) {
      back = true;
      continue;
    }
    const entry = skillCatalog[Number(answer) - 1];
    if (!entry) continue;

    const current = statuses
      .filter((status) => status.id === entry.id)
      .map((status) => `${status.agent}: ${status.state}`)
      .join(", ");
    stdout.write(`\n  ${entry.name}\n`);
    stdout.write(`  Source: ${entry.source.repo}@${entry.source.ref} (${entry.source.path})\n`);
    stdout.write(`  License: ${entry.license}; version: ${entry.version}\n`);
    stdout.write(`  Compatible agents: ${entry.compatibleAgents.join(", ")}\n`);
    stdout.write(`  Dependencies: ${entry.dependencies.length === 0 ? "none" : entry.dependencies.map((item) => item.description).join("; ")}\n`);
    stdout.write(`  Status: ${current}\n\n`);
    stdout.write("  1. Preview/install for OpenCode\n");
    stdout.write("  2. Preview/install for Codex\n");
    stdout.write("  3. Remove OpenCode\n");
    stdout.write("  4. Remove Codex\n");
    stdout.write("  5. Back\n\n");
    const action = (await terminal.question("  Choose an action: ")).trim();
    if (action === "5" || action.toLowerCase() === "b") continue;
    const agent: SkillAgent | undefined = action === "1" || action === "3"
      ? "opencode"
      : action === "2" || action === "4"
        ? "codex"
        : undefined;
    if (!agent) continue;

    if (action === "1" || action === "2") {
      const plan = await previewSkill(projectRoot, entry.id, agent);
      stdout.write(`\n  Preview: ${plan.action}\n  Target: ${plan.targetPath}\n`);
      if (plan.missing.length > 0) stdout.write(`  Missing dependencies: ${plan.missing.join("; ")}\n`);
      if (plan.reason) stdout.write(`  Reason: ${plan.reason}\n`);
      if (plan.action === "install" || plan.action === "update") {
        const confirmation = (await terminal.question("\n  Apply this global change? Type yes to confirm: ")).trim().toLowerCase();
        if (confirmation === "yes") {
          try {
            const result = await installSkill(projectRoot, entry.id, agent);
            stdout.write(`\n  ${result.action}: ${entry.name} [${agent}]\n  Files: ${result.fileCount}\n`);
          } catch (error) {
            stdout.write(`\n  ${error instanceof Error ? error.message : String(error)}\n`);
          }
        } else {
          stdout.write("\n  No files changed.\n");
        }
      }
    } else {
      const confirmation = (await terminal.question("\n  Remove this Nix-managed skill? Type yes to confirm: ")).trim().toLowerCase();
      if (confirmation === "yes") {
        try {
          await removeSkill(projectRoot, entry.id, agent);
          stdout.write(`\n  removed: ${entry.name} [${agent}]\n`);
        } catch (error) {
          stdout.write(`\n  ${error instanceof Error ? error.message : String(error)}\n`);
        }
      } else {
        stdout.write("\n  No files changed.\n");
      }
    }
    await terminal.question("\n  Press Enter to return to the skill list.");
  }
}

async function manageSecurityHooks(terminal: ReturnType<typeof createInterface>): Promise<void> {
  const projectRoot = process.cwd();
  const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const installer = new SecurityHooksInstaller(sourceRoot);
  let back = false;
  while (!back) {
    const status = await installer.status(projectRoot);
    stdout.write("\n  Global destructive-operation safeguards\n");
    stdout.write(`  Codex: ${status.codexEnabled ? "enabled" : "disabled"}\n`);
    stdout.write(`  OpenCode V1/V2: ${status.opencodeEnabled ? "enabled" : "disabled"}\n`);
    stdout.write("  Shells: PowerShell, cmd.exe, Git Bash/MSYS\n");
    stdout.write("  1. Preview and enable\n  2. Disable\n  0. Back\n");
    const answer = (await terminal.question("\n  Choose an option: ")).trim().toLowerCase();
    if (answer === "0" || answer === "q") { back = true; continue; }
    if (answer === "1") {
      const plan = await installer.preview(projectRoot);
      stdout.write(`\n  Preview: ${plan.action}\n  Codex: ${plan.targets.codex}\n  OpenCode: ${plan.targets.opencode}\n`);
      if (plan.reason) stdout.write(`  Reason: ${plan.reason}\n`);
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
        stdout.write(`\n  Security hooks ${result.action}.\n`);
      } else stdout.write("\n  No files changed.\n");
      await terminal.question("\n  Press Enter to return.");
      continue;
    }
    if (answer === "2") {
      const confirmation = (await terminal.question("\n  Remove only Nix-owned global hooks and preserve user-owned entries? Type yes to confirm: ")).trim().toLowerCase();
      if (confirmation === "yes") {
        await installer.uninstall(projectRoot);
        stdout.write("\n  Nix-owned security hooks removed.\n");
      } else stdout.write("\n  No files changed.\n");
      await terminal.question("\n  Press Enter to return.");
    }
  }
}
