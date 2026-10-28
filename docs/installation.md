# Install and configure Nix

Install the Nix CLI once, then use its interactive TUI to configure the AI tools you want. The TUI previews global targets and asks before each change; optional MCPs and security hooks are never silently enabled.

## Supported baseline

- **Operating system:** Windows 10 or Windows 11. Other platforms are not verified for v1.
- **Shell:** Windows PowerShell 5.1 or newer.
- **Runtime:** Node.js `>=20.11.0` with an npm-compatible package manager.
- **Shells:** PowerShell, `cmd.exe`, and Git Bash/MSYS for security-hook inspection.
- **Agents:** OpenCode and Codex. Additional agent adapters are not implemented.
- **Repository tools:** Git is required by the source installer and for pinned external skills.

The authoritative compatibility record is the release manifest and the [support matrix](support-matrix.md).

## One-command install on Windows

```powershell
$installer = Join-Path $env:TEMP 'nix-install.ps1'; Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/Samuel-Urrego/Nix/main/scripts/install.ps1' -OutFile $installer; & $installer
```

The installer checks Node.js, npm, and Git, then installs the **latest `v*` release tag** from its prebuilt release artifact under your user profile without administrator access. It opens the configuration TUI afterwards. It asks before adding Nix's command directory to your user `PATH`; declining does not prevent this installation from launching the TUI.

**Tag-based releases:** the installer resolves the newest `v*` tag with `git ls-remote`, downloads `nix-ai-stack-<version>.tgz` from that tag's GitHub release, and installs it with `npm install --global --ignore-scripts`. Because the artifact is already compiled, no package lifecycle script runs during installation: `prepare`, `postinstall`, and any other install script are blocked. A branch is never installed; use `npm link` from a source checkout to test unreleased code.

**Trust boundary:** this downloads and runs the PowerShell installer from the Nix GitHub repository. Review [`scripts/install.ps1`](https://github.com/Samuel-Urrego/Nix/blob/main/scripts/install.ps1) before executing it if you want to inspect the source first. The installer does not change PowerShell's execution policy, request elevation, delete existing files, or execute downloaded package scripts.

To preview only:

```powershell
.\scripts\install.ps1 -DryRun
```

`-DryRun` reports the tag resolution command, the artifact URL pattern, and the exact npm command without downloading anything or touching the network. `-NoLaunch` installs without opening the TUI. Re-running the installer moves the CLI to the newest release tag and preserves Nix's configuration and managed component data.

### Installer error codes

If installation fails, copy the `NIX-INST-###` code printed by PowerShell and send it with the error details. The code identifies the failing stage:

| Code | Meaning |
|---|---|
| `NIX-INST-001`–`003` | Node.js, npm, or Git is missing (in that order). |
| `NIX-INST-004`–`008` | npm/Node.js version could not be read or parsed, or Node.js is below 20.11. |
| `NIX-INST-009` | Windows did not provide the user install location. |
| `NIX-INST-010` | npm could not install Nix; check the reported exit code, network, Git, and npm configuration. |
| `NIX-INST-011` | npm reported success but did not create the Nix CLI command shim. |
| `NIX-INST-012` | The installer could not update the user `PATH`; the message includes the directory to add manually. |
| `NIX-INST-013`–`014` | Nix was installed, but the TUI could not start or exited with an error. |
| `NIX-INST-015` | No `v*` release tag could be resolved from the repository. |
| `NIX-INST-016` | The prebuilt release artifact could not be downloaded for the resolved tag. |
| `NIX-INST-017` | The installed CLI does not report the version of the resolved release tag. |
| `NIX-INST-999` | An unexpected installer failure; include the full error details. |

Errors that occur before the script starts (for example, failure to download the script itself) cannot be assigned a code by the installer.

## Configure from the TUI

The installer opens the TUI after installing Nix. From there you can:

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

Contributors who want to work on the Nix repository should clone it and install development dependencies instead of using the end-user installer:

```powershell
git clone https://github.com/Samuel-Urrego/Nix.git nix
cd nix
npm ci
npm run build
npm test
```

Run the local TUI with `npm start`. The published installer installs the configured Git ref globally; it is not a development checkout.

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

1. Install Node.js 20.11+, npm, and Git; confirm their commands are available.
2. Run `scripts/install.ps1 -DryRun` and confirm it reports the tag resolution command, the artifact URL pattern, and the user install target without changing files or using the network.
3. Run the installer from a trusted source and confirm it opens the Nix TUI after installation.
4. In the TUI, preview and install one specialist, one skill, one command surface, and an optional MCP; verify a declined confirmation changes no files.
5. Confirm an existing unmanaged target is preserved and an unmet MCP prerequisite is reported.
6. Confirm security hooks remain disabled until explicitly enabled.
7. Run `nix-ai --version`, `nix-ai doctor`, and the status commands for the selected integrations.
8. Run `npm run release:check` in the source checkout.
9. Confirm the [support matrix](support-matrix.md) matches what you observed.

The interactive TUI journey requires a real terminal. Automated TUI tests inject terminal input and isolate user configuration under a temporary directory; the release journey covers CLI lifecycles separately.

## Troubleshooting

- **`nix-ai` is not recognized:** open a new terminal after the PATH change, or run the installed shim at `%LOCALAPPDATA%\Programs\Nix AI Stack\npm\nix-ai.cmd`.
- **`NIX-INST-015`:** the repository has no `v*` release tag, or Git could not reach it. Confirm network access and that at least one released tag exists.
- **`NIX-INST-016`:** the resolved tag has no `nix-ai-stack-<version>.tgz` asset. Publish the artifact for that tag and retry; the installer never falls back to a branch.
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
