---
name: python-fastapi
description: "Trigger: Python API, FastAPI, uv, async endpoint, Pydantic validation, pytest. Build and test maintainable Python HTTP APIs."
license: Apache-2.0
metadata:
  author: "surre"
  version: "1.0"
---

## Activation Contract

Use this skill for Python backend work centered on FastAPI, async HTTP APIs, request validation, and pytest.

## Hard Rules

- Inspect the consumer project's Python version, `pyproject.toml`, `uv.lock`, and existing conventions before choosing APIs or commands.
- Preserve asynchronous boundaries; do not block the event loop with synchronous network or filesystem I/O inside async handlers.
- Keep Pydantic schemas and validation at the API boundary; do not silently coerce invalid input outside the declared contract.
- Keep Araxys-specific integration guidance in `araxys-integration`; this skill does not authorize edits to external library repositories.

## Decision Gates

| Situation | Action |
| --- | --- |
| Installed version differs from latest docs | Use the installed version's documented API. |
| A handler performs blocking work | Use an existing async API or an explicit worker boundary. |
| Error responses change | Pin status, response shape, and validation behavior with tests. |

## Execution Steps

1. Map the app entry point, routers, schemas, dependency injection, and pytest setup.
2. Define the public request/response and failure behavior before implementation.
3. Add focused pytest coverage through HTTP or the established public boundary.
4. Implement using project conventions and `uv`; avoid adding dependencies without need.
5. Run focused `uv run pytest` checks and required project quality commands.

## Output Contract

Report the Python/runtime versions, API behavior changed, files touched, exact tests run, and compatibility gaps.

## References

- `agents/python-fastapi-specialist.md` — matching role boundaries and workflow.
