#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { DefaultArchitectureSelector } from "../core/architecture/default-architecture-selector.js";
import { loadNixConfig, writeDefaultNixConfig } from "../core/config/config-loader.js";
import { projectMetadata } from "../core/system/project-metadata.js";
import { loadReviewers } from "../core/reviewers/reviewer-registry.js";
import type { ArchitectureSelectionInput } from "../core/contracts/architecture-selector.js";
import { builtinReviewers } from "../core/reviewers/builtin-reviewers.js";
import { runReviewers } from "../core/reviewers/reviewer-runner.js";
import { scanRepository } from "../core/stack/repo-scanner.js";
import { stackInventory } from "../core/stack/stack-inventory.js";
import { readOption } from "../core/system/cli-args.js";
import { getNixHome } from "../core/config/global-paths.js";
import { getStackStatePath, loadStackState, saveStackState } from "../core/config/stack-state.js";
import { runTui } from "./tui.js";
import { advanceWorkflow, createWorkflow, describeNextAction, skipWorkflowStep } from "../core/workflows/workflow-engine.js";
import { isWorkflowKind, type WorkflowKind } from "../core/workflows/workflow-contracts.js";
import { listWorkflowRecords, loadWorkflowRecord, saveWorkflowRecord } from "../core/workflows/workflow-store.js";
import { isWorkflowCommandId, resolveCommandAvailability } from "../core/commands/workflow-command-catalog.js";
import {
  installAgentCommands,
  removeAgentCommands,
  runWorkflowCommand as executeWorkflowCommand
} from "../core/commands/workflow-command-service.js";
import { mcpCatalog, findMcpEntry } from "../core/mcp/mcp-catalog.js";
import type { McpAgent } from "../core/mcp/mcp-contracts.js";
import { getMcpStatus, installMcp, previewMcp, removeMcp, updateMcp } from "../core/mcp/mcp-service.js";
import { findSkillEntry, skillCatalog } from "../core/skills/skill-catalog.js";
import type { SkillAgent } from "../core/skills/skill-contracts.js";
import {
  createLocalSkillFetcher,
  getSkillStatus,
  globalSkillTargetPath,
  installSkill,
  previewSkill,
  removeSkill,
  updateSkill
} from "../core/skills/skill-installer.js";
import { scaffoldGlobalSkill } from "../core/skills/skill-authoring.js";
import { CodexSkillAdapter } from "../core/components/codex-skill-adapter.js";
import { componentCatalog } from "../core/components/component-catalog.js";
import type { LifecycleOperation } from "../core/contracts/component-lifecycle.js";
import { SecurityHooksInstaller } from "../core/security/security-hooks-installer.js";
import {
  createReleaseManifest,
  loadReleaseManifest,
  releaseCompatibility,
  verifyReleaseManifest,
  writeReleaseManifest
} from "../core/release/release-manifest.js";

type CommandHandler = () => Promise<void>;

const handlers = new Map<string, CommandHandler>([
  ["version", printVersion],
  ["doctor", printDoctor],
  ["config:init", initConfigCommand],
  ["reviewers:list", printReviewers],
  ["reviewers:run", runReviewersCommand],
  ["arch:select", printArchitectureSelection],
  ["component", manageComponent],
  ["security:hooks", manageSecurityHooks],
  ["workflow:configure", configureWorkflows],
  ["workflow:status", printWorkflowStatus],
  ["workflow:start", startWorkflow],
  ["workflow:advance", advanceWorkflowCommand],
  ["workflow:skip", skipWorkflowCommand],
  ["workflow:resume", resumeWorkflow],
  ["workflow:commands", printWorkflowCommands],
  ["workflow:command", runWorkflowCommandCli],
  ["workflow:install-commands", installWorkflowCommands],
  ["mcp:list", printMcpCatalog],
  ["mcp:status", printMcpStatus],
  ["mcp:preview", previewMcpCommand],
  ["mcp:install", installMcpCommand],
  ["mcp:update", updateMcpCommand],
  ["mcp:remove", removeMcpCommand],
  ["skill:list", printSkillCatalog],
  ["skill:status", printSkillStatus],
  ["skill:preview", previewSkillCommand],
  ["skill:install", installSkillCommand],
  ["skill:update", updateSkillCommand],
  ["skill:remove", removeSkillCommand],
  ["skill:new", newSkillCommand],
  ["release:manifest", releaseManifestCommand],
  ["release:verify", verifyReleaseCommand],
  ["help", printHelp]
]);

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === undefined) {
    await runTui();
    return;
  }

  if (command === "--version" || command === "-v") {
    await printVersion();
    return;
  }

  const handler = handlers.get(command);

  if (!handler) {
    console.error(`Unknown command: ${command}`);
    console.error("");
    printHelp();
    process.exitCode = 1;
    return;
  }

  await handler();
}

async function printVersion(): Promise<void> {
  console.log(projectMetadata.version);
}

