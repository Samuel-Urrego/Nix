---
name: go-stack
description: "Trigger: Go, golang, net/http, chi, gin, echo, fiber, gRPC, sqlc, pgx, GORM, cobra. Pick the Go stack and verify it against go.mod."
license: Apache-2.0
metadata:
  author: "Samuel Urrego"
  version: "1.0"
---

## Activation Contract

Use this skill for Go services, CLIs, and libraries where the HTTP framework, persistence layer, or project layout must be decided or validated.

## Hard Rules

- Read `go.mod`, `go.sum`, the Go directive, and the existing package layout first. Match the module path and internal-package conventions already in use.
- Follow the standard project layout only where the project already uses it. Never restructure a working repository to satisfy a blog post.
- Errors carry context with `%w`; sentinel errors are matched with `errors.Is`/`errors.As`. No `panic` on request paths.
- Goroutines have an owner and a stop condition. Every `go` statement must say who waits for it and how it ends.
- Accept interfaces, return structs. Do not introduce an interface before there is a second implementation or a test seam that needs it.

## Framework Map

| Need | Choose | Avoid when |
| --- | --- | --- |
| HTTP with full control, no dependency | `net/http` (1.22+ routing) | You need a large middleware ecosystem out of the box |
| Router with idiomatic middleware | chi | You want a framework with built-in binding and validation |
| Fast API with binding and validation | gin or echo | You prefer compatibility-first `net/http` handlers |
| Maximum throughput, Express-like API | fiber | You need strict `net/http` compatibility (fiber is built on fasthttp) |
| Service-to-service contracts | gRPC + protobuf | The consumer is only a browser or a simple HTTP client |
| Typed SQL, no ORM | sqlc + pgx | The team cannot regenerate code in the build pipeline |
| ORM with associations | GORM | You need the smallest runtime footprint: sqlx/sqlc is leaner |
| CLI | cobra or the `flag` package | The CLI is trivial: stdlib flags are enough |
| Logging | `log/slog` | — |

## Decision Gates

| Situation | Action |
| --- | --- |
| Handler does blocking I/O | Keep it synchronous in the handler goroutine, not inside a goroutine you spawn per request. |
| Shared state between handlers | Pass a dependency struct through the constructor; no package-level mutable state. |
| Context must reach the datastore | Thread `context.Context` from the handler to the query; no `context.Background()` inside a request path. |
| Module pulls a framework for one helper | Implement the helper locally instead. |

## Execution Steps

1. Read `go.mod`, entry points, package boundaries, and test conventions.
2. State the decision (router, persistence, layout) with the rejected alternative.
3. Add dependencies with the Go toolchain and keep `go.sum` consistent.
4. Implement with context propagation and typed errors.
5. Test through the exported API; add one table-driven test for the decision's edge cases.

## Verification

- `go build ./...`, `go vet ./...`, `go test ./...`, and `go test -race ./...` for concurrent code.
- For handlers, assert status, body shape, and that a cancelled context aborts the work.

## Pitfalls

- Unbounded goroutines per request.
- `defer` inside a loop.
- Ignoring `rows.Close()` / `defer resp.Body.Close()`.
- Interfaces introduced for a single implementation.
- Framework migration that changes status codes without a test pinning them.
