# Security hooks and destructive-operation safeguards

Nix can install opt-in, project-local pre-execution hooks that block a narrow set of high-confidence destructive commands before an agent runs them. This document defines the threat model, the supported agent events, the policy rules, and the exact limits of the protection.

These hooks are an advisory defense-in-depth layer, **not a sandbox**. They reduce accidental damage from common commands; they do not prevent a determined or unusual command from running.

## Scope

- **Platform:** Windows only (v1).
- **Shells inspected:** PowerShell, cmd.exe, and Git Bash/MSYS.
- **Agents:** Codex and OpenCode. OpenCode supports both the V1 `tool.execute.before` plugin API and the V2 `ctx.tool.hook("execute.before", ...)` plugin API.
- **Installation:** project-local and opt-in. No global configuration is read, written, or modified.
- **Enforcement point:** before a shell tool executes. The policy never runs a command, edits a command, or auto-approves one.

## Threat model

In scope:

- Accidental or copy-pasted recursive deletion of a filesystem root, a broad wildcard, or a protected system directory.
- Accidental or copy-pasted destructive SQL against a database reachable through a command-line client: `DROP`, `TRUNCATE`, unscoped `DELETE`, and unscoped `UPDATE`.
- Commands wrapped in the common single-level or nested shell invocations listed below.

Out of scope:

- Malicious obfuscation, encoded payloads, aliases, shell functions, script files, and alternate executables.
- Direct database clients, drivers, or HTTP APIs that do not go through a recognized CLI invocation.
- Non-shell tools and agent-specific events other than the ones listed below.
- Any guarantee that an unsupported or unrecognized command is safe. Unsupported syntax is reported as unsupported, never as an allow decision with a claim of protection.

## Supported hook events

| Agent | Event | Accepted payload | Tools inspected |
|-------|-------|------------------|-----------------|
| Codex | `PreToolUse` | `tool_name` plus `tool_input.command` as a string | `Bash` (evaluated against all three Windows shells), `PowerShell`, `Cmd` |
| OpenCode V1 | `tool.execute.before` | `input.tool` plus `output.args.command` as a string | `bash` |
| OpenCode V2 | `execute.before` | `event.tool` plus `event.input.command` as a string | `bash` |

Because OpenCode does not expose the active configured shell in these events, its `bash` tool is evaluated conservatively against PowerShell, cmd.exe, and Git Bash/MSYS. A match in any of them blocks; otherwise an unsupported result in any of them is reported as unsupported.

## Decision model

Each inspection returns one of four outcomes:

- **allow** — no supported destructive operation was detected. The command runs normally.
- **block** — a high-confidence destructive operation matched a rule. Codex receives `permissionDecision: "deny"` with the reason; OpenCode receives its native hook error with the reason.
- **unsupported** — the command or event cannot be inspected safely. It is reported distinctly and is never presented as a successful block.
- **runtime-failure** — the adapter or policy failed unexpectedly. Codex does not emit a deny decision and writes the failure to stderr; OpenCode throws a distinct runtime-failure error. Neither is represented as a policy block.

## Policy rules

### Broad file deletion

The policy tokenizes the command, splits it on `;`, `&&`, `||`, and `&`, and inspects each invocation. A deletion is blocked only when it is recursive **and** targets a broad location.

