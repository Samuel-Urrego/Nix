# Nix Agent System

## Goal

Nix should support a growing system of specialized agents without turning the stack into a pile of unrelated prompts.

## Core distinction

| Concept | Purpose |
|--------|---------|
| Agent | Owns a role, decision boundary, and workflow responsibility |
| Skill | Encodes a repeatable instruction pattern for a narrow task |
| Adapter | Connects Nix to external systems such as Engram or review tooling |

## Recommended model

### 1. One orchestrator, many specialists

The orchestrator should route work, enforce policy, and decide sequencing. Specialist agents should focus on one domain at a time.

### 2. Skills for repetition

If you keep repeating the same instructions, that belongs in a skill. Skills should be narrow, reusable, and composable.

### 3. Adapters for external dependencies

External systems such as Engram, reviewer tooling, or CLI integrations should stay behind contracts so agents depend on Nix interfaces, not vendor details.

## Agent categories for Nix

| Category | Responsibility |
|---------|----------------|
| Core orchestrator | Routing, sequencing, policy enforcement |
| SDD agents | Proposal, spec, design, tasks, apply, verify |
| Review agents | Reviewer passes, Judgment Day, quality gates |
| Tech specialists | Framework or language-specific implementation guidance |
| Workflow agents | PR prep, issue creation, docs, repetitive delivery tasks |

## When to create a new agent

Create an agent only when all of these are true:

- the domain appears repeatedly,
- the work has stable decision rules,
- the work benefits from dedicated context,
- a normal skill is no longer enough.

## When NOT to create a new agent

- for one-off tasks,
- for simple prompts,
- when a skill can solve the problem,
- when the specialization is just a renamed generic coder.

## Suggested evolution path

1. Start with conventions and templates.
2. Define domain categories.
3. Create skills for repeated tasks.
4. Promote only mature domains into specialized agents.
