# Phase 9 — Release readiness

Objective: Prove that a new user can install, configure, diagnose, update, roll back, and remove the stack using documented and tested steps, and produce verifiable release artifacts without claiming signing support that does not exist.

Branch: `codex/phase-1-tui` (preserves the existing dirty worktree).
Delivery: `ask-on-risk`; forecast approximately 800 authored lines. Test runner: `npm test`, `npm run typecheck`, and `npm run build`.

## Specs

1. **S1 — End-to-end lifecycle.** Roadmap: "Run end-to-end tests for clean install, upgrade, interrupted install, rollback/restore, and uninstall." The suite covers a clean install, a version upgrade, a mid-write failure that must clean up partial files, a backup/uninstall/restore rollback, and a final uninstall.
2. **S2 — First-run journey.** Roadmap: "Validate a clean-machine first-run journey from `nix-ai` launch through selecting and removing a component." The automated journey uses the CLI equivalents (`doctor`, `config:init`, `component`) in an isolated project and state directory; the interactive TUI checklist is documented for a manual smoke test.
3. **S3 — Release packaging and checksums.** Roadmap: "Add release packaging, versioning, checksums/signing where appropriate, and an upgrade compatibility policy." A release manifest records the package version, compatibility contract, and SHA-256 for every built file; a verify command detects missing, modified, and extra files. Signing is explicitly not implemented because no signing key infrastructure exists.
4. **S4 — Version and compatibility policy.** The package and CLI version come from `projectMetadata`; package.json must match. Stack state schema 1 is current, `nix.config.json` is forward-compatible for unknown keys, component downgrades and same-version replacements are refused, and upgrades require a higher component version.
5. **S5 — Documentation.** Roadmap: "Update README, installation guide, component catalog, security model, and support matrix to match implemented behavior." Add an installation guide, release guide, component catalog, and support matrix; reconcile README, SECURITY.md, and the security hook model.
6. **S6 — No false support claims.** Windows is the only verified platform for v1. OpenCode and Codex are the only verified agents. Codex slash prompts remain unsupported. Checksums are integrity evidence, not authenticity or signing.
7. **S7 — Clean release check.** `npm run release:check` runs typecheck, tests, build, manifest generation, and manifest verification in that order.

## Protocol decisions

- Release artifacts are the built `dist/` tree plus `dist/release-manifest.json`; `npm pack` packaging is configured through the package `files` list but no registry publish is performed.
- The manifest is deterministic except for an optional `generatedAt` timestamp. Files are sorted and hashed with SHA-256.
- `release:manifest` scans `dist`, excludes the manifest itself, and writes the canonical path unless `--json` is used.
- `release:verify` compares the manifest against the current `dist` tree and reports `missing`, `modified`, and `extra` files; any difference sets a non-zero exit code.
- Signing is out of scope. The documentation states that checksums detect corruption and accidental drift, not malicious replacement.
- The automated first-run journey uses the CLI rather than a pseudo-TTY TUI. The manual TUI checklist remains the evidence for the interactive path.
- End-to-end lifecycle coverage uses the real `CodexSkillAdapter` with a temporary source root and custom manifests, plus the real CLI for the first-run journey.
- Interrupted installation is tested with a manifest whose second target path conflicts with the first target file, forcing a mid-write failure; the adapter must remove the partial target.
- A hard process kill can still leave an unowned directory. That is documented as manual recovery, not claimed as automatic.
- Compatibility contract: stack state schema 1, config file `nix.config.json`, Node.js >=20.11.0, Windows v1, agents OpenCode and Codex.

## Tasks

- T1 — S3, S4, S7, inline; release manifest module, CLI `release:manifest`, `release:verify`, `--version`, package scripts, and tests. **Done.** `src/core/release/release-manifest.ts`; CLI handlers; `release:manifest`, `release:verify`, and `release:check` scripts; `files` packaging list.
- T2 — S1, inline; end-to-end lifecycle tests for clean install, upgrade, interrupted install cleanup, backup/restore, and uninstall. **Done.** `test/release/release-journey.test.ts`.
- T3 — S2, inline; CLI first-run journey test with isolated project, APPDATA, doctor, config, install, backup, uninstall, and restore. **Done.** `test/cli/release-journey.test.ts`.
- T4 — S5, S6, inline; installation guide, release guide, component catalog, support matrix, README, SECURITY.md, and security hook model updates. **Done.** `docs/installation.md`, `docs/release.md`, `docs/support-matrix.md`, `agents/component-catalog.md`, and reconciled README/SECURITY/security-hooks.
- T5 — S5, inline; roadmap completion record and feature document closure. **Done.** Phase 9 checked in `docs/roadmap.md`.
- T6 — S1-S7, inline; full checks, release check, risk line, and completion record. **Done.** `npm run release:check` passes; see log.

## Log

- L1 (2026-10-21): "shi" — user confirms continuation with Phase 9 after Phase 8 completion.
- L2 (2026-10-21): Design decision: release integrity uses a SHA-256 manifest and a verify command; digital signing is documented as not implemented rather than simulated.
- L3 (2026-10-21): Design decision: first-run automation exercises the CLI path in an isolated project and APPDATA; the TUI journey is a documented manual smoke test because it requires an interactive terminal.
- L4 (2026-10-21): Design decision: component lifecycle tests use the real adapter with custom temporary manifests so upgrade and interrupted-write behavior are exercised without changing the built-in catalog.
- L5 (2026-10-21): Verification evidence: targeted RED tests failed because the release module and CLI commands did not exist; after implementation, 10/10 targeted tests passed. Full `npm run release:check` passed with 112/112 tests, clean typecheck, successful build, a 144-file SHA-256 manifest, and `Release manifest verified.` The first intermediate failure was an uppercase/lowercase path sort mismatch; deterministic codepoint ordering fixed it.
- L6 (2026-10-21): Documentation evidence: added `docs/installation.md`, `docs/release.md`, `docs/support-matrix.md`, and `agents/component-catalog.md`; reconciled `README.md`, `SECURITY.md`, `agents/security-hooks.md`, `agents/README.md`, and `docs/roadmap.md`. The docs explicitly state Windows v1, OpenCode/Codex only, no signing, and no automatic recovery after a hard kill.
- L7 (2026-10-21): Phase 9 complete. S1-S7 satisfied. No commits, pushes, or reviews were performed; the pre-existing dirty worktree is intentionally preserved.

Risk: item 5 (release packaging, scripts, and manifest are delivery/environment changes).
