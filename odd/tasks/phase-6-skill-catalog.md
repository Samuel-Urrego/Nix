# Phase 6 — Stack-aware skill catalog and requested skills

Objective: Deliver a maintained, stack-aware skill catalog with six confirmed upstream skills, reproducible pinned installation for OpenCode and Codex, compatibility and duplicate protection, TUI visibility/selection, and a project skill-authoring path.
Branch: `codex/phase-1-tui` (preserves the existing dirty worktree).
Delivery: `ask-on-risk`; forecast approximately 900 authored lines. Test runner: `npm test`, `npm run typecheck`, and `npm run build`.

## Specs

1. **S1 — Stack audit and compatibility matrix.** Roadmap: "Audit existing project skills and map candidates to the user's actual technology stack; keep the result as a maintained compatibility matrix rather than relying on automatic repository scanning." The matrix is derived from `agents/stack-inventory.md` and maintained in `agents/skill-compatibility.md`.
2. **S2 — Catalog metadata.** Roadmap: "Define skill source, license, version, dependencies, compatible agents, install location, and update policy in a catalog." Every entry declares a pinned git source, license, version, dependencies, compatible agents, per-agent install paths, and an explicit pinned update policy.
3. **S3 — Requested skills.** Roadmap: "Review and package the requested skills: Brag for Hyperframes (including verified dependencies), Grafana k6, Cloudflare Security Audit, Emil Kowalski, Taste, and Accessibility." Catalog ids: `brag`, `grafana-k6`, `security-audit`, `emil-design-eng`, `design-taste-frontend`, `accessibility`.
4. **S4 — Confirmed provenance.** Roadmap: "Confirm the exact upstream source and intended meaning for each named skill before importing it." Each entry records the upstream repository, the exact commit SHA, the skill path, and the license verified at that ref.
5. **S5 — TUI and install safety.** Roadmap: "Let the TUI show skill descriptions and dependencies, support selection, and prevent incompatible or duplicate installs." The TUI lists description, dependencies, and per-agent state; an incompatible agent is refused; an unowned same-id target is a conflict; a modified managed target is refused until explicit update/remove policy applies.
6. **S6 — Authoring path.** Roadmap: "Add a project skill-authoring path that follows the repository's skill style guide." `skill:new` scaffolds `skills/<id>/SKILL.md` plus `references/` and `assets/` using the normative structure from `agents/skill-style-guide.md`.
7. **S7 — Reproducible install.** Installation fetches the pinned source, writes only the selected agent target, records file hashes in `.nix/skills/managed.json`, supports update and removal, and leaves unrelated files untouched.

## Catalog decisions

| Id | Upstream | Pinned ref | Path | License | Version |
|----|----------|------------|------|---------|---------|
| `brag` | `latent-spaces/brag` | `069432cac935ed1895859df201c31436c07fb74e` | `skills/brag` | MIT | `0.4.0` |
| `grafana-k6` | `grafana/skills` | `cc33318b60a7fbc2c69a25122164baf00e805f79` | `skills/grafana-k6/k6` | Apache-2.0 | `main@cc33318` |
| `security-audit` | `cloudflare/security-audit-skill` | `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8` | `skills/security-audit` | MIT | `main@c1c8a8c` |
| `emil-design-eng` | `emilkowalski/skills` | `2d228630ba1446365f614a108cb8252f1feda202` | `skills/emil-design-eng` | MIT | `main@2d22863` |
| `design-taste-frontend` | `Leonxlnx/taste-skill` | `6010f91a9935f1c167dfc500fb1a475681892e6b` | `skills/taste-skill` | MIT | `2.0.0-experimental` |
| `accessibility` | `addyosmani/web-quality-skills` | `afa8da942115f2961fdbfa80807ea0b232ff6c00` | `skills/accessibility` | MIT | `2.0` |

- Install locations: OpenCode `.opencode/skills/<id>/`; Codex `.agents/skills/<id>/`.
- `security-audit` is OpenCode-only because it requires parallel sub-agents.
- Installation fetches from the pinned commit with `git fetch --depth 1`; tests inject a local fetcher.
- `--source=<dir>` is an explicit authoring/development override that bypasses the pinned fetch; preview discloses it.
- Update policy is `pinned`: the catalog ref only changes through a reviewed code change.

