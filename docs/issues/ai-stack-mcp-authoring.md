# MCP-authoring skill

## Outcome

Create a focused skill for repeatable MCP server and adapter development in Nix-supported projects.

## Scope

- Guide tool contracts, argument validation, read/write boundaries, error behavior, configuration adapters, and tests.
- Link to local Nix references for security and integration conventions.
- Complement `mcp-safety` review guidance rather than duplicating it.

## Acceptance

- Follow `agents/skill-style-guide.md` and its frontmatter/section contract.
- Include practical decision gates and test expectations without becoming a broad MCP tutorial.
- Register the skill and verify project registry output.

## Dependencies and checks

- No agent-catalog dependency.
- Validate frontmatter and required sections, refresh the skill registry, and run relevant tests if catalog-backed.
