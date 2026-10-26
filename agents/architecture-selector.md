# Nix Architecture Selector

This document defines how Nix should reason about architecture choice instead of defaulting blindly to one style.

## Quick path

1. Identify project type.
2. Measure complexity, team size, and change pressure.
3. Prefer the simplest architecture that protects the real constraints.
4. Escalate to heavier structure only when the problem justifies it.

## Goal

Help Nix recommend an architecture that fits the project instead of enforcing Clean Architecture everywhere.

## Decision factors

| Factor | Questions |
|--------|-----------|
| Domain complexity | Is the domain simple CRUD, moderate business logic, or high rule density? |
| Delivery pressure | Is this speed-first, balanced, or long-lived platform work? |
| Team shape | Solo, small team, or large cross-functional team? |
| Integration surface | Few dependencies or many external systems? |
| Change frequency | Stable system or constant evolution? |
| Risk level | Low-risk internal tool or high-impact business-critical system? |

## Architecture options

### Simple modular application

Best for:

- solo or small-team tools,
- internal utilities,
- low-to-medium complexity products,
- fast delivery with clear modules.

Avoid when:

- domain rules are dense,
- infrastructure churn is high,
- or long-term boundaries are critical.

### Layered architecture

Best for:

- straightforward business applications,
- conventional service backends,
- systems where a clean separation of API, service, and data is enough.

Avoid when:

- teams start adding fake layers with no benefit,
- or the system needs stronger domain isolation.

### Clean Architecture

Best for:

- enterprise systems with dense business rules,
- multiple integrations,
- long-lived systems with frequent change,
- teams that need strong dependency discipline.

Avoid when:

- the app is simple,
- the team is small and speed matters more than indirection,
- or the domain does not justify heavy boundaries.

### Modular monolith

Best for:

- products with multiple bounded features,
- teams that need strong internal structure without operational microservice cost,
- systems expected to grow in depth before splitting.

Avoid when:

- the product is still tiny,
- or the team is not yet disciplined enough to keep modules coherent.

## Default guidance

| Context | Recommended starting point |
|---------|----------------------------|
| Small internal app | Simple modular application |
| Standard API/backend | Layered architecture |
| Enterprise rule-heavy system | Clean Architecture |
| Growing product with many domains | Modular monolith |
| MCP utility / tooling | Simple modular application or layered architecture |
| Marketing/content frontend | Component-oriented frontend structure |

## Reviewer expectations

The architecture selector reviewer should flag:

- architecture that is too heavy,
- architecture that is too weak for the domain,
- fake boundaries,
- accidental coupling,
- missing justification for complex structure.

## Checklist

- [ ] Project type identified
- [ ] Complexity judged honestly
- [ ] Team shape considered
- [ ] Simpler alternative evaluated
- [ ] Chosen architecture justified

## Next step

Pair this selector with architecture reviewers so recommendation and verification stay aligned.
