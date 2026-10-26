# Native hook capability research

## Outcome

Verify the current native Codex and OpenCode hook event surfaces and propose one narrowly scoped next security-hook enhancement.

## Scope

- Use official documentation/source for supported event names, payloads, failure semantics, and platform availability.
- Compare findings with Nix's implemented project-local Windows shell/SQL safeguards.
- Recommend a testable next behavior only when the native contract supports it.
- Do not implement or enable new enforcement in this research item.

## Acceptance

- Evidence links support all event and payload claims.
- The write-up states unsupported cases and preserves the non-sandbox limitation.
- Any implementation is left as a separately authorized follow-up with its own risk line and tests.

## Dependencies and checks

- No code dependency.
- Verify source citations and structurally read back the recommendation.

## Verified findings (2026-10-26)

### Codex

- The native lifecycle set includes `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PreCompact`, `PostCompact`, `SessionStart`, `SessionEnd`, `UserPromptSubmit`, `SubagentStart`, `SubagentStop`, `Stop`, and `Interrupt`.
- Command-hook input is one JSON object on stdin. Shared fields include `session_id`, `transcript_path`, `cwd`, `hook_event_name`, and `model`; turn-scoped events can include `turn_id`, and several include `permission_mode`. The transcript format is explicitly not a stable hook interface.
- Matching `PreToolUse` and `PostToolUse` handlers cover more than shell commands in the general contract, but the existing Nix adapter intentionally accepts only string `tool_input.command` for its listed shell tools.
- Explicit supported deny output can block a tool call. A callback error, timeout, malformed response, or unsupported event output is a failed hook and does not block the operation; Nix must not report those as a successful block. Multiple matching command hooks can run concurrently.
- Trust remains explicit for non-managed hooks. The user's existing opt-in/project-local Nix hook model is preserved.

### OpenCode

- V1 plugin events include `tool.execute.before` and `tool.execute.after`; tool-specific hook payloads expose the selected tool and mutable/observed arguments. Its docs demonstrate throwing from a before hook to reject a read, but do not establish a general fail-closed guarantee for plugin load/runtime failures.
- V2 exposes typed `ctx.tool.hook("execute.before", callback)` and `ctx.tool.hook("execute.after", callback)`; the before event can inspect/replace tool input, while the after event distinguishes completed and failed calls. V2 separately exposes `ctx.shell.hook("create.before", ...)` for shell command, cwd, timeout, shell, and environment changes. Do not assume V1 and V2 hook schemas or behavior are interchangeable.
- OpenCode's public plugin event stream (for example `session.idle`, `file.edited`, or `permission.asked`) is distinct from operation-intercepting hooks; do not claim those stream events can block a tool.

## Recommended next, separately scoped behavior

Prototype a narrow PowerShell content-truncation guard: block only `Clear-Content` or `Set-Content` when the resolved target is a filesystem root, broad wildcard, or protected system path; allow ordinary project-file targets. This addresses an adjacent destructive file class without broadening hook lifecycle or platform scope. Specify parser behavior and false-positive fixtures first, then implement as a separately authorized high-risk task with Codex/OpenCode adapter tests. This recommendation is not an implementation authorization.

## Primary sources

- [Codex Hooks](https://learn.chatgpt.com/docs/hooks) — event inventory, payload/output schemas, trust, concurrency, and failure behavior.
- [OpenCode V1 plugins](https://dev.opencode.ai/docs/plugins/) — plugin events and V1 `tool.execute.before`/`tool.execute.after` examples.
- [OpenCode V2 plugin hooks](https://opencode.ai/v2/docs/build/plugins/) — typed tool and shell hooks, event payloads, and version-specific V1/V2 distinction.

## Scope reminder

Existing Nix hooks remain opt-in, project-local, Windows-only protections for a narrow set of commands. They are defense-in-depth, not a sandbox. No new event support or enforcement was implemented by this research.
