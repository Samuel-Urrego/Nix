# Phase 1 — CLI Foundation and TUI Shell
Objective: Deliver the first Windows-only `nix-ai` interactive shell with the requested header art, versioned local preferences, and safe read-only inspection.
Branch: `codex/phase-1-tui` (pre-existing working-tree changes are preserved; no commit created).
Delivery: incremental phase work; test runner is TypeScript compiler and Node built-ins unless project dependencies become available.

## Specs
1. **S1 — Windows CLI entry point and TUI.** User request: "Listo empieza con la fase 1, quiero que la TUI tenga este ASCII ART en el header porfa". Phase 1 roadmap: "Make `nix-ai` the executable entry point; invoking it without a subcommand opens the TUI." Add an interactive component-selection shell with categories, descriptions, installed state, selection, and clear exit/help behavior. Header must render this exact art:
   ```text
   ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
   ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠸⠁⠸⢳⡄⠀⠀⠀⠀⠀⠀⠀⠀
   ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⠃⠀⠀⢸⠸⠀⡠⣄⠀⠀⠀⠀⠀
   ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡠⠃⠀⠀⢠⣞⣀⡿⠀⠀⣧⠀⠀⠀⠀
   ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣠⡖⠁⠀⠀⠀⢸⠈⢈⡇⠀⢀⡏⠀⠀⠀⠀
   ⠀⠀⠀⠀⠀⠀⠀⠀⡴⠩⢠⡴⠀⠀⠀⠀⠀⠈⡶⠉⠀⠀⡸⠀⠀⠀⠀⠀
   ⠀⠀⠀⠀⠀⠀⢀⠎⢠⣇⠏⠀⠀⠀⠀⠀⠀⠀⠁⠀⢀⠄⡇⠀⠀⠀⠀⠀
   ⠀⠀⠀⠀⠀⢠⠏⠀⢸⣿⣴⠀⠀⠀⠀⠀⠀⣆⣀⢾⢟⠴⡇⠀⠀⠀⠀⠀
   ⠀⠀⠀⠀⢀⣿⠀⠠⣄⠸⢹⣦⠀⠀⡄⠀⠀⢋⡟⠀⠀⠁⣇⠀⠀⠀⠀⠀
   ⠀⠀⠀⢀⡾⠁⢠⠀⣿⠃⠘⢹⣦⢠⣼⠀⠀⠉⠀⠀⠀⠀⢸⡀⠀⠀⠀⠀
   ⠀⠀⢀⣴⠫⠤⣶⣿⢀⡏⠀⠀⠘⢸⡟⠋⠀⠀⠀⠀⠀⠀⠀⠀⢳⠀⠀⠀⠀
   ⠐⠿⢿⣿⣤⣴⣿⣣⢾⡄⠀⠀⠀⠀⠳⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢣⠀⠀⠀
   ⠀⠀⠀⣨⣟⡍⠉⠚⠹⣇⡄⠀⠀⠀⠀⠀⠀⠀⠀⠈⢦⠀⠀⢀⡀⣾⡇⠀⠀
   ⠀⠀⢠⠟⣹⣧⠃⠀⠀⢿⢻⡀⢄⠀⠀⠀⠀⠐⣦⡀⣸⣆⠀⣾⣧⣯⢻⠀⠀
   ⠀⠀⠘⣰⣿⣿⡄⡆⠀⠀⠀⠳⣼⢦⡘⣄⠀⠀⡟⡷⠃⠘⢶⣿⡎⠻⣆⠀⠀
   ⠀⠀⠀⡟⡿⢿⡿⠀⠀⠀⠀⠀⠙⠀⠻⢯⢷⣼⠁⠁⠀⠀⠀⠙⢿⡄⡈⢆⠀
   ⠀⠀⠀⠀⡇⣿⡅⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⠦⠀⠀⠀⠀⠀⠀⡇⢹⢿⡀
   ⠀⠀⠀⠀⠁⠛⠓⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠼⠇⠁
   ```
   Check: compiled CLI starts the TUI without a subcommand and legacy named commands remain available.
