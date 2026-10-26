# Nix AI Stack Roadmap

This roadmap records the proposed delivery order for turning Nix into an installable AI development stack. After the project owner approves the sequence, create Markdown issue briefs under `docs/issues/`; creating GitHub issues is a separate action requiring an explicit request.

## Product direction

- The executable is `nix-ai`; running `nix-ai` opens the interactive TUI.
- The TUI lets users select, install, configure, update, and remove Nix-managed components.
- SDD and TDD are independently optional and configurable from the TUI.
- Integrations, hooks, workflows, and skills are modular; users opt into what they need.
- Agent-specific configuration is written through adapters rather than from TUI code.
- Keep agent, architecture, reviewer, and skill guidance in the top-level `agents/` directory; reserve `docs/` for the roadmap and approved issue briefs.
- Remove the standalone `stack:scan` command; do not replace it with another general-purpose repository scanner in this roadmap. Keep its internal heuristic module only while the prototype `reviewers:run` still depends on it.

## Delivery order

### Phase 0 — Confirm scope and remove the rejected feature

- [x] Remove `stack:scan` from the CLI command registry, help, package scripts, and docs; no test suite exists yet.
- [x] Review the current repository and correct README statements that described unimplemented behavior as complete.
- [x] Confirm supported operating system for v1: Windows only.
- [x] Confirm initial coding-agent targets for v1: OpenCode and Codex.
- [x] Inspect Gentle AI and ECC for reusable product patterns before deciding what to adapt. Both repositories identify their license as MIT; review notices and license terms for every external skill or asset separately.
- [x] Establish a source-provenance rule: record each component's source, license, version, and dependencies before bundling it. No external skills or assets were bundled in Phase 0; the component catalog will carry those records before any import.
- [x] Check `nix-ai` against the selected Windows environment: it is not present on the current PATH, so it does not collide with a command available here. Registering it as the package executable remains Phase 1 work.

**Local preflight:** neither `nix-ai` nor `nix` is on the current Windows PATH. The current package still declares `nix`; Phase 1 changes the executable to `nix-ai`.

**Exit condition:** Windows, OpenCode, and Codex are documented as v1 targets; source-use rules and the `nix-ai` command name are recorded; the standalone scanner command is gone. The internal heuristic module remains only as a temporary dependency of `reviewers:run`.

### Phase 1 — CLI foundation and TUI shell

- [x] Make `nix-ai` the executable entry point; invoking it without a subcommand opens the TUI.
- [x] Build the TUI navigation model: component categories, descriptions, installed state, selection, confirmation, progress, and errors.
- [x] Define a versioned Nix configuration/state format for selected components and supported agent targets.
- [x] Add a read-only preview of planned changes before applying them.
- [x] Add a read-only `doctor` report for prerequisites, component status, and configuration problems.
- [x] Preserve user-owned configuration and provide backups, idempotent updates, and removal limited to Nix-managed entries.

**Exit condition — met:** the TUI can inspect state and preview a plan without modifying agent configuration.

### Phase 2 — Installation and agent adapters

- [x] Define contracts for component manifests, installers, agent adapters, and managed configuration ownership.
- [x] Implement one complete adapter for the first agreed agent and platform (Codex project-local skill, Windows).
- [x] Support install, update, uninstall, backup/restore, and dry-run/preview through the same component lifecycle.
- [x] Make repeated installs safe and ensure uninstall removes only Nix-owned files or entries.
- [x] Add integration tests using temporary home/config directories and pre-existing user settings.
- [ ] Add further agent/platform adapters only after the first adapter's contract is proven.

**Exit condition — met:** the Codex Nix Core skill can be installed, updated, backed up/restored, and removed project-locally without clobbering unrelated user configuration; independent verification passed Phase 2 specs S1–S6.

### Phase 3 — Security hooks and destructive-operation safeguards

- [x] Define the threat model and supported hook events for each agent adapter.
- [x] Add safeguards for abusive or accidental file deletion commands and destructive SQL operations affecting objects or data.
- [x] Prefer structured command parsing and context-aware policies over substring-only matching.
- [x] Explain each block, provide a safe confirmation/escalation path where appropriate, and keep hook enablement visible in the TUI.
- [x] Test direct commands, common shell wrappers, quoting/escaping, harmless near-matches, and unsupported shell/event behavior.
- [x] Keep hook installation opt-in until its behavior and platform coverage are demonstrated.

**Exit condition — met:** safeguards have documented coverage and limitations in [the security hook model](../agents/security-hooks.md), and false positives/false negatives are tested before default enablement is considered. Installation remains opt-in and project-local.

### Phase 4 — Optional SDD and TDD workflows

- [x] Define independent TUI settings for enabling SDD and TDD.
- [x] Define workflow contracts and persisted settings before adding agent-specific prompts or hooks.
- [x] Add SDD flow: idea intake, clarification, specification, task breakdown, implementation handoff, and verification record.
- [x] Add TDD flow: identify a runnable test, observe RED, implement GREEN, refactor, and report proof or explain when meaningful RED is unavailable.
- [x] Add recovery/resume behavior for interrupted workflows.
- [x] Test enabled, disabled, and partially configured states for each workflow.

**Exit condition - met:** SDD and TDD can be enabled independently and produce observable, resumable project-local workflows. Agent-specific hooks remain future work; Phase 8 adds the workflow command catalog and OpenCode slash commands. See [the workflow model](../agents/workflows.md).

