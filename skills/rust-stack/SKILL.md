---
name: rust-stack
description: "Trigger: Rust, Cargo, Axum, Actix, Rocket, Tokio, SQLx, Diesel, Tauri, Leptos. Pick the Rust framework and verify it against the installed crate versions."
license: Apache-2.0
metadata:
  author: "surre"
  version: "1.0"
---

## Activation Contract

Use this skill for Rust work where the framework is not already decided, or where a decision must be defended. Load it before adding crates, before choosing an async runtime, and before designing module boundaries.

## Hard Rules

- Read `Cargo.toml`, `Cargo.lock`, the workspace layout, and the toolchain file before recommending a crate. The installed version is the truth; do not describe an API the locked version does not have.
- Prefer the standard library and an existing dependency over a new one. Every new crate is a supply-chain and compile-time cost.
- `unsafe` needs a written justification and a test that would fail without it. Do not introduce it for convenience.
- Do not change the established error strategy (typed error enum vs `anyhow`) in a crate that already has one.

## Framework Map

| Need | Choose | Avoid when |
| --- | --- | --- |
| HTTP API with strong typing | Axum | You need mature built-in extractors across many teams and can accept more ceremony: Actix Web is viable |
| Highest-throughput HTTP, mature ecosystem | Actix Web | You want the smallest conceptual surface and tight Tokio integration |
| Fast prototype, batteries included | Rocket | You need fine-grained tower middleware composition |
| Async runtime | Tokio | The project is deliberately `async-std`-based or fully synchronous |
| SQL with compile-time checked queries | SQLx | The team cannot run database access at build time: use Diesel or SeaORM |
| ORM with migrations and relations | SeaORM or Diesel | You only need a handful of queries: SQLx is simpler |
| Desktop app | Tauri | You need a single-language native UI: use a native toolkit |
| WASM frontend | Leptos or Dioxus | The team is not fluent in signals/ownership-driven UI |
| Serialization | Serde | — (it is the ecosystem default) |
| Observability | `tracing` + `tracing-subscriber` | — |
| Benchmarks | Criterion | — |

## Decision Gates

| Situation | Action |
| --- | --- |
| The service is CPU-bound | Use `spawn_blocking` or a bounded thread pool; never block the async executor. |
| Shared mutable state across handlers | Prefer `Arc<AppState>` with immutable config; locks only around the minimum critical section. |
| A crate's MSRV exceeds the project's toolchain | Pin a compatible version or raise the toolchain deliberately, and say which. |
| Error type crosses a module boundary | Return a typed error, convert at the edge, and keep internal detail out of API responses. |

## Execution Steps

1. Read manifest, lockfile, toolchain, workspace members, and existing error and logging conventions.
2. State the decision (framework, runtime, persistence) and the reason, with the alternative rejected.
3. Add the smallest dependency set and enable only the features used.
4. Implement with explicit types at public boundaries; keep `pub` surface minimal.
5. Add unit tests beside the module and one integration test through the public interface.

## Verification

- `cargo check --all-targets`, `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt --check`.
- For a service change, assert status codes and payload shape, not only the happy path.

## Pitfalls

- `unwrap`/`expect` on request-derived input.
- Holding a `MutexGuard` across `.await`.
- Feature flags that silently enable a second runtime.
- Rewriting an existing module into an async API when the call site is synchronous.
