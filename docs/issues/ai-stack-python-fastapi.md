# Python and FastAPI specialist

## Outcome

Add a reusable Python/FastAPI skill and a bounded specialist agent for recurring backend implementation work.

## Scope

- Cover project-version-aware Python, uv, async API, validation, layering, and pytest patterns.
- Keep Araxys-specific integration guidance in the separate Araxys skill/agent.
- Do not create a generic coding agent or duplicate the core orchestrator.

## Acceptance

- Agent and skill have clear activation triggers and decision boundaries.
- Both supported global agent targets can discover them through Nix's catalog.
- Tests cover catalog metadata and safe lifecycle behavior.

## Dependencies and checks

- Depends on the global specialist-agent catalog.
- Risk: global agent-facing installation boundary.
- Run focused tests, typecheck, and full suite at feature closure.
