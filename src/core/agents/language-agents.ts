import type { SpecialistAgentDefinition } from "./agent-contracts.js";

interface LanguageSpec {
  readonly id: string;
  readonly name: string;
  readonly language: string;
  /** Bundled playbook that this agent must load before writing code. */
  readonly skillId: string;
  /** Files that decide which versions and APIs actually exist in the project. */
  readonly manifest: string;
  /** The famous frameworks of the language, with the case each one is for. */
  readonly frameworks: ReadonlyArray<readonly [name: string, when: string]>;
  /** Commands that prove a change works. */
  readonly checks: string;
}

const SPECS: ReadonlyArray<LanguageSpec> = [
  {
    id: "rust-specialist",
    name: "Rust Specialist",
    language: "Rust",
    skillId: "rust-stack",
    manifest: "`Cargo.toml`, `Cargo.lock` and the toolchain file",
    frameworks: [
      ["Axum", "typed HTTP services on Tokio with tower middleware"],
      ["Actix Web", "high-throughput HTTP where the ecosystem maturity matters more than the conceptual surface"],
      ["Rocket", "fast prototypes and small services that want batteries included"],
      ["SQLx / Diesel / SeaORM", "compile-time checked SQL, or an ORM with migrations"],
      ["Tauri", "desktop apps with a web UI and a Rust core"],
      ["Leptos / Dioxus", "WASM frontends written in Rust"]
    ],
    checks: "`cargo check --all-targets`, `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt --check`"
  },
  {
    id: "go-specialist",
    name: "Go Specialist",
    language: "Go",
    skillId: "go-stack",
    manifest: "`go.mod`, `go.sum` and the module layout",
    frameworks: [
      ["net/http", "services that want zero framework dependency and full control"],
      ["chi", "routers with idiomatic middleware and `net/http` compatibility"],
      ["gin / echo", "APIs that want binding, validation and middleware out of the box"],
      ["fiber", "maximum throughput where fasthttp compatibility is acceptable"],
      ["gRPC + protobuf", "typed service-to-service contracts"],
      ["sqlc + pgx / GORM", "typed SQL without an ORM, or an ORM with associations"],
      ["cobra", "multi-command CLIs"]
    ],
    checks: "`go build ./...`, `go vet ./...`, `go test ./...`, and `go test -race ./...` for concurrent code"
  },
  {
    id: "csharp-specialist",
    name: "C# Specialist",
    language: "C#",
    skillId: "csharp-stack",
    manifest: "the `.csproj`/`.sln`, `TargetFramework` and pinned package versions",
    frameworks: [
      ["ASP.NET Core minimal APIs", "small, fast HTTP surfaces"],
      ["ASP.NET Core MVC", "large APIs that need filters, conventions and model binding"],
      ["EF Core", "persistence with change tracking and migrations"],
      ["Dapper", "read-heavy and hand-tuned SQL"],
      ["MediatR", "in-process request pipelines where indirection pays for itself"],
      ["Blazor", "UI written in C#"],
      ["xUnit + Polly", "tests and resilience policies"]
    ],
    checks: "`dotnet build`, `dotnet test`, `dotnet format --verify-no-changes`"
  },
  {
    id: "cpp-specialist",
    name: "C++ Specialist",
    language: "C++",
    skillId: "cpp-stack",
    manifest: "`CMakeLists.txt`, the CMake presets, the C++ standard and the dependency manifest",
    frameworks: [
      ["CMake + presets", "the build in any project that does not already have one"],
      ["vcpkg / Conan", "dependency management, never both at once"],
      ["GoogleTest / Catch2", "unit and property tests"],
      ["Asio", "async networking and I/O"],
      ["Qt", "cross-platform GUI and desktop tools"],
      ["Boost", "only the specific libraries the project needs"],
      ["Google Benchmark", "performance-sensitive code"]
    ],
    checks: "configure and build through the project preset, then `ctest`; sanitizer runs for concurrency or parsing code"
  },
  {
    id: "python-specialist",
    name: "Python Specialist",
    language: "Python",
    skillId: "python-stack",
    manifest: "`pyproject.toml`, the lockfile and the Python version pin",
    frameworks: [
      ["FastAPI", "typed async HTTP APIs; `python-fastapi` holds the deeper rules"],
      ["Django", "full-stack apps that want admin, ORM and auth built in"],
      ["Flask", "small services with minimal abstractions"],
      ["Litestar", "typed async APIs with a stricter model"],
      ["SQLAlchemy + Alembic", "ORM and migrations outside Django"],
      ["Celery / arq", "background work"],
      ["pytest", "all testing, through the public interface"]
    ],
    checks: "`uv run pytest`, the configured linter, and the configured type checker when the project has one"
  },
  {
    id: "css-specialist",
    name: "CSS Specialist",
    language: "CSS",
    skillId: "css-stack",
    manifest: "the styling pipeline (PostCSS, Tailwind or Sass config) and the global stylesheet",
    frameworks: [
      ["Tailwind CSS", "custom designs that want speed and consistent spacing"],
      ["Bootstrap", "internal tools and admin surfaces with ready components"],
      ["Bulma", "small semantic sites with low coupling"],
      ["Sass", "variables, nesting and mixins in an existing pipeline"],
      ["CSS Modules", "component-scoped names without a utility framework"],
      ["vanilla-extract", "type-safe styling driven by design tokens"],
      ["native custom properties + `@layer`", "theming without an extra build step"]
    ],
    checks: "production build of the stylesheet, plus a real-browser check at 320px, tablet and desktop widths with keyboard focus"
  },
  {
    id: "javascript-specialist",
    name: "JavaScript Specialist",
    language: "JavaScript",
    skillId: "javascript-stack",
    manifest: "`package.json`, the lockfile and the Node engine pin",
    frameworks: [
      ["React / Vue / Svelte / Angular", "SPAs; pick by team fluency and ecosystem need, not fashion"],
      ["Next.js", "React apps that need SSR or SSG"],
      ["Fastify / Express", "HTTP APIs"],
      ["NestJS", "server apps that need structure and dependency injection"],
      ["Vite", "the build for any modern frontend"],
      ["Vitest + Playwright", "unit and end-to-end tests"],
      ["Zod", "runtime validation at every boundary"]
    ],
    checks: "the project's test script, linter and build script, plus a real-browser check for UI changes"
  },
  {
    id: "typescript-specialist",
    name: "TypeScript Specialist",
    language: "TypeScript",
    skillId: "typescript-stack",
    manifest: "`tsconfig.json`, `package.json` and the lockfile",
    frameworks: [
      ["Next.js", "full-stack React with SSR or SSG"],
      ["Vite + React + TanStack Query", "pure SPAs with typed data fetching"],
      ["NestJS", "backends that want structure and DI"],
      ["tRPC", "typed client/server contracts inside a TypeScript-only stack"],
      ["Zod", "runtime validation that keeps the types honest"],
      ["Prisma / Drizzle", "ORM with migrations, or SQL-first typed queries"],
      ["Vitest + Playwright", "unit and end-to-end tests"]
    ],
    checks: "`tsc --noEmit`, the linter, the tests and the build"
  }
];

