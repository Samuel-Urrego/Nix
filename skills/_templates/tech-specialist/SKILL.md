---
name: tech-specialist
description: "Trigger: framework specialist, language specialist, stack-specific guidance. Apply Nix conventions to one specific technology domain."
license: Apache-2.0
metadata:
  author: "surre"
  version: "1.0"
---

## Activation Contract

Use this skill when the task belongs to a specific technology with repeated constraints, patterns, or review heuristics.

## Hard Rules

- Focus on one technology only.
- Prefer project conventions over generic ecosystem habits.
- Escalate cross-cutting decisions back to the orchestrator.

## Decision Gates

| Situation | Action |
|-----------|--------|
| Generic task | Use a more general skill |
| Tech-specific repeated task | Use this specialist skill |
| Multi-technology architecture decision | Hand back to orchestrator |

## Execution Steps

1. Identify the exact technology scope.
2. Apply the relevant project conventions.
3. Produce guidance or changes scoped to that technology.
4. Surface risks, constraints, and follow-up needs.

## Output Contract

Return:
- technology scope handled,
- files or artifacts affected,
- conventions applied,
- risks or follow-up items.

## References

- `agents/skill-style-guide.md`
