import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

export interface StackSignal {
  readonly name: string;
  readonly evidence: string;
}

export interface RepoScanResult {
  readonly root: string;
  readonly signals: ReadonlyArray<StackSignal>;
  readonly tags: ReadonlyArray<string>;
}

const SIGNAL_CANDIDATES: ReadonlyArray<{
  readonly fileName: string;
  readonly signalName: string;
  readonly tags: ReadonlyArray<string>;
}> = [
  { fileName: "pyproject.toml", signalName: "Python project", tags: ["python", "backend"] },
  { fileName: "uv.lock", signalName: "uv lockfile", tags: ["python", "uv"] },
  { fileName: "requirements.txt", signalName: "Python requirements", tags: ["python"] },
  { fileName: "package.json", signalName: "Node package", tags: ["node", "tooling"] },
  { fileName: "astro.config.mjs", signalName: "Astro config", tags: ["astro", "frontend"] },
  { fileName: "astro.config.ts", signalName: "Astro config", tags: ["astro", "frontend"] },
  { fileName: "tailwind.config.ts", signalName: "Tailwind config", tags: ["tailwind", "frontend"] },
  { fileName: "tailwind.config.js", signalName: "Tailwind config", tags: ["tailwind", "frontend"] },
  { fileName: "vite.config.ts", signalName: "Vite config", tags: ["vite", "frontend"] },
  { fileName: "global.json", signalName: ".NET global config", tags: [".net", "csharp"] },
  { fileName: "nix.config.json", signalName: "Nix config", tags: ["nix"] }
];

export async function scanRepository(
  rootDirectory: string = process.cwd()
): Promise<RepoScanResult> {
  const signals: StackSignal[] = [];
  const tags = new Set<string>();
  const files = await collectFiles(rootDirectory, 3);

  for (const filePath of files) {
    const relativePath = path.relative(rootDirectory, filePath) || path.basename(filePath);
    const fileName = path.basename(filePath);

    for (const candidate of SIGNAL_CANDIDATES) {
      if (candidate.fileName !== fileName) {
        continue;
      }

      signals.push({
        name: candidate.signalName,
        evidence: relativePath
      });

      for (const tag of candidate.tags) {
        tags.add(tag);
      }
    }

    if (fileName.endsWith(".sln") || fileName.endsWith(".csproj")) {
      signals.push({
        name: fileName.endsWith(".sln") ? ".NET solution" : ".NET project",
        evidence: relativePath
      });

      tags.add(".net");
      tags.add("csharp");
    }
  }

  await enrichTagsFromContent(rootDirectory, files, tags, signals);

  return {
    root: rootDirectory,
    signals: dedupeSignals(signals),
    tags: [...tags].sort()
  };
}

async function collectFiles(rootDirectory: string, maxDepth: number): Promise<string[]> {
  const skipDirectories = new Set([
    ".git",
    "node_modules",
    "dist",
    ".venv",
    "bin",
    "obj",
    ".next",
    ".astro"
  ]);

  const results: string[] = [];

  async function walk(currentDirectory: string, depth: number): Promise<void> {
    const entries = await readdir(currentDirectory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        if (depth >= maxDepth || skipDirectories.has(entry.name)) {
          continue;
        }

        await walk(fullPath, depth + 1);
        continue;
      }

      if (entry.isFile()) {
        results.push(fullPath);
      }
    }
  }

  await walk(rootDirectory, 0);
  return results;
}

async function enrichTagsFromContent(
  rootDirectory: string,
  files: ReadonlyArray<string>,
  tags: Set<string>,
  signals: StackSignal[]
): Promise<void> {
  for (const filePath of files) {
    const fileName = path.basename(filePath);

    if (fileName === "package.json") {
      const raw = await safeReadText(filePath);

      if (!raw) {
        continue;
      }

      if (raw.includes("\"react\"")) {
        tags.add("react");
        tags.add("frontend");
        signals.push({
          name: "React dependency",
          evidence: path.relative(rootDirectory, filePath)
        });
      }

      if (raw.includes("\"astro\"")) {
        tags.add("astro");
        tags.add("frontend");
      }

      if (raw.includes("tailwind")) {
        tags.add("tailwind");
      }
    }

    if (fileName === "pyproject.toml" || fileName === "requirements.txt") {
      const raw = await safeReadText(filePath);

      if (!raw) {
        continue;
      }

      if (raw.toLowerCase().includes("fastapi")) {
        tags.add("fastapi");
        tags.add("backend");
        signals.push({
          name: "FastAPI dependency",
          evidence: path.relative(rootDirectory, filePath)
        });
      }

      if (raw.toLowerCase().includes("pinecone")) {
        tags.add("pinecone");
      }
    }

    if (fileName.endsWith(".csproj")) {
      const raw = await safeReadText(filePath);

      if (!raw) {
        continue;
      }

      if (raw.includes("ModelContextProtocol")) {
        tags.add("mcp");
        tags.add("tools");
        signals.push({
          name: "Model Context Protocol package",
          evidence: path.relative(rootDirectory, filePath)
        });
      }

      if (raw.includes("SqlClient")) {
        tags.add("sqlserver");
      }

      if (raw.includes("Dapper")) {
        tags.add("dapper");
      }
    }
  }

  try {
    await access(path.join(rootDirectory, "tests"));
    tags.add("tests");
    signals.push({
      name: "Tests directory",
      evidence: "tests"
    });
  } catch {
    // No tests directory at root.
  }
}

async function safeReadText(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

function dedupeSignals(signals: ReadonlyArray<StackSignal>): ReadonlyArray<StackSignal> {
  const unique = new Map<string, StackSignal>();

  for (const signal of signals) {
    const key = `${signal.name}::${signal.evidence}`;

    if (!unique.has(key)) {
      unique.set(key, signal);
    }
  }

  return [...unique.values()];
}
