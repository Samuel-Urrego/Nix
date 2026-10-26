# Nix Reviewer Specification

This document defines the minimum contract every Nix reviewer must follow.

## Quick path

1. Match the reviewer to a real technology, architecture, or pattern.
2. Define what it validates.
3. Define what signals activate it.
4. Define the checks, smells, and verdict shape.

## Goal

Make reviewers portable, composable, and consistent across projects.

## Reviewer categories

| Category | Purpose |
|----------|---------|
| Technology | Validate framework or platform-specific quality |
| Architecture | Validate structural fit and boundary discipline |
| Pattern | Validate whether a design pattern is justified and correctly applied |

## Required contract

Every reviewer should define:

| Field | Meaning |
|-------|---------|
| `id` | Stable machine-readable identifier |
| `name` | Human-readable reviewer name |
| `category` | `technology`, `architecture`, or `pattern` |
| `appliesTo` | Tags or contexts where the reviewer is relevant |
| `goal` | What this reviewer is trying to protect |
| `signals` | What conditions justify running it |
| `checks` | Concrete review checks |
| `smells` | Failure patterns or warning signs |
| `verdictShape` | Expected output structure |

## Minimum reviewer behavior

Every reviewer must answer:

1. Is this choice appropriate for the project context?
2. Is it being applied consistently?
3. Is it improving clarity, safety, or maintainability?
4. What simpler alternative should be preferred if the current choice is overengineered?

## Smell model

Use these severity levels:

| Severity | Meaning |
|----------|---------|
| Critical | Dangerous or clearly incorrect for the context |
| Warning | Risky, inconsistent, or costly without enough justification |
| Suggestion | Improvement opportunity without immediate danger |

## Verdict shape

Reviewers should produce:

```text
Reviewer: <name>
Category: <category>
Verdict: pass | pass-with-warnings | fail

Findings:
- [Severity] <finding>

Recommended actions:
- <action>

Simpler alternative:
- <alternative when appropriate>
```

## Anti-dogma rule

A reviewer must not defend a style just because it is fashionable or familiar.

The right architecture or pattern is the one that fits the problem, not the one with the most ceremony.

## Checklist

- [ ] The reviewer has a narrow purpose
- [ ] The reviewer defines concrete checks
- [ ] The reviewer names failure smells
- [ ] The reviewer can explain when NOT to use the thing it reviews

## Next step

Use this contract together with `architecture-selector.md` and `pattern-review-rules.md`.
