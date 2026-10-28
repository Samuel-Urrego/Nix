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

### S6 — Flicker-free searchable selection with Next

User request: “la pantalla titila cuando se cambia de opcion y haz que las opciones sean seleccionable, tengan buscador, que haya un boton de next, y que se tome lo que el usuario seleccion y todo debe estar default marcado para que el usuario solo quite lo que no quiere”.

Acceptance:
- Changing the highlighted row must not clear and repaint the whole screen; rows are redrawn in place.
- Options are selectable: `Space` toggles the focused row and `a` toggles every row matching the current search.
- Typing printable characters filters the list, `Backspace` edits the filter, and a `Search:` line shows the active filter.
- A visible `Next →` row with a `selected/total` counter ends the selection; `Enter` takes the user's current selection.
- Every option starts checked, so the user only unchecks what they do not want.
- `Esc` still cancels and writes nothing.

Risk: item 5 — this changes the interactive installation flow.

Checks: keyboard unit tests for filtering, toggle-all, in-place redraw, and Next; the real-keyboard end-to-end test installs only the filtered skill.

### S7 — One-step install, framed panels, yes/no confirmation, and a progress bar

User request: “todo debe salir dentor del recuadro bb y bonito y haz que el paso en el que se instala pida la confirmacion tambien con una opcion de si o no, y ponle barra de descarga. quiero que todo se pueda instalar de una bb arregla esas dependencias de las skills externas”.

Acceptance:
- Every screen of the install, update, and advanced-management flows is rendered inside a framed panel; no report is printed as bare text outside a frame.
- Long values wrap inside the frame without breaking the border, and home-relative paths are shown instead of full absolute paths.
- The install flow starts with an `INSTALL MODE` choice: `Install everything (recommended)` installs every detected target and every compatible skill after a single confirmation, and `Choose targets and skills` keeps the guided wizard.
- The installation step asks for confirmation with a selectable `Yes/No` (default `No`), never a typed `yes`.
- Installation shows a framed progress bar with `N/M steps · P%` and finishes in an `INSTALL COMPLETE` panel reporting installed, preserved, and failed counts.
- A Codex command wrapper never shares a directory with an installed skill of the same id, so one-step installation cannot fail on that collision; a wrapper left by an older build at the skill path is migrated only when Nix provably owns the whole directory.

Risk: item 5 — this changes the interactive installation flow; item 3 for the Codex wrapper directory rename, which changes a path Nix already writes.

Checks: scripted TUI tests for the framed panels, the progress bar, the one-step install, and the declined confirmation writing nothing; a real-keyboard E2E run; command-service tests for the wrapper migration and for never deleting an unmanaged directory.

### S8 — Runtime tool dependencies never block skill installation

User request: “arregla esas dependencias de las skills externas”.

Acceptance:
- Copying a skill's markdown never fails because a runtime tool such as `ffmpeg`, `k6`, `node`, or a browser is missing; every catalog dependency is advisory.
- The preview and the final report list the runtime tools an installed skill uses, so the user knows what to install before using it.
- Nix never installs system binaries on its own.

Risk: none — this only removes an install-time blocker and adds reporting; no new process is executed.

Checks: catalog test asserting no git skill has a blocking dependency; installer test previewing `brag` on a machine without FFmpeg.

### S9 — Each wizard step replaces the previous screen

User request: “pero bb que es esa mierda, que se vaya limpiando el paso anterior, no que se vaya dibujando uno debajo del anterior y verifa que si haya quedado todo instalado porfa”.

Acceptance:
- Every wizard step (`TARGET DETECTION`, `INSTALL MODE`, `INSTALL TARGETS`, `GLOBAL SKILLS`, `INSTALL PREVIEW`, `INSTALLING`) starts on a cleared screen and is drawn exactly once.
- Returning to the home screen clears the previous step's result.
- Intra-selector redraws stay in place: no `ESC[2J` on keystrokes.
- The install preview and its confirmation stay on the same screen, because the user must read the preview while confirming.

Risk: none — screen clearing only changes terminal output.

Checks: TUI test splitting the transcript on `ESC[2J ESC[H` and asserting the panels never share a screen; full suite; real run.

