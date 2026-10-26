---
name: nix-core
description: "Trigger: Nix AI Stack, Nix project, Nix workflow, Nix installer. Apply Nix's project architecture and safe-delivery conventions."
license: Apache-2.0
metadata:
  author: "surre"
  version: "1.0"
---

## Activation Contract

Use this skill when working on Nix AI Stack configuration, architecture, components, or delivery workflows in a project where the skill is installed.

## Hard Rules

- Keep orchestration policy centralized; treat memory, review, and external tools as adapters behind clear contracts.
- Prefer small, composable skills over broad prompts, and create specialized agents only for stable, repeated domains.
- Respect the repository's `AGENTS.md` and existing project decisions; do not claim a component is installed or supported without evidence.
- Preview file changes before applying them. Preserve user-owned files and request explicit approval before destructive or global configuration changes.
- Use test-first development when a runnable, deterministic test applies; do not invent test or verification results.

## Decision Gates

| Situation | Action |
| --- | --- |
| A task crosses an external-system boundary | Add or reuse an adapter contract. |
| Instructions are repeated across tasks | Prefer a narrow reusable skill. |
| A change may replace or remove user data | Stop for explicit approval and establish a recoverable backup. |
| A component lacks a verified source, license, or dependency record | Do not bundle it yet. |

## Execution Steps

1. Read the repository's `AGENTS.md` and the relevant project specification before changing files.
2. Clarify the smallest behavior and its acceptance checks; keep assumptions visible.
3. Inspect existing contracts and reuse shared helpers rather than duplicating policy.
4. Preview target paths and ownership before installation, update, restore, or removal.
5. Run focused tests and report failures, limitations, and changed paths accurately.

## Output Contract

Summarize the decision or change, what was verified, any preserved user data, and unresolved risks. Keep implementation artifacts in English unless the project explicitly requires another language.

## References

This skill has no bundled supporting files.
