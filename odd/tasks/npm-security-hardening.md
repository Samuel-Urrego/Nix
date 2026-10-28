# Nix AI-STACK npm Security Hardening

Objective: Harden the AI-STACK's npm publication and consumer-facing execution paths, then prepare a verifiable release for user installation and TUI feedback.
Branch: `codex/npm-security-hardening`; delivery: `ask-on-risk`; forecast: approximately 350 authored lines. Test runner: `npm test`, `npm run typecheck`, `npm run build`, `npm run release:check`, plus isolated packed-package install verification.

## Specs

1. **S1 — Security hardening.** User request: “quiero que blindemos de segurida el AI-STACK ya que vamos a hacer que se instale desde npm, so todo este año se han descubierto muchas maneras de vulnerar paquetas de node”. Audit the npm distribution and executable trust boundaries, make concrete in-scope improvements, and add regression tests for each behavior changed. Do not claim the package is invulnerable; document remaining limits.
2. **S2 — Release and install proof.** User request: “saca la release y me avises para hacer la prueba de que se esta instalando todo correctamente”. Prepare a release whose package/version/lock metadata agree, whose tarball contents and consumer installation are verified in isolated state, and whose publication method is protected against leaked long-lived credentials. Publishing to npm is explicitly requested, but the exact credential/session for remote publication must be confirmed before using it.
3. **S3 — TUI user test and follow-up.** User request: “y empezar a usar nuestro AI-STACK ir haciendo correciones de como se ve la TUI y todo eso”. Preserve a clear handoff for the user's real installation and TUI feedback; implement visual changes only after the user reports concrete observations.

## Tasks

- T1 — S1-S2, inline; enforce package/lock version consistency and verify packed contents and clean consumer install. Status: done; commit: pending feature slice. Risk: item 5 (npm release packaging and its published consumer artifact).
- T2 — S1, inline; harden the npm upgrade process invocation and pin its behavior with regression tests. Status: pending; commit: pending.
- T3 — S1, inline; validate and safely persist configuration without changing the existing config contract; test failure and malformed-input behavior. Status: pending; commit: pending.
- T4 — S1, inline; review filesystem/path boundaries in component and security-hook installation, harden confirmed gaps, and add public-interface regression coverage. Status: pending; commit: pending.
- T5 — S1-S2, inline; migrate release workflow away from long-lived npm write tokens to Trusted Publishing/provenance where repository and npm configuration support it; pin third-party Actions to immutable revisions and document required npm-side setup. Status: pending; commit: pending.
- T6 — S1-S3, inline; run full release checks and isolated package-install smoke test, reconcile security documentation, and deliver the user’s install/TUI test handoff. Status: pending; commit: pending.

## Log

- L1 (2026-10-27): “/goal Buenas noches bb, quiero que blindemos de segurida el AI-STACK ya que vamos a hacer que se instale desde npm, so todo este año se han descubierto muchas maneras de vulnerar paquetas de node, entonces quiero que lo blindes todo saques la release y me avises para hacer la prueba de que se esta instalando todo correctamente, y empezar a usar nuestro AI-STACK ir haciendo correciones de como se ve la TUI y todo eso”
- L2 (2026-10-27): Read-only inventory found package.json at 0.1.1 but package-lock root metadata at 0.1.0; release workflow uses NODE_AUTH_TOKEN and Actions tagged by major version. Existing npm docs recommend OIDC Trusted Publishing and automatic provenance for eligible public GitHub/npm releases. These findings are hardening targets, not evidence of compromise.
- L3 (2026-10-27): User explicitly requested npm release; no source changes or publishing occurred before creating this branch. Ask for exact credential/session authorization before any remote publication.
- L4 (2026-10-27): T1 observed RED: `test/cli/packaging.test.ts` failed because `package-lock.json` declared 0.1.0 while `package.json` declared 0.1.1. Updated the two root lockfile version fields and added a lock/manifest consistency regression test. GREEN: focused test passed; `npm test` passed 135 tests with 1 skipped; `npm run typecheck` passed. `npm pack --dry-run --json` showed 209 files, included `dist/cli/index.js` and `SECURITY.md`, excluded tests. Installed the real packed tarball offline in an isolated temp prefix and verified `nix-ai --version` returns 0.1.1.
- L5 (2026-10-27): Independent T1 verification found no candidate-caused blocker: candidate package metadata matched at 0.1.1 and its packed artifact installed offline with `nix-ai --version` stdout `0.1.1`, exit 0, empty stderr. The verifier’s scratch-copy build lacked npm dependencies, and baseline CLI comparison was unavailable because baseline did not contain built `dist`; parent checks independently verified the candidate pack/install and the workspace regression test. RDD mode is explicitly off globally, so no native review transaction was started.

