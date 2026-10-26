---
name: mcp-authoring
description: "Trigger: MCP server, MCP tool, tool schema, MCP adapter, resource, prompt. Design safe, testable MCP integrations and servers."
license: Apache-2.0
metadata:
  author: "surre"
  version: "1.0"
---

## Activation Contract

Use this skill when authoring or changing MCP servers, tools, resources, prompts, or configuration adapters.

## Hard Rules

- Define each tool's purpose, input schema, output shape, side effects, and failure behavior before implementation.
- Validate untrusted arguments at the boundary; reject unknown or malformed fields rather than silently widening behavior.
- Make read-only and mutating operations distinct and explicit. Mutations require a clear confirmation boundary and must preserve unrelated user state.
- Keep secrets in environment or credential adapters; never log or serialize secret values.
- Do not duplicate the `mcp-safety` reviewer's adversarial security review; use it as a separate check when applicable.

## Decision Gates

| Situation | Action |
| --- | --- |
| Tool can write, delete, publish, or trigger external effects | Preview first, require explicit confirmation, and test refused-operation preservation. |
| A tool accepts paths, commands, or URLs | Constrain scope and validate traversal, shell injection, and SSRF boundaries. |
| Configuration already contains other servers | Merge only the selected entry and prove unrelated entries are unchanged. |
| External operation can fail partway | Define timeout, retry, partial-write, and recovery semantics before coding. |

## Execution Steps

1. Read existing server, adapter, schema, and test conventions; reuse shared configuration and validation helpers.
2. Specify tool names, descriptions, required inputs, bounded outputs, errors, and side effects.
3. Add deterministic tests through the public MCP/tool interface for valid, invalid, refused, and failure cases.
4. Implement the smallest adapter and keep provider-specific configuration behind it.
5. Run focused tests and verify secrets, unrelated configuration, and rejected writes remain unchanged.

## Output Contract

Summarize tool contracts, read/write boundaries, validation and failure behavior, changed files, and exact verification results.

## References

- `agents/mcp-integrations.md` — Nix MCP configuration, ownership, credential, and status conventions.
- `src/core/reviewers/builtin-reviewers.ts` — `mcp-safety` reviewer contract for a separate adversarial review.
