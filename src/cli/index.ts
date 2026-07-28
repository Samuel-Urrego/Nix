#!/usr/bin/env node

import { projectMetadata } from "../core/system/project-metadata.js";
import { builtinReviewers } from "../core/reviewers/builtin-reviewers.js";
import { stackInventory } from "../core/stack/stack-inventory.js";

type CommandHandler = () => void;

const handlers = new Map<string, CommandHandler>([
  ["doctor", printDoctor],
  ["reviewers:list", printReviewers],
  ["stack:scan", printStackInventory],
  ["help", printHelp]
]);

function main(): void {
  const command = process.argv[2] ?? "help";
  const handler = handlers.get(command);

  if (!handler) {
    console.error(`Unknown command: ${command}`);
    console.error("");
    printHelp();
    process.exitCode = 1;
    return;
  }

  handler();
}

function printDoctor(): void {
  console.log(`${projectMetadata.name} doctor`);
  console.log("");
  console.log(`Version: ${projectMetadata.version}`);
  console.log(`Runtime: ${projectMetadata.runtime}`);
  console.log(`Package manager: ${projectMetadata.packageManager}`);
  console.log(`Built-in reviewers: ${builtinReviewers.length}`);
  console.log(`Stack domains: ${stackInventory.length}`);
  console.log("");
  console.log("Status: bootstrap-ready");
}

function printReviewers(): void {
  console.log("Built-in reviewers");
  console.log("");

  for (const reviewer of builtinReviewers) {
    console.log(`- ${reviewer.name} [${reviewer.category}]`);
    console.log(`  id: ${reviewer.id}`);
    console.log(`  goal: ${reviewer.goal}`);
    console.log(`  appliesTo: ${reviewer.appliesTo.join(", ")}`);
    console.log("");
  }
}

function printStackInventory(): void {
  console.log("Stack inventory");
  console.log("");

  for (const domain of stackInventory) {
    console.log(`- ${domain.name} (${domain.priority})`);
    console.log(`  technologies: ${domain.technologies.join(", ")}`);
    console.log("");
  }
}

function printHelp(): void {
  console.log("Nix CLI");
  console.log("");
  console.log("Commands:");
  console.log("  doctor           Show bootstrap status");
  console.log("  reviewers:list   List built-in reviewers");
  console.log("  stack:scan       Print the current built-in stack inventory");
  console.log("  help             Show this help");
}

main();
