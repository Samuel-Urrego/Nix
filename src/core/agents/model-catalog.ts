import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

import { getCodexConfigPath, getOpenCodeConfigPath } from "../config/global-paths.js";
import type { SpecialistAgentTarget } from "./agent-contracts.js";

export interface ModelList {
  /** Models that can actually be selected for this target. */
  readonly models: ReadonlyArray<string>;
  /** Where the list came from, so the UI never implies more certainty than it has. */
  readonly source: "opencode CLI" | "opencode config" | "codex config" | "none";
}

const OPENCODE_TIMEOUT_MS = 8000;

/**
 * Reads the models OpenCode can run. The CLI is the authority: it lists what the
 * installed build actually offers, including providers added after install. When
 * it is unavailable, the user's own configuration is the next best evidence, and
 * an empty list is reported as empty instead of guessed.
 */
export async function listOpenCodeModels(
  environment: NodeJS.ProcessEnv = process.env,
  run: (command: string, args: ReadonlyArray<string>) => Promise<string | undefined> = runCommand
): Promise<ModelList> {
  const fromCli = await run("opencode", ["models"]);
  const cliModels = parseModelLines(fromCli ?? "");
  if (cliModels.length > 0) return { models: cliModels, source: "opencode CLI" };

  const fromConfig = parseOpenCodeConfigModels(await readOptional(getOpenCodeConfigPath(environment)));
  return fromConfig.length > 0 ? { models: fromConfig, source: "opencode config" } : { models: [], source: "none" };
}

/**
 * Reads the models named by the Codex configuration. Codex has no local command
 * that enumerates every model it accepts, so Nix reports what the user already
 * configured and never invents an id.
 */
export async function listCodexModels(
  environment: NodeJS.ProcessEnv = process.env
): Promise<ModelList> {
  const models = parseCodexConfigModels(await readOptional(getCodexConfigPath(environment)));
  return models.length > 0 ? { models, source: "codex config" } : { models: [], source: "none" };
}

export async function listModelsFor(
  target: SpecialistAgentTarget,
  environment: NodeJS.ProcessEnv = process.env
): Promise<ModelList> {
  return target === "opencode" ? listOpenCodeModels(environment) : listCodexModels(environment);
}

/** `opencode models` prints one `provider/model` id per line, sometimes with decoration. */
export function parseModelLines(output: string): ReadonlyArray<string> {
  const seen = new Set<string>();
  for (const raw of output.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const match = /([a-z0-9][a-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._:-]*)/.exec(line);
    if (match) seen.add(match[1]!);
  }
  return [...seen].sort((left, right) => left.localeCompare(right));
}

export function parseOpenCodeConfigModels(raw: string | undefined): ReadonlyArray<string> {
  if (!raw) return [];
  const seen = new Set<string>();
  try {
    const parsed = JSON.parse(raw) as {
      model?: unknown;
      provider?: Record<string, { models?: Record<string, unknown> }>;
    };
    if (typeof parsed.model === "string" && parsed.model.includes("/")) seen.add(parsed.model);
    for (const [providerId, provider] of Object.entries(parsed.provider ?? {})) {
      for (const modelId of Object.keys(provider.models ?? {})) seen.add(`${providerId}/${modelId}`);
    }
  } catch {
    return [];
  }
  return [...seen].sort((left, right) => left.localeCompare(right));
}

export function parseCodexConfigModels(raw: string | undefined): ReadonlyArray<string> {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) continue;
    const match = /^model\s*=\s*"([^"]+)"$/.exec(trimmed);
    if (match) seen.add(match[1]!);
  }
  return [...seen].sort((left, right) => left.localeCompare(right));
}

async function readOptional(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return undefined;
  }
}

function runCommand(command: string, args: ReadonlyArray<string>): Promise<string | undefined> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value: string | undefined): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(command, [...args], { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      resolve(undefined);
      return;
    }
    const timer = setTimeout(() => {
      child.kill();
      done(undefined);
    }, OPENCODE_TIMEOUT_MS);
    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.on("error", () => done(undefined));
    child.on("close", (code) => done(code === 0 ? output : undefined));
  });
}
