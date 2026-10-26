# Optional MCP integrations

Nix can preview, install, update, diagnose, and remove three project-local MCP servers without touching unrelated configuration. Every integration is selected independently and writes only to the current project.

| Integration | Purpose | Network | Credentials | Prerequisite |
|-------------|---------|---------|-------------|--------------|
| `playwright` | Browser automation, page inspection, and end-to-end testing | First run may download the npm package | None written | Node.js with `npx` |
| `codegraph` | Call graphs, code relationships, and impact analysis | None | None written | `@astudioplus/codegraph-mcp` installed in the project |
| `engram` | Persistent project memory across sessions | None | None written | `engram` available on `PATH` |

## Target files and scope

All integrations are **project-scoped**. Nix never edits global user configuration.

| Agent | File | Shape |
|-------|------|-------|
| OpenCode | `opencode.json` | `mcp.servers.<id>` (OpenCode V2) |
| Codex | `.codex/config.toml` | `[mcp_servers.<id>]` |

OpenCode config is parsed as JSON. Malformed JSON is diagnosed as invalid and is never overwritten. Legacy `mcp.<id>` entries are recognized as existing servers but new entries are written under `mcp.servers`.

The Codex adapter edits only the matching `[mcp_servers.<id>]` section. Comments, keys, and other sections outside that block are preserved byte-for-byte. Duplicate managed sections are rejected. The adapter does not parse unrelated TOML features.

## Commands

```text
nix-ai mcp:list
nix-ai mcp:status --root=.
nix-ai mcp:preview --id=codegraph --agent=opencode --root=.
nix-ai mcp:install --id=codegraph --agent=opencode --root=. --yes
nix-ai mcp:update  --id=codegraph --agent=opencode --root=. --yes
nix-ai mcp:remove  --id=codegraph --agent=opencode --root=. --yes
```

`--agent` accepts `opencode` or `codex`. Mutating actions require `--yes`.

Preview is read-only and always shows:

- `Scope: project` and the exact target path;
- `Network: none` or `first-run`;
- `Credentials: none required`, or the environment variable names a future remote integration would reference;
- missing prerequisites, if any.

Install refuses when a prerequisite is missing. It also refuses when an existing same-name server was not installed by Nix, because that entry is user-owned.

## Ownership and safe updates

Nix records each install in `.nix/mcp/managed.json` with the integration id, agent, install time, and a hash of the installed specification.

| Situation | Preview | Install | Update | Remove |
|-----------|---------|---------|--------|--------|
| No entry | `install` | writes the server | refuses (not managed) | refuses (not managed) |
| Managed and matches catalog | `already-current` | no-op | rewrites the catalog spec | removes |
| Managed but catalog changed | `update` | rewrites and updates the record | rewrites and updates the record | removes the recorded version |
| Managed but edited outside Nix | `conflict` | refuses | restores the catalog spec | refuses |
| Same name, no Nix record | `conflict` | refuses | refuses | refuses |
| Invalid OpenCode JSON | `conflict` | refuses | — | — |

Removal deletes only the Nix-managed entry and its ownership record. Other servers, top-level settings, and user files stay intact. Engram removal never deletes the local memory store.

## Diagnosis

`mcp:status` reports one line per integration and agent:

- `absent` — no entry exists;
- `current` — installed spec matches the catalog;
- `update-available` — installed spec still matches the Nix record, but the catalog changed;
- `modified` — the on-disk entry no longer matches the Nix record;
- `conflict` — an entry exists but Nix did not install it;
- `invalid` — the configuration file cannot be parsed.

`update` is the explicit recovery path for a modified managed entry. It restores the catalog spec and rewrites the ownership hash.

## Credentials

These three integrations require no credentials. Nix never writes literal secrets. If a future integration needs a token, the catalog must reference it as an environment placeholder (for example `{env:MCP_API_KEY}` for OpenCode) and declare the variable name in its credential policy; the value stays in the user's environment.

## Current limits

- Only OpenCode and Codex project-local configuration is supported.
- Playwright package download happens on first server start; Nix does not prefetch it or install browsers.
- The Codex adapter performs narrow section editing, not full TOML parsing.
- `mcp:status` checks configuration and prerequisites, not a live MCP handshake.
