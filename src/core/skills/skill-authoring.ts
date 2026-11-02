import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getGlobalSkillTargetPath } from "../config/global-paths.js";
import type { SkillAgent } from "./skill-contracts.js";

export interface ScaffoldResult {
  readonly targetPath: string;
  readonly files: ReadonlyArray<string>;
}

/**
 * Creates a project-authored skill under `skills/<id>` following
 * `agents/skill-style-guide.md`.
 */
export async function scaffoldProjectSkill(root: string, id: string): Promise<ScaffoldResult> {
  validateId(id);
  const target = path.join(path.resolve(root), "skills", id);
  await mkdir(path.join(path.resolve(root), "skills"), { recursive: true });
  return scaffoldAt(target, id);
}

/** Creates a user-scope skill under the selected agent's global skill directory. */
export async function scaffoldGlobalSkill(id: string, agent: SkillAgent = "codex"): Promise<ScaffoldResult> {
  validateId(id);
  const target = getGlobalSkillTargetPath(agent, id);
  await mkdir(path.dirname(target), { recursive: true });
  return scaffoldAt(target, id);
}

/**
 * Creates a project-local skill for one agent target: `.opencode/skills/<id>` or
 * `.agents/skills/<id>`. A project skill documents the project's own commands and
 * conventions, which is what Nix loads before working inside that repository.
 */
export async function scaffoldProjectAgentSkill(root: string, id: string, agent: SkillAgent = "codex"): Promise<ScaffoldResult> {
  validateId(id);
  const base = path.resolve(root);
  const target = agent === "opencode"
    ? path.join(base, ".opencode", "skills", id)
    : path.join(base, ".agents", "skills", id);
  await mkdir(path.dirname(target), { recursive: true });

  try {
    await mkdir(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error(`Skill already exists: ${target}`);
    throw error;
  }

  const skill = `---
name: ${id}
description: "Trigger: work inside this project, project commands, project conventions. Load before domain work."
license: Apache-2.0
metadata:
  author: "Samuel Urrego"
  version: "0.1.0"
---

## Activation Contract

Load this skill whenever you work inside this project, before choosing a framework, a command, or a file layout.

## Project facts

Fill these in from the repository; they are what an agent gets wrong without reading them.

- Language and frameworks: _(fill in)_
- Package manager and install command: _(fill in)_
- Test command: _(fill in)_
- Build command: _(fill in)_
- Entry point and deployment target: _(fill in)_

## Conventions

- _(fill in: naming, folder layout, error handling, state management)_

## Gotchas

- _(fill in: commands that look right but are not, generated files, required env vars)_

## Verification

- Run the test command above and report the observed result.
- Run the build command above before claiming the change is complete.
`;

  const skillPath = path.join(target, "SKILL.md");
  try {
    await writeFile(skillPath, skill, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    const { rm } = await import("node:fs/promises");
    await rm(target, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
  return { targetPath: target, files: [skillPath] };
}

function validateId(id: string): void {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    throw new Error(`Invalid skill id: ${id}. Use lowercase letters, digits, and hyphens.`);
  }
}

async function scaffoldAt(target: string, id: string): Promise<ScaffoldResult> {
  try {
    await mkdir(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error(`Skill already exists: ${target}`);
    throw error;
  }

  const skill = `---
name: ${id}
description: "Trigger: ${id} workflow, repeated ${id} task, project convention. Execute one narrow repeatable workflow."
license: Apache-2.0
metadata:
  author: "Samuel Urrego"
  version: "0.1.0"
---

## Activation Contract

Use this skill when the task is a repeated, stable, ${id}-specific workflow.

## Hard Rules

- Stay within one responsibility.
- Keep project artifacts in English unless explicitly requested otherwise.
- Move long examples or templates to \`assets/\` or \`references/\`.

## Decision Gates

| Situation | Action |
|-----------|--------|
| One-off task | Do not use this skill |
| Stable repeated task | Use or adapt this skill |
| Large mixed workflow | Split into smaller skills |

## Execution Steps

1. Confirm the task matches this skill's trigger.
2. Follow the project conventions for the workflow.
3. Produce the expected artifact or action.
4. Report what changed and what remains.

## Output Contract

Return:
- files created or modified,
- decisions taken,
- follow-up work if relevant.

## References

- \`agents/skill-style-guide.md\`
`;

  const files = [
    path.join(target, "SKILL.md"),
    path.join(target, "references", ".gitkeep"),
    path.join(target, "assets", ".gitkeep")
  ];
  try {
    await mkdir(path.join(target, "references"));
    await mkdir(path.join(target, "assets"));
    await writeFile(files[0]!, skill, { encoding: "utf8", flag: "wx" });
    await writeFile(files[1]!, "", { encoding: "utf8", flag: "wx" });
    await writeFile(files[2]!, "", { encoding: "utf8", flag: "wx" });
  } catch (error) {
    const { rm } = await import("node:fs/promises");
    await rm(target, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
  return { targetPath: target, files };
}
