# AI Stack Expansion — Feature Specification

Objective: Build the next Nix AI-stack roadmap for reusable specialist agents, skills, commands, and a separately researched hook roadmap.
Branch: `codex/ai-stack-expansion` | Delivery strategy: `ask-on-risk` | Chain strategy: `feature-branch-chain` (user chose “feature per branch”) | Test runner: `npm test`, `npm run typecheck`

## Specs

### S1 — Separate roadmap

The new work belongs to a new roadmap, not another phase of the completed roadmap. The user clarified: “Epa mala mia esto no seria la phase2 es un nuevo roadmap, el roadmap que habiamos empezado ya lo termine :D, entonces me gusta lo que propones, quiero eso”.

Acceptance:
- Add a new roadmap document that does not rewrite or reopen `docs/roadmap.md`.
- Sequence the approved stack-enrichment work into clear deliverables with acceptance checks and dependencies.
- Keep hook improvements as a separate evidence-gathering workstream; do not imply unsupported hook events or weaken existing safeguards.

Checks: Structural readback of the roadmap, its links, task IDs, and old-roadmap status.

### S2 — Araxys specialist boundary

The user's exact requirement: “agrega al mapeo de las nuevas cosas a crear un agente especializado en usar mi libreria P:\Proyectos\Araxys este agente es experto en usarla, no en hacerle cambios, get it?”

Acceptance:
- Provide an Araxys specialist for integrating and using Araxys from consuming FastAPI applications.
- It may read Araxys' public docs, exported API, examples, and tests as reference.
- It must not edit, commit, or create files in the Araxys repository. Report suspected Araxys defects or missing capabilities to the user instead.
- Verify the installed Araxys version and public exports before recommending APIs; do not assume README claims match the consuming project's installed version.

Checks: Skill/agent contract assertions; consumer-only scope and a negative boundary check in documentation/tests.

### S3 — Specialist-agent foundation

Create a Nix-managed, global specialist-agent catalog and lifecycle for the supported OpenCode and Codex targets, using their native user-level agent formats. Treat this as a new stack capability, not a documentation-only list. Preserve unmanaged files and make preview the safe path before global writes.

Assumption: The new specialists are globally available through Nix for both currently supported agent targets; project-specific assets remain the responsibility of `/new-project`.

Acceptance:
- Catalog entries expose stable IDs, purpose, supported agents, source/ownership, and native targets.
- Preview/status/install/update/remove are truthful and do not overwrite or remove unowned files.
- Update is allowed only for targets whose Nix ownership record and installed hash both validate; preserve a recoverable copy before replacement.
- Tests prove target paths, content ownership, and preservation of unrelated agent files.

Risk: item 5 — this introduces a global installer and agent configuration lifecycle.

### S4 — Araxys integration specialist, skill, and command

Create the Araxys usage specialist, a narrow reusable `araxys-integration` skill, and an `/araxys` command that routes API-consumer work through the skill. Use only public/version-matched Araxys interfaces and operate only on the consuming application.

Acceptance:
- Both supported agent targets can discover the specialist and skill through the Nix-managed global catalog.
- `/araxys` is additive, appears in the shared command catalog, and requests the intended task/context without starting an unrelated SDD/TDD workflow.
- No artifact or command grants permission to modify the Araxys library repository.

Risk: item 5 — installation writes global agent-facing files.

### S5 — Python/FastAPI specialist and skill

Create a narrowly scoped Python/FastAPI specialist and matching `python-fastapi` skill focused on uv, async APIs, validation, and pytest conventions. Keep it distinct from Araxys-specific integration guidance.

Acceptance:
- Role boundaries avoid duplicating the Araxys specialist or the general orchestrator.
- Both supported agent targets can discover the role and skill through the Nix-managed catalog.
- Add contract and lifecycle tests appropriate to the agent/skill catalogs.

Risk: item 5 — installation writes global agent-facing files.

### S6 — MCP-authoring skill

Create a composable `mcp-authoring` skill for Nix's recurring MCP server work: tool contracts, input validation, read/write boundaries, errors, configuration adapters, and tests.

Acceptance:
- The skill follows `agents/skill-style-guide.md`, is registered, and links only to local references.
- It complements rather than duplicates `security-audit` and `mcp-safety` reviewer guidance.

Checks: Required frontmatter/section validation, registry refresh, and focused skill tests if registration is code-backed.

### S7 — Security Audit command

Add `/security-audit` to the shared command catalog so OpenCode and Codex can invoke the existing Cloudflare Security Audit skill with explicit project scope and coverage-first instructions.

Acceptance:
- Command is additive, available for both supported agents, and does not copy the full upstream skill into the prompt.
- Command docs/help, installation, and removal remain generated from the shared catalog and preserve unmanaged files.

Risk: item 5 — command installation writes global agent-facing files.

### S8 — Hook capabilities research

Map supported native lifecycle/security hook events for OpenCode and Codex and identify the next useful, testable hook enhancement. Do not implement new enforcement or claim broad protection until the event contract, platform scope, and false-positive behavior are verified.

Acceptance:
- Document native source references, event/payload compatibility, failure semantics, and a small proposed next behavior.
- Preserve current opt-in, project-local, advisory security-hook model and explicitly state that it is not a sandbox.
- Any enforcement change remains a future separately scoped task with its own tests and risk assessment.

Checks: Primary documentation/source verification and structural review only.

## Tasks