## Tasks

- [x] T1 — S1-S4, inline; catalog contracts, six entries, compatibility matrix, and catalog tests. Evidence: `test/skills/skill-catalog.test.ts` 3/3.
- [x] T2 — S7, inline; ownership manifest, safe tree read/write/remove, default git fetcher, injected fetcher, and installer tests. Evidence: `test/skills/skill-installer.test.ts` 7/7.
- [x] T3 — S5, inline; CLI preview/install/update/remove/status with compatibility and duplicate protection, plus end-to-end tests. Evidence: `test/cli/skill-command.test.ts` 3/3.
- [x] T4 — S5, inline; TUI skill list with description, dependencies, status, and install/remove selection. Evidence: `src/cli/tui.ts`; typecheck clean.
- [x] T5 — S6, inline; `skill:new` scaffold and authoring docs. Evidence: `test/skills/skill-authoring.test.ts` 2/2.
- [x] T6 — S1-S7, inline; README/roadmap reconciliation, full checks, risk line. Evidence below.

## Log

- L1 (2026-10-20): "brother en la carpetas /docs tienes todas las features pendientes divididas en fases, quiero que analices en cual vamos y empieces cada fase, cada que termines una fase por completo me avisas"
- L2 (2026-10-20): "shi" — user authorizes starting Phase 6 after Phase 5 closed.
- L3 (2026-10-20): Verified upstream sources and licenses: Brag `latent-spaces/brag` MIT 0.4.0; Grafana k6 `grafana/skills` Apache-2.0; Cloudflare security audit MIT; Emil Kowalski `emilkowalski/skills` MIT; Taste `Leonxlnx/taste-skill` MIT; Accessibility `addyosmani/web-quality-skills` MIT 2.0. All six `SKILL.md` paths returned HTTP 200 at the pinned commits.
- L4 (2026-10-20): Design decision: do not vendor third-party skill trees. Fetch the exact pinned commit at install time, copy the selected skill directory plus the repository `LICENSE`/`NOTICE` when present, and record file hashes for ownership. This keeps provenance reviewable and avoids a stale in-repo copy.
- L5 (2026-10-20): Design decision: `security-audit` is OpenCode-only because its upstream requirements name parallel sub-agents; the other five support OpenCode and Codex.
- L6 (2026-10-20): Implemented `skill-contracts.ts`, `skill-catalog.ts`, `skill-installer.ts`, and `skill-authoring.ts`; added CLI `skill:list|status|preview|install|update|remove|new` and a TUI project-skill menu. Installer writes `.nix/skills/managed.json`, rejects unowned same-id targets, refuses modified removal, and restores modified managed content only through explicit update.
- L7 (2026-10-20): RED observed for catalog, installer, authoring, and CLI tests before implementation; GREEN reached with 12 unit tests and 3 CLI tests.
- L8 (2026-10-20): Documentation reconciled: `agents/skill-catalog.md`, `agents/skill-compatibility.md`, `agents/skill-authoring.md`, `agents/README.md`, `skills/README.md`, `README.md`, and Phase 6 checkboxes/exit condition in `docs/roadmap.md`.
- L9 (2026-10-20): Verification: `npm run typecheck` passed; `npm test` passed 80/80; `npm run build` passed. CLI smoke checks passed for `skill:list`, `skill:preview`, `skill:status`, and `skill:new` in an isolated temporary root.
- L10 (2026-10-20): Real pinned fetch validated against GitHub: `skill:install --id=emil-design-eng --agent=codex` installed `SKILL.md` and `LICENSE` from commit `2d228630ba1446365f614a108cb8252f1feda202`; status reported `current`; `skill:remove` removed only the managed target. No repository files were installed during the smoke check.
- L11 (2026-10-20): No commit created. The worktree remains intentionally dirty with accumulated phase work.
- Risk: item 3 (new public `skill:*` CLI/catalog contract others consume), item 5 (installer fetches network sources and writes project agent skill directories).