async function releaseManifestCommand(): Promise<void> {
  const args = process.argv.slice(3);
  const root = path.resolve(resolveRootFromArgs(args));
  const distDirectory = path.resolve(root, readOption(args, "dist") ?? "dist");
  const outFile = path.resolve(root, readOption(args, "out") ?? "dist/release-manifest.json");
  const excludedPaths = relativeInside(distDirectory, outFile);
  const manifest = await createReleaseManifest({
    distDirectory,
    version: projectMetadata.version,
    ...(excludedPaths === undefined ? {} : { excludedPaths: [excludedPaths] })
  });

  if (args.includes("--json")) {
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }

  await writeReleaseManifest(manifest, outFile);
  console.log(`Release manifest: ${outFile}`);
  console.log(`Version: ${manifest.version}`);
  console.log(`Files: ${manifest.files.length}`);
}

async function verifyReleaseCommand(): Promise<void> {
  const args = process.argv.slice(3);
  const root = path.resolve(resolveRootFromArgs(args));
  const distDirectory = path.resolve(root, readOption(args, "dist") ?? "dist");
  const manifestFile = path.resolve(root, readOption(args, "manifest") ?? "dist/release-manifest.json");
  const excludedPaths = relativeInside(distDirectory, manifestFile);
  const manifest = await loadReleaseManifest(manifestFile);
  const result = await verifyReleaseManifest(
    distDirectory,
    manifest,
    excludedPaths === undefined ? {} : { excludedPaths: [excludedPaths] }
  );

  if (args.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.ok) {
    console.log("Release manifest verified.");
  } else {
    console.error("Release verification failed.");
    for (const file of result.missing) console.error(`  missing: ${file}`);
    for (const file of result.modified) console.error(`  modified: ${file}`);
    for (const file of result.extra) console.error(`  extra: ${file}`);
  }

  if (!result.ok) process.exitCode = 1;
}

function relativeInside(directory: string, file: string): string | undefined {
  const relative = path.relative(directory, file);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) return undefined;
  return relative.split(path.sep).join("/");
}

async function printDoctor(): Promise<void> {
  const root = resolveRootFromArgs(process.argv.slice(3));
  const { config, source } = await loadNixConfig(root);
  const { reviewers, sources } = await loadReviewers(root);
  let stackStateStatus: string;
  try {
    const state = await loadStackState();
    stackStateStatus = `valid (schema ${state.schemaVersion}, ${state.selectedComponents.length} selected)`;
  } catch (error) {
    stackStateStatus = `invalid (${error instanceof Error ? error.message : String(error)})`;
  }

  console.log(`${projectMetadata.name} doctor`);
  console.log("");
  console.log(`Project context: ${root}`);
  console.log(`Nix home: ${getNixHome()}`);
  console.log(`Version: ${projectMetadata.version}`);
  console.log(`Runtime: ${projectMetadata.runtime}`);
  console.log(`Package manager: ${projectMetadata.packageManager}`);
  console.log(`Built-in reviewers: ${builtinReviewers.length}`);
  console.log(`Loaded reviewers: ${reviewers.length}`);
  console.log(`Stack domains: ${stackInventory.length}`);
  console.log(`Config source: ${source}`);
  console.log(
    `Release compatibility: state schema ${releaseCompatibility.stackStateSchema}, config ${releaseCompatibility.configFile}, Node ${releaseCompatibility.node}`
  );
  console.log(`Stack preferences: ${stackStateStatus}`);
  console.log(`Stack preferences path: ${getStackStatePath()}`);
  try {
    const state = await loadStackState();
    console.log(`Workflows: SDD ${state.workflows.sdd ? "enabled" : "disabled"}, TDD ${state.workflows.tdd ? "enabled" : "disabled"}`);
  } catch {
    console.log("Workflows: unavailable (stack preferences are invalid)");
  }
  console.log(`Reviewer sources: ${sources.join(", ")}`);
  console.log(`Default architecture: ${config.defaultArchitecture}`);
  console.log("");
  console.log("Status: bootstrap-ready");
}

async function initConfigCommand(): Promise<void> {
  const root = resolveRootFromArgs(process.argv.slice(3));
  const configPath = await writeDefaultNixConfig(root, {
    projectName: path.basename(root),
    scanRoots: ["."],
    preferredTestRoot: "tests"
  });

  console.log("Nix global config initialized");
  console.log("");
  console.log(`Project context: ${root}`);
  console.log(`Nix home: ${getNixHome()}`);
  console.log(`Config: ${configPath}`);
}

async function printReviewers(): Promise<void> {
  const root = resolveRootFromArgs(process.argv.slice(3));
  const { reviewers, sources } = await loadReviewers(root);

  console.log("Loaded reviewers");
  console.log(`Root: ${root}`);
  console.log(`Sources: ${sources.join(", ")}`);
  console.log("");

  for (const reviewer of reviewers) {
    console.log(`- ${reviewer.name} [${reviewer.category}]`);
    console.log(`  id: ${reviewer.id}`);
    console.log(`  goal: ${reviewer.goal}`);
    console.log(`  appliesTo: ${reviewer.appliesTo.join(", ")}`);
    console.log("");
  }
}