| ID | Specs | Route | Status | Commit |
|----|-------|-------|--------|--------|
| T1 | S1 | Inline | Done — structural readback and `git diff --check` pass | `c8a9233` |
| T2 | S3 | Inline | Done — native OpenCode/Codex formats, ownership/hash safety, preview/status/install/update/remove, recovery backup; independent verification and checks pass | `4e82d74` |
| T3 | S2, S4 | Inline | Done — consumer-only Araxys role/skill/command; bundled-skill source installs without network; checks pass | `4e82d74` |
| T4 | S5 | Inline | Done — distinct Python/FastAPI specialist and skill registered | `4e82d74` |
| T5 | S6 | Inline | Done — MCP-authoring skill registered with local references | `4e82d74` |
| T6 | S7 | Inline | Done — coverage-first `/security-audit` command invokes installed skill | `4e82d74` |
| T7 | S8 | Inline | Done — official event/payload/failure findings and bounded follow-up documented; no enforcement changed | `c8a9233` |

## Log

- L1 — User request: “Epa mala mia esto no seria la phase2 es un nuevo roadmap, el roadmap que habiamos empezado ya lo termine :D, entonces me gusta lo que propones, quiero eso”.
- L2 — User's Araxys constraint: “agrega al mapeo de las nuevas cosas a crear un agente especializado en usar mi libreria P:\Proyectos\Araxys este agente es experto en usarla, no en hacerle cambios, get it?”
- L3 — User selected this session's subagent model: “Nop, siempre que llames un sub agente en esta sesion usa 6 luna medio porfa”. The architecture explorer used `gpt-6-luna` with medium reasoning.
- L4 — Existing `docs/roadmap.md` marks the previous delivery sequence complete; keep it intact. Existing security hooks are opt-in and project-local, targeting a narrow set of Windows shell and SQL operations.
- L5 — Araxys consumer reference inspected: its `AI.md`, README, examples, and public exports center on `AraxysShield` and `AraxysConfig`. The future specialist is restricted to consumer applications.
- L6 — Native agent targets verified from official docs: Codex personal agents use `~/.codex/agents/*.toml`; OpenCode global agents use `~/.config/opencode/agents/*.md`. Keep exact native formats and permission semantics in their adapters.
- L7 — Forecast exceeds 400 authored lines across the roadmap and implementation work. Delivery strategy remains `ask-on-risk`; resolve a chain strategy before the first over-budget commit. No PR or push is authorized by this request.
- L8 — Created `docs/roadmap-ai-stack-expansion.md` and six scoped briefs under `docs/issues/`. The work briefs sequence the previously approved proposal; Araxys remains consumer-only, and hook work is research-only.
- L9 — T1 complete: structural checks confirm the new roadmap, all six linked briefs, and the task document exist; `git diff --check` passes.

- L10 — T2 implementation adds a global specialist-agent lifecycle with OpenCode Markdown and Codex TOML adapters, managed ownership/hash state, guarded updates/removals, and agent:* CLI commands. Windows rename-over-existing proved unreliable in the test environment, so the implementation uses guarded writes and an explicit pre-update recovery copy. Full npm test (119 passed, 1 skipped) and npm run typecheck pass. Independent verification found no blockers; existing skill:list and mcp:list outputs match the baseline. Risk: item 5 (global agent configuration lifecycle).
- L11 — T3 adds a consumer-only Araxys specialist, a reusable skill, `/araxys`, and a truthful bundled skill source for Nix-packaged assets. The consumer's Araxys source reports version 0.14.0; the role still requires each consuming project to verify its own installed version and public exports.
- L12 — T4 and T5 add Python/FastAPI and MCP-authoring skills and specialist role guidance; both are registered in AGENTS.md and the generated skill registry, and Python/FastAPI is also available in the bundled global skill catalog for both agents.
- L13 — T6 adds `/security-audit` to the shared command catalog and routes to the existing installed skill, with explicit project scope and coverage-first guidance rather than copying the upstream prompt.
- L14 — T7 verifies Codex lifecycle payload and failure constraints, OpenCode V1/V2 plugin and hook surfaces, and keeps existing Nix safeguards unchanged. A separate candidate follow-up protects only catastrophic PowerShell content truncation targets; no enforcement was added.
- L15 — Feature implementation and final independent verification are complete on `codex/ai-stack-expansion`; 125 tests pass, 1 is skipped, typecheck and build pass, and baseline `doctor`, `mcp:list`, and `/new-project` output match. Global RDD is off. The verifier could not run commands in its scratch copy because the sandbox denied the `node_modules` junction; checks passed on the actual candidate. It also could not inspect Araxys git status because access was denied; no Araxys writes were attempted. No push or PR is authorized.
- L16 — The verifier found that the generated registry omitted `mcp-authoring`; `gentle-ai skill-registry refresh --cwd . --force` was rerun and now indexes 16 skills, including `araxys-integration`, `mcp-authoring`, and `python-fastapi`. The generated registry is ignored by Git; its full current contents are mirrored in Engram under `skill-registry`.
- L17 — The authored-change forecast exceeds 400 lines. Before the first work-unit commit, the user selected “feature per branch”, mapped to the `feature-branch-chain` strategy. Work-unit commits will stay on this feature branch; no PR or push is authorized.
- L18 — User's delivery choice: “feature per branch”.
- L19 — Delivery choice was applied without remote operations: created local work-unit commits `c8a9233` (roadmap and scoped briefs) and `4e82d74` (global specialists, skills, commands, and tests). Final verification on the committed candidate: `npm test` (125 passed, 1 skipped, 0 failed), `npm run typecheck`, `npm run build`, and `git diff --check` passed. Risk: item 5 (global agent/skill/command installation and configuration lifecycle).