### S10 — Nix orchestrator agent for OpenCode

User request: “espera agrega tambien una agente para opencode que sea Nix, flow el Gentle-Orchestrator de Gentle-AI”.

Acceptance:
- The specialist catalog holds a `nix` entry named `Nix`, owned by Nix, supported only by OpenCode, installed as a primary agent (`mode: primary`) so it is an entry point rather than a delegated role.
- Its instructions carry the Gentle-Orchestrator flow adapted to Nix: authorize, explore, resolve uncertainty, classify size, track large work, implement in reviewable work units, verify with observed evidence, close with a risk line; plus the delegation triggers, the risk items 1–6, and the English-artifact language contract.
- The instructions never reference machinery Nix does not have (Go review lifecycle, receipt-driven development).
- Every other catalog entry keeps the default `mode: subagent`.

Risk: item 3 — the installed agent file is a prompt contract OpenCode consumes, and the rendered frontmatter shape changes.

Checks: catalog test for id, target, mode, and flow markers; installer test asserting `mode: primary` renders while a default entry still renders `mode: subagent`.

### S11 — Nix routes work through skills and specialist subagents

User request: “Se supone que Nix debe saber usar todas las skills y saber invocar sub agentes especiliazados en esas skills”.

Acceptance:
- The orchestrator prompt tells Nix to treat the harness-provided skill list as the truth, load every matching skill before domain work, and never invent a skill id or restate one from memory.
- The prompt tells Nix to delegate to the specialist roster exposed by its delegation tool, names the shipped specialists (`araxys-specialist`, `python-fastapi-specialist`), and forbids inventing a subagent to look thorough.
- A specialist reports which specs it covered; Nix keeps the outcome, the verification, and the report.
- Every installed skill is reachable through a delegated specialist: `skill-runner` takes one skill id plus a bounded task, loads that skill in a fresh context, executes inside the given edit surfaces, and reports its checks. It is not a per-skill wrapper agent.
- The one-step install installs the Nix-owned specialist agents for every detected target, so the roster the prompt refers to actually exists. Agents Nix cannot support for a target (the OpenCode-only orchestrator on Codex) are never written there.
- A re-run reports an already-current agent as preserved, not as a failure.

Risk: item 5 — the one-step installer now writes agent files into the global agent directories of both targets.

Checks: catalog test for the skill and roster protocol markers; TUI test asserting the one-step install writes `nix.md` as primary, both specialists as subagents, codex TOMLs for the Codex target, and no `nix.toml`.

### S12 — Escape cancels the current step instead of freezing the TUI

User request: “la TUI tiene un bug cuando se le da al escape, no devuelve y la TUI se bloquea”.

Acceptance:
- A lone Escape is answered within ~50 ms instead of waiting on Node's escape-sequence disambiguation timeout.
- Escape in a multi-select returns a cancel, which is distinct from an empty selection, so the flow goes back instead of installing nothing.
- Cancelling a guided install step writes no file and reports `INSTALL CANCELLED`.
- Escape never leaves the terminal in raw mode or with a hidden cursor.

Risk: none — key handling only; no new write path.

Checks: keyboard tests asserting a lone Escape resolves the selector and the multi-select within 200 ms; TUI test asserting a cancelled target step writes nothing.

## Tasks

