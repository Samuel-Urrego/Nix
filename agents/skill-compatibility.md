# Skill Compatibility Matrix

This is a maintained mapping from the real technology stack in [`stack-inventory.md`](stack-inventory.md) to selected skills. It is reviewed by hand; Nix does not scan repositories to infer compatibility.

## How to read it

- **Recommended**: the skill has a clear, repeated use in that domain.
- **Situational**: useful only for a specific kind of task in that domain.
- **Not a fit**: do not install it for that domain.

## Matrix

| Stack domain | Signals | Recommended | Situational | Not a fit |
|--------------|---------|-------------|-------------|-----------|
| Python + uv + FastAPI | Python 3.13, uv, FastAPI, Pydantic, Pytest | `grafana-k6`, `security-audit` | `accessibility` for server-rendered docs | `emil-design-eng`, `design-taste-frontend` |
| Astro + Tailwind | Astro, Tailwind, content sites | `accessibility`, `emil-design-eng` | `design-taste-frontend` for greenfield pages; `brag` for launch videos | `grafana-k6` unless load testing the site |
| React + Vite + Tailwind | React, Vite, Tailwind, component work | `emil-design-eng`, `accessibility` | `design-taste-frontend` for redesigns or greenfield UI; `brag` for launch videos | `grafana-k6` unless testing the UI under load |
| Blazor + .NET + SQL Server | C#, .NET 8/10, Blazor, Dapper, stored procedures | `security-audit` | `grafana-k6` for API performance | `emil-design-eng`, `design-taste-frontend` |
| MCP server development | C#/.NET or TypeScript MCP servers, tool contracts | `security-audit` | `accessibility` for tool output rendered in a UI | `brag` |
| AI / vector applications | FastAPI, Pinecone, OpenAI, LangChain | `security-audit` | `grafana-k6` for latency and load behavior | `emil-design-eng`, `design-taste-frontend` |
| Launch and marketing | Product sites, demos, share copy | `brag` | `design-taste-frontend` for the landing page | `grafana-k6`, `security-audit` unless the surface is public |
| Cross-cutting review | Any repository before release | `security-audit`, `accessibility` | `grafana-k6` for performance evidence | `brag` |

## Existing skills outside the catalog

These are already available at user scope and are not installed by the phase 6 catalog:

| Skill | Scope | Relationship to the stack |
|-------|-------|---------------------------|
| `dotnet-backend-patterns` | User | Reinforces the C#/.NET, Dapper, and MCP domains. |
| `vercel-react-best-practices` | User | Reinforces React and Vite component work. |
| `vercel-composition-patterns` | User | Complements React composition and component architecture. |
| `nix-core` | Project | Nix's own architecture and safe-delivery conventions. |

## Review rule

When a new technology domain becomes recurring, add a row here before adding a catalog entry. When a skill stops matching a domain, change the matrix and the catalog together in the same reviewed change.
