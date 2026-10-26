# Project Skill Authoring

Use this path when a workflow becomes repeated, stable, and narrow enough to encode as an instruction contract. The normative structure is [`skill-style-guide.md`](skill-style-guide.md).

## Scaffold

```text
nix-ai skill:new --id=<skill-id> --root=.
```

This creates:

```text
skills/<skill-id>/
├── SKILL.md
├── assets/
│   └── .gitkeep
└── references/
    └── .gitkeep
```

The generated `SKILL.md` uses the required sections: Activation Contract, Hard Rules, Decision Gates, Execution Steps, Output Contract, and References.

## Authoring rules

1. Keep one narrow responsibility per skill.
2. Lead with activation triggers and decision boundaries, not background theory.
3. Put reusable assets in `assets/` and long explanations in `references/`.
4. Write artifact-facing instructions in English by default.
5. Prefer project conventions over generic ecosystem advice.
6. If the skill grows because it contains multiple workflows, split it.

## When to use a project skill instead of the catalog

| Situation | Use |
|-----------|-----|
| Nix-specific or repository-specific repeated workflow | Project skill under `skills/` |
| Third-party skill with an upstream source | Catalog entry with a pinned ref |
| One-off task | Neither; do it inline |
| Broad, unstable workflow | Neither; keep it out of `skills/` |

## Promotion

Promote a skill to a dedicated agent only when the domain appears across multiple projects, repeated mistakes keep surfacing, the domain has real decision trees, and a specialist would materially reduce context load. See [`skill-agent-matrix.md`](skill-agent-matrix.md).

## Registration

After creating or changing a project skill, refresh the skill registry so the orchestrator can resolve it:

```text
gentle-ai skill-registry refresh --force
```

The registry indexes paths; `SKILL.md` remains the source of truth.
