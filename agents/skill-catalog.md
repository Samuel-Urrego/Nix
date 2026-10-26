# Skill Catalog and Installation

Nix installs selected external skills from pinned upstream commits into global agent skill directories. It does not vendor third-party skill trees, so the catalog cannot drift into a stale copy.

## Catalog format

Every entry in `src/core/skills/skill-catalog.ts` declares:

| Field | Meaning |
|-------|---------|
| `id` | Stable catalog identity and install directory name. |
| `name`, `description` | What the skill does and when it applies. |
| `source` | Git repository, exact commit SHA, skill path, and license path. |
| `license`, `version` | License verified at the pinned ref and the upstream version or version marker. |
| `dependencies` | Required or optional commands, files, runtimes, and network access. |
| `compatibleAgents` | `opencode`, `codex`, or both. |
| `installPaths` | Project-local target per agent. |
| `updatePolicy` | `pinned`: the ref advances only through a reviewed catalog change. |
| `stackTags` | Reviewable mapping into [`skill-compatibility.md`](skill-compatibility.md). |

## Requested skills and provenance

| Id | Upstream | Pinned ref | Path | License | Version |
|----|----------|------------|------|---------|---------|
| `brag` | `latent-spaces/brag` | `069432cac935ed1895859df201c31436c07fb74e` | `skills/brag` | MIT | `0.4.0` |
| `grafana-k6` | `grafana/skills` | `cc33318b60a7fbc2c69a25122164baf00e805f79` | `skills/grafana-k6/k6` | Apache-2.0 | `main@cc33318` |
| `security-audit` | `cloudflare/security-audit-skill` | `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8` | `skills/security-audit` | MIT | `main@c1c8a8c` |
| `rea` | `morluto/rea` | `160d821ac9a0310afcb8d1fc427862dd6508add5` | `.agents/skills/reverse-engineer-anything` | MIT | `6.8.0` |
| `emil-design-eng` | `emilkowalski/skills` | `2d228630ba1446365f614a108cb8252f1feda202` | `skills/emil-design-eng` | MIT | `main@2d22863` |
| `design-taste-frontend` | `Leonxlnx/taste-skill` | `6010f91a9935f1c167dfc500fb1a475681892e6b` | `skills/taste-skill` | MIT | `2.0.0-experimental` |
| `accessibility` | `addyosmani/web-quality-skills` | `afa8da942115f2961fdbfa80807ea0b232ff6c00` | `skills/accessibility` | MIT | `2.0` |

The six original `SKILL.md` paths returned HTTP 200 at their pinned commits when the catalog was authored. The REA skill path was verified at its pinned 6.8.0 release commit.

## Install locations

| Agent | Directory | Discovery |
|-------|-----------|-----------|
| OpenCode | `.opencode/skills/<id>/` | OpenCode project skills |
| Codex | `.agents/skills/<id>/` | Codex walks up to the repository root |

Both locations are project-local. Nix never edits user-level skill directories.

## Commands

```text
nix-ai skill:list
nix-ai skill:status --root=.
nix-ai skill:preview --id=brag --agent=codex --root=.
nix-ai skill:install --id=brag --agent=codex --root=. --yes
nix-ai skill:update  --id=brag --agent=codex --root=. --yes
nix-ai skill:remove  --id=brag --agent=codex --root=. --yes
nix-ai skill:new     --id=release-notes --root=.
```

`--agent` accepts `opencode` or `codex`. Mutating install/update/remove actions require `--yes`.

`skill:install` fetches the exact pinned commit with `git fetch --depth 1`, copies the selected skill directory plus the repository `LICENSE` (and `NOTICE` when declared), and records file hashes in `.nix/skills/managed.json`.

`--source=<dir>` is an explicit development or authoring override that reads a local skill directory instead of fetching the pin. The preview still shows the catalog provenance; use it for local skill development, not for normal installs.

## Ownership and safety

| Situation | Preview | Install | Update | Remove |
|-----------|---------|---------|--------|--------|
| No directory, no record | `install` | writes the tree | refuses | refuses |
| Managed and matches the record and catalog | `already-current` | no-op | rewrites | removes |
| Managed and catalog version/ref changed | `update` | rewrites and updates the record | rewrites | removes |
| Managed but edited outside Nix | `conflict` | refuses | restores the reviewed tree | refuses |
| Directory exists without a Nix record | `conflict` | refuses | refuses | refuses |
| Agent not compatible | `incompatible` | refuses | refuses | refuses |
| Required dependency missing | `install` with `missing` | refuses | — | — |

Installation refuses path traversal, symlinks, non-regular files, duplicate files, and trees without `SKILL.md`.

## Dependencies

| Skill | Required | Optional |
|-------|----------|----------|
| `brag` | Node.js 22+, FFmpeg, `npx` | `uv` for custom music cues |
| `grafana-k6` | `k6` v2.0+ | — |
| `security-audit` | Node.js | Parallel sub-agents |
| `rea` | Node.js 22.23.4+, 24.22.1+, or 26.12.1+; npm | REA MCP registration for tool-backed investigations; native analysis engines are target-dependent |
| `emil-design-eng` | None | — |
| `design-taste-frontend` | Node.js 22+, Chrome/Edge/Chromium | Network for reference images |
| `accessibility` | None | Lighthouse CLI or `npx` |

## Update policy

The catalog is pinned. Updating a skill means changing its `ref` and `version` in a reviewed catalog change, then running `skill:update` in each project. `skill:update` never follows upstream `main` on its own.

## Current limits

- Downloading a skill requires network access and `git`.
- The installer copies skill files; it does not execute setup scripts or install toolchains.
- `security-audit` is supported on OpenCode and Codex; parallel sub-agents are required for its full audit workflow.
- The REA skill provides workflow guidance; install the separate REA MCP integration to expose its analysis tools to the agent.
- The catalog records provenance but does not re-verify upstream content signatures.
