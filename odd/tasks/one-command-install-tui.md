# One-command Nix installation and TUI setup — Feature Specification

Objective: Make installing Nix and configuring its supported AI-stack integrations a guided, safe Windows-first flow.
Branch: `codex/one-command-install-tui` | Delivery strategy: `ask-on-risk` | Chain strategy: `feature-branch-chain` | Test runner: `npm test`, `npm run typecheck`, plus installer checks where available.

## Specs

### S1 — Single bootstrap entry

User request: “Si recuerda que la idea es que se instale, y luego desde la TUI configurarlo, puedes hacer esos cambios plis?”

Acceptance:
- Provide one Windows PowerShell bootstrap script that installs/updates the Nix CLI from the configured Nix repository, checks prerequisites, and opens the Nix TUI after a successful build/link.
- Script is idempotent, fails with actionable messages, preserves user files and avoids destructive cleanup.
- It must never change the Araxys repository.

Assumption: Bootstrap targets the configured public source repository `https://github.com/Samuel-Urrego/Nix.git` because no published npm package/release artifact is currently configured.

Risk: item 5 — installer changes the user's local tool installation and PATH only when necessary.

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
| T1 | S1 | Inline | Done — PowerShell bootstrap dry-run and package build lifecycle pass | — |
| T2 | S2 | Inline | Done — TUI agent, MCP, and command managers reuse existing safe installers; integration tests pass | — |
| T3 | S3 | Inline | Done — one-command install and TUI path documented; local guide links and acceptance section checked | — |

## Log

- L1 — User request: “Si recuerda que la idea es que se instale, y luego desde la TUI configurarlo, puedes hacer esos cambios plis?”
- L2 — Repo mapping found the no-argument CLI already opens `runTui`, but the TUI only saves selected preferences; agent targets report installers are not implemented, MCP category redirects users to CLI, and skills/commands use separate flows. Existing component installers expose preview, ownership, and recovery behavior and must be reused.
- L3 — Global RDD is explicitly off; continue ordinary focused verification and do not start native review.
- L4 — Proposed onboarding keeps local bootstrap separate from component configuration: install CLI once, then configure through TUI. Optional MCPs and security hooks remain opt-in. No remote action is authorized by this implementation task.
- L5 — npm 11.19.1 warns that Git lifecycle scripts require an explicit allowlist during global installation. The bootstrap version-gates `--allow-scripts nix-ai-stack` for npm 11+; older npm versions use their existing lifecycle behavior. `package.json` adds `prepare` so Git-source installs compile `dist`.
- L6 — `scripts/install.ps1` targets a dedicated user-level npm prefix and only adds it to user PATH after explicit confirmation; no admin elevation or execution-policy changes are used. It launches the TUI after install.
- L7 — TUI now manages specialist agents, MCP integrations, and workflow commands through existing previews and ownership-safe services. Skills and security hooks already had TUI managers; missing prerequisites and unverifiable removals are shown without applying changes.
- L8 — RED/GREEN: injected TUI test initially failed because no TTY injection was possible; added a prompt/output seam and integration tests. Installer/package tests also failed before adding the npm `prepare` script and PowerShell bootstrap.
- L9 — Full verification: `npm test` (131 passed, 1 skipped, 0 failed), `npm run typecheck`, `npm run build`, `git diff --check`, installer `-DryRun`, and local `npm pack` plus isolated global CLI version smoke test pass. The skipped symlink test requires Windows symlink capability.
- L10 — Structural docs check confirms the support-matrix/release links and clean-machine checklist remain present. The PowerShell script uses `return` rather than `exit` for dry-run, so invoking the script from a user's interactive session does not close their shell.
