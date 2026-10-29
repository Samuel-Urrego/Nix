---
name: python-stack
description: "Trigger: Python, Django, Flask, Litestar, SQLAlchemy, Pydantic, uv, poetry, pytest, Celery. Pick the Python framework and verify it against the lockfile."
license: Apache-2.0
metadata:
  author: "Samuel Urrego"
  version: "1.0"
---

## Activation Contract

Use this skill when the Python framework or project structure must be decided, or when the existing choice must be validated. For FastAPI specifically, `python-fastapi` is the deeper authority; load both and let it win on FastAPI details.

## Hard Rules

- Read `pyproject.toml`, the lockfile (`uv.lock`, `poetry.lock`), the Python version pin, and the test configuration first.
- Use the project's existing tooling for dependencies and virtual environments. Do not add a second package manager.
- Type hints on public functions; the type checker that the project already configures must stay clean.
- No blocking I/O inside async code; no `async` keyword used only for style.
- Do not introduce a framework to solve a problem the standard library already solves.

## Framework Map

| Need | Choose | Avoid when |
| --- | --- | --- |
| Typed async HTTP API | FastAPI | The project needs a full CMS/admin and ORM-driven conventions: Django |
| Full-stack app with admin, ORM, auth built in | Django (+ DRF only if an API is truly needed) | The deliverable is a small JSON service |
| Small service, minimal abstractions | Flask | You need async-first request handling and typed validation |
| FastAPI alternative with stricter typing | Litestar | The team is not invested in its ecosystem |
| ORM and migrations | SQLAlchemy 2 + Alembic | The project already uses Django ORM |
| Validation and settings | Pydantic v2 / pydantic-settings | — |
| Tests | pytest (+ `pytest-asyncio`, `httpx.AsyncClient`) | — |
| Lint and format | Ruff | The project already uses Black + isort and works |
| Background jobs | Celery or arq | A cron job or a thread suffices |
| HTTP client | httpx | — |

## Decision Gates

| Situation | Action |
| --- | --- |
| A handler awaits a synchronous library | Move it to a thread/executor boundary and say so, or use the async client. |
| Settings come from the environment | One `pydantic-settings` model, injected; no `os.environ` reads scattered in code. |
| A migration is added | Review the generated SQL and confirm it runs forward on a fresh database. |
| A new dependency overlaps an existing one | Use the installed library; do not duplicate a concern. |

## Execution Steps

1. Read `pyproject.toml`, lockfile, Python pin, package layout, and test conventions.
2. State the decision (framework, ORM, task runner) and the rejected alternative.
3. Implement with explicit validation at boundaries and typed public functions.
4. Add unit tests for logic and one API-level test through the public interface.
5. Run the project's lint, type check, and test commands.

## Verification

- `uv run pytest`, the configured linter, and the configured type checker (mypy or pyright) when the project has one.
- For API changes, assert status codes, response shape, and validation errors.

## Pitfalls

- Import cycles caused by putting models next to routers.
- Sync DB drivers inside async endpoints.
- Mutable default arguments and module-level state.
- Tests that hit the network or a real database without a fixture.
- Pinning versions only in `pyproject.toml` while the lockfile drifts.
