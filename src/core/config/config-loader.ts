import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getNixConfigPath } from "./global-paths.js";
import { defaultNixConfig, type NixConfig } from "./nix-config.js";

export async function loadNixConfig(
  _baseDirectory: string = process.cwd(),
  environment: NodeJS.ProcessEnv = process.env
): Promise<{ readonly config: NixConfig; readonly source: string }> {
  const configPath = getNixConfigPath(environment);

  try {
    await access(configPath);
  } catch {
    return {
      config: defaultNixConfig,
      source: "default"
    };
  }

  const raw = await readFile(configPath, "utf8");
  const parsed = JSON.parse(raw) as Partial<NixConfig> & Record<string, unknown>;
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Nix config at ${configPath} must contain a JSON object.`);
  }

  const config: NixConfig = {
    ...parsed,
    projectName: parsed.projectName ?? defaultNixConfig.projectName,
    defaultArchitecture:
      parsed.defaultArchitecture ?? defaultNixConfig.defaultArchitecture,
    reviewerSources: parsed.reviewerSources ?? defaultNixConfig.reviewerSources,
    scanRoots: parsed.scanRoots ?? defaultNixConfig.scanRoots,
    ...(parsed.architectureHints ? { architectureHints: parsed.architectureHints } : {}),
    ...(parsed.preferredTestRoot
      ? { preferredTestRoot: parsed.preferredTestRoot }
      : {})
  };

  return {
    config,
    source: configPath
  };
}

export async function writeDefaultNixConfig(
  _baseDirectory: string,
  overrides: Partial<NixConfig> = {},
  environment: NodeJS.ProcessEnv = process.env
): Promise<string> {
  const configPath = getNixConfigPath(environment);
  const existing = await loadNixConfig(_baseDirectory, environment);
  const config: NixConfig = {
    ...defaultNixConfig,
    ...(existing.source === "default" ? {} : existing.config),
    ...overrides
  };

  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(`${configPath}`, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return configPath;
}
