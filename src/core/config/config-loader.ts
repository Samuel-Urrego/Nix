import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { defaultNixConfig, type NixConfig } from "./nix-config.js";

const CONFIG_FILE_NAME = "nix.config.json";

export async function loadNixConfig(
  baseDirectory: string = process.cwd()
): Promise<{ readonly config: NixConfig; readonly source: string }> {
  const configPath = path.join(baseDirectory, CONFIG_FILE_NAME);

  try {
    await access(configPath);
  } catch {
    return {
      config: defaultNixConfig,
      source: "default"
    };
  }

  const raw = await readFile(configPath, "utf8");
  const parsed = JSON.parse(raw) as Partial<NixConfig>;
  const config: NixConfig = {
    projectName: parsed.projectName ?? defaultNixConfig.projectName,
    defaultArchitecture:
      parsed.defaultArchitecture ?? defaultNixConfig.defaultArchitecture,
    reviewerSources: parsed.reviewerSources ?? defaultNixConfig.reviewerSources,
    scanRoots: parsed.scanRoots ?? defaultNixConfig.scanRoots,
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
  baseDirectory: string,
  overrides: Partial<NixConfig> = {}
): Promise<string> {
  const configPath = path.join(baseDirectory, CONFIG_FILE_NAME);
  const config: NixConfig = {
    ...defaultNixConfig,
    ...overrides
  };

  await writeFile(`${configPath}`, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return configPath;
}
