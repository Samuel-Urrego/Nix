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
  readonly detectedDependencies: ReadonlyArray<string>;
  readonly probableArchitecture: string;
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
  const detectedDependencies = new Set<string>();
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

  await enrichTagsFromContent(rootDirectory, files, tags, signals, detectedDependencies);
  const probableArchitecture = inferProbableArchitecture(tags, signals, files);

  return {
    root: rootDirectory,
    signals: dedupeSignals(signals),
    tags: [...tags].sort(),
    detectedDependencies: [...detectedDependencies].sort(),
    probableArchitecture
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
  signals: StackSignal[],
  detectedDependencies: Set<string>
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
        detectedDependencies.add("react");
        signals.push({
          name: "React dependency",
          evidence: path.relative(rootDirectory, filePath)
        });
      }

      if (raw.includes("\"astro\"")) {
        tags.add("astro");
        tags.add("frontend");
        detectedDependencies.add("astro");
      }

      if (raw.includes("tailwind")) {
        tags.add("tailwind");
        detectedDependencies.add("tailwindcss");
      }

      if (raw.includes("\"vite\"")) {
        tags.add("vite");
        detectedDependencies.add("vite");
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
        detectedDependencies.add("fastapi");
        signals.push({
          name: "FastAPI dependency",
          evidence: path.relative(rootDirectory, filePath)
        });
      }

      if (raw.toLowerCase().includes("pydantic")) {
        detectedDependencies.add("pydantic");
      }

      if (raw.toLowerCase().includes("pytest")) {
        detectedDependencies.add("pytest");
      }

      if (raw.toLowerCase().includes("ruff")) {
        detectedDependencies.add("ruff");
      }

      if (raw.toLowerCase().includes("mypy")) {
        detectedDependencies.add("mypy");
      }

      if (raw.toLowerCase().includes("typer")) {
        detectedDependencies.add("typer");
      }

      if (raw.toLowerCase().includes("pinecone")) {
        tags.add("pinecone");
        detectedDependencies.add("pinecone");
      }

      if (raw.toLowerCase().includes("sqlparse")) {
        detectedDependencies.add("sqlparse");
      }

      if (raw.toLowerCase().includes("structlog")) {
        detectedDependencies.add("structlog");
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
        detectedDependencies.add("ModelContextProtocol");
        signals.push({
          name: "Model Context Protocol package",
          evidence: path.relative(rootDirectory, filePath)
        });
      }

      if (raw.includes("SqlClient")) {
        tags.add("sqlserver");
        detectedDependencies.add("Microsoft.Data.SqlClient");
      }

      if (raw.includes("Dapper")) {
        tags.add("dapper");
        detectedDependencies.add("Dapper");
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

function inferProbableArchitecture(
  tags: ReadonlySet<string>,
  signals: ReadonlyArray<StackSignal>,
  files: ReadonlyArray<string>
): string {
  const lowerPaths = files.map((file) => file.toLowerCase());
  const hasDomainFolders = lowerPaths.some((file) =>
    file.includes("\\domain\\") || file.includes("/domain/")
  );
  const hasApplicationFolders = lowerPaths.some((file) =>
    file.includes("\\application\\") || file.includes("/application/")
  );
  const hasInfrastructureFolders = lowerPaths.some((file) =>
    file.includes("\\infrastructure\\") || file.includes("/infrastructure/")
  );
  const hasApiOrPresentationFolders = lowerPaths.some((file) =>
    file.includes("\\api\\") ||
    file.includes("/api/") ||
    file.includes("\\presentation\\") ||
    file.includes("/presentation/")
  );

  if (hasDomainFolders && hasApplicationFolders && hasInfrastructureFolders) {
    return "clean-architecture";
  }

  if (hasApiOrPresentationFolders && tags.has("backend")) {
    return "layered";
  }

  if (tags.has("mcp") || tags.has("tooling")) {
    return "simple-modular";
  }

  if (signals.length >= 6 && tags.has("backend")) {
    return "modular-monolith";
  }

  return "simple-modular";
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
