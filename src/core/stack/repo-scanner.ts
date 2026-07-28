import { access } from "node:fs/promises";
import path from "node:path";

export interface StackSignal {
  readonly name: string;
  readonly evidence: string;
}

export interface RepoScanResult {
  readonly root: string;
  readonly signals: ReadonlyArray<StackSignal>;
}

const SIGNAL_CANDIDATES: ReadonlyArray<{
  readonly name: string;
  readonly relativePath: string;
}> = [
  { name: "Python / uv", relativePath: "pyproject.toml" },
  { name: "uv lockfile", relativePath: "uv.lock" },
  { name: "Node package", relativePath: "package.json" },
  { name: "Astro", relativePath: "astro.config.mjs" },
  { name: "Astro (TypeScript config)", relativePath: "astro.config.ts" },
  { name: "Tailwind", relativePath: "tailwind.config.ts" },
  { name: "Tailwind (JavaScript config)", relativePath: "tailwind.config.js" },
  { name: ".NET solution", relativePath: "app.sln" },
  { name: ".NET global config", relativePath: "global.json" },
  { name: "Nix config", relativePath: "nix.config.json" }
];

export async function scanRepository(
  rootDirectory: string = process.cwd()
): Promise<RepoScanResult> {
  const signals: StackSignal[] = [];

  for (const candidate of SIGNAL_CANDIDATES) {
    const candidatePath = path.join(rootDirectory, candidate.relativePath);

    try {
      await access(candidatePath);
      signals.push({
        name: candidate.name,
        evidence: candidate.relativePath
      });
    } catch {
      continue;
    }
  }

  return {
    root: rootDirectory,
    signals
  };
}