async function runReviewersCommand(): Promise<void> {
  const root = resolveRootFromArgs(process.argv.slice(3));
  const { reviewers } = await loadReviewers(root);
  const repoScan = await scanRepository(root);
  const reports = runReviewers(reviewers, repoScan);

  console.log("Reviewer run");
  console.log("");
  console.log(`Root: ${repoScan.root}`);
  console.log(`Tags: ${repoScan.tags.join(", ") || "none"}`);
  console.log(`Probable architecture: ${repoScan.probableArchitecture}`);
  console.log(`Applicable reviewers: ${reports.length}`);
  console.log("");

  if (reports.length === 0) {
    console.log("No reviewers applied to the current repository context.");
    return;
  }

  for (const report of reports) {
    console.log(`- ${report.reviewer.name}`);
    console.log(`  category: ${report.reviewer.category}`);
    console.log(`  verdict: ${report.verdict}`);

    for (const finding of report.findings) {
      console.log(`  [${finding.severity}] ${finding.message}`);
    }

    console.log("");
  }
}

async function printArchitectureSelection(): Promise<void> {
  const selector = new DefaultArchitectureSelector();
  const input = parseArchitectureSelectionInput(process.argv.slice(3));
  const recommendations = await selector.recommend(input);

  console.log("Architecture selection");
  console.log("");
  console.log(`Project type: ${input.projectType}`);
  console.log(`Complexity: ${input.complexity}`);
  console.log(`Team size: ${input.teamSize}`);
  console.log("");

  for (const recommendation of recommendations) {
    console.log(`- ${recommendation.name}`);
    console.log(`  id: ${recommendation.id}`);
    console.log(`  fitFor: ${recommendation.fitFor.join(", ")}`);
    console.log(`  avoidWhen: ${recommendation.avoidWhen.join(", ")}`);
    console.log("");
  }
}

