# Install and configure Nix

Install the Nix CLI from npm, then use its interactive TUI to configure the AI tools you want. The TUI previews global targets and asks before each change; optional MCPs and security hooks are never silently enabled.

## Supported baseline

- **Operating system:** Windows 10 or Windows 11. Other platforms are not verified for v1.
- **Shell:** Windows PowerShell 5.1, `cmd.exe`, or Git Bash/MSYS.
- **Runtime:** Node.js `>=20.11.0` with npm.
- **Agents:** OpenCode and Codex. Additional agent adapters are not implemented.
- **Repository tools:** Git is required only when installing skills that are pinned to an upstream commit.

The authoritative compatibility record is the release manifest and the [support matrix](support-matrix.md).

## Install

```powershell
npm install --global nix-ai-stack
nix-ai
```

That is the whole installation. npm resolves the newest published version, installs the already-compiled package into your user npm prefix, and puts the `nix-ai` command on your `PATH`. No administrator access, no build step, and no package lifecycle script runs during installation.

`npm install --global` on Windows writes to `%APPDATA%\npm`, which is already on the user `PATH`. If you run it from a terminal that was open before npm first created that directory, open a new terminal once and `nix-ai` will resolve.

To try Nix without installing it globally:

```powershell
npx nix-ai-stack doctor
```

### Prerequisites

```powershell
node --version    # must be >= 20.11.0
npm --version
```

If Node.js is missing, install the current LTS release from [nodejs.org](https://nodejs.org/) or a version manager, then re-run the install. Git is optional at this stage.

## Configure from the TUI

`nix-ai` without arguments opens the TUI. From there you can:

- choose OpenCode or Codex as a preferred target;
- preview and install Nix specialist agents, reusable skills, and workflow commands;
- preview and configure optional MCP integrations, including their prerequisites and network behavior;
- independently enable SDD/TDD preferences; and
- explicitly opt into or manage the advisory security hooks.

Each manager reuses Nix's ownership checks, previews the affected paths, and asks before writing. Unmanaged agent, skill, command, or MCP configuration is preserved. A saved agent preference is not itself an installation.

When the TUI closes, verify the setup with:

```powershell
nix-ai doctor
nix-ai agent:status
nix-ai skill:status
nix-ai mcp:status
```

Optional Git-based skills can download pinned upstream content during installation. MCPs that use `npx` may download their package on first run. Security hooks remain opt-in and advisory; they are not a sandbox.

## Source development

Contributors who want to work on the Nix repository should clone it and install development dependencies instead of using the published package:

```powershell
git clone https://github.com/Samuel-Urrego/Nix.git nix
cd nix
npm ci
npm run build
npm test
```

Run the local TUI with `npm start`. Use `npm link` to expose that checkout as the global `nix-ai` command while developing.

## Install the Nix Core component

```powershell
nix-ai component --action=preview --component=skill.nix-core --root=.
nix-ai component --action=install --component=skill.nix-core --root=. --yes
```

The install writes only to the global Codex user-skill directory:

```text
~/.agents/skills/nix-core/SKILL.md
~/.agents/skills/nix-core/.nix-ai-managed.json
```

Mutating actions require `--yes`. Nix refuses to overwrite an unowned target or content it does not manage.

## Optional global setup

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

OpenCode slash commands and Codex workflow skills for the workflow catalog:

```powershell
nix-ai workflow:install-commands --agent=opencode --root=. --yes
nix-ai workflow:install-commands --agent=codex --root=. --yes
```

Codex custom slash prompts are deprecated upstream and are not used. Codex receives user skills under `~/.agents/skills` that invoke the same CLI executor.

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

## Update the CLI

```powershell
nix-ai upgrade
```

`upgrade` prints the exact npm command it will run, then runs `npm install --global nix-ai-stack@latest`. It only resolves published versions: a branch, a local checkout, or an unreleased tag is never installed. Confirm the result with `nix-ai --version`.

The same thing by hand:

```powershell
npm install --global nix-ai-stack@latest
nix-ai --version
```

To pin a specific version, install it explicitly:

```powershell
npm install --global nix-ai-stack@0.1.1
```

## Update a managed component

```powershell
nix-ai component --action=preview --component=skill.nix-core --root=.
nix-ai component --action=update --component=skill.nix-core --root=. --yes
```

Upgrade rules:

- An update requires a higher component version.
- A downgrade is refused.
- A same-version replacement with different content is refused.
- Stack state schema 1 is current. An unsupported schema is rejected with a clear error instead of being migrated implicitly.
- `config.json` under the Nix home is read as a partial configuration; unknown keys are ignored for forward compatibility.

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

Backups live under `<nix-home>/backups/components`. A restore refuses to overwrite an existing managed target. Stack-state writes also keep a `.bak` copy of the previous state file.

## Remove

Uninstall the CLI:

```powershell
npm uninstall --global nix-ai-stack
```

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

1. Install Node.js 20.11+ and npm; confirm `node --version` and `npm --version`.
2. Run `npm install --global nix-ai-stack` and confirm it finishes without administrator access.
3. Run `nix-ai --version` and confirm it reports the published version.
4. Run `nix-ai` and confirm the TUI opens.
5. In the TUI, preview and install one specialist, one skill, one command surface, and an optional MCP; verify a declined confirmation changes no files.
6. Confirm an existing unmanaged target is preserved and an unmet MCP prerequisite is reported.
7. Confirm security hooks remain disabled until explicitly enabled.
8. Run `nix-ai doctor` and the status commands for the selected integrations.
9. Run `npm run release:check` in a source checkout.
10. Confirm the [support matrix](support-matrix.md) matches what you observed.

The interactive TUI journey requires a real terminal. Automated TUI tests inject terminal input and isolate user configuration under a temporary directory; the release journey covers CLI lifecycles separately.

## Troubleshooting

- **`nix-ai` is not recognized:** npm's global prefix is not on your `PATH` in this terminal. Run `npm prefix --global` to see it, open a new terminal, or add that directory to your user `PATH`.
- **`npm install` reports `EACCES` or a permission error:** the global prefix is outside your user-writable area. On Windows the default prefix is `%APPDATA%\npm` and needs no elevation; if it was changed, point npm at a user-writable prefix with `npm config set prefix`.
- **`nix-ai upgrade` fails:** run the printed `npm install --global nix-ai-stack@latest` command by hand to see the full npm output, then retry. A failed upgrade leaves the previous version installed.
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
