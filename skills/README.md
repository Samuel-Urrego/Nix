# Skills

This folder stores reusable, project-authored skills for Nix.

## Suggested structure

```text
skills/
├── README.md
├── _templates/
└── {skill-name}/
    ├── SKILL.md
    ├── assets/
    └── references/
```

## Rule

If the task pattern is repeated and stable, create a skill. If it is broad, unstable, or one-off, keep it out of `skills/`.

## Project-authored vs external skills

- Project-authored skills live here and follow [`agents/skill-style-guide.md`](../agents/skill-style-guide.md). Scaffold one with `nix-ai skill:new --id=<id> --root=.`.
- External skills with an upstream source are not vendored here. They are installed from a pinned commit into `.opencode/skills/<id>/` or `.agents/skills/<id>/` by the skill catalog. See [`agents/skill-catalog.md`](../agents/skill-catalog.md).
- Stack-to-skill mapping lives in [`agents/skill-compatibility.md`](../agents/skill-compatibility.md).
