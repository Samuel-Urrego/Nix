# One-command Nix installation and TUI setup — Feature Specification

Objective: Make installing Nix and configuring its supported AI-stack integrations a guided, safe Windows-first flow.
Branch: `codex/one-command-install-tui` | Delivery strategy: `ask-on-risk` | Chain strategy: `feature-branch-chain` | Test runner: `npm test`, `npm run typecheck`, plus installer checks where available.

## Specs

### S1 — Single bootstrap entry

User request: “Si recuerda que la idea es que se instale, y luego desde la TUI configurarlo, puedes hacer esos cambios plis?”

Acceptance:
- Provide one Windows PowerShell bootstrap script that installs the Nix CLI from the newest `v*` release tag and opens the Nix TUI afterwards.
- The installed artifact is a prebuilt release tarball and is installed with `npm install --global --ignore-scripts`, so no package lifecycle script runs on the user's machine.
- Script is idempotent, fails with actionable messages, preserves user files and avoids destructive cleanup.
- Every handled failure prints a stable, copyable error code; unexpected failures use a documented fallback code.
- It must never change the Araxys repository.

Assumption: a branch is never installed. Testing unreleased code uses `npm link` from a source checkout instead of an installer flag.

Risk: item 5 — installer changes the user's local tool installation and PATH only when necessary.

### S4 — Tagged release artifacts

User request: “la idea es que siempre se instale sobre la ultima git tag, no desde la rama main baby”

Acceptance:
- Each `v*` tag publishes `nix-ai-stack-<version>.tgz` as a GitHub release asset containing a built `dist/`.
- The installer resolves the newest tag with `git ls-remote --tags --refs --sort=-v:refname` and fails with a stable code when no tag or artifact exists instead of falling back to source.
- The release process that produces the artifact is documented next to the existing manifest tooling.

Risk: item 5 — a broken or missing release artifact blocks every new installation.

### S2 — TUI is the configuration surface

Acceptance:
- After bootstrap, launching Nix opens the TUI as the main configuration experience.
- TUI can install Nix-managed specialist agents, skills, workflow commands, and optional MCP integrations using the existing preview/ownership-safe services.
- Preserve independent SDD/TDD settings and explicit opt-in for security hooks; do not silently enable optional external services or safeguards.
- Preview planned global targets before applying and require a clear confirmation for writes; preserve unowned files and report dependencies/conflicts.
- Persist selected agent targets and preferences consistently without claiming preferences alone installed anything.

Risk: item 5 — the TUI orchestrates global agent/tool configuration changes.

### S3 — Document the happy path

Acceptance:
- Rewrite the installation quick path to show one bootstrap command, then TUI configuration and read-only verification.
- Keep source-development setup separate from end-user installation and document prerequisites/failure modes.
- Document the installer repository trust boundary and avoid unsafe opaque elevation or deletion.

Checks: Structural doc readback and links.

## Tasks

| ID | Specs | Route | Status | Commit |
|----|-------|-------|--------|--------|
| T1 | S1 | Inline | Partial — stable failure codes and docs added; parent checks pass, independent scratch verification unavailable | `6064bc1` |
| T2 | S2 | Inline | Done — TUI agent, MCP, and command managers reuse existing safe installers; install-decline test confirms no target writes | `6064bc1`, `9206bd4` |
| T3 | S3 | Inline | Done — one-command install and TUI path documented; local guide links and acceptance section checked | `6064bc1` |
| T4 | S1, S4 | Inline | Done — tag-resolved release artifact install with `--ignore-scripts`; happy path and `NIX-INST-016` verified against the published `v0.1.0` release | pending commit |

## Log

