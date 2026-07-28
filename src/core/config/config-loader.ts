import { access, readFile } from "node:fs/promises";
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

  return {
    config: {
      projectName: parsed.projectName ?? defaultNixConfig.projectName,
      defaultArchitecture:
        parsed.defaultArchitecture ?? defaultNixConfig.defaultArchitecture,
      reviewerSources: parsed.reviewerSources ?? defaultNixConfig.reviewerSources,
      scanRoots: parsed.scanRoots ?? defaultNixConfig.scanRoots
    },
    source: configPath
  };
}
