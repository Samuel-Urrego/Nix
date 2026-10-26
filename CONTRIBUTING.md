# Contributing to Nix

Thanks for considering a contribution.

Nix is open source, but it is also opinionated. The goal is not to accept random automation ideas. The goal is to build a disciplined AI stack with clear architecture, explicit contracts, and strong verification habits.

## Quick path

1. Read the product and architecture docs.
2. Check whether the proposal fits the current direction.
3. Keep changes small, reviewable, and well-explained.
4. Include docs and tests when the change affects behavior.

## Before you start

Read these first:

- `README.md`
- `agents/product-vision.md`
- `agents/architecture.md`
- `docs/roadmap.md`
- `AGENTS.md`

## Contribution rules

| Rule | Expectation |
|------|-------------|
| Respect boundaries | Do not blur orchestrator, memory, review, and workflow concerns |
| Prefer clarity | Explain the change and the reason behind it |
| Keep it reviewable | Avoid oversized PRs when the work can be sliced |
| Preserve conventions | Skills belong in `skills/`, agent planning belongs in `agents/`, runtime code belongs in `src/` |
| Verify behavior | If behavior changes, tests and docs should reflect it |

## Good first contribution targets

- improve docs,
- refine architecture contracts,
- add reusable project skills,
- improve developer ergonomics,
- add focused scaffolding for runtime modules.

## Changes that need extra care

- new orchestration flows,
- new provider contracts,
- anything that couples Nix directly to one vendor/tool,
- large abstractions introduced before the runtime needs them.

## Pull request checklist

- [ ] The change matches the current Nix direction
- [ ] The diff is intentionally scoped
- [ ] Docs were updated when needed
- [ ] Tests were added or updated when behavior changed
- [ ] The explanation is clear enough for a reviewer to validate intent quickly

## Communication

If you are unsure whether something fits, open an issue or discussion before building a large change.

That saves everyone time and keeps the project coherent.
