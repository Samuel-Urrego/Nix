<p align="center">
  <img src="./docs/assets/logo.png" alt="Nix logo" width="420" />
</p>

<h1 align="center">Nix</h1>

<p align="center">
  <strong>Built in the shadow. Designed to illuminate.</strong>
</p>

<p align="center">
  An open-source AI stack for disciplined software delivery.
</p>

<p align="center">
  <em>Repository setup in progress — public URL coming soon.</em>
</p>

---

## Why Nix

Most AI coding setups optimize for speed first and thinking second.

Nix goes the other way.

Nix is being built as an opinionated AI stack for engineers who want structure, verification, and long-term ownership — not prompt chaos, disposable automation, or black-box habits.

It keeps the strongest ideas from proven workflows and rebuilds them under a system that is modular, explicit, and fully extensible.

## Vision

Nix exists to make AI-assisted development feel less like improvisation and more like engineering.

The goal is to provide a stack where:

- planning is intentional,
- implementation is disciplined,
- verification is mandatory,
- memory survives across sessions,
- and specialization grows through reusable skills and agents.

## Core foundations

Nix starts from five non-negotiable foundations:

- **SDD** — Spec-Driven Development for intentional change design
- **Strict TDD** — tests are part of delivery, not decoration
- **Reviewers** — quality gates for implementation and delivery
- **Judgment Day** — adversarial review for high-confidence validation
- **Engram** — persistent memory for continuity across sessions

These are not side features. They are the spine of the stack.

## What Nix is building

Nix is being designed as a modular system with clear boundaries between orchestration, workflows, memory, review, and specialization.

```text
agents/              # Agent catalogs, role definitions, specialization plans
docs/                # Product, architecture, conventions, roadmap
skills/              # Reusable project skills and templates
src/
├── cli/             # Commands and entry points
├── orchestrator/    # Workflow coordination and policy enforcement
├── sdd/             # Proposal, spec, design, tasks, apply, verify
├── review/          # Review adapters, gates, Judgment Day hooks
├── memory/          # MemoryProvider abstraction and Engram integration
└── testing/         # Strict TDD policy and verification helpers
```

## Design principles

| Principle | Meaning |
|----------|---------|
| Ownership over dependence | Nix owns the contracts, boundaries, and workflow semantics |
| Adapters over coupling | External systems stay behind explicit interfaces |
| Skills before agents | Repeated workflows become skills before they become specialists |
| Verification over vibes | Delivery must be reviewable, testable, and explainable |
| Evolution by design | The stack should grow without collapsing into prompt spaghetti |

## Current status

Nix is in its foundation stage.

What already exists:

- initial project structure,
- architecture and product docs,
- agent and skill conventions,
- reusable skill templates,
- a roadmap for future specialization.

What comes next:

- runtime selection,
- core contracts,
- CLI bootstrap,
- first executable orchestration slice.

## Getting started

Nix is still in bootstrap mode, but the repository is already structured so contributors can understand the direction quickly.

### Quick path

1. Install Node.js 20.11+.
2. Run `npm install`.
3. Run `npm run doctor`.
4. Explore `npm run reviewers:list` and `npm run stack:scan`.

### Repository reading path

1. Read `C:\Proyectos\Nix\docs\product-vision.md`
2. Read `C:\Proyectos\Nix\docs\architecture.md`
3. Read `C:\Proyectos\Nix\docs\roadmap.md`
4. Check `C:\Proyectos\Nix\AGENTS.md` and `C:\Proyectos\Nix\docs\skill-style-guide.md`

### Current repository focus

| Area | Status |
|------|--------|
| Brand and vision | Ready |
| Architecture foundation | Ready |
| Agent and skill conventions | Ready |
| TypeScript runtime bootstrap | Ready |
| Public contribution flow | Ready for first repo push |

## Documentation

- `C:\Proyectos\Nix\docs\product-vision.md`
- `C:\Proyectos\Nix\docs\architecture.md`
- `C:\Proyectos\Nix\docs\roadmap.md`
- `C:\Proyectos\Nix\docs\agent-system.md`
- `C:\Proyectos\Nix\docs\skill-style-guide.md`
- `C:\Proyectos\Nix\docs\tech-agent-roadmap.md`

## Contributing

Nix is intended to be open source, but not directionless.

If you want to contribute, the expectation is simple:

1. understand the architecture before adding abstractions,
2. preserve clear module boundaries,
3. prefer reusable skills over vague agent sprawl,
4. treat tests, reviews, and documentation as part of the change.

If a contribution makes the stack faster but less understandable, it is probably the wrong contribution.

Before opening a PR, read:

- `C:\Proyectos\Nix\CONTRIBUTING.md`
- `C:\Proyectos\Nix\CODE_OF_CONDUCT.md`
- `C:\Proyectos\Nix\SECURITY.md`

## Long-term direction

Over time, Nix will grow into a system with:

- specialist agents for recurring technology domains,
- project skills for repetitive engineering workflows,
- strong orchestration rules,
- portable provider contracts for memory and review systems.

The point is not to have “more AI”.

The point is to have a better-engineered AI stack.

## Philosophy

Nix is inspired by a simple belief:

> AI should accelerate disciplined engineering, not replace it.

## License

This project is licensed under the MIT License. See `C:\Proyectos\Nix\LICENSE`.