| ID | Specs | Route | Status | Commit / Evidence |
|----|-------|-------|--------|-------------------|
| T1 | S1 | Inline | Done — arrow-key selection, small home menu, framed menus, and narrow-width rendering pass self-checks and independent review | `1b2aa02`; RED/GREEN keyboard tests; `141 passed, 3 skipped` |
| T2 | S2 | Inline | Done — evidence-based Codex/OpenCode detection, keyboard target multi-select limited to detected apps, guided global install with preview and confirmation, workflows persisted | Commit `feat(tui): add guided global installer`; RED/GREEN `agent-detection` + `tui` tests; real-keyboard E2E |
| T3 | S3 | Inline | Done — keyboard multi-select skill catalog filtered by compatible targets, dependency-aware preview, decline writes nothing | Same work unit as T2; `guided install` tests |
| T4 | S4 | Inline | Done — in-TUI update reusing `createUpgradePlan`/`spawnUpgrade`, shows current/target version, confirms first, reports exit code | Commit `feat(tui): add in-TUI update`; RED/GREEN update tests |
| T5 | S5 | Inline | Done — feature branch exists; local Gentle AI is a Go Bubble Tea/Lipgloss reference, not a source to port | branch `codex/tui-redesign` |
| T6 | S6 | Inline | Done — in-place redraw replaces full-screen clears, multi-select gained search, `a` toggle-all, `Next →` row, and default-checked options | RED/GREEN `tui-keyboard` tests; E2E installs only the filtered skill |
| T7 | S7 | Inline | Done — `INSTALL MODE`, one-step install, framed panels everywhere, `Yes/No` confirmation, framed progress bar, namespaced Codex command wrappers | RED/GREEN `tui-keyboard` + `tui` tests; `170 passed`; visual transcript with `Failed: 0` |
| T8 | S8 | Inline | Done — catalog runtime tools are advisory and reported as guidance instead of blocking installation | RED/GREEN `skill-catalog` + `skill-installer` tests |
| T9 | S9 | Inline | Done — `TuiTerminal.clear()` at every step boundary (home loop, `pause`, install steps, updater, advanced loops); RED test failed before the change | `e41a8eb`; TUI test splitting on `ESC[2J`; `171 passed` |
| T10 | S10 | Inline | Done — `SpecialistAgentMode` plus optional `mode` contract, `nix` primary orchestrator entry, installer renders the declared mode | RED/GREEN catalog + installer tests; `173 passed` |
| T11 | S11 | Inline | Done — orchestrator prompt gained the skill and specialist-roster protocol; the one-step install now writes the Nix-owned specialist agents per target | RED/GREEN catalog + TUI tests; `174 passed` |
| T12 | S12 | Inline | Done — lone ESC flushed in 50 ms, multi-select cancel is `undefined` instead of `[]`, guided steps report `INSTALL CANCELLED` and write nothing | RED tests exceeded a 200 ms deadline before the change; `178 passed` |
## Log