### Phase 5 — Optional MCP integrations

- [x] Define an MCP catalog format with purpose, prerequisites, configuration fields, credential handling, supported agents, and removal behavior.
- [x] Add Playwright, CodeGraph, and Engram as separately selectable integrations.
- [x] Make network access, credentials, and project/global configuration scope explicit before writes.
- [x] Preview MCP configuration changes and preserve pre-existing servers and settings.
- [x] Test install/update/remove, duplicate detection, invalid configuration, and missing prerequisites.

**Exit condition — met:** each integration can be independently selected, configured, diagnosed, and removed without disturbing unrelated MCPs. See [the MCP integration model](../agents/mcp-integrations.md).

### Phase 6 — Stack-aware skill catalog and requested skills

- [x] Audit existing project skills and map candidates to the user's actual technology stack; keep the result as a maintained compatibility matrix rather than relying on automatic repository scanning.
- [x] Define skill source, license, version, dependencies, compatible agents, install location, and update policy in a catalog.
- [x] Review and package the requested skills: Brag for Hyperframes (including verified dependencies), Grafana k6, Cloudflare Security Audit, Emil Kowalski, Taste, and Accessibility.
- [x] Confirm the exact upstream source and intended meaning for each named skill before importing it.
- [x] Let the TUI show skill descriptions and dependencies, support selection, and prevent incompatible or duplicate installs.
- [x] Add a project skill-authoring path that follows the repository's skill style guide.

**Exit condition — met:** selected skills install reproducibly from pinned commits into project-local agent directories, their provenance and licenses are documented, and the technology-to-skill mapping is reviewable. See [the skill catalog](../agents/skill-catalog.md) and [the compatibility matrix](../agents/skill-compatibility.md).

### Phase 7 — Blind-judge idea evaluation skill

- [x] Specify the judgment protocol, roles, input/output schema, and what counts as evidence.
- [x] Run separate pro and con judge groups without exposing one group's arguments or identities to the other.
- [x] Give each of five neutral evaluators the same evidence bundle while isolating their independent assessments from one another.
- [x] Have the orchestrator synthesize the five votes, disagreements, and evidence into a bounded verdict with uncertainty clearly stated.
- [x] Test context isolation, missing/invalid votes, ties, correlated reasoning risks, and repeatability.
- [x] Expose the workflow as an optional skill and document that it supports decisions rather than guaranteeing correctness.

**Exit condition — met:** the blind-judge engine enforces context isolation, audits missing and invalid assessments, and produces a deterministic synthesis with quorum, dissent, correlated-risk signals, and uncertainty. See [the blind-judge protocol](../agents/blind-judge.md) and [the optional skill](../skills/blind-judge/SKILL.md).

### Phase 8 — Workflow commands

- [x] Define a command/skill catalog and the distinction between TUI actions, CLI subcommands, and agent slash commands.
- [x] Add the requested workflows: `/new-feat`, `/refactor`, and `/new-idea`.
- [x] Make command availability depend on the selected agent and installed components.
- [x] Ensure each command invokes the corresponding SDD/TDD workflow when enabled and handles disabled workflows predictably.
- [x] Document command syntax, prerequisites, expected artifacts, and recovery behavior.

**Exit condition — met:** `workflow:commands` exposes the catalog and per-surface availability; the CLI refuses disabled or incomplete workflows before writing; OpenCode slash commands install project-locally; Codex is explicitly CLI-only because custom slash prompts are deprecated upstream. See [the workflow command catalog](../agents/command-catalog.md).

### Phase 9 — Release readiness

- [x] Run end-to-end tests for clean install, upgrade, interrupted install, rollback/restore, and uninstall.
- [x] Verify Windows and other agreed platform paths, permissions, shells, and configuration formats.
- [x] Add release packaging, versioning, checksums/signing where appropriate, and an upgrade compatibility policy.
- [x] Update README, installation guide, component catalog, security model, and support matrix to match implemented behavior.
- [x] Validate a clean-machine first-run journey from `nix-ai` launch through selecting and removing a component.

**Exit condition — met:** the release journey covers clean install, upgrade, interrupted-write cleanup, backup/restore, and uninstall; the CLI first-run journey covers diagnosis, configuration, install, backup, restore, and removal in an isolated project and state directory; `npm run release:check` typechecks, tests, builds, writes a SHA-256 manifest, and verifies it. Windows is the only verified platform, OpenCode and Codex are the only verified agents, and signing is explicitly not implemented. See [installation](../docs/installation.md), [release](../docs/release.md), [support matrix](../docs/support-matrix.md), and [component catalog](../agents/component-catalog.md).

## Planning rules

- After the project owner approves the phase order, write one Markdown issue brief per approved work unit under `docs/issues/`. Do not create GitHub issues unless explicitly requested later.
- Keep each issue focused on one behavior with acceptance criteria, dependencies, and verification steps.
- Establish contracts and tests before adding more agent-specific implementations.
- Do not copy an upstream system prompt wholesale. Study its public architecture and workflows; write Nix-owned prompts/contracts and keep provenance and required notices when reusing licensed material.
- Do not claim an integration or safeguard is supported until its target matrix and tests demonstrate that support.

## References

- [Gentle AI](https://github.com/Gentleman-Programming/gentle-ai)
- [ECC](https://github.com/affaan-m/ECC)
- [Nix skill style guide](../agents/skill-style-guide.md)
- [Nix architecture foundation](../agents/architecture.md)
