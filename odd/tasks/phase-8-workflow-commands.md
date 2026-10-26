# Phase 8 — Workflow commands

Objective: Deliver one discoverable command catalog that maps `/new-feat`, `/refactor`, and `/new-idea` to Nix workflows and skills, exposes the three command surfaces explicitly, and refuses to bypass disabled SDD/TDD policy.

Branch: `codex/phase-1-tui` (preserves the existing dirty worktree).
Delivery: `ask-on-risk`; forecast approximately 900 authored lines. Test runner: `npm test`, `npm run typecheck`, and `npm run build`.

## Specs

1. **S1 — Command and skill catalog.** Roadmap: "Define a command/skill catalog and the distinction between TUI actions, CLI subcommands, and agent slash commands." The catalog is the single source for command id, slash name, purpose, supported surfaces and agents, required components, workflow mapping, and expected artifacts.
2. **S2 — Requested commands.** Roadmap: "Add the requested workflows: `/new-feat`, `/refactor`, and `/new-idea`." `/new-feat` maps to SDD, `/refactor` maps to TDD, and `/new-idea` maps to the optional `blind-judge` skill.
3. **S3 — Availability.** Roadmap: "Make command availability depend on the selected agent and installed components." Availability requires an installed agent component and the command's required workflow component to be selected and enabled.
4. **S4 — Policy enforcement.** Roadmap: "Ensure each command invokes the corresponding SDD/TDD workflow when enabled and handles disabled workflows predictably." The CLI executor refuses a disabled workflow before writing a record; slash command templates instruct the agent to stop on the same refusal.
5. **S5 — Documentation.** Roadmap: "Document command syntax, prerequisites, expected artifacts, and recovery behavior." A dedicated catalog document and the workflow guide cover all three surfaces.
6. **S6 — OpenCode slash commands.** Project-local command files are generated under `.opencode/commands/<id>.md`, carry a Nix-managed marker, and never overwrite unmanaged files.
7. **S7 — Codex behavior is explicit.** Codex custom slash prompts are deprecated and user-global, so Nix does not write them. Codex users get the CLI executor; the limitation is documented rather than silently claimed as slash support.
8. **S8 — Discovery and no silent bypass.** `workflow:commands` lists every command with CLI/slash availability and reasons. The TUI exposes a read-only discovery screen. No command starts a disabled workflow or bypasses the catalog.

## Protocol decisions

- Surfaces:
  - **TUI actions:** configure SDD/TDD, select agents/components, and discover workflow commands read-only.
  - **CLI subcommands:** authoritative execution and installation surface; `workflow:commands`, `workflow:command`, and `workflow:install-commands`.
  - **Agent slash commands:** OpenCode project commands generated from the catalog. Codex custom slash prompts are not supported and are documented as such.
- Command mappings:
  - `/new-feat` → SDD workflow.
  - `/refactor` → TDD workflow.
  - `/new-idea` → `blind-judge` skill; no SDD/TDD record and no forced workflow.
- Availability requires both `agentTargets` and matching `agent.<target>` in `selectedComponents`. Workflow commands also require the matching `workflow.<kind>` component and enabled setting.
- Slash installation writes only available commands and removes Nix-managed files for commands that become unavailable. Unmanaged files are conflicts and are never overwritten.
- The CLI executor loads the stack state itself; a direct `workflow:start` path remains available for advanced use, but the command catalog is the discoverable path.
- `/new-idea` expects an audited `JudgmentResult` JSON artifact at `.nix/ideas/<slug>.json`; it does not persist a workflow record.
- Generated OpenCode commands are Nix-managed and carry `<!-- nix-ai:workflow-command id=<id> -->`.
- Command templates do not use OpenCode shell blocks, so user-supplied `$ARGUMENTS` is not interpolated into a shell command outside the agent's permission flow.
- Codex custom prompt deprecation source: <https://developers.openai.com/codex/custom-prompts>.

## Tasks

- [x] T1 — S1-S3, inline; command catalog, availability resolver, and catalog tests. Evidence: `test/commands/workflow-command-catalog.test.ts` 5/5.
- [x] T2 — S4, S6-S8, inline; command service, OpenCode command rendering/install/remove, policy enforcement, and service tests. Evidence: `test/commands/workflow-command-service.test.ts` 7/7.
- [x] T3 — S4, S8, inline; CLI handlers and CLI tests. Evidence: `test/cli/workflow-commands.test.ts` 3/3.
- [x] T4 — S1, S8, inline; read-only TUI workflow-command discovery screen. Evidence: `src/cli/tui.ts` Workflow commands menu.
- [x] T5 — S5, S7, inline; `agents/command-catalog.md`, workflow guide, README, roadmap, and blind-judge limit update. Evidence: docs reconciled.
- [x] T6 — S1-S8, inline; full checks, risk line, and completion record. Evidence: `npm run typecheck` passed; `npm test` passed 102/102; `npm run build` passed.

## Log

- L1 (2026-10-21): "SHI" — user confirms continuation with Phase 8 after Phase 7 completion.
- L2 (2026-10-21): Design decision: one catalog is the source of truth for command id, slash name, supported agents, required components, workflow/skill mapping, and artifacts.
- L3 (2026-10-21): Design decision: OpenCode is the only slash-command target in this phase. Codex custom prompts are deprecated and user-global; Codex keeps the CLI executor and a documented limitation instead of a false slash claim.
- L4 (2026-10-21): Design decision: `/new-feat` maps to SDD, `/refactor` maps to TDD, and `/new-idea` maps to `blind-judge` without creating a workflow record.
- L5 (2026-10-21): Design decision: availability requires installed agent components; disabled or unselected workflows make the command unavailable and the CLI refuses before any record write.
- L6 (2026-10-21): Implemented `workflow-command-catalog.ts` (catalog, mappings, surface-specific availability), `workflow-command-service.ts` (execution, OpenCode rendering/install/remove, unmanaged-file protection), CLI handlers (`workflow:commands`, `workflow:command`, `workflow:install-commands`), and the read-only TUI discovery screen.
- L7 (2026-10-21): Verification: `npm run typecheck` passed; `npm test` passed 102/102; `npm run build` passed. Worktree remains intentionally dirty; no commit or push was made.
- L8 (2026-10-21): Docs: added `agents/command-catalog.md`; reconciled `agents/workflows.md`, `README.md`, `agents/README.md`, `agents/blind-judge.md`, and `docs/roadmap.md`. Codex slash prompts are documented as unsupported because upstream deprecates them and scopes them to user-level configuration.

Risk: item 3 (new public CLI commands, the command catalog contract, and generated OpenCode command-file contract). Tests cover disabled-workflow refusal before writes and unmanaged-file preservation.
