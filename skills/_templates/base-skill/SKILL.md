---
name: base-skill
description: "Trigger: repeated workflow, reusable task, project convention. Execute one narrow repeatable workflow for Nix."
license: Apache-2.0
metadata:
  author: "surre"
  version: "1.0"
---

## Activation Contract

Use this skill when the workflow is repeated, stable, and narrow enough to encode as a reusable instruction contract.

## Hard Rules

- Stay within one responsibility.
- Keep project artifacts in English unless explicitly requested otherwise.
- Move long examples or templates to `assets/` or `references/`.

## Decision Gates

| Situation | Action |
|-----------|--------|
| One-off task | Do not use this skill |
| Stable repeated task | Use or adapt this skill |
| Large mixed workflow | Split into smaller skills |

## Execution Steps

1. Confirm the task matches this skill's trigger.
2. Follow the project conventions for the workflow.
3. Produce the expected artifact or action.
4. Report what changed and what remains.

## Output Contract

Return:
- files created or modified,
- decisions taken,
- follow-up work if relevant.

## References

- `agents/skill-style-guide.md`
