import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export interface ProjectTask {
  readonly id: string;
  readonly specs: string;
  readonly route: string;
  readonly status: string;
  readonly done: boolean;
}

export interface TaskDocument {
  readonly file: string;
  readonly title: string;
  readonly tasks: ReadonlyArray<ProjectTask>;
}

const TASK_ROW = /^\|\s*(T\d+)\s*\|\s*([^|]*)\|\s*([^|]*)\|\s*([^|]*)\|/;

/**
 * Reads the ODD task documents a project keeps under `odd/tasks/`. The task table
 * is the plan the agent and the human share, so the TUI shows exactly what the
 * documents say instead of a separate list that can drift.
 */
export async function readProjectTasks(root: string): Promise<ReadonlyArray<TaskDocument>> {
  const directory = path.join(path.resolve(root), "odd", "tasks");
  let files: string[];
  try {
    files = (await readdir(directory)).filter((file) => file.endsWith(".md")).sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const documents: TaskDocument[] = [];
  for (const file of files) {
    const content = await readFile(path.join(directory, file), "utf8");
    documents.push({
      file,
      title: firstHeading(content) ?? file.replace(/\.md$/, ""),
      tasks: parseTaskRows(content)
    });
  }
  return documents;
}

export function parseTaskRows(content: string): ReadonlyArray<ProjectTask> {
  const tasks: ProjectTask[] = [];
  for (const line of content.split(/\r?\n/)) {
    const match = TASK_ROW.exec(line);
    if (!match) continue;
    const status = (match[4] ?? "").trim();
    tasks.push({
      id: (match[1] ?? "").trim(),
      specs: (match[2] ?? "").trim(),
      route: (match[3] ?? "").trim(),
      status,
      done: /^done\b/i.test(status)
    });
  }
  return tasks;
}

function firstHeading(content: string): string | undefined {
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) return trimmed.slice(2).trim();
  }
  return undefined;
}
