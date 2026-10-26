# Release and compatibility

Nix produces a built `dist/` tree plus a checksum manifest. The release process is intentionally small: build, hash, verify, and record the supported compatibility contract. No registry publish is performed from this repository.

## Versioning

- The package version is the release version. `package.json` and `src/core/system/project-metadata.ts` must match; a test enforces this.
- The current version is `0.1.0`. The project is pre-1.0, so a minor release may include breaking changes; patch releases are intended to be compatible.
- `nix-ai --version` and `nix-ai version` print the CLI version. `nix-ai doctor` also reports it.

## Build and manifest

```powershell
npm run release:manifest
npm run release:verify
```

`release:manifest`:

1. runs `npm run build`;
2. scans `dist/` recursively;
3. records every regular file with its POSIX-relative path, byte count, and SHA-256;
4. sorts file entries by path;
5. writes `dist/release-manifest.json`.

The manifest itself is excluded from the hash list. Symlinks and unsupported file types are rejected rather than silently included.

The manifest records:

- schema version `1`;
- package name `nix-ai-stack`;
- package version;
- generation timestamp;
- compatibility contract: stack state schema `1`, config file `config.json`, Node.js `>=20.11.0`, Windows platform, OpenCode and Codex agents;
- the hashed file list.

To inspect without writing:

```powershell
nix-ai release:manifest --root=. --json
```

To verify a manifest against a different build directory:

```powershell
nix-ai release:verify --root=. --dist=dist --manifest=dist/release-manifest.json
```

The verify command reports `missing`, `modified`, and `extra` files and exits non-zero when any difference exists. `--json` prints the machine-readable result.

## Signing status

**Release signing is not implemented.** This repository has no signing key infrastructure, key custody process, or published public key. The SHA-256 manifest detects accidental corruption and drift; it does not prove authenticity and does not protect against an attacker who can replace both the files and the manifest.

Do not describe these checksums as signatures or as a supply-chain guarantee. A future signing design must define key ownership, rotation, verification, and the trust root before it is advertised.

## Packaging

`package.json` declares the files included in an npm pack:

```text
dist/
agents/
skills/
docs/
README.md
LICENSE
SECURITY.md
CODE_OF_CONDUCT.md
```

The package remains `private`; no publish step is configured. Use a dry run to inspect the package contents:

```powershell
npm pack --dry-run
```

## Upgrade compatibility policy

### Stack state

- Current schema: `1`.
- The loader rejects an unsupported schema with a validation error. It does not guess at a migration.
- Every successful state save copies the previous file to `<state>.bak` before writing the new state.
- A failed write restores the backup.

### Global configuration

- File name: `config.json` under the Nix home (`NIX_AI_HOME`, otherwise `%APPDATA%\Nix AI Stack` on Windows).
- The file is optional and read as a partial configuration; missing fields use defaults.
- Unknown keys are ignored, which keeps older builds forward-compatible with newer configuration files.
- Configuration initialization writes only the global file.

### Components

- Component identity is the manifest `id`.
- An update requires a higher version than the installed owner record.
- Downgrades and same-version content replacements are refused.
- Managed content is verified against the owner record before update, backup, restore, or uninstall.
- Backups live under `<nix-home>/backups/components` and can restore a previous version after an uninstall.
- A hard process kill can leave an unowned partial directory. The installer cleans up failures it detects during the write, but manual review is required after an interrupted process.

### Runtime and targets

- Node.js `>=20.11.0`.
- Windows is the only verified platform for v1.
- OpenCode and Codex are the only verified agents.
- Codex custom slash prompts remain unsupported because they are deprecated upstream; Codex receives workflow user skills under `~/.agents/skills` instead.
- Security hooks are advisory and opt-in, not a sandbox.

## Release checklist

Run from a clean source checkout:

1. `npm ci`
2. `npm run release:check`
3. `npm pack --dry-run`
4. Complete the [clean-machine acceptance checklist](installation.md#clean-machine-acceptance-checklist)
5. Confirm documentation matches observed behavior
6. Confirm the worktree contains no unintended release artifacts
7. Record the version, manifest checksum, and known limitations

`npm run release:check` runs typecheck, the full test suite, the build, manifest generation, and manifest verification in that order.

## Rollback

- **Component:** `component --action=backup`, then `uninstall`, then `restore --backup=<id>`.
- **Stack state:** restore the `.bak` file only after confirming it is the intended previous state.
- **Build artifact:** rebuild from the previous source revision and regenerate the manifest. Checksums verify the artifact you built; they do not provide a trusted history.

## Known limitations

- No digital signing or provenance attestation.
- No macOS or Linux verification.
- No automatic migration for unsupported stack-state schemas.
- No project-local installation mode; component, skill, MCP, and security-hook operations are global.
- No sandbox for hooks or blind-judge evaluation.
- No registry publish workflow.
