# Global Nix AI Stack and Codex workflow skills

Branch: `codex/phase-1-tui`
Delivery strategy: `ask-on-risk`
Test runner: `npm test`

## Specs

### S1 — Global Nix home

- Nix resolves one user-scope home:
  - `NIX_AI_HOME` when set.
  - Windows: `%APPDATA%\Nix AI Stack`.
  - Other platforms: `$XDG_CONFIG_HOME/nix-ai`, else `~/.config/nix-ai`.
- Stack state: `<nix-home>/state.json`.
- Config: `<nix-home>/config.json`.
- Managed skill records: `<nix-home>/managed/skills.json`.
- Managed MCP records: `<nix-home>/managed/mcp.json`.
- Component backups: `<nix-home>/backups/components`.
- Project workflow records: `<nix-home>/projects/<sha256(canonical-project-path)[0..16]>/workflows/<id>.json`.
- Project idea records: `<nix-home>/projects/<sha256(canonical-project-path)[0..16]>/ideas/<slug>.json`.
- Stack-managed writes must not create `.nix`, `.opencode`, `.codex`, `.agents`, or `nix.config.json` inside a project.

### S2 — Global agent targets

- OpenCode config directory: `$XDG_CONFIG_HOME/opencode`, else `~/.config/opencode`.
  - Config file: `opencode.jsonc` when it already exists, otherwise `opencode.json`.
  - Commands: `<opencode-config-directory>/commands`.
  - Skills: `<opencode-config-directory>/skills`.
  - Plugins: `<opencode-config-directory>/plugins`.
- Codex home: `$CODEX_HOME`, else `~/.codex`.
  - Config: `<codex-home>/config.toml`.
  - Hooks: `<codex-home>/hooks.json`.
  - User skills: `~/.agents/skills` (official Codex user-skill location).
- Existing unmanaged entries are preserved. Nix refuses to overwrite an unmanaged target.

### S3 — Global skills

- `skill:preview`, `skill:install`, `skill:update`, `skill:remove`, and `skill:status` operate on global agent targets and the global managed-skill record.
- `skill:new --id=<id> [--agent=opencode|codex]` scaffolds a user-scope skill. Codex is the default agent. The skill is user-owned and is not added to the managed-skill record.

### S4 — Global MCP

- `mcp:preview`, `mcp:install`, `mcp:update`, `mcp:remove`, and `mcp:status` operate on global agent config files and the global managed-MCP record.
- OpenCode `.jsonc` comments and unrelated settings are preserved.
- Existing OpenCode legacy `mcp.<id>` entries keep their legacy shape; an existing `mcp.servers` object keeps the V2 shape. A new config uses `mcp.servers`.
- Codex TOML sections other than the target `[mcp_servers.<id>]` are preserved.

### S5 — Global components and security hooks

- `component` installs Nix Core into `~/.agents/skills/nix-core` and stores backups under `<nix-home>/backups/components`.
- `security:hooks` installs Codex hooks into `<codex-home>/hooks.json` and `<codex-home>/hooks/nix-ai-security`.
- `security:hooks` installs the OpenCode plugin into `<opencode-config-directory>/plugins/nix-ai-security`.
- Existing Codex hooks, OpenCode plugins, and unrelated configuration are preserved.
- The Codex hook command uses an absolute runtime path, not a project-relative path.

### S6 — Codex workflow skills

- `workflow:install-commands --agent=codex --yes` installs three Codex user skills:
  - `~/.agents/skills/new-feat/SKILL.md`
  - `~/.agents/skills/refactor/SKILL.md`
  - `~/.agents/skills/new-idea/SKILL.md`
- `workflow:install-commands --agent=opencode --yes` installs three global OpenCode commands under `<opencode-config-directory>/commands`.
- Each command/skill runs the project-aware CLI form `nix-ai workflow:command ... --root=. --yes`.
- `--remove` removes only Nix-managed command/skill files and preserves unmanaged files.
- `workflow:commands` reports both OpenCode and Codex availability.

### S7 — CLI, TUI, docs, and tests

- CLI and TUI labels report global scope and the resolved Nix home.
- CLI help and README document global paths, `NIX_AI_HOME`, and Codex workflow skills.
- Tests isolate `NIX_AI_HOME`, `HOME`, `USERPROFILE`, `XDG_CONFIG_HOME`, and `CODEX_HOME` in temporary directories.
- Verification: `npm test`, `npm run typecheck`, `npm run build`, `npm run release:check`.

## Tasks

- [x] T1 — Global path resolver, global config/state, and project-keyed workflow storage (`S1`, `S7`) — inline
- [x] T2 — Global skill installation, status, and user-scope skill scaffolding (`S1`, `S2`, `S3`) — inline
- [x] T3 — Global MCP adapters with JSONC-preserving OpenCode editing (`S1`, `S2`, `S4`) — inline
- [x] T4 — Global Nix Core component and global security hooks (`S1`, `S2`, `S5`) — inline
- [x] T5 — Codex workflow skills and global OpenCode commands (`S2`, `S6`) — inline
- [x] T6 — CLI/TUI/help/docs alignment and full verification (`S7`) — inline

## Log

### L1

User: "Nono, yo ya tengo Gentle-ai pero para basarnos en él, la idea es quedarnos solo con el nuestro propio que seria Nix"

Earlier request in this session: convert Nix AI Stack into a self-contained global stack modeled on gentle-ai, and add Codex workflow skills for `/new-feat`, `/refactor`, and `/new-idea`.

### L2 — 2026-10-21

Constraint: do not delete or modify gentle-ai automatically. Nix must become self-sufficient and may coexist with gentle-ai until the user removes it.

### L3 — 2026-10-21

Evidence: Codex custom prompts are deprecated and removed in Codex CLI 0.117.0. Codex user skills live at `~/.agents/skills`; this feature uses skills instead of custom prompts.

### L4 — 2026-10-21

Evidence: the existing global OpenCode config is `C:\Users\surre\.config\opencode\opencode.jsonc` and uses legacy direct `mcp.<id>` entries. Preserve that shape and its comments.

### L5 — 2026-10-26

Verification:
- `npm test`: 112 tests, 112 pass, 0 fail.
- `npm run typecheck`: exit 0.
- `npm run build`: exit 0.
- `npm run release:manifest`: exit 0, version 0.1.0, 147 files.
- `npm run release:verify`: exit 0, "Release manifest verified."

Fixes found during verification:
- `release-manifest` compatibility validator still expected `nix.config.json`; corrected to `config.json` to match `releaseCompatibility`.
- CLI tests now isolate global resolution with `test/helpers/home.ts` and read state/config, OpenCode commands, Codex skills, component targets, and project workflow records from their global paths.
- Codex workflow command test now asserts user-skill installation and removal instead of the retired custom-prompt limitation.

