import { access } from "node:fs/promises";
import path from "node:path";

import {
  getCodexConfigPath,
  getCodexHome,
  getOpenCodeConfigDirectory,
  getOpenCodeConfigPath
} from "./global-paths.js";
import type { SkillAgent } from "../skills/skill-contracts.js";

export interface AgentDetection {
  readonly agent: SkillAgent;
  readonly label: string;
  readonly command: string;
  readonly detected: boolean;
  /** Observed local signals only; empty when nothing could be verified. */
  readonly evidence: ReadonlyArray<string>;
}

export interface AgentDetectionOptions {
  readonly environment?: NodeJS.ProcessEnv;
  readonly exists?: (target: string) => Promise<boolean>;
}

async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function findExecutable(name: string, environment: NodeJS.ProcessEnv, probe: (target: string) => Promise<boolean>): Promise<string | undefined> {
  const pathValue = environment.PATH ?? "";
  const extensions = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const directory of pathValue.split(path.delimiter)) {
    if (!directory) continue;
    for (const extension of extensions) {
      const candidate = path.join(directory, `${name}${extension}`);
      if (await probe(candidate)) return candidate;
    }
  }
  return undefined;
}

/**
 * Detects which agent applications are actually present on this machine.
 *
 * Detection never trusts a constructible destination path: a target counts as
 * installed only when an existing application configuration file/directory or
 * an application executable on PATH was observed.
 */
export async function detectAgentTargets(options: AgentDetectionOptions = {}): Promise<ReadonlyArray<AgentDetection>> {
  const environment = options.environment ?? process.env;
  const probe = options.exists ?? exists;

  const definitions: ReadonlyArray<{ agent: SkillAgent; label: string; command: string; configTargets: () => ReadonlyArray<string> }> = [
    {
      agent: "opencode",
      label: "OpenCode",
      command: "opencode",
      configTargets: () => [getOpenCodeConfigPath(environment), getOpenCodeConfigDirectory(environment)]
    },
    {
      agent: "codex",
      label: "Codex",
      command: "codex",
      configTargets: () => [getCodexConfigPath(environment), getCodexHome(environment)]
    }
  ];

  const detections: AgentDetection[] = [];
  for (const definition of definitions) {
    const evidence: string[] = [];
    for (const target of definition.configTargets()) {
      if (await probe(target)) evidence.push(`config: ${target}`);
    }
    const executable = await findExecutable(definition.command, environment, probe);
    if (executable) evidence.push(`cli: ${executable}`);
    detections.push({
      agent: definition.agent,
      label: definition.label,
      command: definition.command,
      detected: evidence.length > 0,
      evidence
    });
  }
  return detections;
}
