# Nix Stack Inventory

This document captures the real technology domains, architectural styles, and recurring engineering patterns that Nix should support first.

## Goal

Build Nix around proven day-to-day usage instead of imaginary future needs.

## Technology inventory

### Python ecosystem

| Area | Technologies |
|------|--------------|
| Language/runtime | Python 3.13 |
| Package management | uv |
| Web/API | FastAPI, Uvicorn |
| Validation/config | Pydantic v2, pydantic-settings |
| Tooling | Ruff, Mypy, Pytest, Typer |
| AI/data | Pinecone, OpenAI, LangChain |
| Libraries | Custom Python libraries and CLIs |

### Frontend ecosystem

| Area | Technologies |
|------|--------------|
| Content/frontend | Astro |
| SPA/frontend | React, Vite |
| Styling | Tailwind CSS |
| UI composition | Component-first frontend workflows |

### .NET ecosystem

| Area | Technologies |
|------|--------------|
| Language/runtime | C#, .NET 8, .NET 10 |
| Web UI | Blazor |
| Data access | Dapper |
| Database | SQL Server |
| Data patterns | Stored procedures |
| Protocol/integration | MCP servers |

## Architectural patterns in real use

| Pattern | Context |
|---------|---------|
| Clean Architecture | Enterprise .NET application development (for example SUITE) |
| Modular backend design | Python/FastAPI libraries and services |
| CLI + library duality | Python toolchains and reusable internal libraries |
| Read-only defensive MCP server design | SQL Server MCP server |
| Component-oriented frontend structure | Astro, React, Blazor UI work |

## Verified project signals

| Project | Signals |
|---------|---------|
| `C:\Proyectos\Araxys` | Python, uv, FastAPI, strict tooling, custom library development |
| `C:\Proyectos\Kurunami` | Python, uv, FastAPI, Pinecone, OpenAI, Celery, backend platform work |
| `C:\Proyectos\Araxys-Web` | Astro, Tailwind |
| `C:\Proyectos\PortFolio` | Astro, Tailwind, documented experience with SUITE, SQL Server MCP, and SQL tooling |
| `C:\Proyectos\AmorYCerezas\frontend` | React, Vite, Tailwind |
| `C:\Proyectos\ChatFlotante` | Blazor |
| `C:\Proyectos\SQLSERVERMCP` | C#, .NET 10, SQL Server, Model Context Protocol |
| `C:\Proyectos\ChatBotVectorialDB` | FastAPI, Pinecone, LangChain |

## What Nix should optimize for

### First-class domains

- Python + uv + FastAPI
- Astro + Tailwind
- React + Vite + Tailwind
- C# + .NET + Blazor
- SQL Server + Dapper + stored procedures
- MCP server development
- AI apps using Pinecone and OpenAI

### Cross-cutting concerns

- architecture selection,
- testing and strict TDD,
- review and verification,
- documentation and onboarding,
- reusable workflow automation,
- packaging and CLI ergonomics.

## Implication for Nix

Nix should not be hardcoded to one architecture or one framework philosophy.

It should provide:

- technology-aware specialists,
- architecture-aware reviewers,
- pattern-aware skills,
- and adapters that can be reused across companies and repositories.
