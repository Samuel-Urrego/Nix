# Nix Architecture Foundation

## Decision

Nix starts as a modular AI stack with orchestration at the center and external capabilities isolated through adapters.

## Module map

| Module | Responsibility |
|--------|----------------|
| `cli` | Parse commands and invoke workflows |
| `orchestrator` | Coordinate phases, routing, policies, and execution flow |
| `sdd` | Model proposal/spec/design/tasks/apply/verify workflows |
| `review` | Integrate reviewers, gates, and Judgment Day style checks |
| `memory` | Provide persistent context through a provider abstraction |
| `testing` | Enforce strict TDD and runtime verification behavior |

## Key architectural choices

### 1. Orchestrator-centered design

The orchestrator owns workflow sequencing and policy enforcement. Other modules should not independently control global flow.

### 2. Memory provider abstraction

Engram remains the first persistence backend, but Nix should depend on a contract, not an implementation.

Suggested interface:

```text
MemoryProvider
├── save()
├── search()
├── get()
└── summarizeSession()
```

### 3. Review adapters

Reviewer systems should be modeled as adapters so the review policy can remain stable even if tools change later.

### 4. Strict TDD as policy

Testing is not an optional utility. It is a delivery policy that influences apply and verify workflows.

## Dependency direction

```text
cli -> orchestrator
orchestrator -> sdd
orchestrator -> review
orchestrator -> memory
orchestrator -> testing

sdd/review/testing -> provider contracts
provider adapters -> external systems
```

## Risks

- Recreating too much too early instead of defining contracts first
- Coupling Nix directly to Engram or review tooling
- Implementing commands before workflow semantics are stable

## Recommendation

The next implementation step should define contracts and language/runtime selection before building behavior-heavy modules.
