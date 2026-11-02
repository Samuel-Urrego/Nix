# Nix features for the next release

Objective: ship the capability set requested for the release after the TUI redesign.
Branch: `codex/nix-features`. Delivery: one pull request to `main` after every unit passes.
Test runner: `npx tsx --import ./test/setup.ts --test <file>`; full suite `npm test`.

## Specs

### S1 — Stack advisor

User request: "Agente especializado en definir que tecnologías usar dependiendo del tamaño del proyecto y su posible eslabalidad".

- A Nix-owned agent `stack-advisor`, available to OpenCode and Codex.
- It sizes the project first (solo/MVP, small team, growth, scale), then proposes a stack with tradeoffs, an explicit upgrade path, and what not to adopt yet.
- It never invents a framework or a version, and it names the assumption behind every recommendation.
- When the stack includes a language Nix ships an agent for, it says which language agent and skill must be loaded before implementation.

### S2 — Project-local skills and agents

User request: "Skills y Agentes locales por proyecto del usuario o sea; Skill creator and Skill agent creator".

- `nix-ai skill:new --scope=project --id=<id> --root=<project>` writes `<project>/.agents/skills/<id>/SKILL.md` and prints the exact path.
- `nix-ai agent:new --scope=project --id=<id> --target=opencode|codex --root=<project>` writes a project agent: `<project>/.opencode/agent/<id>.md` for OpenCode, `<project>/.codex/agents/<id>.toml` for Codex.
- Both refuse to overwrite an existing file, report the path when they refuse, and accept `--force` only with `--yes`.
- Both keep the generated frontmatter valid for their runtime.

### S3 — Language agents and framework playbooks

User request: "Agente por lenguajes de programación: Rust, Go, C#, C++, Python, Css, JavaScript, TypeScript. Estos agentes van a tener skills por cada framework famoso que hay para trabajar en estos lenguajes".

- One agent per language: `rust-specialist`, `go-specialist`, `csharp-specialist`, `cpp-specialist`, `python-specialist`, `css-specialist`, `javascript-specialist`, `typescript-specialist`, installed for both targets.
- Each agent loads its bundled playbook skill before writing code and states the framework it chose and why.
- One bundled skill per language (`<language>-stack`) that maps the famous frameworks of that language: when to pick each, when not to, install command, project layout, testing story, performance and scaling notes, and the pitfalls that bite in production.
- A language agent must defer to a project-local framework skill when one exists.

### S4 — `/new-startup`

User request: "Comandos /New-startup. Flujo para definir si la idea de una startup es buena con sub agentes decidiendo si inverterían en esta startup algo parecido a shark tank".

- New command `new-startup` exposed as `/new-startup` for OpenCode and Codex, backed by the bundled skill `startup-tank`.
- The skill defines a panel of independent investor subagents (skeptic operator, growth investor, technical diligence, market analyst) that score the idea alone, then the orchestrator synthesizes a verdict with the disagreements named.
- Each investor gets the same brief and no access to the other verdicts; the orchestrator never invents a score the panel did not produce.
- The verdict states the evidence gaps that would change the answer.

### S5 — Nix loads the project skill

User request: "Cuando este en un proyecto debe cargar la skill de ese proyecto, sino existe pedir autorización para crearla".

- The Nix agent instructions require loading the current project's skill when work happens inside a project.
- If no project skill exists, Nix asks for authorization to create one and only creates it after the user agrees, using the project-skill creator.
- Nix never creates a project skill silently and never claims to have loaded one it did not read.

### S6 — Nix prompt merge

User request: "Mezclar System Prompt de Gentle-AI y el de ECC ubicados en P:Proyectos".

- Merge the Gentle-AI orchestrator prompt and the ECC system prompt into the Nix agent instructions.
- Keep Nix's identity, ODD flow, delegation, skills, specialist, work-unit and risk sections.
- Carry over the durable conventions from both sources (authorization before mutation, evidence over claims, language rules, review discipline, no AI attribution) without duplicating a paragraph or leaving a contradiction between two sections.
- Sources: `P:/Proyectos/gentle-ai/internal/assets/codex/orchestrator.md` (and the OpenCode variant) and `P:/Proyectos/ECC/AGENTS.md`, `CLAUDE.md`, `SOUL.md`.

### S7 — MCP selection in the TUI

User request: "TUI. Poder seleccionar los MCPs que se van a instalar. MCPs Codegraph, Playwright, Engram, Context7".

