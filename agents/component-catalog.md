# Component catalog

This catalog documents the Nix-authored components that the component lifecycle manages. External skills have a separate [pinned skill catalog](skill-catalog.md).

## Nix Core

| Field | Value |
|-------|-------|
| ID | `skill.nix-core` |
| Name | Nix Core |
| Version | `1.0.0` |
| Kind | `skill` |
| Agent target | `codex` |
| Install path | `.agents/skills/nix-core` |
| Source | `skills/nix-core` |
| License | Apache-2.0 |
| Dependencies | None |
| Managed files | `SKILL.md` |

Install it project-locally:

```powershell
nix-ai component --action=preview --component=skill.nix-core --root=.
nix-ai component --action=install --component=skill.nix-core --root=. --yes
```

## Lifecycle actions

| Action | Behavior |
|--------|----------|
| `preview` | Read-only plan. Reports `install`, `update`, `already-current`, `not-installed`, or `conflict`. |
| `install` | Writes the component only when the target is absent or a valid older managed version. Records ownership and file hashes. |
| `update` | Requires a higher component version. Backs up the current managed target, then writes the new version. |
| `backup` | Copies the current managed target into `.nix-ai/backups/` and records the backup metadata. |
| `list-backups` | Lists backup IDs, component versions, and creation times. |
| `restore` | Restores a backup only when the target is absent. |
| `uninstall` | Removes a managed target after verifying the owner record; creates a backup first. |

Every mutating action requires `--yes`.

## Ownership and safety

- A managed target contains `.nix-ai-managed.json` with the schema version, component ID, version, and file hashes.
- Nix refuses to overwrite an unowned target.
- Nix refuses to update, back up, restore over, or remove content that no longer matches the owner record.
- A downgrade or a same-version content replacement is a conflict.
- Backups are project-local under `.nix-ai/backups/`.
- Write failures detected during install trigger cleanup of the partial managed target.
- A hard process kill can leave an unowned partial directory; review and remove it manually before reinstalling.

## Compatibility

- Stack state schema: `1`.
- Supported platform: Windows v1.
- Supported agent: Codex.
- The component version is independent from the CLI package version, but the installed owner record is checked against the manifest version.

## Related documents

- [Installation and first run](../docs/installation.md)
- [Release and compatibility](../docs/release.md)
- [Support matrix](../docs/support-matrix.md)
- [Skill catalog](skill-catalog.md)
- [Skill compatibility](skill-compatibility.md)
