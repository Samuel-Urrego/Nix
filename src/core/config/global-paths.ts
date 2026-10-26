import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/** Resolves the user home directory, honoring test and portable overrides. */
export function getHomeDirectory(environment: NodeJS.ProcessEnv = process.env): string {
  return path.resolve(environment.HOME || environment.USERPROFILE || os.homedir());
}

/** Resolves the single user-scope Nix home. */
export function getNixHome(environment: NodeJS.ProcessEnv = process.env): string {
  const override = environment.NIX_AI_HOME?.trim();
  if (override) return path.resolve(override);
  if (process.platform === "win32" || environment.APPDATA) {
    const appData = environment.APPDATA || path.join(getHomeDirectory(environment), "AppData", "Roaming");
    return path.join(appData, "Nix AI Stack");
  }
  const configHome = environment.XDG_CONFIG_HOME?.trim()
    ? path.resolve(environment.XDG_CONFIG_HOME)
    : path.join(getHomeDirectory(environment), ".config");
  return path.join(configHome, "nix-ai");
}

export function getNixConfigPath(environment: NodeJS.ProcessEnv = process.env): string {
  return path.join(getNixHome(environment), "config.json");
}

export function getManagedDirectory(environment: NodeJS.ProcessEnv = process.env): string {
  return path.join(getNixHome(environment), "managed");
}

export function getManagedSkillsPath(environment: NodeJS.ProcessEnv = process.env): string {
  return path.join(getManagedDirectory(environment), "skills.json");
}

export function getManagedMcpPath(environment: NodeJS.ProcessEnv = process.env): string {
  return path.join(getManagedDirectory(environment), "mcp.json");
}

export function getBackupsDirectory(environment: NodeJS.ProcessEnv = process.env): string {
  return path.join(getNixHome(environment), "backups");
}

export function getComponentBackupsDirectory(environment: NodeJS.ProcessEnv = process.env): string {
  return path.join(getBackupsDirectory(environment), "components");
}

export function getProjectStateDirectory(
  projectRoot: string,
  environment: NodeJS.ProcessEnv = process.env
): string {
  const canonical = process.platform === "win32"
    ? path.resolve(projectRoot).toLowerCase()
    : path.resolve(projectRoot);
  const key = createHash("sha256").update(canonical).digest("hex").slice(0, 16);
  return path.join(getNixHome(environment), "projects", key);
}

export function getProjectWorkflowsDirectory(
  projectRoot: string,
  environment: NodeJS.ProcessEnv = process.env
): string {
  return path.join(getProjectStateDirectory(projectRoot, environment), "workflows");
}

export function getProjectIdeasDirectory(
  projectRoot: string,
  environment: NodeJS.ProcessEnv = process.env
): string {
  return path.join(getProjectStateDirectory(projectRoot, environment), "ideas");
}

export function getOpenCodeConfigDirectory(environment: NodeJS.ProcessEnv = process.env): string {
  const configHome = environment.XDG_CONFIG_HOME?.trim()
    ? path.resolve(environment.XDG_CONFIG_HOME)
    : path.join(getHomeDirectory(environment), ".config");
  return path.join(configHome, "opencode");
}

export function getOpenCodeConfigPath(environment: NodeJS.ProcessEnv = process.env): string {
  const directory = getOpenCodeConfigDirectory(environment);
  const jsonc = path.join(directory, "opencode.jsonc");
  if (existsSync(jsonc)) return jsonc;
  return path.join(directory, "opencode.json");
}

export function getOpenCodeCommandsDirectory(environment: NodeJS.ProcessEnv = process.env): string {
  return path.join(getOpenCodeConfigDirectory(environment), "commands");
}

export function getOpenCodeSkillsDirectory(environment: NodeJS.ProcessEnv = process.env): string {
  return path.join(getOpenCodeConfigDirectory(environment), "skills");
}

export function getOpenCodePluginsDirectory(environment: NodeJS.ProcessEnv = process.env): string {
  return path.join(getOpenCodeConfigDirectory(environment), "plugins");
}

export function getCodexHome(environment: NodeJS.ProcessEnv = process.env): string {
  const override = environment.CODEX_HOME?.trim();
  return override ? path.resolve(override) : path.join(getHomeDirectory(environment), ".codex");
}

export function getCodexConfigPath(environment: NodeJS.ProcessEnv = process.env): string {
  return path.join(getCodexHome(environment), "config.toml");
}

export function getCodexHooksPath(environment: NodeJS.ProcessEnv = process.env): string {
  return path.join(getCodexHome(environment), "hooks.json");
}

export function getCodexUserSkillsDirectory(environment: NodeJS.ProcessEnv = process.env): string {
  return path.join(getHomeDirectory(environment), ".agents", "skills");
}

export function getGlobalSkillTargetPath(
  agent: "opencode" | "codex",
  skillId: string,
  environment: NodeJS.ProcessEnv = process.env
): string {
  const root = agent === "opencode"
    ? getOpenCodeSkillsDirectory(environment)
    : getCodexUserSkillsDirectory(environment);
  return path.join(root, skillId);
}
