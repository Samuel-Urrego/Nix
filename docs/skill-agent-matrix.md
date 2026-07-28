# Nix Skill and Agent Matrix

This matrix defines what should become a skill first, what should become a specialist agent later, and what needs architecture-aware reviewers.

## Rule

Start with skills. Promote to agents only when the domain proves repeated, stable, and worth dedicated reasoning.

## Matrix

| Domain | Skill first | Agent later | Reviewer needed |
|--------|-------------|-------------|-----------------|
| Python + uv | Yes | Yes | Yes |
| FastAPI backend | Yes | Yes | Yes |
| Astro + Tailwind | Yes | Yes | Yes |
| React + Vite + Tailwind | Yes | Yes | Yes |
| Blazor | Yes | Yes | Yes |
| SQL Server + Dapper + stored procedures | Yes | Yes | Yes |
| MCP server development | Yes | Yes | Yes |
| Pinecone/OpenAI apps | Yes | Yes | Yes |
| Clean Architecture | Yes | Optional dedicated reviewer first | Yes |
| Design patterns | Yes | Optional later | Yes |
| Docs / onboarding | Yes | Optional later | Yes |
| PR / review workflows | Yes | Optional later | Yes |

## Priority skills

### Tier 1

- Python library workflow
- FastAPI feature workflow
- Astro page/component workflow
- React feature workflow
- Blazor component/module workflow
- SQL Server stored procedure integration workflow
- MCP server tool workflow
- architecture decision workflow
- pattern selection workflow
- review checklist workflow

### Tier 2

- Pinecone integration workflow
- CLI scaffolding workflow
- test strategy workflow
- docs/README workflow
- migration/refactor workflow

## Candidate specialist agents

### Technology specialists

- Python specialist
- FastAPI specialist
- Astro specialist
- React specialist
- Blazor specialist
- SQL Server specialist
- MCP specialist
- Vector/AI app specialist

### Cross-cutting specialists

- Architecture specialist
- Testing specialist
- Documentation specialist
- Refactor specialist

## Candidate reviewers

- Clean Architecture reviewer
- Layered architecture reviewer
- Modular monolith reviewer
- Frontend component architecture reviewer
- API contract reviewer
- SQL/data access reviewer
- MCP safety reviewer
- Design pattern reviewer

## Promotion criteria

Promote a skill into an agent when:

- the domain appears across multiple projects,
- repeated mistakes or review comments keep surfacing,
- the domain has real decision trees,
- and the specialist would reduce context load materially.
