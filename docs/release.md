# Release and compatibility

Nix produces a built `dist/` tree plus a checksum manifest, and publishes the package to the public npm registry. The release process is intentionally small: build, hash, verify, publish, and record the supported compatibility contract.

## Versioning

- The package version is the release version. `package.json` and `src/core/system/project-metadata.ts` must match; a test enforces this.
- The current prepared release version is `0.1.2`. The project is pre-1.0, so a minor release may include breaking changes; patch releases are intended to be compatible.
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

`package.json` declares the files included in the published package:

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

The package is published to the public npm registry as `nix-ai-stack` and exposes the `nix-ai` binary. It is not private: `publishConfig.access` is `public`, and `dist/` always ships because `prepack` builds it and `prepublishOnly` runs the typecheck and the full test suite before any publish. No lifecycle script is needed at consumer install time.

Users install it with:

```powershell
npm install --global nix-ai-stack
```

To inspect the artifact without publishing:

```powershell
npm pack --dry-run
```

## Publishing a release

Cutting a release:

```powershell
git checkout main
git pull
# package.json and src/core/system/project-metadata.ts must both hold the release version
npm run release:check
git tag -a v<version> -m "Nix <version>"
git push origin v<version>
```

Pushing a `v*` tag triggers `.github/workflows/release.yml`, which installs dependencies, refuses a tag that does not match the package version, and runs `npm publish`. The publish itself runs `prepublishOnly` (typecheck plus the full test suite) and `prepack` (build), so a failing suite blocks the release before anything reaches the registry.

The workflow uses npm Trusted Publishing with GitHub Actions OIDC rather than a long-lived `NODE_AUTH_TOKEN`. Configure the package's trusted publisher on npmjs.com with provider **GitHub Actions**, owner `Samuel-Urrego`, repository `Nix`, workflow filename `release.yml`, and allow direct `npm publish`. The workflow grants `id-token: write` only to the publishing job; npm automatically publishes provenance for eligible public GitHub repositories and public packages. It pins Actions to full commit SHAs and uses Node.js 22.14.0+ with npm 11.21.1; npm's documented minimum for trusted publishing is 11.5.1.

Manual publish, only when the workflow is unavailable:

```powershell
npm login
npm run release:check
npm publish
```

Published versions are immutable. To fix a broken release, publish a new patch version; never re-publish or move an existing tag. A local `npm publish` requires `npm login` in the same session.

A version that is already on the registry cannot be overwritten:

```text
npm error You cannot publish over the previously published versions
```

That error means the version is spent: bump `package.json` and `src/core/system/project-metadata.ts` together.

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
- A hard process kill can leave an unowned partial directory. The component installer cleans up failures it detects during the write, but manual review is required after an interrupted process.

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
3. `npm pack --dry-run` and confirm `dist/cli/index.js` is included
4. Confirm npm Trusted Publishing is configured for `Samuel-Urrego/Nix` and `.github/workflows/release.yml`, with direct publishing enabled
5. Complete the [clean-machine acceptance checklist](installation.md#clean-machine-acceptance-checklist)
6. Confirm documentation matches observed behavior
7. Confirm the worktree contains no unintended release artifacts
8. Record the version, manifest checksum, and known limitations

`npm run release:check` runs typecheck, the full test suite, the build, manifest generation, and manifest verification in that order.

## Rollback

- **Component:** `component --action=backup`, then `uninstall`, then `restore --backup=<id>`.
- **Stack state:** restore the `.bak` file only after confirming it is the intended previous state.
- **Build artifact:** rebuild from the previous source revision and regenerate the manifest. Checksums verify the artifact you built; they do not provide a trusted history.

## Known limitations

- No separate digital-signing key is configured. npm automatically attaches provenance when Trusted Publishing succeeds from an eligible public GitHub repository; the local SHA-256 manifest is not a signature.
- No macOS or Linux verification.
- No automatic migration for unsupported stack-state schemas.
- No project-local installation mode; component, skill, MCP, and security-hook operations are global.
- No sandbox for hooks or blind-judge evaluation.
- No non-interactive `install --preset` for unattended configuration; the TUI and the per-resource CLI commands are the only configuration surfaces.
