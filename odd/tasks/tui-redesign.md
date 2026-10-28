# AI-STACK TUI redesign — Feature Specification

Objective: Replace the crowded numeric setup flow with a polished, keyboard-driven global installer and updater.
Branch: `codex/tui-redesign` | Delivery strategy: `ask-on-risk` | Forecast: ~700 authored lines; chain strategy: `feature-branch-chain` | Test runner: `npm test`, `npm run typecheck`, `npm run build`.

## Specs

### S1 — Keyboard-first framed TUI

User request: “no me gusta para nada veo muchas opciones y eso de tener que pasarle un numero se ve muy pobre, hazlo que sea seleccionable con las flechas del teclado” and “ponle un reborde a la TUI”.

Acceptance:
- Replace numeric menu selection with arrow-key navigation and intuitive enter/back/quit controls.
- Reduce the first screen to a small set of clear top-level actions; keep advanced choices inside guided flows.
- Render the experience inside a visible, responsive frame/border without breaking non-interactive test seams.
- Preserve preview/confirmation and existing safe installer behavior for global changes.

Risk: item 5 — this changes the public interactive install/update workflow and global configuration surface.

### S2 — Guided global installation and target selection

User request: “que tenga un flujo de instalacion para saber que quiere instalar el usuario, que detecte si el usuario tiene codex o opencode, o ambos y le permita solo descargarlo en uno” and “el usuario que todo esto sea global”.

Acceptance:
- Guide the user through choosing what to install instead of exposing every manager at the first screen.
- Detect Codex and OpenCode installations using verifiable local signals and show the evidence clearly.
- Let the user select one detected target or both, without forcing installs into every detected target.
- Keep all Nix-managed install targets global and use existing global-path and preview/ownership-safe services.
- Do not claim an application is detected from a path merely because the path can be constructed.

Risk: item 5 — global configuration writes and target detection determine where user files are changed.

### S3 — Selectable skill catalog

User request: “que permita mirar que skills quiere instalar”.

Acceptance:
- Present available skills as a keyboard-selectable multi-select list with concise descriptions and compatibility information.
- Allow selecting only specific skills and target applications before preview/apply.
- Reuse existing skill catalog and installer; preserve ownership, conflict, and no-change-on-decline behavior.

Risk: item 5 — selected skills are written into global agent configuration.

### S4 — In-TUI AI-STACK update

User request: “que desde ahi mismo se pueda actualizar el AI-STACK”.

Acceptance:
- Add an update action to the TUI that reuses the existing upgrade/update implementation.
- Clearly show current and target versions and confirm before changing the globally installed CLI.
- Report progress and actionable failures without duplicating update policy.

Risk: item 5 — updating changes the globally installed executable and package version.

### S5 — Gentle AI reference and progress roadmap

User request: “revisa la TUI de gentle-ai ya clone el repo esta aqui P:\Proyectos\gentle-ai crea una nueva rama para hacer esto, y haz el roadmap para mejorar la TUI, ve marcando el progreso del roadmap, y haz que sea una TUI chimba”.

Acceptance:
- Use the local Gentle AI TUI as a visual/interactions reference only; do not modify that repository or copy its Go implementation into Nix.
- Track implementation tasks and verification evidence in this document as work advances.
- Keep the new implementation on branch `codex/tui-redesign`.

Checks: structural review of the local reference and task document.

## Tasks

| ID | Specs | Route | Status | Commit / Evidence |
|----|-------|-------|--------|-------------------|
| T1 | S1 | Inline | Verified — arrow-key selection, small home menu, framed menus, and narrow-width rendering pass self-checks and independent review | RED/GREEN: keyboard tests; `141 passed, 3 skipped`; independent blocker recheck passed; commit pending |
| T2 | S2 | Inline | Pending — guided global install, reliable Codex/OpenCode detection and target choice | Pending |
| T3 | S3 | Inline | Pending — keyboard multi-select skill picker and safe install preview | Pending |
| T4 | S4 | Inline | Pending — in-TUI updater reusing upgrade behavior | Pending |
| T5 | S5 | Inline | Done — feature branch exists; local Gentle AI is a Go Bubble Tea/Lipgloss reference, not a source to port | branch `codex/tui-redesign` |

## Log

- L1 — User request: “Ya instala, y esta es la TUI, no me gusta para nada veo muchas opciones y eso de tener que pasarle un numero se ve muy pobre, hazlo que sea seleccionable con las flechas del teclado, que tenga un flujo de instalacion para saber que quiere instalar el usuario, que detecte si el usuario tiene codex o opencode, o ambos y le permita solo descargarlo en uno, que permita mirar que skills quiere instalar, el usuario que todo esto sea global, revisa la TUI de gentle-ai ya clone el repo esta aqui P:\Proyectos\gentle-ai crea una nueva rama para hacer esto, y haz el roadmap para mejorar la TUI, ve marcando el progreso del roadmap, y haz que sea una TUI chimba, que desde ahi mismo se pueda actualizar el AI-STACK y ponle un reborde a la TUI”
- L2 — Existing implementation is a numbered manager menu in `src/cli/tui.ts`; tests inject an `ask` prompt seam and assert preview/decline safety. The previous feature task `odd/tasks/one-command-install-tui.md` documents that core managers already use global preview/ownership-safe services; this redesign must preserve those contracts.
- L3 — The read-only Gentle AI comparison found a Go Bubble Tea/Lipgloss TUI with arrow-key welcome selection and bordered panels. Nix is TypeScript/Node, so this is an interaction/design reference, not a source port.
- L4 — Existing uncommitted `package.json`, `package-lock.json`, and `odd/tasks/npm-security-hardening.md` changes predate this feature and are preserved; do not stage them into TUI work.
- L5 — The referenced screenshot was unavailable at the attachment path in the prior session; implementation proceeds from the current TUI and Gentle AI reference, and visual runtime validation remains required.
- L6 — TDD for the selector was RED first (`tui-keyboard.js` module missing), then GREEN after adding a raw-keyboard selector with arrow wraparound, Enter/Escape/Q handling, raw-mode restoration, and width-bounded framed rendering. Migrated all numbered TUI action menus to this selector while retaining the existing text-answer seam for deterministic flow tests. Parent checks pass: focused TUI tests (8/8 after the narrow-width regression test), `npm run typecheck`, full suite (141 passed, 3 skipped), `npm run build`, and `git diff --check`.
- L7 — Independent T1 review caught that the frame's original 30-column minimum could overflow a narrow terminal. Fixed the frame to honor actual terminal columns, truncate long titles, and tested a 20-column viewport; verifier recheck passes. The full feature forecast is ~700 authored lines.
- L8 — User selected the `feature-branch-chain` strategy before the first work-unit commit: “feature branch chain por eso te hice crear una rama nueva”.
