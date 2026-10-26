# Optional SDD and TDD workflows

Nix can enable Spec-Driven Development (SDD) and Test-Driven Development (TDD) independently. Settings, workflow contracts, project-keyed records, and the workflow command catalog are global; OpenCode receives commands under its config directory, and Codex receives user skills under `~/.agents/skills`.

## Independent settings

Both workflows are disabled by default and do not affect each other.

- **TUI:** run `nix-ai`, open **Workflows**, toggle SDD and/or TDD, then choose **Save preferences**.
- **CLI:** `nix-ai workflow:configure --sdd=on --tdd=off --yes`.

Settings persist in the global stack state file (`<nix-home>/state.json`, which is `%APPDATA%\Nix AI Stack\state.json` on Windows) as explicit `workflows.sdd` and `workflows.tdd` booleans. Older state files without that field derive the flags from the selected `workflow.sdd` and `workflow.tdd` components, so upgrading does not invalidate existing preferences.

Starting a disabled workflow fails with a message that names the setting to enable.

## Workflow commands

The catalog exposes `/new-feat` (SDD), `/refactor` (TDD), `/new-idea` (blind-judge), and `/new-project` (project asset generator). Discover availability with:

```text
nix-ai workflow:commands
```

Install the global agent surfaces:

```text
nix-ai workflow:install-commands --agent=opencode --root=. --yes
nix-ai workflow:install-commands --agent=codex --root=. --yes
```

OpenCode writes commands under `<opencode-config-directory>/commands`; Codex writes user skills under `~/.agents/skills`. See [the workflow command catalog](command-catalog.md) for command syntax, prerequisites, artifacts, and recovery.

`/new-project` uses repository evidence to propose one project skill and only genuinely distinct specialist agents. It previews exact paths and contents, waits for confirmation, and preserves existing targets. The shared skill belongs in `.agents/skills/`; native project agent definitions belong in `.codex/agents/` and `.opencode/agents/`.

## Workflow records

Each run is a project-keyed JSON record under `<nix-home>/projects/<project-key>/workflows/<id>.json`. Records survive process restarts, so an interrupted workflow can be resumed from its persisted current step. A record contains:

- `schemaVersion`, `id`, `kind` (`sdd` or `tdd`), `title`, `status` (`active` or `completed`);
- `currentStep` (`null` when complete);
- ordered `steps`, each `pending`, `done`, or `skipped`, with evidence, reason, and completion time when recorded.

## SDD flow

| Step | What it records |
|------|-----------------|
| `idea` | The intake statement and the problem to solve |
| `clarification` | Resolved questions, assumptions, and open decisions |
| `specification` | The approved scope and acceptance criteria |
| `tasks` | The ordered work breakdown |
| `handoff` | The implementation handoff and its boundaries |
| `verification` | The verification record and observed result |

```text
nix-ai workflow:start --kind=sdd --title="Add optional workflows" --root=. --yes
nix-ai workflow:advance --id=<id> --evidence="Problem and intended outcome recorded" --root=. --yes
nix-ai workflow:resume --id=<id> --root=.
```

Every advance requires non-empty evidence. The workflow completes after the verification record.

## TDD flow

| Step | What it records |
|------|-----------------|
| `test-identification` | The runnable test and expected behavior |
| `red` | The observed failing test |
| `green` | The implementation and passing result |
| `refactor` | The cleanup with behavior preserved |
| `proof` | The final proof: commands, counts, and observed result |

```text
nix-ai workflow:start --kind=tdd --title="Add a testable guard" --root=. --yes
nix-ai workflow:advance --id=<id> --evidence="test/guard.test.ts asserts the rejection" --root=. --yes
nix-ai workflow:skip --id=<id> --reason="Docs-only change; no meaningful runnable RED." --root=. --yes
```

`RED` is the only skippable step. Skipping it requires a persisted reason explaining why a meaningful runnable test is unavailable. Every other step advances only with evidence.

## Status and recovery

```text
nix-ai workflow:status --root=.
nix-ai workflow:resume --id=<id> --root=.
```

`workflow:status` prints the SDD/TDD settings and the active workflows for the project. `workflow:resume` prints the persisted completed steps and the exact next action, so a new session can continue without reconstructing context from chat.

## Current limits

- Workflow commands are catalogued and executable; OpenCode commands and Codex user skills install globally.
- Workflow records are project-keyed files under the Nix home and are not encrypted or validated against a remote service.
- `workflow:advance` records what the user reports as evidence; it does not run tests or verify claims by itself.
- The TUI configures enablement and discovers commands; executing and installing commands happens through the CLI or the generated agent surface.
