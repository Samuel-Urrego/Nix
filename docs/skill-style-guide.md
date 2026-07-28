# Nix Skill Style Guide

This document is the normative guide for project skills in Nix.

## Purpose

A skill is an instruction contract for an LLM. It is not general documentation and it is not a knowledge dump.

## Rules

- Keep `SKILL.md` concise and operational.
- Lead with activation triggers and decision boundaries.
- Put reusable assets in `assets/`.
- Put long explanations or supporting detail in `references/`.
- Prefer one narrow responsibility per skill.
- Write artifact-facing instructions in English by default.

## Required structure

Every skill should use this structure:

```markdown
---
name: {skill-name}
description: "Trigger: {essential trigger words}. {What the skill does}."
license: Apache-2.0
metadata:
  author: "surre"
  version: "1.0"
---

## Activation Contract
## Hard Rules
## Decision Gates
## Execution Steps
## Output Contract
## References
```

## Quality bar

| Good | Bad |
|------|-----|
| Narrow trigger | Vague, everything-skill |
| Clear decisions | Motivational prose |
| Step-by-step instructions | Abstract theory |
| Reusable assets | Giant monolithic prompt |

## Promotion rule

If a skill keeps growing because it contains multiple workflows, split it.
