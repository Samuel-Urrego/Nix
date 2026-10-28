# Araxys consumer-integration specialist

## Outcome

Create a reusable Araxys integration skill, a specialist agent for supported global agent targets, and an `/araxys` command for consumer-application work.

## Scope

- Read the consuming application's installed Araxys version and verify imports against that version's public exports.
- Use Araxys documentation, `AraxysShield`, `AraxysConfig`, examples, dependencies, and tests to guide integration.
- Make changes only in the consuming application repository.
- Never edit, commit, or create files in `P:\Proyectos\Araxys`; report suspected library defects instead.
- Keep the skill narrow and the command prompt a routing layer, not a duplicate copy of the skill.

## Acceptance

- Agent and skill are discoverable for OpenCode and Codex through the global Nix catalog.
- `/araxys` routes a concrete consumer task through the skill and does not start unrelated SDD/TDD flows.
- Agent instructions state the strict no-modification boundary and version-aware API verification.
- Tests cover catalog metadata, command availability/rendering, and install conflict preservation.

## Dependencies and checks

- Depends on the global specialist-agent catalog.
- Risk: global agent-facing installation boundary.
- Run focused tests, typecheck, and the full suite at feature closure.
