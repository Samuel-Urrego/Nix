# Support matrix

This matrix records what the current release verifies. It is not a roadmap promise. A feature marked **Unverified** may exist in code but is not part of the supported release contract.

## Platform and runtime

| Area | Status | Notes |
|------|--------|-------|
| Windows 10/11 | **Supported** | The only verified platform for v1. |
| macOS | **Unverified** | Not part of the v1 support contract. |
| Linux | **Unverified** | Not part of the v1 support contract. |
| Node.js `>=20.11.0` | **Supported** | Required by `package.json` and the release manifest. |
| npm-compatible package manager | **Supported** | `npm ci`, `npm run build`, and the CLI are the verified path. |
| PowerShell | **Supported** | Security-hook inspection and CLI usage. |
| `cmd.exe` | **Supported** | Security-hook inspection and CLI usage. |
| Git Bash/MSYS | **Supported** | Security-hook inspection and CLI usage. |

## Agents

| Agent | Status | Supported surface |
|-------|--------|-------------------|
| OpenCode | **Supported** | Global skills, MCP entries, security hooks, workflow slash commands, SDD/TDD workflows. |
| Codex | **Supported** | Global skills, MCP entries, security hooks, workflow user skills, SDD/TDD workflows. Custom slash prompts are not supported. |
| Other agents | **Unsupported** | No adapter is implemented. |

Codex custom slash prompts are deprecated upstream; Nix installs Codex user skills under `~/.agents/skills` instead. The skills invoke the same CLI workflow executor.

## Components and features

| Feature | Status | Scope |
|---------|--------|-------|
| Nix Core component lifecycle | **Supported** | Global install, update, backup, restore, and uninstall for `skill.nix-core`. |
| External skill catalog | **Supported** | Six pinned skills, global, OpenCode and Codex. See [skill catalog](skill-catalog.md). |
| Optional MCP integrations | **Supported** | Playwright, CodeGraph, and Engram; global; prerequisites apply. |
| SDD/TDD workflows | **Supported** | Independently configurable, project-keyed records under the Nix home, CLI execution. |
| Workflow command catalog | **Supported** | `/new-feat`, `/refactor`, `/new-idea`; global OpenCode commands and Codex user skills. |
| Blind-judge evaluation | **Supported** | Isolated context groups, five neutral evaluators, bounded synthesis; not a process sandbox. |
| Security hooks | **Supported, advisory** | Opt-in, global, Windows shells; not a sandbox. |
| Configuration and doctor | **Supported** | Global `config.json`, stack preferences, diagnostic report. |
| Release checksums | **Supported** | SHA-256 manifest and verification; integrity only. |
| Release signing | **Not implemented** | No key infrastructure or trust root. |
| Global configuration | **Supported** | State, config, managed records, and agent surfaces live under the Nix home. |
| Project-local installation | **Unsupported** | Component, skill, MCP, workflow-command, and hook operations are global. |
| Automatic state migration | **Unsupported** | Unsupported schemas are rejected. |
| Sandboxing | **Unsupported** | Hooks and blind-judge evaluation are advisory boundaries, not sandboxes. |
| AI-backed reviewer execution | **Unsupported** | The reviewer command remains heuristic. |

## Compatibility contract

- Stack state schema: `1`.
- Global configuration: `config.json` under the Nix home, partial, unknown keys ignored.
- Component upgrade: higher version only; downgrade and same-version replacement refused.
- Release artifact: any `dist/` tree plus `release-manifest.json`.
- Supported platform: Windows v1.
- Supported agents: OpenCode and Codex.

## Evidence

- Automated release journey: `test/release/release-journey.test.ts`.
- CLI first-run journey: `test/cli/release-journey.test.ts`.
- Release manifest and verification: `test/release/release-manifest.test.ts` and `test/cli/release-command.test.ts`.
- Full release gate: `npm run release:check`.
- Manual interactive TUI checklist: [installation guide](installation.md#clean-machine-acceptance-checklist).

## Related documents

- [Installation and first run](installation.md)
- [Release and compatibility](release.md)
- [Component catalog](../agents/component-catalog.md)
- [Security hooks](../agents/security-hooks.md)
- [Skill catalog](../agents/skill-catalog.md)
- [Skill compatibility](skill-compatibility.md)
- [Roadmap](roadmap.md)