async function manageComponent(): Promise<void> {
  const args = process.argv.slice(3);
  const operation = readOption(args, "action") ?? "preview";
  const componentId = readOption(args, "component") ?? "skill.nix-core";
  const root = path.resolve(resolveRootFromArgs(args));
  const supportedOperations: ReadonlyArray<LifecycleOperation | "list-backups" | "preview"> = ["preview", "install", "update", "backup", "restore", "uninstall", "list-backups"];
  if (!supportedOperations.includes(operation as LifecycleOperation | "list-backups" | "preview")) {
    throw new Error(`Unsupported component action: ${operation}`);
  }
  const adapter = new CodexSkillAdapter(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."), componentCatalog);
  const backupId = readOption(args, "backup");

  if (operation === "preview") {
    const plan = await adapter.preview(root, componentId);
    console.log(`${plan.action === "install" ? "Would install" : `Preview: ${plan.action}`} ${componentCatalog.find((item) => item.id === componentId)?.name ?? componentId}`);
    console.log(`Target: ${plan.targetPath}`);
    if (plan.reason) console.log(`Reason: ${plan.reason}`);
    if (plan.action === "conflict") process.exitCode = 1;
    return;
  }
  if (operation === "list-backups") {
    const backups = await adapter.listBackups(root, componentId);
    if (backups.length === 0) console.log("No backups found.");
    for (const item of backups) console.log(`${item.backupId}  ${item.version}  ${item.createdAt}`);
    return;
  }
  if (!args.includes("--yes")) throw new Error(`Action '${operation}' changes global agent files. Re-run with --yes to confirm.`);

  const result = operation === "install" ? await adapter.install(root, componentId)
    : operation === "update" ? await adapter.update(root, componentId)
    : operation === "backup" ? await adapter.backup(root, componentId)
    : operation === "restore" ? await adapter.restore(root, componentId, backupId ?? "")
    : await adapter.uninstall(root, componentId);
  console.log(`${result.action === "installed" ? "Installed" : result.action} ${componentCatalog.find((item) => item.id === componentId)?.name ?? componentId}`);
  console.log(`Target: ${result.targetPath}`);
  if (result.backupId) console.log(`Backup: ${result.backupId}`);
}

async function manageSecurityHooks(): Promise<void> {
  const args = process.argv.slice(3);
  const action = readOption(args, "action") ?? "preview";
  if (!["preview", "status", "install", "uninstall"].includes(action)) throw new Error(`Unsupported security hook action: ${action}`);
  const root = path.resolve(resolveRootFromArgs(args));
  const installer = createSecurityHooksInstaller();
  if (action === "status") {
    const status = await installer.status(root);
    console.log(`Scope: global`);
    console.log(`Project context: ${root}`);
    console.log(`Nix home: ${getNixHome()}`);
    console.log(`Codex: ${status.codexEnabled ? "enabled" : "disabled"}`);
    console.log(`OpenCode V1/V2: ${status.opencodeEnabled ? "enabled" : "disabled"}`);
    console.log(`Shell coverage: PowerShell, cmd.exe, Git Bash/MSYS`);
    return;
  }
  if (action === "preview") {
    const plan = await installer.preview(root);
    console.log(`Security hooks: ${plan.action}`);
    console.log(`Codex: ${plan.targets.codex}`);
    console.log(`OpenCode: ${plan.targets.opencode}`);
    console.log(`Shells: ${plan.targets.shells.join(", ")}`);
    if (plan.reason) console.log(`Reason: ${plan.reason}`);
    if (plan.action === "conflict") process.exitCode = 1;
    return;
  }
  if (!args.includes("--yes")) throw new Error(`Action '${action}' changes global agent files. Re-run with --yes to confirm.`);
  if (action === "install") {
    const plan = await installer.preview(root);
    console.log(`Security hooks: ${plan.action}`);
    console.log(`Codex: ${plan.targets.codex}`);
    console.log(`OpenCode: ${plan.targets.opencode}`);
    if (plan.reason) console.log(`Reason: ${plan.reason}`);
    if (plan.action === "conflict") throw new Error("Resolve the global target conflict before installing.");
    console.log(`Result: ${(await installer.install(root)).action}`);
    return;
  }
  await installer.uninstall(root);
  console.log("Removed Nix-owned global security hooks; user-owned entries were preserved.");
}

async function configureWorkflows(): Promise<void> {
  const args = process.argv.slice(3);
  const sdd = readToggle(args, "sdd");
  const tdd = readToggle(args, "tdd");
  if (sdd === undefined && tdd === undefined) throw new Error("Provide --sdd=on|off and/or --tdd=on|off.");
  requireYes(args, "configure workflows");
  const statePath = getStackStatePath();
  let state = await loadStackState(statePath);
  if (sdd !== undefined) state = withWorkflowSetting(state, "sdd", sdd);
  if (tdd !== undefined) state = withWorkflowSetting(state, "tdd", tdd);
  await saveStackState(statePath, state);
  console.log("Workflow settings saved");
  console.log("");
  console.log(`SDD: ${state.workflows.sdd ? "enabled" : "disabled"}`);
  console.log(`TDD: ${state.workflows.tdd ? "enabled" : "disabled"}`);
  console.log(`State: ${statePath}`);
}

async function printWorkflowStatus(): Promise<void> {
  const root = path.resolve(resolveRootFromArgs(process.argv.slice(3)));
  const state = await loadStackState();
  const records = await listWorkflowRecords(root);
  const active = records.filter((record) => record.status === "active");
  console.log("Workflow settings");
  console.log(`SDD: ${state.workflows.sdd ? "enabled" : "disabled"}`);
  console.log(`TDD: ${state.workflows.tdd ? "enabled" : "disabled"}`);
  console.log("");
  console.log(`Project: ${root}`);
  if (active.length === 0) {
    console.log("No active workflows.");
    return;
  }
  console.log(`Active workflows: ${active.length}`);
  for (const record of active) {
    console.log(`- ${record.id} [${record.kind}] ${record.title} — current: ${record.currentStep ?? "none"}`);
  }
}

async function startWorkflow(): Promise<void> {
  const args = process.argv.slice(3);
  const kind = readOption(args, "kind");
  if (!isWorkflowKind(kind)) throw new Error("Provide --kind=sdd or --kind=tdd.");
  const title = readOption(args, "title");
  if (!title) throw new Error("Provide --title=\"...\" for the workflow.");
  requireYes(args, "start a workflow");
  const root = path.resolve(resolveRootFromArgs(args));
  const state = await loadStackState();
  if (!state.workflows[kind]) {
    throw new Error(`${kind.toUpperCase()} workflows are disabled. Enable them in the TUI or run workflow:configure --${kind}=on --yes.`);
  }
  const record = createWorkflow(kind, title);
  await saveWorkflowRecord(root, record);
  console.log(`Started ${kind.toUpperCase()} workflow: ${record.title}`);
  console.log(`ID: ${record.id}`);
  console.log(`Current step: ${record.currentStep}`);
  console.log(`Project: ${root}`);
}

async function advanceWorkflowCommand(): Promise<void> {
  const args = process.argv.slice(3);
  const id = readOption(args, "id");
  if (!id) throw new Error("Provide --id=<workflow-id>.");
  const evidence = readOption(args, "evidence");
  if (!evidence) throw new Error("Evidence is required to advance a workflow step; provide --evidence=\"...\".");
  requireYes(args, "advance a workflow");
  const root = path.resolve(resolveRootFromArgs(args));
  const record = advanceWorkflow(await loadWorkflowRecord(root, id), evidence);
  await saveWorkflowRecord(root, record);
  printWorkflowRecord(record);
}

async function skipWorkflowCommand(): Promise<void> {
  const args = process.argv.slice(3);
  const id = readOption(args, "id");
  if (!id) throw new Error("Provide --id=<workflow-id>.");
  const reason = readOption(args, "reason");
  if (!reason) throw new Error("A reason is required to skip the TDD RED step; provide --reason=\"...\".");
  requireYes(args, "skip a workflow step");
  const root = path.resolve(resolveRootFromArgs(args));
  const record = skipWorkflowStep(await loadWorkflowRecord(root, id), reason);
  await saveWorkflowRecord(root, record);
  printWorkflowRecord(record);
}

async function resumeWorkflow(): Promise<void> {
  const args = process.argv.slice(3);
  const id = readOption(args, "id");
  if (!id) throw new Error("Provide --id=<workflow-id>.");
  const root = path.resolve(resolveRootFromArgs(args));
  const record = await loadWorkflowRecord(root, id);
  console.log(`Workflow ${record.id} [${record.kind}] ${record.title}`);
  console.log(`Status: ${record.status}`);
  const completed = record.steps.filter((step) => step.status === "done" || step.status === "skipped");
  console.log(`Completed steps: ${completed.length === 0 ? "none" : completed.map((step) => `${step.id} (${step.status})`).join(", ")}`);
  console.log(describeNextAction(record));
}

async function printWorkflowCommands(): Promise<void> {
  const args = process.argv.slice(3);
  const state = await loadStackState();
  const availabilities = resolveCommandAvailability(state);
  if (args.includes("--json")) {
    console.log(JSON.stringify(availabilities, null, 2));
    return;
  }

  console.log("Workflow commands");
  console.log("");
  for (const availability of availabilities) {
    const command = availability.command;
    console.log(`${command.slash} — ${command.name} [${command.kind}]`);
    console.log(`  ${command.description}`);
    console.log(`  CLI: ${availability.cliAvailable ? "available" : `unavailable — ${availability.cliReason}`}`);
    console.log(`  Slash: ${availability.slashAvailable ? "available" : `unavailable — ${availability.slashReason}`}`);
    console.log(`  Workflow: ${command.workflowKind ?? command.skillId ?? "none"}`);
    console.log(`  Artifacts: ${command.artifacts.join(", ")}`);
    console.log("");
  }
  console.log("Install global OpenCode commands with: nix-ai workflow:install-commands --agent=opencode --root=. --yes");
  console.log("Install global Codex skills with: nix-ai workflow:install-commands --agent=codex --root=. --yes");
}

async function runWorkflowCommandCli(): Promise<void> {
  const args = process.argv.slice(3);
  const id = readOption(args, "id");
  if (!isWorkflowCommandId(id)) {
    throw new Error("Provide --id=new-feat, --id=refactor, --id=new-idea, or --id=new-project.");
  }
  const title = readOption(args, "title") ?? "";
  if (!title && id !== "new-project") throw new Error(`Provide --title="..." for ${id}.`);
  requireYes(args, `run the ${id} command`);
  const root = path.resolve(resolveRootFromArgs(args));
  const state = await loadStackState();
  const result = await executeWorkflowCommand(root, state, id, title);
  if (result.workflow) {
    console.log(`Started ${result.workflow.kind.toUpperCase()} workflow: ${result.workflow.title}`);
    console.log(`Command: ${result.command.slash}`);
    console.log(`ID: ${result.workflow.id}`);
    console.log(`Current step: ${result.workflow.currentStep}`);
    console.log(`Project: ${root}`);
    return;
  }
  console.log(`Command ${result.command.slash} is ready.`);
  console.log(result.prompt);
}

async function installWorkflowCommands(): Promise<void> {
  const args = process.argv.slice(3);
  const agentValue = readOption(args, "agent");
  if (agentValue !== "opencode" && agentValue !== "codex") {
    throw new Error("Provide --agent=opencode or --agent=codex.");
  }
  const remove = args.includes("--remove");
  requireYes(args, remove ? "remove workflow commands" : "install workflow commands");
  const root = path.resolve(resolveRootFromArgs(args));
  const state = await loadStackState();
  const result = remove
    ? await removeAgentCommands(root, agentValue)
    : await installAgentCommands(root, state, agentValue);

  console.log(`${remove ? "Removed" : "Installed"} workflow commands for ${agentValue}.`);
  for (const item of result.installed) console.log(`  installed: ${item}`);
  for (const item of result.removed) console.log(`  removed: ${item}`);
  for (const item of result.skipped) console.log(`  skipped: ${item.path} — ${item.reason}`);
}

function printWorkflowRecord(record: Awaited<ReturnType<typeof loadWorkflowRecord>>): void {
  console.log(`Workflow: ${record.id} [${record.kind}]`);
  console.log(`Status: ${record.status}`);
  if (record.currentStep) console.log(`Current step: ${record.currentStep}`);
  for (const step of record.steps) {
    const detail = step.evidence ?? step.reason;
    console.log(`- ${step.id}: ${step.status}${detail ? ` — ${detail}` : ""}`);
  }
}

function withWorkflowSetting(
  state: Awaited<ReturnType<typeof loadStackState>>,
  kind: WorkflowKind,
  enabled: boolean
): Awaited<ReturnType<typeof loadStackState>> {
  const componentId = `workflow.${kind}`;
  const selectedComponents = state.selectedComponents.filter((item) => item !== componentId);
  if (enabled) selectedComponents.push(componentId);
  return {
    ...state,
    selectedComponents,
    workflows: { ...state.workflows, [kind]: enabled }
  };
}

function readToggle(args: ReadonlyArray<string>, name: string): boolean | undefined {
  const value = readOption(args, name);
  if (value === undefined) return undefined;
  if (value === "on") return true;
  if (value === "off") return false;
  throw new Error(`--${name} must be on or off.`);
}

function requireYes(args: ReadonlyArray<string>, action: string): void {
  if (!args.includes("--yes")) throw new Error(`Action '${action}' changes stored state. Re-run with --yes to confirm.`);
}

async function printMcpCatalog(): Promise<void> {
  console.log("MCP catalog");
  console.log("");
  for (const entry of mcpCatalog) {
    console.log(`- ${entry.id} — ${entry.name}`);
    console.log(`  purpose: ${entry.purpose}`);
    console.log(`  agents: ${entry.supportedAgents.join(", ")}`);
    console.log(`  scope: ${entry.scope}`);
    console.log(`  network: ${entry.networkAccess}`);
    console.log(`  credentials: ${entry.credentials.required ? `required (${entry.credentials.envVars.join(", ")})` : "none required"}`);
    console.log(`  prerequisites: ${entry.prerequisites.length === 0 ? "none" : entry.prerequisites.map((item) => item.description).join("; ")}`);
    console.log(`  removal: ${entry.removal}`);
    console.log("");
  }
}

async function printMcpStatus(): Promise<void> {
  const root = path.resolve(resolveRootFromArgs(process.argv.slice(3)));
  const statuses = await getMcpStatus(root);
  console.log("MCP status");
  console.log(`Project context: ${root}`);
  console.log(`Nix home: ${getNixHome()}`);
  console.log("Scope: global");
  console.log("");
  for (const status of statuses) {
    console.log(`- ${status.id} [${status.agent}]: ${status.state}${status.detail ? ` — ${status.detail}` : ""}`);
  }
}

async function previewMcpCommand(): Promise<void> {
  const args = process.argv.slice(3);
  const id = readMcpId(args);
  const agent = readMcpAgent(args);
  const root = path.resolve(resolveRootFromArgs(args));
  printMcpPlan(id, agent, await previewMcp(root, id, agent));
}

async function installMcpCommand(): Promise<void> {
  const args = process.argv.slice(3);
  const id = readMcpId(args);
  const agent = readMcpAgent(args);
  requireYes(args, "install an MCP integration");
  const root = path.resolve(resolveRootFromArgs(args));
  const result = await installMcp(root, id, agent);
  console.log(`${result.action === "installed" ? "Installed" : result.action === "updated" ? "Updated" : "Already current"}: ${id} [${agent}]`);
  console.log(`Target: ${result.targetPath}`);
}

async function updateMcpCommand(): Promise<void> {
  const args = process.argv.slice(3);
  const id = readMcpId(args);
  const agent = readMcpAgent(args);
  requireYes(args, "update an MCP integration");
  const root = path.resolve(resolveRootFromArgs(args));
  const result = await updateMcp(root, id, agent);
  console.log(`Updated: ${id} [${agent}]`);
  console.log(`Target: ${result.targetPath}`);
}

async function removeMcpCommand(): Promise<void> {
  const args = process.argv.slice(3);
  const id = readMcpId(args);
  const agent = readMcpAgent(args);
  requireYes(args, "remove an MCP integration");
  const root = path.resolve(resolveRootFromArgs(args));
  await removeMcp(root, id, agent);
  console.log(`Removed Nix-managed MCP server ${id} [${agent}]; unrelated servers were preserved.`);
}

function printMcpPlan(id: string, agent: McpAgent, plan: Awaited<ReturnType<typeof previewMcp>>): void {
  console.log(`MCP preview: ${id}`);
  console.log(`Agent: ${agent}`);
  console.log(`Scope: ${plan.scope}`);
  console.log(`Target: ${plan.targetPath}`);
  console.log(`Action: ${plan.action}`);
  console.log(`Network: ${plan.networkAccess}`);
  console.log(`Credentials: ${plan.credentials.required ? `required (${plan.credentials.envVars.join(", ")})` : "none required"}`);
  if (plan.credentials.note) console.log(`Credential note: ${plan.credentials.note}`);
  console.log(`Prerequisites: ${plan.prerequisites.satisfied ? "satisfied" : `Missing prerequisites: ${plan.prerequisites.missing.join("; ")}`}`);
  if (plan.reason) console.log(`Reason: ${plan.reason}`);
}

function readMcpId(args: ReadonlyArray<string>): string {
  const id = readOption(args, "id");
  if (!id) throw new Error("Provide --id=<integration>.");
  if (!findMcpEntry(id)) throw new Error(`Unknown MCP integration: ${id}.`);
  return id;
}

function readMcpAgent(args: ReadonlyArray<string>): McpAgent {
  const agent = readOption(args, "agent");
  if (agent !== "opencode" && agent !== "codex") throw new Error("Provide --agent=opencode or --agent=codex.");
  return agent;
}

async function printSkillCatalog(): Promise<void> {
  console.log("Skill catalog");
  console.log("");
  for (const entry of skillCatalog) {
    console.log(`- ${entry.id} — ${entry.name}`);
    console.log(`  description: ${entry.description}`);
    console.log(`  source: ${entry.source.repo}@${entry.source.ref} (${entry.source.path})`);
    console.log(`  license: ${entry.license}; version: ${entry.version}`);
    console.log(`  agents: ${entry.compatibleAgents.join(", ")}`);
    console.log(`  install: ${entry.compatibleAgents.map((agent) => `${agent} ${globalSkillTargetPath(agent, entry.id)}`).join("; ")}`);
    console.log(`  dependencies: ${entry.dependencies.length === 0 ? "none" : entry.dependencies.map((item) => `${item.description}${item.required ? "" : " (optional)"}`).join("; ")}`);
    console.log(`  update: ${entry.updatePolicy}`);
    console.log(`  stack: ${entry.stackTags.join(", ")}`);
    console.log("");
  }
}

async function printSkillStatus(): Promise<void> {
  const root = path.resolve(resolveRootFromArgs(process.argv.slice(3)));
  const statuses = await getSkillStatus(root);
  console.log("Skill status");
  console.log(`Project context: ${root}`);
  console.log(`Nix home: ${getNixHome()}`);
  console.log("Scope: global");
  console.log("");
  for (const status of statuses) {
    console.log(`- ${status.id} [${status.agent}]: ${status.state}${status.detail ? ` — ${status.detail}` : ""}`);
  }
}

async function previewSkillCommand(): Promise<void> {
  const args = process.argv.slice(3);
  const id = readSkillId(args);
  const agent = readSkillAgent(args);
  const root = path.resolve(resolveRootFromArgs(args));
  printSkillPlan(id, agent, await previewSkill(root, id, agent));
}

async function installSkillCommand(): Promise<void> {
  const args = process.argv.slice(3);
  const id = readSkillId(args);
  const agent = readSkillAgent(args);
  requireYes(args, "install a skill");
  const root = path.resolve(resolveRootFromArgs(args));
  const result = await installSkill(root, id, agent, skillOptions(args));
  console.log(`${result.action === "installed" ? "Installed" : result.action === "updated" ? "Updated" : "Already current"}: ${id} [${agent}]`);
  console.log(`Target: ${result.targetPath}`);
  console.log(`Files: ${result.fileCount}`);
}

async function updateSkillCommand(): Promise<void> {
  const args = process.argv.slice(3);
  const id = readSkillId(args);
  const agent = readSkillAgent(args);
  requireYes(args, "update a skill");
  const root = path.resolve(resolveRootFromArgs(args));
  const result = await updateSkill(root, id, agent, skillOptions(args));
  console.log(`Updated: ${id} [${agent}]`);
  console.log(`Target: ${result.targetPath}`);
  console.log(`Files: ${result.fileCount}`);
}

async function removeSkillCommand(): Promise<void> {
  const args = process.argv.slice(3);
  const id = readSkillId(args);
  const agent = readSkillAgent(args);
  requireYes(args, "remove a skill");
  const root = path.resolve(resolveRootFromArgs(args));
  await removeSkill(root, id, agent);
  console.log(`Removed Nix-managed skill ${id} [${agent}]; unrelated files were preserved.`);
}

async function newSkillCommand(): Promise<void> {
  const args = process.argv.slice(3);
  const id = readOption(args, "id");
  if (!id) throw new Error("Provide --id=<skill-id>.");
  const agent = readSkillAgent(args, "codex");
  const result = await scaffoldGlobalSkill(id, agent);
  console.log(`Created global skill: ${id} [${agent}]`);
  console.log(`Target: ${result.targetPath}`);
  console.log(`Files: ${result.files.join(", ")}`);
}

function printSkillPlan(id: string, agent: SkillAgent, plan: Awaited<ReturnType<typeof previewSkill>>): void {
  console.log(`Skill preview: ${id}`);
  console.log(`Agent: ${agent}`);
  console.log(`Scope: global`);
  console.log(`Target: ${plan.targetPath}`);
  console.log(`Action: ${plan.action}`);
  console.log(`Source: ${plan.repo}@${plan.ref}`);
  console.log(`License: ${plan.license}`);
  console.log(`Version: ${plan.version}`);
  console.log(`Network: ${plan.network ? "required (pinned source fetch)" : "none"}`);
  console.log(`Dependencies: ${plan.dependencies.length === 0 ? "none" : plan.dependencies.map((item) => `${item.description}${item.required ? "" : " (optional)"}: ${item.satisfied ? "satisfied" : "missing"}`).join("; ")}`);
  if (plan.missing.length > 0) console.log(`Missing dependencies: ${plan.missing.join("; ")}`);
  if (plan.reason) console.log(`Reason: ${plan.reason}`);
}

function readSkillId(args: ReadonlyArray<string>): string {
  const id = readOption(args, "id");
  if (!id) throw new Error("Provide --id=<skill>.");
  if (!findSkillEntry(id)) throw new Error(`Unknown skill: ${id}.`);
  return id;
}

function readSkillAgent(args: ReadonlyArray<string>, defaultAgent?: SkillAgent): SkillAgent {
  const agent = readOption(args, "agent") ?? defaultAgent;
  if (agent !== "opencode" && agent !== "codex") throw new Error("Provide --agent=opencode or --agent=codex.");
  return agent;
}

function skillOptions(args: ReadonlyArray<string>): { readonly fetcher?: ReturnType<typeof createLocalSkillFetcher> } {
  const source = readOption(args, "source");
  return source ? { fetcher: createLocalSkillFetcher(path.resolve(source)) } : {};
}

function createSecurityHooksInstaller(): SecurityHooksInstaller {
  const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  return new SecurityHooksInstaller(sourceRoot);
}

function parseArchitectureSelectionInput(args: ReadonlyArray<string>): ArchitectureSelectionInput {
  const projectType = readOption(args, "type") ?? "general";
  const complexity = readOption(args, "complexity");
  const teamSize = readOption(args, "team");

  return {
    projectType,
    complexity:
      complexity === "low" || complexity === "medium" || complexity === "high"
        ? complexity
        : "medium",
    teamSize:
      teamSize === "solo" ||
      teamSize === "small" ||
      teamSize === "medium" ||
      teamSize === "large"
        ? teamSize
        : "small"
  };
}

function resolveRootFromArgs(args: ReadonlyArray<string>): string {
  return readOption(args, "root") ?? process.cwd();
}

async function printHelp(): Promise<void> {
  console.log("Nix AI CLI");
  console.log("");
  console.log("Commands:");
  console.log("  doctor           Show bootstrap status");
  console.log("  version          Print the CLI version (also --version or -v)");
  console.log("  config:init      Create the global Nix config.json under the Nix home");
  console.log("  reviewers:list   List built-in reviewers");
  console.log("  reviewers:run    Run applicable reviewers against the current repository");
  console.log("  arch:select      Recommend an architecture");
  console.log("  component        Preview/manage a global component (default: Nix Core preview)");
  console.log("                   --action=preview|install|update|backup|list-backups|restore|uninstall");
  console.log("                   --component=skill.nix-core --root=<project> [--backup=<id>] [--yes]");
  console.log("                   Mutating actions require --yes and write to global agent targets.");
  console.log("  security:hooks   Preview/status/install/uninstall global security hooks");
  console.log("                   --action=preview|status|install|uninstall --root=<project> [--yes]");
  console.log("                   Supports Codex and OpenCode V1/V2 on PowerShell, cmd.exe, and Git Bash/MSYS.");
  console.log("  workflow:configure  Enable or disable SDD/TDD settings independently");
  console.log("                   --sdd=on|off --tdd=on|off --yes");
  console.log("  workflow:status  Show workflow settings and active project workflows");
  console.log("  workflow:start   Start an enabled workflow (--kind=sdd|tdd --title=\"...\" --yes)");
  console.log("  workflow:advance Record evidence for the current step (--id=<id> --evidence=\"...\" --yes)");
  console.log("  workflow:skip    Skip TDD RED with a reason (--id=<id> --reason=\"...\" --yes)");
  console.log("  workflow:resume  Show the persisted next action for a workflow (--id=<id>)");
  console.log("  workflow:commands  List /new-feat, /refactor, /new-idea, and /new-project with CLI/slash availability (--json)");
  console.log("  workflow:command   Run a catalog command (--id=... [--title=\"...\"] --root=<project> --yes)");
  console.log("  workflow:install-commands  Install/remove global OpenCode commands or Codex skills");
  console.log("                   --agent=opencode|codex --root=<project> [--remove] --yes");
  console.log("  mcp:list         List optional global MCP integrations");
  console.log("  mcp:status       Diagnose global MCP entries per agent (--root=<project>)");
  console.log("  mcp:preview      Preview one integration (--id=<id> --agent=opencode|codex --root=<project>)");
  console.log("  mcp:install      Install/update one integration (same flags, --yes)");
  console.log("  mcp:update       Restore the catalog spec for a modified managed entry (same flags, --yes)");
  console.log("  mcp:remove       Remove only the Nix-managed entry (same flags, --yes)");
  console.log("  skill:list       List requested skills with provenance and dependencies");
  console.log("  skill:status     Diagnose global skill installs per agent (--root=<project>)");
  console.log("  skill:preview    Preview a skill (--id=<id> --agent=opencode|codex --root=<project>)");
  console.log("  skill:install    Install/update a skill (same flags, --yes [--source=<dir>])");
  console.log("  skill:update     Restore a managed skill from its pinned source (same flags, --yes)");
  console.log("  skill:remove     Remove only the Nix-managed skill (same flags, --yes)");
  console.log("  skill:new        Scaffold a global user skill (--id=<id> [--agent=opencode|codex])");
  console.log("  release:manifest Build a SHA-256 release manifest for dist/");
  console.log("                   --root=<project> [--dist=dist] [--out=dist/release-manifest.json] [--json]");
  console.log("  release:verify   Verify dist/ against a release manifest");
  console.log("                   --root=<project> [--dist=dist] [--manifest=dist/release-manifest.json] [--json]");
  console.log("  help             Show this help");
  console.log("");
  console.log("Global home: NIX_AI_HOME, otherwise %APPDATA%\\Nix AI Stack (default: " + getNixHome() + ")");
  console.log("");
  console.log("Example:");
  console.log("  nix-ai component --action=install --component=skill.nix-core --root=. --yes");
  console.log("  nix-ai component --action=list-backups --component=skill.nix-core --root=.");
  console.log(
    `  ${path.basename(process.argv[1] ?? "nix-ai")} reviewers:list --root=C:\\Proyectos\\Araxys`
  );
}

void main();