- L1 — User request: “Si recuerda que la idea es que se instale, y luego desde la TUI configurarlo, puedes hacer esos cambios plis?”
- L2 — Repo mapping found the no-argument CLI already opens `runTui`, but the TUI only saves selected preferences; agent targets report installers are not implemented, MCP category redirects users to CLI, and skills/commands use separate flows. Existing component installers expose preview, ownership, and recovery behavior and must be reused.
- L3 — Global RDD is explicitly off; continue ordinary focused verification and do not start native review.
- L4 — Proposed onboarding keeps local bootstrap separate from component configuration: install CLI once, then configure through TUI. Optional MCPs and security hooks remain opt-in. No remote action is authorized by this implementation task.
- L5 — npm 11.19.1 warns that Git lifecycle scripts require an explicit allowlist during global installation. The bootstrap version-gates `--allow-scripts nix-ai-stack` for npm 11+; older npm versions use their existing lifecycle behavior. `package.json` adds `prepare` so Git-source installs compile `dist`.
- L6 — `scripts/install.ps1` targets a dedicated user-level npm prefix and only adds it to user PATH after explicit confirmation; no admin elevation or execution-policy changes are used. It launches the TUI after install.
- L7 — TUI now manages specialist agents, MCP integrations, and workflow commands through existing previews and ownership-safe services. Skills and security hooks already had TUI managers; missing prerequisites and unverifiable removals are shown without applying changes.
- L8 — RED/GREEN: injected TUI test initially failed because no TTY injection was possible; added a prompt/output seam and integration tests. Installer/package tests also failed before adding the npm `prepare` script and PowerShell bootstrap.
- L9 — Full verification after the decline regression test: `npm test` (132 passed, 1 skipped, 0 failed), `npm run typecheck`, `npm run build`, and `git diff --check` pass. Earlier checks also passed installer `-DryRun` and local `npm pack` plus isolated global CLI version smoke test. The skipped symlink test requires Windows symlink capability.
- L10 — Structural docs check confirms the support-matrix/release links and clean-machine checklist remain present. The PowerShell script uses `return` rather than `exit` for dry-run, so invoking the script from a user's interactive session does not close their shell.

- L11 — Independent verification of 6064bc1 passed focused tests, typecheck, and build. In verifier scratch, the full suite's CRLF-sensitive agent-catalog failure reproduced on both baseline 71406a7 and candidate; the parent workspace full suite passes. Live installation was not performed because it requires network access and user-level mutation.
- L12 — Added regression test 9206bd4: declining agent, MCP, and workflow-command installations leaves all candidate global files and ownership manifests absent; full suite remains green.
- L13 — User request: “Que algo salio mal y un codigo de error bb, tenes que hacer que el catch diga un codigo de error que tu entiendas por cada caso que pueda fallar y ya yo te lo paso :D”
- L14 — Added stable installer codes `NIX-INST-001`–`015` for handled failures and `NIX-INST-999` for unexpected errors, with a troubleshooting table and invalid-ref behavior test. Parent checks pass: 134 tests passed, 1 Windows symlink test skipped, typecheck/build/diff-check pass. The independent verifier could not create its mandated system-temp scratch copy because access was denied; its checks and baseline comparison remain unavailable, so T1 stays partial and is not published.
- L15 — After merge to `main`, verification of the published installer found the Git-source install broken: `npm install --global ... git+https://…#main` fails because npm's nested Git-dependency preparation runs without devDependencies, so `prepare` cannot run `tsc`. With `--ignore-scripts` the same install instead succeeds silently while creating neither `dist/` nor the CLI shim.
- L16 — User request: “si estamos instalando con npm hay que agregar porfa la flag de --ignore-scripts” and “la idea es que siempre se instale sobre la ultima git tag, no desde la rama main baby”.
- L17 — `v0.1.0` created on `main` (34f16ac) and published with a prebuilt `nix-ai-stack-0.1.0.tgz` asset. The installer now resolves the newest `v*` tag, downloads that asset, and installs it with `--ignore-scripts`; `-Ref` was removed, and `NIX-INST-015`/`016`/`017` cover tag resolution, artifact download, and version mismatch.
- L18 — Verification: `npm run typecheck` clean; `npm test` 135 passed, 0 failed. Isolated end-to-end run against the published release with a redirected `LOCALAPPDATA` resolved `v0.1.0`, installed in 3s, reported `Installed Nix 0.1.0`, honored a declined PATH change, and exited 0; the installed CLI answered `--version` and `doctor`, with no dev dependencies present. A temporary `v99.9.9` tag without an asset produced `NIX-INST-016` and exit 1, then the tag was deleted. The interactive TUI launch was not exercised because it requires a real terminal.
