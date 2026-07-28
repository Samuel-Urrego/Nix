#!/usr/bin/env node

import path from "node:path";

import { DefaultArchitectureSelector } from "../core/architecture/default-architecture-selector.js";
import { loadNixConfig } from "../core/config/config-loader.js";
import { projectMetadata } from "../core/system/project-metadata.js";
import { loadReviewers } from "../core/reviewers/reviewer-registry.js";
import type { ArchitectureSelectionInput } from "../core/contracts/architecture-selector.js";
import { builtinReviewers } from "../core/reviewers/builtin-reviewers.js";
import { runReviewers } from "../core/reviewers/reviewer-runner.js";
import { scanRepository } from "../core/stack/repo-scanner.js";
import { stackInventory } from "../core/stack/stack-inventory.js";

type CommandHandler = () => Promise<void>;

const handlers = new Map<string, CommandHandler>([
  ["doctor", printDoctor],
  ["reviewers:list", printReviewers],
  ["reviewers:run", runReviewersCommand],
  ["stack:scan", printStackInventory],
  ["arch:select", printArchitectureSelection],
  ["help", printHelp]
]);

async function main(): Promise<void> {
  const command = process.argv[2] ?? "help";
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

async function printDoctor(): Promise<void> {
  const { config, source } = await loadNixConfig();
  const { reviewers, sources } = await loadReviewers();

  console.log(`${projectMetadata.name} doctor`);
  console.log("");
  console.log(`Version: ${projectMetadata.version}`);
  console.log(`Runtime: ${projectMetadata.runtime}`);
  console.log(`Package manager: ${projectMetadata.packageManager}`);
  console.log(`Built-in reviewers: ${builtinReviewers.length}`);
  console.log(`Loaded reviewers: ${reviewers.length}`);
  console.log(`Stack domains: ${stackInventory.length}`);
  console.log(`Config source: ${source}`);
  console.log(`Reviewer sources: ${sources.join(", ")}`);
  console.log(`Default architecture: ${config.defaultArchitecture}`);
  console.log("");
  console.log("Status: bootstrap-ready");
}

async function printReviewers(): Promise<void> {
  const { reviewers, sources } = await loadReviewers();

  console.log("Loaded reviewers");
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

async function printStackInventory(): Promise<void> {
  const repoScan = await scanRepository();

  console.log("Stack inventory");
  console.log("");

  for (const domain of stackInventory) {
    console.log(`- ${domain.name} (${domain.priority})`);
    console.log(`  technologies: ${domain.technologies.join(", ")}`);
    console.log("");
  }

  console.log("Repository signals");
  console.log(`Root: ${repoScan.root}`);
  console.log("");
  console.log(`Tags: ${repoScan.tags.join(", ") || "none"}`);
  console.log("");

  if (repoScan.signals.length === 0) {
    console.log("- No manifest signals found in the current working directory.");
    return;
  }

  for (const signal of repoScan.signals) {
    console.log(`- ${signal.name}`);
    console.log(`  evidence: ${signal.evidence}`);
  }
}

async function runReviewersCommand(): Promise<void> {
  const { reviewers } = await loadReviewers();
  const repoScan = await scanRepository();
  const reports = runReviewers(reviewers, repoScan);

  console.log("Reviewer run");
  console.log("");
  console.log(`Root: ${repoScan.root}`);
  console.log(`Tags: ${repoScan.tags.join(", ") || "none"}`);
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

function parseArchitectureSelectionInput(args: ReadonlyArray<string>): ArchitectureSelectionInput {
  const values = new Map<string, string>();

  for (const arg of args) {
    const [key, rawValue] = arg.split("=");

    if (!key || !rawValue) {
      continue;
    }

    values.set(key.replace(/^--/, ""), rawValue);
  }

  const projectType = values.get("type") ?? "general";
  const complexity = values.get("complexity");
  const teamSize = values.get("team");

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

async function printHelp(): Promise<void> {
  console.log("Nix CLI");
  console.log("");
  console.log("Commands:");
  console.log("  doctor           Show bootstrap status");
  console.log("  reviewers:list   List built-in reviewers");
  console.log("  reviewers:run    Run applicable reviewers against the current repository");
  console.log("  stack:scan       Print the current built-in stack inventory and repo signals");
  console.log("  arch:select      Recommend an architecture");
  console.log("  help             Show this help");
  console.log("");
  console.log("Example:");
  console.log(
    `  ${path.basename(process.argv[1] ?? "nix")} arch:select --type=tooling --complexity=low --team=solo`
  );
}

void main();