- L1 — User request: “Ya instala, y esta es la TUI, no me gusta para nada veo muchas opciones y eso de tener que pasarle un numero se ve muy pobre, hazlo que sea seleccionable con las flechas del teclado, que tenga un flujo de instalacion para saber que quiere instalar el usuario, que detecte si el usuario tiene codex o opencode, o ambos y le permita solo descargarlo en uno, que permita mirar que skills quiere instalar, el usuario que todo esto sea global, revisa la TUI de gentle-ai ya clone el repo esta aqui P:\Proyectos\gentle-ai crea una nueva rama para hacer esto, y haz el roadmap para mejorar la TUI, ve marcando el progreso del roadmap, y haz que sea una TUI chimba, que desde ahi mismo se pueda actualizar el AI-STACK y ponle un reborde a la TUI”
- L2 — Existing implementation is a numbered manager menu in `src/cli/tui.ts`; tests inject an `ask` prompt seam and assert preview/decline safety. The previous feature task `odd/tasks/one-command-install-tui.md` documents that core managers already use global preview/ownership-safe services; this redesign must preserve those contracts.
- L3 — The read-only Gentle AI comparison found a Go Bubble Tea/Lipgloss TUI with arrow-key welcome selection and bordered panels. Nix is TypeScript/Node, so this is an interaction/design reference, not a source port.
- L4 — Existing uncommitted `package.json`, `package-lock.json`, and `odd/tasks/npm-security-hardening.md` changes predate this feature and are preserved; do not stage them into TUI work.
- L5 — The referenced screenshot was unavailable at the attachment path in the prior session; implementation proceeds from the current TUI and Gentle AI reference, and visual runtime validation remains required.
- L6 — TDD for the selector was RED first (`tui-keyboard.js` module missing), then GREEN after adding a raw-keyboard selector with arrow wraparound, Enter/Escape/Q handling, raw-mode restoration, and width-bounded framed rendering. Migrated all numbered TUI action menus to this selector while retaining the existing text-answer seam for deterministic flow tests. Parent checks pass: focused TUI tests (8/8 after the narrow-width regression test), `npm run typecheck`, full suite (141 passed, 3 skipped), `npm run build`, and `git diff --check`.
- L7 — Independent T1 review caught that the frame's original 30-column minimum could overflow a narrow terminal. Fixed the frame to honor actual terminal columns, truncate long titles, and tested a 20-column viewport; verifier recheck passes. The full feature forecast is ~700 authored lines.
- L8 — User selected the `feature-branch-chain` strategy before the first work-unit commit: “feature branch chain por eso te hice crear una rama nueva”.
- L9 — T1 committed as `1b2aa02` (`feat(tui): add framed keyboard navigation`). Only the five TUI/roadmap paths were staged; the user's existing npm-security worktree changes remain unstaged and untouched. No push or PR was performed.
- L10 — Read-only T2 map found no Codex/OpenCode presence detector; existing global paths and preview/ownership-safe services can be reused (`global-paths.ts`, `skill-installer.ts`, and `agent-installer.ts`). A constructed destination path is not proof of an installed app. The exact local evidence threshold (CLI on PATH versus existing app configuration) needs one bounded assumption challenge before implementation.
- L11 — T2 evidence threshold resolved by implementation: a target is detected only when an existing application config file/directory or an application executable on PATH is observed. `src/core/config/agent-detection.ts` reports per-target evidence strings and never infers detection from a constructible destination path. RED tests covered the empty machine, config-file signal, CLI-on-PATH signal, and both-installed case before the module existed.
- L12 — Guided install (`Install AI-STACK`) shows detection evidence, offers a keyboard multi-select limited to detected targets, then a multi-select of skills filtered by the chosen targets with per-agent status and dependency preview, and one explicit `yes` confirmation. Preview and apply share `resolveCommandAvailability` over the same effective state (targets, `agent.*`, `workflow.sdd`/`workflow.tdd`), so the preview cannot promise a command the installer would preserve. A fresh install enables the core SDD/TDD workflows and states that in the preview; already-configured workflow settings are preserved. Decline writes nothing; no detected target means the flow refuses to install and reports it.
- L13 — T4 adds `Update AI-STACK` using `createUpgradePlan`/`spawnUpgrade` unchanged, plus a read-only `resolveLatestPublishedVersion` registry query (`npm view`) whose failure degrades to "latest published version (registry unavailable)" instead of a guessed version. The flow shows current/target/command, confirms before touching the global CLI, and reports the exit code. Upgrade and resolver are injectable for deterministic tests.
- L14 — Full verification after T2–T4: `npm run typecheck`, `npm test` (156 passed, 0 failed), `npm run build`, and `git diff --check`. The user's pre-existing `package.json`, `package-lock.json`, and `odd/tasks/npm-security-hardening.md` changes remain unstaged and untouched.
- L15 — Closed the L5 runtime-validation gap as far as automation allows: an end-to-end test drives the real `selectWithKeyboard`/`multiSelectWithKeyboard` raw-key-driven path over a fake TTY (arrows, `enter`, `space`, typed `yes`) through home → detection → targets → skills → preview → apply → quit, asserting both targets receive commands and the OpenCode/Codex files on disk. The earlier scripted tests never exercised the raw-mode selector end to end. Also removed a dead `getCodexUserSkillsDirectory` import from `tui.ts`. Suite: 157 passed, 0 failed; typecheck, build, and `git diff --check` clean. A human eye check in a real terminal is still the last mile and remains unautomated.
- L16 — User reported the wolf art was lost and re-pasted it. Byte comparison showed the `header` constant in `tui.ts` already matched it exactly (18 lines × 29 columns); the real defect was that the art was printed only in the non-interactive branch, so the interactive TUI never showed it. `selectWithKeyboard` now accepts a `banner` and the home screen passes the wolf plus a subtitle on its first render only; the banner is skipped below 34 terminal columns so it cannot wrap into noise. Tests cover: banner precedes the frame, wolf appears exactly once per session, and narrow terminals render without it. Suite: 160 passed, 0 failed.
- L17 — User request: “la pantalla titila cuando se cambia de opcion y haz que las opciones sean seleccionable, tengan buscador, que haya un boton de next, y que se tome lo que el usuario seleccion y todo debe estar default marcado para que el usuario solo quite lo que no quiere”. Root cause of the flicker: every keypress wrote `ESC[2J` and repainted the whole screen. `InPlaceScreen` now moves the cursor up over its own rows and rewrites them with `ESC[2K`, shrinking back when a filter narrows the list, so no full-screen clear remains in either selector. `multiSelectWithKeyboard` gained a print-to-filter `Search:` line, Space toggling, `a` toggle-all over the visible rows, a visible `Next →` row with a selected/total counter, and Enter as the Next action; Esc cancels and writes nothing. The guided installer now passes every skill index as `initialSelected`, so everything starts checked and the user only unchecks. Tests: three new keyboard tests (filter plus Next counter, toggle-all, no `ESC[2J` on redraw) and the real-keyboard E2E now clears all, filters `python`, checks one skill, and asserts only that skill landed. Suite: 163 passed, 0 failed; typecheck, build, and `git diff --check` clean.
- L18 — User request: “todo debe salir dentor del recuadro bb y bonito y haz que el paso en el que se instala pida la confirmacion tambien con una opcion de si o no, y ponle barra de descarga. quiero que todo se pueda instalar de una bb arregla esas dependencias de las skills externas”. Delivered as S7+S8/T7+T8: `runGuidedInstall` now renders `TARGET DETECTION`, `INSTALL MODE`, `INSTALL PREVIEW`, `CONFIRM`, `INSTALLING`, and `INSTALL COMPLETE` as frames; the mode select makes one-step installation the default; confirmation and every advanced-management confirmation became a `Yes/No` selector defaulting to `No`; `createProgress` draws an in-place framed bar; `shortenPath` keeps wrapped paths short. Only three bare writes remain in `tui.ts` (banner, non-interactive branch, one flow-entry clear).
- L19 — One-step installation exposed a real collision: `/araxys` (`codexSkillId: "araxys-integration"`) and `/security-audit` wrote their Codex wrappers into the same directories as the external skills of those ids, so the skill install failed with "An existing skill directory with this id is not managed by Nix." Fixed by namespacing the wrappers (`nix-command-araxys`, `nix-command-security-audit`) and keeping the frontmatter `name` as the command id so Codex never lists two skills with the same name. A stale wrapper from an older build is removed only when the directory contains exactly one `SKILL.md` carrying that command's ownership marker; anything else is preserved. The previous one-step test only asserted the file existed, which the command wrapper alone satisfied — it now compares the installed content with the bundled skill and asserts no `Failure:` line. Suite: 170 passed, 0 failed; typecheck clean; visual transcript ends with `Installed: 16 files · Preserved: 0 · Failed: 0`.
- L20 — User request: “pero bb que es esa mierda, que se vaya limpiando el paso anterior, no que se vaya dibujando uno debajo del anterior y verifa que si haya quedado todo instalado porfa”. Root cause: steps wrote their frame after the previous one, and the home loop never cleared, so the terminal kept scrolling. `TuiTerminal.clear()` now writes `ESC[2J ESC[H` at every step boundary: the home loop, `pause`, each guided install step, both updater frames, and the top of every advanced-management loop. Selector keystrokes still redraw in place. RED first, then GREEN; `e41a8eb`. Real-machine verification of the previous install: `%APPDATA%\Nix AI Stack\managed\skills.json` holds 17 of 18 entries — every skill for both targets except `codex:accessibility`.
- L21 — The one missing entry is correct behavior, not a failed install: `~\.agents\skills\accessibility` existed before Nix and its `SKILL.md` is byte-identical (SHA256 `5F96552E41DB945F…`) to the Nix-managed OpenCode copy, but the directory has no Nix `LICENSE`, so Nix reports `conflict` instead of claiming user-owned content. Content is functionally present for Codex; it is simply unmanaged and will not receive updates.
- L22 — User request: “espera agrega tambien una agente para opencode que sea Nix, flow el Gentle-Orchestrator de Gentle-AI”. The Gentle-Orchestrator prompt is bound to Go-owned review machinery (RDD, frozen candidates, native acknowledgement) that Nix does not have, so only its flow was ported: ODD protocol, delegation triggers, work units, risk items, language contract. `SpecialistAgentMode` and an optional `mode` were added to the definition contract because `renderSpecialistAgent` hardcoded `mode: subagent`; the `nix` entry declares `mode: primary` and `supportedAgents: ["opencode"]`. Specialist agents remain outside the one-step install (Advanced management → Specialist agents), matching the existing contract. Suite: 173 passed, 0 failed; typecheck and build clean.
- L23 — User requirement: “Se supone que Nix debe saber usar todas las skills y saber invocar sub agentes especiliazados en esas skills”. Two parts. (1) Prompt: the `nix` instructions gained `## Skills` (the harness skill list is the truth; load every matching skill before writing; a skill outranks your own habits; never invent or recall a skill id) and `## Specialist subagents` (the delegation tool's roster is the source of truth; the shipped specialists are `araxys-specialist` and `python-fastapi-specialist`; a specialist reports the specs it covered while Nix keeps verification and the report; never invent a subagent). No per-skill wrapper agents were generated: a skill already carries the specialization, and nine wrappers whose whole body is "load skill X" would duplicate it with worse discoverability. (2) Roster: the one-step install now also installs the Nix-owned specialist agents for each detected target, because delegating to an agent that was never installed is a promise Nix cannot keep. `nix` stays OpenCode-only, so no `nix.toml` is written for Codex, and an already-current agent is reported as preserved rather than as a failure. Version bumped to `1.1.0` so the installed copy updates instead of reading as a hand edit. Suite: 174 passed, 0 failed; typecheck, build, and `git diff --check` clean.
- L24 — Coverage gap closed without generating nine wrapper agents: the catalog gained one `skill-runner` subagent (both targets, delegated role) whose whole contract is "load the named skill in a fresh context, execute the bounded task inside the given edit surfaces, report each check with its observed result, never widen scope, never commit". Nix's prompt now routes any skill without a named domain specialist through it, so all nine installed skills are delegable while the two real specialists keep the deeper domain rules. The advanced-management TUI test stopped answering by index and answers `araxys` instead, because adding catalog entries silently shifted what "2" selected — a test that encodes a menu position breaks every time the menu grows. Suite: 174 passed, 0 failed.
- L25 — Found by the same stale state: `previewSpecialistAgent` compared the installed file only against its own ownership record, then compared versions, and never against the content the catalog would render now. A prompt change without a version bump therefore reported `already-current` and was never applied — the Nix 1.1.0 install kept an older prompt in place while claiming to be current. The plan now renders the desired content and diffs it against the file, so the record keeps proving ownership and the render proves currency. Regression test: same version, changed instructions → `update`, then `already-current`. Suite: 175 passed, 0 failed.
- L26 — User report: “la TUI tiene un bug cuando se le da al escape, no devuelve y la TUI se bloquea”. Two defects, both reproduced by test before the fix. (1) Node's keypress decoder buffers a lone ESC while it waits for an escape sequence and only flushes it after ~500 ms, so Escape felt dead; `watchLoneEscape` flushes it after 50 ms if no follow-up byte arrives, and cancels its timer when one does. (2) `multiSelectWithKeyboard` returned `[]` on Escape, which is indistinguishable from "the user unchecked everything", so the guided install went forward with an empty selection instead of going back. Cancel now returns `undefined` and both guided steps treat it as a cancel that writes nothing. `selectWithKeyboard` keeps `-1`. The regression test used a 500 ms deadline that passed by accident against the 500 ms flush; lowering it to 200 ms is what makes it a real RED. Suite: 178 passed.
- L27 — User decision: “Que Nix lo adopte” for the unmanaged `codex:accessibility` directory. Adoption was added as an explicit operation, never an automatic takeover: `previewSkillAdoption` claims a directory only when the existing files are byte-identical to what Nix would install, and refuses when any file differs or when the directory holds files Nix would not write. What it adds is the missing Nix-owned file (`LICENSE`); it never rewrites content it is claiming. `adoptSkill` applies the additions and records ownership, and `skill:adopt` exposes the plan read-only, requiring `--yes` to apply.
