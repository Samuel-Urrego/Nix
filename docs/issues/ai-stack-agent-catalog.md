# Global specialist-agent catalog

## Outcome

Add a Nix-managed catalog and safe lifecycle for native global specialist-agent definitions in OpenCode and Codex.

## Scope

- Define stable agent IDs, descriptions, instruction sources, supported agents, and target paths.
- Use Codex TOML custom-agent files and OpenCode Markdown agent files.
- Provide list, preview, status, install, and remove behavior consistent with Nix ownership conventions.
- Preserve unrelated/user-owned files and refuse unmanaged overwrites or destructive removal.

## Acceptance

- Both native formats are validated before write.
- Preview is read-only and identifies exact global targets.
- Install/remove operate only on Nix-owned files and preserve user-owned targets.
- Tests cover paths, format validation, idempotency, conflicts, and preservation.

## Dependencies and checks

- Depends on existing global skill/MCP path and managed-ownership patterns.
- Risk: global installer/environment boundary.
- Run focused agent-catalog tests, `npm run typecheck`, and the full suite at feature closure.
