# Phase 2 — Codex project-local skill lifecycle
Objective: Define reusable component lifecycle contracts and ship the first Windows/Codex component as a project-local Nix Core skill.
Branch: `codex/phase-1-tui` (preserve the existing dirty worktree; do not commit unrelated Phase 0/1 changes).
Delivery: ask-on-risk; forecast approximately 450 authored lines. Test runner: npm test, npm run typecheck, and npm run build.

## Specs
1. **S1 — Component and adapter contracts.** Roadmap: "Define contracts for component manifests, installers, agent adapters, and managed configuration ownership." Model a Nix-authored `skill.nix-core` component with source/provenance, version, Apache-2.0 license, supported target (`codex`), relative file artifacts, and a Codex/Windows adapter. Keep catalog/manifest policy separate from filesystem-specific adapter code.
2. **S2 — Codex project-local install target.** User choice: "Arranca por codex" and confirmation: "shi". The first component is a Nix Core skill, installed only at `<project>/.agents/skills/nix-core/SKILL.md`, which is a Codex-supported project skill root. Do not modify global Codex settings or files. The skill is authored by Nix, licensed Apache-2.0 as explicitly chosen by the user, and must not copy upstream prompts or third-party assets. Register the source skill in root `AGENTS.md` and the generated skill registry.
3. **S3 — Safe lifecycle and ownership.** Roadmap: "Support install, update, uninstall, backup/restore, and dry-run/preview through the same component lifecycle." A fresh install must refuse a conflicting unowned destination. Update/uninstall may act only on the exact Nix-owned destination whose ownership record and file digests validate; preserve backups before replacing/removing. Restore only a valid Nix-created backup and refuse to overwrite any existing destination. Reject path traversal and symlinks. Repeated install/update is idempotent, and preview is read-only.
4. **S4 — User-data preservation.** Roadmap: "Make repeated installs safe and ensure uninstall removes only Nix-owned files or entries." Preserve unrelated `.agents` content, existing `AGENTS.md`, Codex config, and all files outside the selected Nix skill target; abort safely on unowned conflicts or locally modified managed content. Tests use isolated temporary project roots.
5. **S5 — User workflow.** Add discoverable CLI lifecycle commands/help and an explicit TUI path to preview and confirm installation of the selected Nix Core skill for the current project. Display outcomes/errors clearly. No global configuration scope is offered in this phase.
6. **S6 — Integration proof.** Roadmap: "Add integration tests using temporary home/config directories and pre-existing user settings." Exercise preview, fresh install, repeat install, update/backup, restore, uninstall, user-file preservation, ownership conflicts, malformed markers, and traversal/symlink refusal via public entry points where practical.

## Tasks
- T1 — S1-S2, inline, complete; catalog contract and Apache-2.0 Nix Core skill verified by npx tsx --test test/components/catalog.test.ts (2/2) and npm run typecheck; no commit.
- T2 — S3-S4, inline, complete, no commit; lifecycle tests 7/7 passed (one symlink case skipped because Windows denied symlink creation), npm run typecheck and npm run build passed. Empty backup inventory is an empty array; locally modified owned files remain protected.
- T3 — S5, inline, complete, no commit; component CLI exposes preview/install/update/backup/list-backups/restore/uninstall, mutations require --yes, help documents the boundary, and the TUI previews then explicitly confirms project-local install/update.
- T4 — S6, inline, complete; independent verifier passed all S1-S6 in a fresh scratch copy. npm test 15 passed/0 skipped, npm run typecheck, npm run build, CLI integration (2/2), and documented help command passed.

## Log
- L1 (2026-10-20): "Continua con la siguiente fase y por favor crea el proyecto en engram para que anotes las cosas ahí tambien"
- L2 (2026-10-20): "Arranca por codex"
- L3 (2026-10-20): "shi"
- L4 (2026-10-20): User confirmed the first installable component should be a Nix base skill for Codex, installed project-locally under .agents/skills; no global Codex configuration writes.
- L5 (2026-10-20): Phase 2 is high-risk because it creates, updates, backs up, restores, and removes files in a project agent-skill directory. Existing Phase 0/1 work is dirty; preserve it and do not commit unrelated changes.
- L6 (2026-10-20): "Apache-2.0 baby"
- L7 (2026-10-20): Nix Core skill metadata/provenance uses Apache-2.0 per user decision; repository root remains MIT.
- L8 (2026-10-20): Added component catalog, source skill, AGENTS registration, and generated skill registry; T1 passed.
- L9 (2026-10-20): Implemented Codex project-local lifecycle with ownership digests, backups, restore validation, conflict/traversal/symlink refusal, and user-file preservation. Adapter tests 7/7 passed; one symlink test skipped because Windows denied creation; typecheck/build passed.
- L10 (2026-10-20): Added CLI lifecycle actions, explicit --yes confirmation, TUI preview/confirmation, help text, README usage, and roadmap updates. Local suite passed 14 with one Windows symlink skip. Independent verification in scratch passed 15 tests with no skips, typecheck/build, CLI integration (2/2), and S1-S6. Non-blocking note: --help displays help but exits as unknown; documented nix-ai help works.
- L11 (2026-10-20): User instructed: "dale cierra la fase 2". Independent verification completed without blockers. Scratch: C:\Users\surre\AppData\Local\Temp\nix-phase2-verify-48ea65442cd44bc2b5674624801aad98.

Risk: item 1 (installed project files are persistent user data), item 3 (Codex skill discovery is a consumer-facing contract), item 5 (installer changes the project environment).