| Shell | Recursive flag | Blocked target examples |
|-------|----------------|-------------------------|
| PowerShell | `-Recurse` or `-r` | `C:\`, `C:/`, `/`, `*`, `.\*`, `..\*`, `C:\Windows`, `C:\Users`, `C:\Program Files` |
| cmd.exe | `/s` | the same broad roots and wildcards |
| Git Bash/MSYS | combined flags containing `r` and `f` (for example `-rf`), or `--recursive` | the same broad roots and wildcards |

`cmd.exe /q` alone is quiet mode, not recursion, and is allowed. Recursive deletion of an ordinary project-relative path is allowed.

### Destructive SQL

SQL is inspected only for these CLI clients: `psql`, `mysql`, `mariadb`, `sqlite3`, and `sqlcmd`, when the statement is passed through `-c`, `--command`, `--execute`, or `-e`. SQL comments are stripped before matching.

Blocked patterns:

- `DROP` and `TRUNCATE` against a database object (`table`, `database`, `schema`, `index`, `view`, `sequence`, `function`, `procedure`, `trigger`, `role`, `user`).
- `DELETE FROM <table>` with no `WHERE` clause.
- `UPDATE <table> SET ...` with no `WHERE` clause.

A scoped `UPDATE ... WHERE ...` and a scoped `DELETE FROM ... WHERE ...` are allowed.

### Shell wrappers and nesting

The policy unwraps these prefixes before inspecting the inner command, up to a nesting depth of three:

- `cmd /c ...` and `cmd /k ...`
- `powershell -Command ...`, `powershell -c ...`, `pwsh -Command ...`, `pwsh -c ...`
- `bash -c ...`, `sh -c ...`, `zsh -c ...`

Quoted arguments are tokenized with the quoting rules of the active shell dialect. Destructive-looking text inside an `echo` argument is allowed because it is not an invocation.

### Explicitly unsupported syntax

The policy returns `unsupported` rather than guessing when it sees:

- PowerShell encoded payloads (`-EncodedCommand`, `-enc`).
- Dynamic command construction such as `$(...)`, backtick substitution, or piping into a nested shell executable.
- Unbalanced quoting, unrecognized event shapes, missing or non-string command payloads, and wrapper nesting beyond three levels.

## Installation, status, and removal

Open the TUI with `nix-ai` and choose **Manage project-local security hooks**. The screen shows the current Codex and OpenCode enablement state, the inspected shells, and the preview targets. Installation requires typing `yes`; nothing is enabled by default.

Installation writes only:

- `.codex/hooks/nix-ai-security/*` — the Codex hook runtime and shared policy.
- `.codex/hooks.json` — one managed `PreToolUse` entry with matcher `Bash|PowerShell|Cmd`. Existing user entries are preserved.
- `.opencode/plugins/nix-ai-security/*` — the shared V1/V2 OpenCode plugin.

Removal deletes only files whose bytes match the Nix-managed build and the exact managed Codex entry. Modified files, unowned files, symlinked targets, and conflicting directory contents cause a refusal instead of an overwrite. User-owned hooks and plugin files remain untouched.

## Blocked-command workflow

A block message names the rule and the matched target or statement. There is no hidden auto-approval and no global bypass. To proceed, inspect the command, narrow the target or scope the SQL, and submit the corrected command again. If the corrected command is still intentionally broad, run it outside the agent with ordinary operating-system safeguards.

## Release compatibility

- Windows 10/11 is the only verified platform for v1.
- OpenCode and Codex are the only verified agents.
- The release manifest checksums cover the built `dist/` tree; they do not sign hooks, inspect hook behavior, or prove authenticity.
- Hook installation remains project-local and opt-in in every release. Checksums do not change the threat model or enable hooks by default.

See [the support matrix](../docs/support-matrix.md) and [release and compatibility](../docs/release.md).

## Coverage and current limits

Deterministic tests cover:

- direct deletion commands in PowerShell, cmd.exe, and Git Bash/MSYS,
- `cmd /c`, PowerShell `-Command`, and `bash -c` wrappers,
- quoting and escaped arguments,
- harmless near-matches such as text inside `echo` and `cmd.exe /q`,
- unscoped versus scoped SQL,
- encoded PowerShell and malformed payloads,
- Codex and both OpenCode event adapters, including allow, block, unsupported, and runtime-failure mappings,
- project-local install, idempotent reinstall, and removal that preserves user-owned entries.

Known gaps:

- No protection for `Remove-Item` aliases other than `ri`, `rm`, `rmdir`, `del`, and `erase`; aliases and functions can bypass recognition.
- No inspection of script files, `Invoke-Expression`, `Start-Process`, job schedulers, WMI, or remote shells.
- No inspection of SQL passed through standard input, configuration files, ORMs, migrations, or database APIs.
- No protection for other platform shells or other agents; unsupported adapters remain unavailable by design.
- No sandbox: a command that the policy does not recognize can still be destructive.

Default enablement is not planned until broader platform and shell coverage is demonstrated.
