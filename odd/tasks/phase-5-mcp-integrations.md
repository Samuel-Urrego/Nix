# Phase 5 — Optional MCP integrations

Objective: Deliver a project-local MCP catalog with Playwright, CodeGraph, and Engram, safe preview/install/update/remove for OpenCode and Codex, explicit network/credential/scope disclosure, and ownership tracking that preserves unrelated servers.
Branch: `codex/phase-1-tui` (preserves the existing dirty worktree; no commits that capture unrelated phase work).
Delivery: `ask-on-risk`; forecast approximately 750 authored lines. Test runner: `npm test`, `npm run typecheck`, and `npm run build`.

## Specs

1. **S1 — Catalog format.** Roadmap: "Define an MCP catalog format with purpose, prerequisites, configuration fields, credential handling, supported agents, and removal behavior." Each entry declares id, purpose, local server command, supported agents, project scope, network access, prerequisite checks, credential policy, and the removal rule.
2. **S2 — Three integrations.** Roadmap: "Add Playwright, CodeGraph, and Engram as separately selectable integrations." Playwright uses `npx -y @playwright/mcp@latest`; CodeGraph uses the pinned local package under `node_modules`; Engram uses `engram mcp --tools=agent`. Each is selected independently.
3. **S3 — Explicit disclosure before writes.** Roadmap: "Make network access, credentials, and project/global configuration scope explicit before writes." Preview and install output must state project scope and target path, network behavior, credential requirements (these three require none), and missing prerequisites.
4. **S4 — Preview and preservation.** Roadmap: "Preview MCP configuration changes and preserve pre-existing servers and settings." Preview is read-only. Writes preserve unrelated keys, servers, comments outside managed Codex sections, and user-owned entries; a same-name unmanaged server is a conflict, never an overwrite.
5. **S5 — Lifecycle coverage.** Roadmap: "Test install/update/remove, duplicate detection, invalid configuration, and missing prerequisites." Tests cover install, idempotent reinstall, update of a modified managed entry, removal, duplicate/user-owned conflicts, malformed OpenCode JSON and malformed Codex sections, and missing prerequisite refusal.
6. **S6 — Ownership and diagnosis.** Removal and update act only on Nix-managed records tracked in `.nix/mcp/managed.json`; a managed server modified outside Nix is reported as modified and refused. Status reports config validity, installed state, and prerequisites per agent.

## Tasks

- T1 — S1, inline; **complete**. `mcp-contracts.ts` and `mcp-catalog.ts` define the catalog format and the three entries; two catalog tests pass.
- T2 — S1-S4, inline; **complete**. OpenCode JSON and Codex TOML section adapters preserve unrelated configuration, reject malformed/duplicate config, and support read/list/write/remove. `.nix/mcp/managed.json` records id, agent, spec hash, and install time. Four adapter tests pass.
- T3 — S1-S5, inline; **complete**. Service implements preview, install, update, remove, status, prerequisite checks, conflict/modified detection, and stable spec hashing. Six service tests pass, including read-only preview, missing prerequisite, user-owned conflict, modified update/remove, invalid JSON, and first-run network disclosure.
- T4 — S2-S6, inline; **complete**. CLI adds `mcp:list`, `mcp:status`, `mcp:preview`, `mcp:install`, `mcp:update`, and `mcp:remove`; two end-to-end tests pass, including `--yes`, prerequisite refusal, preservation of an unrelated server, and removal.
- T5 — S2-S6, inline; **complete**. TUI MCP category shows per-agent status from `getMcpStatus`; added `agents/mcp-integrations.md`, updated README and agent index, and reconciled the roadmap. Full typecheck, 65/65 tests, build, and CLI smoke checks pass.

## Log

- L1 (2026-10-20): "brother en la carpetas /docs tienes todas las features pendientes divididas en fases, quiero que analices en cual vamos y empieces cada fase, cada que termines una fase por completo me avisas"
- L2 (2026-10-20): "si" — user authorizes starting Phase 5 after Phase 4 closed.
- L3 (2026-10-20): Verified formats from the repository and OpenCode V2 docs: OpenCode uses project `opencode.json` with `mcp.servers.<id>`; Codex uses project `.codex/config.toml` with `[mcp_servers.<id>]`; Engram's local command is `engram mcp --tools=agent`. All three integrations are project-scoped and require no credentials.
- L4 (2026-10-20): Design decision: Nix tracks ownership in `.nix/mcp/managed.json` with a hash of the installed spec. Same-name entries not present in the manifest are user-owned conflicts; manifest entries whose current spec hash no longer matches are "modified" and are never overwritten or removed.
- L5 (2026-10-20): RED observed: all new MCP tests failed with `ERR_MODULE_NOT_FOUND` before implementation. Catalog and adapter tests then passed 6/6; service tests passed 6/6 after the service landed.
- L6 (2026-10-20): Codex config editing is intentionally narrow: only the matching `[mcp_servers.<id>]` section is replaced or removed, duplicate managed sections are rejected, and unrelated comments/keys remain untouched. The adapter does not attempt full TOML parsing.
- L7 (2026-10-20): OpenCode config follows V2 `mcp.servers.<id>`. Legacy `mcp.<id>` entries are recognized for duplicate detection and removal, but new writes use `mcp.servers`. Malformed JSON is diagnosed as invalid and preserved.
- L8 (2026-10-20): CLI smoke checks: `mcp:list` lists three entries; `mcp:status --root=.` reports project-scoped state; `doctor` still reports bootstrap-ready. The repository's existing CodeGraph entries are correctly detected as user-owned conflicts because they predate the Nix manifest.
- L9 (2026-10-20): Final checks: `npm run typecheck` passed, `npm test` passed 65/65, `npm run build` passed. No commit created so unrelated dirty phase work is not captured.

Risk: items 1 (new persisted ownership manifest and project config edits), 2 (credential-boundary disclosure and config ownership safety), 3 (MCP configuration contracts consumed by OpenCode and Codex), and 5 (project-local installer path changes).