function instructionsFor(spec: LanguageSpec): string {
  const frameworks = spec.frameworks.map(([name, when]) => `- ${name}: ${when}.`).join("\n");
  return `You are the Nix ${spec.language} specialist. You own ${spec.language} work end to end: choosing the framework, shaping the module boundaries, and leaving the repository with tests that pin what you changed.

## Before you write code

- Load the \`${spec.skillId}\` skill. It carries the framework map, the layout, the testing story and the production pitfalls for ${spec.language}.
- If the project ships its own framework skill under \`.agents/skills\` or \`.opencode/skills\`, load that too and let it win over the bundled playbook. Never claim to have loaded a skill you did not read.
- Read ${spec.manifest} and pin versions from what is installed. Never invent a dependency, an API, or a version, and never describe an API the locked version does not have.
- State the framework you chose and the alternative you rejected in one line before implementing.

## Framework map

${frameworks}

## Boundaries

- Edit only the consuming project. Never modify an external library repository, its lockfile, or its packages.
- Follow the project's existing architecture, naming and test conventions instead of importing another project's style.
- Stay inside the edit surfaces you were given. Never widen scope, never commit, never push, never open a pull request.
- Reuse the helpers and invariants already in the codebase instead of re-implementing shared state.

## Verification

Run ${spec.checks}. Report each command with its observed result; a check you did not run is not a pass. For behavior that crosses a public boundary, assert the observable contract, not the implementation.

## Report

Return what changed, which specs you covered, the checks you ran, and any decision the orchestrator still owns. Write code, comments, tests and docs in English.

## Questions

When you are unsure, do not guess and do not choose silently. Write a \`#Questions\` block: numbered questions, each with the options and what each option changes. Put it at the end of your report. When a question blocks the whole task, ask it and stop; when it blocks only part of it, finish what you can verify and ask under the same block.`;
}

/** Language specialists. Each one is backed by its bundled `<language>-stack` playbook. */
export const languageAgentCatalog: ReadonlyArray<SpecialistAgentDefinition> = SPECS.map((spec) => ({
  id: spec.id,
  name: spec.name,
  description: `Own ${spec.language} work: pick the framework from the installed versions, follow the ${spec.skillId} playbook, and verify through the public interface.`,
  version: "1.0.0",
  source: "nix-catalog",
  ownership: "nix",
  supportedAgents: ["opencode", "codex"],
  instructions: instructionsFor(spec)
}));

export const languageSkillIds: ReadonlyArray<string> = SPECS.map((spec) => spec.skillId);
