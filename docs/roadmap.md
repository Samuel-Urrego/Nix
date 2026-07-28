# Nix Roadmap

## Phase 1 — Foundation

- [x] Create root project structure
- [x] Write product vision
- [x] Write architecture foundation
- [x] Define initial roadmap
- [x] Add agent and skill conventions
- [x] Add reusable skill templates
- [x] Document stack inventory
- [x] Define first skill/agent matrix
- [x] Define reviewer strategy
- [x] Choose implementation language/runtime
- [x] Define module contracts

## Phase 2 — Core contracts

- [ ] Define `MemoryProvider`
- [ ] Define review provider contracts
- [ ] Define workflow models for SDD phases
- [ ] Define TDD policy rules
- [x] Define CLI command surface
- [ ] Define agent specification format
- [x] Define reviewer specification format
- [x] Define architecture selector rules
- [x] Define pattern reviewer rules

## Phase 3 — First executable slice

- [x] Bootstrap runnable CLI
- [ ] Wire orchestrator to memory provider
- [ ] Implement minimal SDD flow skeleton
- [ ] Implement verification and review hooks

## Phase 4 — Hardening

- [ ] Add tests for orchestration contracts
- [ ] Add documentation for extension points
- [ ] Review naming, boundaries, and dependency direction

## Recommended next move

Start wiring configuration, reviewer loading, and repository scanning into the TypeScript core.