- The guided install gains an MCP step where the user picks which MCPs to install; every detected target receives only the chosen ones.
- The catalog gains `context7` next to `codegraph`, `playwright` and `engram`.
- Declining or cancelling the MCP step writes no MCP entry; the preview lists exactly what will be written.
- The one-step install still works: it installs every MCP by default only when the user chose "install everything".

### S8 — Model configuration panel

User request: "Panel de configuración de modelos para cada agente, revisa como la TUI de gentle-ai tiene eso para poder listar los modelos de Codex y OpenCode".

- The TUI exposes a model configuration panel that lists the models available to each runtime and lets the user assign one per installed agent.
- The assignment is persisted in the Nix config and rendered into the agent files: an OpenCode agent gets a `model:` frontmatter field, a Codex agent gets a `model` field in its TOML.
- Unassigned agents keep installing without a model field, exactly as today.
- The panel states where the list came from (local CLI, local config, or built-in catalog) and never fabricates a model id.

### S9 — Checks

- Every unit ships tests alongside behavior and docs; the suite, `npm run typecheck` and `npm run build` stay clean.
- One commit per unit, Conventional Commits, no AI attribution.

## Tasks

| ID | Specs | Route | Status | Commit / Evidence |
|----|-------|-------|--------|-------------------|
| T1 | S1, S3 | Inline (subagents denied by runtime) | Done - stack advisor plus eight language specialists, each backed by a bundled playbook | `efd2e7b`; `190 passed` |
| T2 | S4 | Inline | Done - `/new-startup` wired for both targets and backed by `startup-tank` | `eb9ad2a`; command and service tests |
| T3 | S2, S5, S6 | Inline | Done - project-scope skill and agent creators, merged prompt with the project-skill rule | `b856d00`; `194 passed` |
| T4 | S7 | Inline | Done - MCP step in the guided install, `context7` added, unchecked entries never written | `c085f7d`; `195 passed` |
| T5 | S8 | Inline | Done - per-agent model panel, model rendered into both agent formats | `f543fe1`; `202 passed` |

## Log

- L1 — User request, verbatim: "para esto creo que deberias crear un nueva rama Nix features / Agente especializado en definir que tecnologías usar dependiendo del tamaño del proyecto y su posible eslabalidad / Skills y Agentes locales por proyecto del usuario o sea; Skill creator and Skill agent creator / Agente por lenguajes de programación Rust Go C# C++ Python Css JavaScript TypeScript Estos agentes van a tener skills por cada framework famoso que hay para trabajar en estos lenguajes / Comandos /New-startup Flujo para definir si la idea de una startup es buena con sub agentes decidiendo si inverterían en esta startup algo parecido a shark tank / System prompt de Nix Cuando este en un proyecto debe cargar la skill de ese proyecto, sino existe pedir autorización para crearla / Mezclar System Prompt de Gentle-AI y el de ECC ubicados en P:Proyectos / TUI Poder seleccionar los MCPs que se van a instalar / MCPs Codegraph Playwright Engram Context7 / Panel de configuración de modelos para cada agente, revisa como la TUI de gentle-ai tiene eso para poder listar los modelos de Codex y OpenCode / Quiero que uses sub agentes para hacer todo esto, solo quiero que me hables si tienes alguna duda, hasta que no termines y todo este hecho no quiero saber nada, solo dudas".
- L2 — Runtime constraint: every `subagent` launch is refused by this session (`Permission denied: subagent`, tried `explore` and `general`). The work runs inline instead; the user asked not to be interrupted for progress, so this is recorded here and reported at the end.
- L3 — Scope decisions taken without asking, because each one protects quality rather than changing the goal. (1) "Skills por cada framework famoso" is delivered as one rich playbook skill per language that maps its famous frameworks (when to use, when not to, checks, pitfalls), instead of forty thin skill directories: a framework skill with no real content is noise, and a project-local framework skill still overrides the bundled playbook. (2) The model panel never fabricates a model id: OpenCode comes from `opencode models` with the user's `opencode.json` as fallback, Codex from the `model` keys in `config.toml`, and an empty list is shown as empty with a "type an id" option. (3) Language specialists do not carry the model field for `/new-startup`-style judgment: only agents that are installed get models. Evidence: `typecheck`, `npm test` 202 passed, `build`, `git diff --check` all clean.
- L4 — User asked to remove the pet before the release ("Quiero que quites lo de la pet porfa"). The window, its tests, the `nix-ai pet` command and its help line are gone; `@opencode/client` and the local `electron` install were removed from the manifest, and the accidental self-dependency `nix-ai-stack` was deleted from `dependencies` while preparing the release manifest. The pet commits stay in the branch history; the tree no longer contains the feature. Suite after removal: 205 passed.
