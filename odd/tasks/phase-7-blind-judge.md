# Phase 7 — Blind-judge idea evaluation skill

Objective: Deliver a deterministic, auditable blind-judge workflow that isolates pro and con groups, gives five neutral evaluators the same evidence bundle without cross-contamination, and synthesizes a bounded verdict with explicit uncertainty.
Branch: `codex/phase-1-tui` (preserves the existing dirty worktree).
Delivery: `ask-on-risk`; forecast approximately 650 authored lines. Test runner: `npm test`, `npm run typecheck`, and `npm run build`.

## Specs

1. **S1 — Protocol and schema.** Roadmap: "Specify the judgment protocol, roles, input/output schema, and what counts as evidence." The protocol defines idea, evidence item kinds, pro/con assessments, neutral votes, synthesis, and audit records.
2. **S2 — Isolated pro/con groups.** Roadmap: "Run separate pro and con judge groups without exposing one group's arguments or identities to the other." The engine constructs separate frozen contexts and never passes one group's output or identities into the other group's context.
3. **S3 — Five neutral evaluators.** Roadmap: "Give each of five neutral evaluators the same evidence bundle while isolating their independent assessments from one another." Exactly five neutral executors receive the same normalized evidence and no pro/con arguments; votes are collected independently.
4. **S4 — Bounded synthesis.** Roadmap: "Have the orchestrator synthesize the five votes, disagreements, and evidence into a bounded verdict with uncertainty clearly stated." The synthesis reports verdict, confidence, agreement, quorum, disagreements, evidence references, strongest pro/con arguments, conditions, and limitations.
5. **S5 — Edge cases.** Roadmap: "Test context isolation, missing/invalid votes, ties, correlated reasoning risks, and repeatability." Tests cover every named case plus input and output validation.
6. **S6 — Optional skill and limits.** Roadmap: "Expose the workflow as an optional skill and document that it supports decisions rather than guaranteeing correctness." The project skill `blind-judge` and `agents/blind-judge.md` state the limits explicitly.
7. **S7 — Auditability.** The result records input/evidence hashes, missing and invalid assessments, correlated-risk signals, and the models used by neutral evaluators.

## Protocol decisions

- Evidence kinds: `fact`, `observation`, `constraint`, `assumption`, and `testimony`. Every item requires an `id`, `claim`, `source`, and valid kind. Assumptions must be labeled as assumptions.
- Pro and con contexts contain only the idea, evidence, their role instruction, and their own judge id. They never receive the other group's arguments, identities, or outputs.
- Neutral contexts contain only the idea, evidence, role instruction, and their own judge id. They never receive pro or con arguments before voting.
- Exactly five neutral evaluators are required. Pro and con groups require at least one executor each; the documented default is three per group.
- Quorum is three valid neutral votes. A verdict requires a strict majority of valid votes: `floor(valid / 2) + 1`. Otherwise the result is `defer`.
- Missing or thrown executors are recorded as `missing`; schema-invalid outputs are recorded as `invalid`. They are never repaired or replaced. Any missing or invalid assessment makes the result `partial`.
- Correlated-reasoning signals: shared explicit model across neutral evaluators, duplicate normalized rationales, and single-evidence dependence.
- Synthesis is deterministic for the same normalized input and executor outputs; the clock is injectable for repeatability tests.
- The workflow supports decisions; it does not guarantee correctness.

## Tasks

- [x] T1 — S1, inline; judgment contracts and strict input/output validators. Evidence: `src/core/judgment/judgment-contracts.ts`.
- [x] T2 — S2-S3, inline; isolated context construction and concurrent executor runs. Evidence: `src/core/judgment/judgment-engine.ts`.
- [x] T3 — S4-S5, S7, inline; synthesis, quorum, ties, correlated risks, missing/invalid audit. Evidence: engine synthesis and audit records.
- [x] T4 — S5, inline; engine tests for isolation, majority, tie, missing/invalid, correlated risks, repeatability, and validation. Evidence: `test/judgment/judgment-engine.test.ts` 7/7.
- [x] T5 — S6, inline; `skills/blind-judge/SKILL.md` and `agents/blind-judge.md`.
- [x] T6 — S1-S7, inline; README/AGENTS/roadmap reconciliation, full checks, risk line. Evidence below.

## Log

- L1 (2026-10-21): "Buenos dias, podemos continuar con el roadmap" — user authorizes starting Phase 7 after Phase 6 closed.
- L2 (2026-10-21): Design decision: enforce isolation in runtime context construction, not only in prompt wording. Neutral evaluators see only the idea and evidence; pro/con outputs are recorded after voting and never influence neutral votes.
- L3 (2026-10-21): Design decision: exactly five neutral evaluators, quorum of three, strict majority for adopt/reject, otherwise defer. Missing/invalid votes reduce confidence and may force defer.
- L4 (2026-10-21): RED observed for the engine test suite before implementation (`ERR_MODULE_NOT_FOUND`); GREEN reached with 7/7 tests covering isolation, majority, tie, missing/invalid votes, correlated risks, repeatability, and validation.
- L5 (2026-10-21): Implemented `judgment-contracts.ts` and `judgment-engine.ts` with frozen per-judge contexts, concurrent group execution, strict schema validation, quorum/majority synthesis, confidence penalties, input/evidence hashes, and correlated-risk detection.
- L6 (2026-10-21): Added optional project skill `skills/blind-judge/SKILL.md`, protocol document `agents/blind-judge.md`, and refreshed `.atl/skill-registry.md` to index the skill.
- L7 (2026-10-21): Documentation reconciled: `AGENTS.md`, `agents/README.md`, `agents/skill-agent-matrix.md`, `README.md`, and Phase 7 checkboxes/exit condition in `docs/roadmap.md`.
- L8 (2026-10-21): Verification: `npm run typecheck` passed; `npm test` passed 87/87; `npm run build` passed. No CLI command was added; Phase 8 owns the workflow command catalog.
- L9 (2026-10-21): No commit created. The worktree remains intentionally dirty with accumulated phase work.
- Risk: item 3 (new public `JudgmentResult`/engine contract and optional skill others consume), item 4 (concurrent executor orchestration and isolation ordering), item 6 (a regression in isolation or synthesis could silently produce a misleading verdict; tests now cover the named cases).
