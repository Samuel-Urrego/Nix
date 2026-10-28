---
name: csharp-stack
description: "Trigger: C#, .NET, ASP.NET Core, EF Core, Dapper, MediatR, Blazor, MAUI, xUnit. Pick the .NET stack and verify it against the project file and target framework."
license: Apache-2.0
metadata:
  author: "surre"
  version: "1.0"
---

## Activation Contract

Use this skill for .NET work where the framework, persistence approach, or project structure must be decided or validated before implementation.

## Hard Rules

- Read the `.csproj`/`.sln`, `TargetFramework`, `Directory.Build.props`, and pinned package versions first. The installed framework decides which APIs exist.
- Keep nullable reference types enabled and do not silence warnings with `!` to make a build pass.
- Async all the way: no `.Result`, `.Wait()`, or `async void` outside event handlers. Pass `CancellationToken` to anything that accepts it.
- Do not replace an established error strategy (`ProblemDetails`, exception middleware, result types) with a different one mid-project.
- Register services in the composition root only; no service locator.

## Framework Map

| Need | Choose | Avoid when |
| --- | --- | --- |
| HTTP API, minimal surface | ASP.NET Core minimal APIs | You need filters, conventions and model binding depth: use MVC controllers |
| HTTP API, mature conventions | ASP.NET Core MVC controllers | The endpoint set is small and would be clearer as minimal APIs |
| Persistence with change tracking | EF Core | You need hand-tuned SQL for a read-heavy path: Dapper |
| Read-heavy queries, explicit SQL | Dapper | The domain is rich and change tracking pays for itself |
| In-process request pipeline | MediatR | The project has no pipeline behaviors and would only gain indirection |
| UI with C# | Blazor (Server or WASM) | The team ships a separate SPA and wants no second UI runtime |
| Cross-platform client | .NET MAUI | The target is desktop-only and WPF/WinUI is already in use |
| Tests | xUnit (or NUnit if already present) | — |
| Resilience | Polly | The project already centralizes retries in a gateway |
| Logging | `Microsoft.Extensions.Logging` + Serilog | — |

## Decision Gates

| Situation | Action |
| --- | --- |
| A query is read-only and hot | Dapper or `AsNoTracking()`; do not pay for change tracking. |
| Background work is needed | `BackgroundService` with its own scope and `CancellationToken`, never a fire-and-forget `Task.Run`. |
| Configuration changes per environment | `IOptions<T>` bound from configuration; no static settings. |
| An endpoint's contract changes | Pin status code and payload with an integration test before changing it. |

## Execution Steps

1. Read project files, target framework, package versions, and existing DI/test setup.
2. State the decision (API style, persistence, layering) and the rejected alternative.
3. Implement with explicit DTOs at the boundary; keep entities out of the response shape.
4. Add unit tests for logic and one integration test through the HTTP surface.
5. Run format, analyzers, and tests.

## Verification

- `dotnet build`, `dotnet test`, `dotnet format --verify-no-changes`, and `dotnet list package --vulnerable` when dependencies change.
- For EF Core changes, verify the migration applies to a fresh database.

## Pitfalls

- `async void`, `.Result`, and `Task.Run` in request paths.
- `DbContext` captured by a singleton.
- N+1 queries from lazy loading after `AsNoTracking` was removed.
- Migrations generated without reviewing the SQL they will run in production.
