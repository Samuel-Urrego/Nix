# Nix Reviewer Strategy

Nix should become portable across companies and projects. That means it cannot assume one architecture is always right.

## Core principle

Nix reviewers should evaluate whether a chosen architecture or pattern is appropriate for the project context — not blindly enforce a favorite style.

## Review layers

### 1. Technology reviewers

Technology reviewers verify framework-specific quality:

- Python reviewer
- FastAPI reviewer
- Astro reviewer
- React reviewer
- Blazor reviewer
- SQL Server reviewer
- MCP reviewer

### 2. Architecture reviewers

Architecture reviewers verify structural coherence:

- Clean Architecture reviewer
- Layered Architecture reviewer
- Modular Monolith reviewer
- Service boundary reviewer
- Frontend composition reviewer

### 3. Pattern reviewers

Pattern reviewers verify whether a pattern is justified and correctly applied:

- Repository pattern reviewer
- CQRS reviewer
- Strategy pattern reviewer
- Factory/builder reviewer
- Mediator reviewer
- Dependency injection reviewer
- State machine/workflow reviewer

## Reviewer behavior

Each reviewer should answer:

1. Is this architecture or pattern appropriate here?
2. Is it being applied consistently?
3. Is it adding clarity, or just ceremony?
4. What simpler alternative should be preferred if the current choice is overengineered?

## Important anti-dogma rule

Clean Architecture is not the default answer to every project.

Examples:

- A small internal CRUD app may not need Clean Architecture.
- An MCP utility may benefit more from strong boundaries and safety rules than from heavy layers.
- A frontend marketing site may need excellent component composition, not enterprise abstraction theater.

## Initial reviewer pack

Nix should eventually ship with a practical reviewer pack for common situations:

| Reviewer | Purpose |
|----------|---------|
| Architecture selector reviewer | Challenge whether the chosen style fits the problem |
| Clean Architecture reviewer | Validate boundaries, dependency direction, and use-case discipline |
| FastAPI backend reviewer | Validate API/module design and operational conventions |
| Frontend composition reviewer | Validate components, state, and UI boundaries |
| SQL/data access reviewer | Validate Dapper/SP usage, query safety, and mapping discipline |
| MCP safety reviewer | Validate tool exposure, read/write constraints, and protocol boundaries |
| Pattern fit reviewer | Validate whether design patterns are justified or overused |

## Long-term goal

When you arrive at a company with an unfamiliar stack, Nix should already have:

- a close-enough technology specialist,
- a close-enough architecture reviewer,
- and a close-enough pattern reviewer.

Then adaptation becomes a matter of tuning, not starting from zero.
