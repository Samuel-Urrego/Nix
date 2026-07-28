# Nix Pattern Review Rules

This document defines how Nix should evaluate design patterns without turning pattern usage into cargo cult behavior.

## Quick path

1. Identify the pattern being used.
2. Ask what problem it solves here.
3. Check whether the team and codebase actually need it.
4. Prefer the simplest mechanism that preserves clarity.

## Goal

Teach Nix to review pattern usage based on fit, not trend.

## Core rule

A design pattern is justified only when it reduces complexity, improves flexibility, or protects an important boundary.

If it only adds ceremony, it should be challenged.

## Common pattern families

| Family | Examples |
|--------|----------|
| Creational | Factory, Builder |
| Behavioral | Strategy, Mediator, State |
| Structural | Adapter, Facade, Decorator |
| Data access | Repository, Unit of Work |
| Coordination | CQRS, pipelines, workflow/state machine patterns |

## Pattern review questions

Every pattern reviewer should ask:

1. What exact problem is this pattern solving?
2. Is there repeated variation that justifies this abstraction?
3. Is the pattern reducing coupling or hiding simple logic behind ceremony?
4. Does the team have enough consistency to use it well?
5. What simpler design would work if the pattern were removed?

## Common smells

| Smell | Meaning |
|-------|---------|
| Pattern without pressure | A pattern was introduced before the problem existed |
| Interface inflation | Many interfaces with only one trivial implementation |
| Indirection theater | The call chain gets longer but the design gets less clear |
| Fake decoupling | Extra layers exist but still leak infrastructure details |
| Pattern sprawl | Multiple patterns stacked without a real need |

## Rule examples

### Repository pattern

Good when:

- persistence boundaries matter,
- tests or multiple data sources need stable interfaces,
- domain logic must stay isolated from storage details.

Bad when:

- it wraps simple queries with no extra value,
- or becomes a pass-through layer to an ORM or Dapper call.

### Strategy pattern

Good when:

- there are multiple interchangeable behaviors,
- new variants are expected,
- runtime selection matters.

Bad when:

- there is only one behavior,
- or the strategy adds more files than flexibility.

### CQRS

Good when:

- read and write concerns truly differ,
- query shape and command rules are independently complex,
- scaling or modeling pressures justify separation.

Bad when:

- the project is a basic CRUD app,
- or CQRS is introduced only for prestige.

## Verdict expectations

Pattern reviewers should always include:

- whether the pattern is justified,
- what smell or benefit was found,
- whether to keep, simplify, or replace it.

## Checklist

- [ ] The problem solved by the pattern is explicit
- [ ] Simpler alternatives were considered
- [ ] The pattern reduces more complexity than it creates
- [ ] The usage is consistent across the affected code

## Next step

Use these rules to define built-in pattern reviewers and to avoid overengineering by default.
