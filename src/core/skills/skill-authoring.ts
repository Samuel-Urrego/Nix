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
  author: "surre"
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