2. **S2 — Versioned local stack preferences.** Phase 1 roadmap: "Define a versioned Nix configuration/state format for selected components and supported agent targets." Persist schema version and selections without editing agent configuration. Check: defaults, load, and validation are deterministic; invalid state reports a useful error.
3. **S3 — Read-only plan preview and doctor.** Phase 1 roadmap: "Add a read-only preview of planned changes before applying them." and "Add a read-only `doctor` report for prerequisites, component status, and configuration problems." Check: preview and doctor do not mutate configuration or agent files.
4. **S4 — Managed ownership safety boundary.** Phase 1 roadmap: "Preserve user-owned configuration and provide backups, idempotent updates, and removal limited to Nix-managed entries." Keep application/removal out of agent files until adapters and ownership are defined; preview only. Check: no user agent configuration is written or removed by Phase 1 commands.

## Tasks
- T1 — S1, inline, implementation and verification passed: `npm run typecheck`, `npm run build`, CLI help, and a PTY launch/exit smoke test; no commit (pre-existing worktree is dirty).
- T2 — S2-S4, inline after T1, complete; tests/build passed and independent verification passed with one non-blocking write-failure advisory; no commit.

## Log
- L1 (2026-10-20): "Listo empieza con la fase 1, quiero que la TUI tenga este ASCII ART en el header porfa".
- Scope note: roadmap is the accepted scope; the existing worktree contains unrelated uncommitted Phase 0 and documentation changes, which must be preserved. Engram mirror is pending because the memory service does not recognize the resolved project `nix`.
- L2 (2026-10-20): Added a dependency-free numbered TUI shell with the requested header, category selection, and a read-only preview; changed the package executable from `nix` to `nix-ai`. The shell intentionally reports all components as not installed because component installers belong to later phases.
- L3 (2026-10-20): `npm run typecheck` could not run: `tsc` is unavailable because dependencies are not installed. Do not install dependencies without the required authorization.
- L4 (2026-10-20): Renamed the package bin in both package manifests and created branch `codex/phase-1-tui`. Initial compilation was blocked until dependencies were installed; Phase 1 remains open until state format and doctor work are delivered.
- L5 (2026-10-20): The user authorized dependency installation; `npm ci` succeeded after network access was approved. Typecheck and build both pass, and invoking the built CLI without a command opens the interactive menu and exits cleanly when selected.
- L6 (2026-10-20): The user explicitly selected CodeGraph AI and authorized project-scoped setup for both Codex and OpenCode without touching global client configurations. This is an out-of-order Phase 5 bootstrap; the reusable TUI catalog integration remains future work.
- L7 (2026-10-20): Installed pinned `@astudioplus/codegraph-mcp@0.21.0`, approved only its pinned postinstall script, skipped the optional static model download, and verified an 8-tool `core` MCP handshake in graph-only mode. Independent high-risk verification is pending: the required `gpt-6.1-sol` verifier model is unavailable in this session, and its available alternatives do not match the repository's fixed assignment.
- L8 (2026-10-20): Added versioned per-user state (`%APPDATA%/Nix AI Stack/state.json`) for selected components and agent targets. The TUI loads preferences and only persists them after explicit save; `doctor` reports state validity and location read-only. State writes preserve the previous file as `.bak`, validate schema version and string selections, and never edit agent configuration. Windows sandbox testing showed `rename` is unavailable for this path, so the implementation uses a backup-first write with restoration on failure instead of rename-based replacement.
- L9 (2026-10-20): Added three Node test-runner cases; `npm test` passed 3/3, and `npm run typecheck`, `npm run build`, and `git diff --check` passed. The user authorized independent verification with gpt-6-luna at medium effort.
- L10 (2026-10-20): Independent `gpt-6-luna` medium verifier passed S2-S4; it noted that an initial state-file write failure without an existing backup could leave a partial file. This is a non-blocking advisory; existing-file writes retain a `.bak` and restore it when writing fails. The verifier ran in a fresh temp copy and changed no workspace files. Receipt-driven development is globally off, so no native review lifecycle was started.

Risk: item 1 (preferences are persisted user state; schema validation and a prior-file backup limit replacement risk).
