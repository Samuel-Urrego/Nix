# Nix Product Vision

Nix is a personal AI stack for disciplined engineering workflows. It is designed to preserve high-value delivery practices from Gentle-ai while replacing framework ownership with a system that is explicit, modular, and extensible.

## Problem

The current stack provides powerful workflows, but the orchestration model, contracts, and extension boundaries are not owned by the Nix project. That makes customization slower and long-term evolution harder.

## Product outcome

Nix should let one maintainer define, run, and evolve:

- planning workflows,
- strict implementation discipline,
- review and verification gates,
- memory-backed continuity across sessions.

## Core principles

| Principle | Meaning |
|-----------|---------|
| Own the architecture | Nix defines its modules, interfaces, and contracts |
| Keep proven workflows | SDD, TDD, reviewers, and Engram stay in the foundation |
| Prefer adapters over coupling | External systems stay behind clear provider interfaces |
| Optimize for evolution | The stack should support replacing or extending integrations later |

## Initial scope

### In scope

- architecture foundation,
- module boundaries,
- memory abstraction,
- review abstraction,
- CLI entry point,
- workflow documentation.

### Out of scope

- full production implementation of every workflow,
- replacing Engram immediately,
- building a UI before the core contracts exist.

## Success criteria

- Nix has a clear module structure.
- Memory is abstracted behind a provider contract.
- SDD and review flows have defined boundaries.
- The project can grow without depending on hidden behavior.
