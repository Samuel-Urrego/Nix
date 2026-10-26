# Phase 4 — Optional SDD and TDD workflows

Objective: Deliver independently configurable, persisted, observable, and resumable SDD and TDD workflows with a typed engine, CLI commands, and TUI settings, before adding any agent-specific prompts or hooks.
Branch: `codex/phase-1-tui` (preserves the existing dirty worktree; no commits that capture unrelated phase work).
Delivery: `ask-on-risk`; forecast approximately 550 authored lines. Test runner: `npm test`, `npm run typecheck`, and `npm run build`.

## Specs

1. **S1 — Independent settings.** Roadmap: "Define independent TUI settings for enabling SDD and TDD." Each workflow is toggled independently in the TUI and persisted as an explicit boolean. Enabling SDD must not enable TDD, and disabling one must not disable the other.
2. **S2 — Contracts before agent specifics.** Roadmap: "Define workflow contracts and persisted settings before adding agent-specific prompts or hooks." Add typed workflow contracts (kind, steps, record, status), persisted stack settings, and a project-local artifact format. Do not add agent prompts or hooks in this phase.
3. **S3 — SDD flow.** Roadmap: "Add SDD flow: idea intake, clarification, specification, task breakdown, implementation handoff, and verification record." A started SDD workflow records those six steps in order, advances only with evidence, and completes after the verification record.
4. **S4 — TDD flow.** Roadmap: "Add TDD flow: identify a runnable test, observe RED, implement GREEN, refactor, and report proof or explain when meaningful RED is unavailable." A started TDD workflow records those five steps in order, requires proof for GREEN and the final report, and permits skipping RED only with an explicit reason that is persisted.
5. **S5 — Recovery and resume.** Roadmap: "Add recovery/resume behavior for interrupted workflows." Active workflow records persist on disk; status and resume report the current step and the exact next action after a process restart.
6. **S6 — State coverage.** Roadmap: "Test enabled, disabled, and partially configured states for each workflow." Tests cover enabled/disabled/partially configured SDD and TDD, persisted round-trips, migration from state without workflow settings, and CLI behavior.

## Tasks

- T1 — S1-S2, inline; **complete**. `WorkflowSettings` and typed contracts in `src/core/workflows/workflow-contracts.ts`; optional `workflows` in stack state with migration from `selectedComponents`. Focused state tests pass, including independent round-trip and older-state derivation.
- T2 — S3-S5, inline; **complete**. `workflow-engine.ts` and `workflow-store.ts` implement ordered steps, evidence-gated advancement, TDD RED skip with persisted reason, completion, and project-local `.nix/workflows/<id>.json` records. Focused engine/store tests pass 13/13 including traversal rejection and schema validation.
- T3 — S3-S6, inline; **complete**. CLI adds `workflow:configure`, `workflow:status`, `workflow:start`, `workflow:advance`, `workflow:skip`, and `workflow:resume`; end-to-end tests cover disabled refusal, independent settings, evidence enforcement, restart resume, TDD RED skip, and `--yes` confirmation.
- T4 — S1, inline; **complete**. The TUI Workflows category toggles SDD and TDD independently, shows `enabled: yes/no`, and persists explicit `workflows` booleans when preferences are saved.
- T5 — S1-S6, inline; **complete**. Added `agents/workflows.md`, linked it from `agents/README.md` and `README.md`, corrected status text, and reconciled the roadmap. Full typecheck, 51/51 tests, and build pass.

## Log

- L1 (2026-10-20): "brother en la carpetas /docs tienes todas las features pendientes divididas en fases, quiero que analices en cual vamos y empieces cada fase, cada que termines una fase por completo me avisas"
- L2 (2026-10-20): "shi" — user authorizes starting Phase 4 after Phase 3 closed.
- L3 (2026-10-20): Design decision: workflow settings live in the existing stack state as optional `workflows` booleans so older state files stay valid; workflow records live project-locally under `.nix/workflows/` so an interrupted run survives a process restart. No agent prompts or hooks are added in this phase.
- L4 (2026-10-20): RED observed: engine/store tests failed with `ERR_MODULE_NOT_FOUND` before implementation. Engine/store tests then passed 13/13; existing stack-state tests were updated for the additive `workflows` field and two migration/independence cases were added.
- L5 (2026-10-20): RED observed for CLI tests before handlers existed; after implementation the three end-to-end workflow CLI tests pass. `workflow:configure` requires `--yes`, keeps `selectedComponents` in sync with the explicit settings, and enables each workflow independently.
- L6 (2026-10-20): TDD RED skip stores `reason` and `status: "skipped"`; every other step requires non-empty evidence. Records are validated for step order, schema version, status consistency, and safe ids. Workflow ids are UUIDs and file paths reject traversal.
- L7 (2026-10-20): Final checks: `npm run typecheck` passed, `npm test` passed 51/51, `npm run build` passed. No commit created so unrelated dirty phase work is not captured.

Risk: item 1 (adds persisted workflow settings to user state and project-local workflow records that must remain readable after upgrade).
