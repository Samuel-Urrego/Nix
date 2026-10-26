# Workflow Command Catalog

Nix exposes workflow, skill, and project-generation commands from one catalog:

| Slash | Purpose | Maps to | Required components | CLI agents | Slash agents | Expected artifact |
|-------|---------|---------|---------------------|------------|--------------|-------------------|
| `/new-feat` | Start a feature with specification and task breakdown | SDD workflow | `workflow.sdd` selected and enabled | OpenCode, Codex | OpenCode, Codex | `<nix-home>/projects/<project-key>/workflows/<id>.json` |
| `/refactor` | Start a behavior-preserving refactor | TDD workflow | `workflow.tdd` selected and enabled | OpenCode, Codex | OpenCode, Codex | `<nix-home>/projects/<project-key>/workflows/<id>.json` |
| `/new-idea` | Evaluate an idea with isolated judges | `blind-judge` skill | None | OpenCode, Codex | OpenCode, Codex | `<nix-home>/projects/<project-key>/ideas/<slug>.json` |
| `/new-project` | Analyze the current repository and propose its skill and evidence-backed specialist agents | Project asset generator | None | OpenCode, Codex | OpenCode, Codex | `.agents/skills/<skill-id>/SKILL.md`, `.codex/agents/<agent-id>.toml`, `.opencode/agents/<agent-id>.md` |

The catalog is implemented in `src/core/commands/workflow-command-catalog.ts`. Availability, execution, and installation live beside it; no surface invents its own command list.

## Three surfaces

| Surface | Purpose | Mutates state? | Authority |
|---------|---------|----------------|-----------|
| TUI actions | Select agents and components, enable SDD/TDD, discover command availability | Yes, only when saving preferences | Configuration and discovery |
| CLI subcommands | List, execute, install, and remove workflow commands | Yes, with explicit `--yes` | Authoritative execution |
| Agent slash commands | Global OpenCode commands and Codex user skills generated from the catalog | Yes, through the CLI command they instruct the agent to run | Convenience layer over the CLI |

The TUI does not execute workflows. The CLI does not claim that a command was installed for an agent that does not support it. An agent command is a prompt that must call the CLI; the CLI remains the policy enforcement point.

## Availability rules

A command is available only when all of these hold:

1. At least one agent target is selected in stack state and its `agent.<target>` component is installed.
2. The command supports that agent on the requested surface.
3. Every required component is selected.
4. For SDD/TDD commands, the corresponding workflow setting is enabled.

`workflow:commands` shows the result per surface:

```text
nix-ai workflow:commands
nix-ai workflow:commands --json
```

A workflow command that is disabled or missing a component is unavailable. The CLI refuses before writing a workflow record. An existing OpenCode command file or Codex skill for an unavailable command is removed on the next install only when it carries the Nix-managed marker.

## Syntax

```text
nix-ai workflow:commands
nix-ai workflow:command --id=new-feat --title="Guided onboarding" --root=. --yes
nix-ai workflow:command --id=refactor --title="Split the billing service" --root=. --yes
nix-ai workflow:command --id=new-idea --title="Adopt a new onboarding flow" --root=. --yes
nix-ai workflow:command --id=new-project --root=. --yes

nix-ai workflow:install-commands --agent=opencode --root=. --yes
nix-ai workflow:install-commands --agent=opencode --root=. --remove --yes
nix-ai workflow:install-commands --agent=codex --root=. --yes
nix-ai workflow:install-commands --agent=codex --root=. --remove --yes
```

The workflow commands map directly to the existing workflow runner:

```text
nix-ai workflow:resume --id=<id> --root=.
nix-ai workflow:advance --id=<id> --evidence="..." --root=. --yes
nix-ai workflow:skip --id=<id> --reason="..." --root=. --yes
```

`RED` remains the only skippable workflow step and requires a persisted reason.

## OpenCode commands

Install writes global files under `<opencode-config-directory>/commands`:

```text
commands/new-feat.md
commands/refactor.md
commands/new-idea.md
```

Each file:

- has YAML frontmatter with a description;
- carries `<!-- nix-ai:workflow-command id=<id> -->`;
- expands `$ARGUMENTS` as the title or idea statement;
- instructs the agent to run the matching `nix-ai workflow:command` before planning or editing;
- tells the agent to stop and report the exact error when the workflow is disabled or unavailable.

Invoke them from OpenCode:

```text
/new-feat Guided onboarding
/refactor Split the billing service
/new-idea Adopt a new onboarding flow
/new-project
```

Installation refuses to overwrite a file without the marker. Removal deletes only marker-bearing files.

## Codex user skills

Codex custom prompts are deprecated upstream. Nix installs Codex user skills instead:

```text
~/.agents/skills/new-feat/SKILL.md
~/.agents/skills/refactor/SKILL.md
~/.agents/skills/new-idea/SKILL.md
```

Each skill:

- has YAML frontmatter with `name` and `description`;
- carries the same `<!-- nix-ai:workflow-command id=<id> -->` marker;
- instructs Codex to run the matching `nix-ai workflow:command ... --root=. --yes`;
- stops and reports the exact error when the workflow is disabled or unavailable.

Codex users can also run the CLI executor directly:

```text
nix-ai workflow:command --id=new-feat --title="Guided onboarding" --root=. --yes
nix-ai workflow:command --id=new-project --root=. --yes
```

## Artifacts and recovery

| Command | Artifact | Recovery |
|---------|----------|----------|
| `/new-feat` | `<nix-home>/projects/<project-key>/workflows/<id>.json` | `workflow:resume --id=<id>`; continue with evidence |
| `/refactor` | `<nix-home>/projects/<project-key>/workflows/<id>.json` | `workflow:resume --id=<id>`; skip only RED with a reason |
| `/new-idea` | `<nix-home>/projects/<project-key>/ideas/<slug>.json` (`JudgmentResult`) | Read the saved result; rerun the command with the same evidence if needed |
| `/new-project` | Project-local skill and native agent definitions | Inspect the preview; confirm before writing; existing destinations are never overwritten |

A workflow record is the durable source of truth. Chat history is not required to resume. `/new-idea` does not create a workflow record; the audited judgment JSON is the durable artifact.

## Policy guarantees

- A disabled SDD or TDD workflow never starts through the catalog.
- A missing workflow component makes the command unavailable even if the setting says enabled.
- A missing agent component makes every command unavailable.
- The CLI refuses before writing a workflow record.
- The OpenCode command template instructs the agent to stop on the same refusal; it does not include a shell block that could bypass the agent's permission flow.
- Unmanaged command files are never overwritten or deleted.

## Limits

- Availability is computed from stack state, not from a live inspection of the agent's current configuration.
- Both OpenCode commands and Codex user skills are global surfaces; neither is written into the project.
- `/new-idea` depends on `skills/blind-judge/SKILL.md` and the `JudgmentResult` contract; it does not execute AI judges by itself.
- `/new-project` is a project-scoped generator prompt; it does not create global agent configuration or invent specialist roles without repository evidence.
- The TUI discovers commands but does not execute or install them.
- A slash command or skill is still an agent instruction. The CLI executor is the enforcing boundary.

## References

- [`src/core/commands/workflow-command-catalog.ts`](../src/core/commands/workflow-command-catalog.ts)
- [`src/core/commands/workflow-command-service.ts`](../src/core/commands/workflow-command-service.ts)
- [`agents/workflows.md`](workflows.md)
- [`agents/blind-judge.md`](blind-judge.md)
- [`docs/roadmap.md`](../docs/roadmap.md)
