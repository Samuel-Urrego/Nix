# Optional SDD and TDD workflows

Nix can enable Spec-Driven Development (SDD) and Test-Driven Development (TDD) independently. Settings, workflow contracts, project-local records, and the workflow command catalog are available; OpenCode slash commands are generated project-locally, while Codex remains CLI-only because custom slash prompts are deprecated upstream.

## Independent settings

Both workflows are disabled by default and do not affect each other.

- **TUI:** run `nix-ai`, open **Workflows**, toggle SDD and/or TDD, then choose **Save preferences**.
- **CLI:** `nix-ai workflow:configure --sdd=on --tdd=off --yes`.

Settings persist in the stack state file (`%APPDATA%\Nix AI Stack\state.json` on Windows) as explicit `workflows.sdd` and `workflows.tdd` booleans. Older state files without that field derive the flags from the selected `workflow.sdd` and `workflow.tdd` components, so upgrading does not invalidate existing preferences.

Starting a disabled workflow fails with a message that names the setting to enable.

## Workflow commands

The catalog exposes `/new-feat` (SDD), `/refactor` (TDD), and `/new-idea` (blind-judge). Discover availability with:

```text
nix-ai workflow:commands
```

OpenCode users can install project-local slash commands:

```text
nix-ai workflow:install-commands --agent=opencode --root=. --yes
```

Codex custom slash prompts are deprecated and user-global, so Codex uses the CLI executor instead. See [the workflow command catalog](command-catalog.md) for command syntax, prerequisites, artifacts, and recovery.

## Workflow records

Each run is a project-local JSON record under `.nix/workflows/<id>.json`. Records survive process restarts, so an interrupted workflow can be resumed from its persisted current step. A record contains:

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

- Workflow commands are catalogued and executable; OpenCode slash commands install project-locally. Codex custom slash prompts are deprecated upstream and remain CLI-only in Nix.
- Workflow records are project-local files and are not encrypted or validated against a remote service.
- `workflow:advance` records what the user reports as evidence; it does not run tests or verify claims by itself.
- The TUI configures enablement and discovers commands; executing and installing commands happens through the CLI or the generated OpenCode command.
