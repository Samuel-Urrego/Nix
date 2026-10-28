# Security Audit command

## Outcome

Expose the existing Cloudflare Security Audit skill through a concise `/security-audit` command for OpenCode and Codex.

## Scope

- Add the command through the central command catalog and generated agent surfaces.
- Pass project scope and the user's audit focus to the existing skill.
- Do not duplicate upstream skill instructions or bypass its coverage/validation workflow.

## Acceptance

- Command availability is reported consistently for both supported agents.
- Install/remove preserve unmanaged command files.
- Help, docs, and tests cover the new command.

## Dependencies and checks

- Depends on the current `security-audit` catalog entry and command generator.
- Risk: global agent-facing installation boundary.
- Run focused command tests, typecheck, and full suite at feature closure.
