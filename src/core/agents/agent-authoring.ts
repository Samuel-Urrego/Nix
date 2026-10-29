import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { SpecialistAgentTarget } from "./agent-contracts.js";

export interface AgentScaffoldResult {
  readonly targetPath: string;
}

/**
 * Creates a project-local agent. A project agent belongs to the repository that
 * needs it: OpenCode reads `.opencode/agent/<id>.md`, Codex reads
 * `.codex/agents/<id>.toml`. Existing files are never overwritten.
 */
export async function scaffoldProjectAgent(
  root: string,
  id: string,
  target: SpecialistAgentTarget
): Promise<AgentScaffoldResult> {
  validateId(id);
  const base = path.resolve(root);
  const targetPath = target === "opencode"
    ? path.join(base, ".opencode", "agent", `${id}.md`)
    : path.join(base, ".codex", "agents", `${id}.toml`);

  await mkdir(path.dirname(targetPath), { recursive: true });
  const content = target === "opencode" ? renderOpenCodeAgent(id) : renderCodexAgent(id);

  try {
    await writeFile(targetPath, content, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error(`Agent already exists: ${targetPath}`);
    throw error;
  }
  return { targetPath };
}

function validateId(id: string): void {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    throw new Error(`Invalid agent id: ${id}. Use lowercase letters, digits, and hyphens.`);
  }
}

function renderOpenCodeAgent(id: string): string {
  return `---
description: "Project agent ${id}: one narrow responsibility inside this repository."
mode: subagent
---
<!-- nix-ai:agent id=${id} scope=project -->

You are the ${id} agent for this project. You own one narrow responsibility and you stay inside the edit surfaces you are given.

## Before you work

- Read the project's Skill (under the project's agent skill directory) and follow its commands, conventions and gotchas.
- Read the files you are about to change and the tests that cover them before editing.

## Rules

- Reuse the helpers and invariants already in the codebase instead of re-implementing shared state.
- Keep the change proportional: no speculative abstractions, no unrequested rewrites.
- Never widen scope, never commit, never push, and never open a pull request.

## Report

Return what changed, the checks you ran with their observed results, and any decision the orchestrator still owns.
`;
}

function renderCodexAgent(id: string): string {
  const description = `Project agent ${id}: one narrow responsibility inside this repository.`;
  const instructions = `You are the ${id} agent for this project. You own one narrow responsibility and you stay inside the edit surfaces you are given. Read the project's Skill before working, read the files and tests you are about to change, reuse existing helpers, keep the change proportional, and never commit, push or open a pull request. Report what changed, the checks you ran with their observed results, and any decision the orchestrator still owns.`;
  return `# nix-ai:agent id=${id} scope=project
name = ${JSON.stringify(id)}
description = ${JSON.stringify(description)}
developer_instructions = ${JSON.stringify(instructions)}
`;
}
