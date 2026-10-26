# Installation and first run

This guide covers a clean Windows installation of Nix, the first-run journey, component lifecycle, diagnosis, upgrades, rollback, and removal. It describes only behavior that is implemented and tested in this repository.

## Supported baseline

- **Operating system:** Windows 10 or Windows 11. Other platforms are not verified for v1.
- **Runtime:** Node.js `>=20.11.0` with an npm-compatible package manager.
- **Shells:** PowerShell, `cmd.exe`, and Git Bash/MSYS for security-hook inspection.
- **Agents:** OpenCode and Codex. Additional agent adapters are not implemented.
- **Repository tools:** Git is optional for the core CLI and required to install pinned external skills from their upstream repositories.

The authoritative compatibility record is the release manifest and the [support matrix](support-matrix.md).

## Clean install from source

```powershell
git clone <repository-url> nix
cd nix
npm ci
npm run build
```

The CLI entry point is `dist/cli/index.js`. To expose the `nix-ai` command:

```powershell
npm link
nix-ai --version
```

If you do not want a global link, use `node dist/cli/index.js <command>` instead of `nix-ai`.

## First run

Run the diagnostic from the project you want to manage:

```powershell
cd C:\path\to\your-project
nix-ai doctor --root=.
```

Expected result: the report ends with `Status: bootstrap-ready` and shows the current version, stack preferences, workflow settings, reviewer sources, and release compatibility.

Create a project-local configuration when you want explicit settings:

```powershell
nix-ai config:init --root=.
```

This writes `nix.config.json` in the selected project. The file is optional; Nix uses defaults when it is absent.

Open the interactive terminal UI with no command:

```powershell
nix-ai
```

The TUI provides the guided path for previewing and managing components. The CLI equivalents below exercise the same project-local lifecycle and are the automated path used by the release tests.

## Install the Nix Core component

```powershell
nix-ai component --action=preview --component=skill.nix-core --root=.
nix-ai component --action=install --component=skill.nix-core --root=. --yes
```

The install writes only inside the selected project:

```text
.agents/skills/nix-core/SKILL.md
.agents/skills/nix-core/.nix-ai-managed.json
```

Mutating actions require `--yes`. Nix refuses to overwrite an unowned target or content it does not manage.

## Optional project-local setup

Security hooks are opt-in and advisory, not a sandbox:

```powershell
nix-ai security:hooks --action=preview --root=.
nix-ai security:hooks --action=install --root=. --yes
```

Enable SDD and/or TDD independently:

```powershell
nix-ai workflow:configure --sdd=on --tdd=on --yes
nix-ai workflow:status
```

Optional MCP integrations and external skills:

```powershell
nix-ai mcp:list
nix-ai mcp:preview --id=codegraph --agent=opencode --root=.
nix-ai mcp:install --id=codegraph --agent=opencode --root=. --yes

nix-ai skill:list
nix-ai skill:preview --id=brag --agent=codex --root=.
nix-ai skill:install --id=brag --agent=codex --root=. --yes
```

OpenCode slash commands for the workflow catalog:

```powershell
nix-ai workflow:install-commands --agent=opencode --root=. --yes
```

Codex custom slash prompts are deprecated upstream and are not supported. Use the Codex CLI workflow commands instead.

## Diagnose

```powershell
nix-ai doctor --root=.
nix-ai component --action=list-backups --component=skill.nix-core --root=.
nix-ai security:hooks --action=status --root=.
nix-ai workflow:status
nix-ai mcp:status --root=.
nix-ai skill:status --root=.
```

`doctor` reports the stack-state schema, configuration source, workflow settings, reviewer sources, and release compatibility. An invalid stack-state file is reported as invalid; Nix does not silently replace it.

## Update and upgrade

For a source checkout:

```powershell
git pull
npm ci
npm run build
nix-ai doctor --root=.
```

For a managed component:

```powershell
nix-ai component --action=preview --component=skill.nix-core --root=.
nix-ai component --action=update --component=skill.nix-core --root=. --yes
```

Upgrade rules:

- An update requires a higher component version.
- A downgrade is refused.
- A same-version replacement with different content is refused.
- Stack state schema 1 is current. An unsupported schema is rejected with a clear error instead of being migrated implicitly.
- `nix.config.json` is read as a partial configuration; unknown keys are ignored for forward compatibility.

## Backup, restore, and rollback

Create a backup before a risky change:

```powershell
nix-ai component --action=backup --component=skill.nix-core --root=. --yes
nix-ai component --action=list-backups --component=skill.nix-core --root=.
```

Roll back by removing the managed component and restoring the backup:

```powershell
nix-ai component --action=uninstall --component=skill.nix-core --root=. --yes
nix-ai component --action=restore --component=skill.nix-core --backup=<backup-id> --root=. --yes
```

Backups live under `.nix-ai/backups/` inside the project. A restore refuses to overwrite an existing managed target. Stack-state writes also keep a `.bak` copy of the previous state file.

## Remove

Remove only what Nix manages:

```powershell
nix-ai component --action=uninstall --component=skill.nix-core --root=. --yes
nix-ai security:hooks --action=uninstall --root=. --yes
nix-ai workflow:install-commands --agent=opencode --root=. --remove --yes
nix-ai mcp:remove --id=codegraph --agent=opencode --root=. --yes
nix-ai skill:remove --id=brag --agent=codex --root=. --yes
```

Uninstall refuses to remove content that no longer matches the managed owner record. Use `skill:update` or `mcp:update` to restore managed content first, then remove it.

Removing a component does not delete user-owned files, unrelated agent configuration, backups, or stack state. Delete those manually only after reviewing them.

## Clean-machine acceptance checklist

Use a fresh Windows user profile or a disposable VM:

1. Install Node.js 20.11+ and confirm `node --version`.
2. Clone the repository, run `npm ci`, and run `npm run build`.
3. Run `nix-ai --version` and `nix-ai doctor --root=<fresh-project>`.
4. Run `nix-ai` and complete the TUI journey: preview Nix Core, install it, then remove it.
5. Confirm the CLI sequence in this guide also installs, backs up, restores, and removes Nix Core.
6. Run `npm run release:check` in the source checkout.
7. Run `npm run release:verify` after `npm run release:manifest`.
8. Confirm the [support matrix](support-matrix.md) matches what you observed.

The interactive TUI journey requires a real terminal. The automated release journey covers the CLI equivalents in an isolated project and state directory.

## Troubleshooting

- **`nix-ai` is not recognized:** run `npm link` from the repository, or use `node dist/cli/index.js`.
- **`doctor` reports an invalid stack state:** inspect the file at the reported path. Restore the `.bak` only after confirming it is the intended previous state.
- **Install reports a conflict:** the target exists and is not owned by Nix, or its content differs. Back up and remove the target manually only after reviewing it.
- **Update refuses the version:** Nix refuses downgrades and same-version replacements. Publish a higher component version for a real upgrade.
- **Release verification fails:** a file is missing, modified, or extra. Regenerate the manifest only after confirming the change is intentional.
- **A hard process kill leaves a partial directory:** automatic cleanup covers failures detected during the write. A killed process can leave an unowned directory; review it and remove it manually before reinstalling.

## Related documents

- [Release and compatibility](release.md)
- [Support matrix](support-matrix.md)
- [Component catalog](../agents/component-catalog.md)
- [Security hooks](../agents/security-hooks.md)
- [Workflows](../agents/workflows.md)
- [MCP integrations](../agents/mcp-integrations.md)
- [Skill catalog](../agents/skill-catalog.md)
