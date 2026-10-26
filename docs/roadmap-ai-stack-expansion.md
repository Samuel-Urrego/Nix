# AI Stack Expansion Roadmap

This roadmap starts a new initiative after the original Nix delivery roadmap was completed. It grows Nix's global OpenCode and Codex stack through specialist agents, focused skills, useful commands, and a carefully scoped hook capability review.

## Outcome

Make Nix more useful without multiplying generic agents or duplicating existing skills. Start with a managed native-agent foundation, then add proven specialists and narrow workflows. Keep the original [`roadmap.md`](roadmap.md) closed and unchanged.

## Current baseline

| Area | Current state | Expansion target |
|------|---------------|------------------|
| Agent targets | OpenCode and Codex adapters | Native, Nix-managed global specialist agents for both |
| Specialist agents | No dedicated runtime agent catalog; five built-in reviewers and documented candidates | Small set of stable specialists with clear boundaries |
| Skills | Seven third-party pinned skills plus Nix Core and Blind Judge | First-party Araxys, Python/FastAPI, and MCP-authoring guidance |
| Commands | `/new-feat`, `/refactor`, `/new-idea`, `/new-project` | Add `/araxys` and `/security-audit` only where they add a clear entry point |
| Hooks | Opt-in project-local Windows protections for a narrow set of destructive shell/SQL patterns | Research additional native events before proposing further enforcement |

## Delivery sequence

| Phase | Deliverable | Depends on | Status |
|-------|-------------|------------|--------|
| 1 | Global Nix-managed specialist-agent catalog and safe lifecycle for Codex and OpenCode | Existing agent config adapters and ownership conventions | Complete |
| 2 | Araxys integration skill, specialist agent, and `/araxys` command | Phase 1 | Complete |
| 3 | Python/FastAPI skill and specialist agent | Phase 1 | Complete |
| 4 | MCP-authoring skill | None | Complete |
| 5 | `/security-audit` command backed by the existing Security Audit skill | Existing skill and command catalog | Complete |
| 6 | Native hook capability research and a separately scoped next-step proposal | Official Codex/OpenCode event contracts | Complete |

## Non-negotiable boundaries

- Nix-managed specialist agents are global for the currently supported agent targets; project-specific generated assets remain the responsibility of `/new-project`.
- Prefer a narrow skill first. Create an agent only when the role needs stable, repeated decision-making and dedicated context.
- The Araxys specialist helps integrate and use Araxys in consumer applications. It may inspect Araxys documentation, exports, examples, and tests, but must never modify the Araxys repository. Report suspected library defects rather than patching them.
- `/security-audit` must invoke the already catalogued skill; do not copy its full upstream instructions into a second prompt.
- Existing security hooks remain opt-in, project-local, Windows-only safeguards for Codex/OpenCode. They are not a sandbox. Hook research must verify native event/payload and failure semantics before proposing enforcement.
- Agent and skill installation must preview targets, preserve user-owned files, refuse unmanaged overwrites, and test removal boundaries.

## Work briefs

- [Global specialist-agent catalog](issues/ai-stack-agent-catalog.md)
- [Araxys consumer-integration specialist](issues/ai-stack-araxys-specialist.md)
- [Python/FastAPI specialist](issues/ai-stack-python-fastapi.md)
- [MCP-authoring skill](issues/ai-stack-mcp-authoring.md)
- [Security Audit command](issues/ai-stack-security-audit-command.md)
- [Hook capability research](issues/ai-stack-hooks-research.md)

## Verification and delivery

- Each implementation brief includes acceptance and verification criteria; keep tests and docs with the behavior they verify.
- For code-backed work, run the focused tests and typecheck, then the full suite once at feature closure.
- Agent installation is a global environment boundary; treat it as high risk, preserve unmanaged files, and verify the safety rules through tests.
- This roadmap is independent of the earlier phase numbering. No PR, push, or merge is authorized by this document.
- Implementation and research are complete. The user selected a feature-branch-chain delivery; work-unit commits belong to `codex/ai-stack-expansion`. No PR or push has been authorized.

## References

- [Codex custom-agent documentation](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [OpenCode agent documentation](https://opencode.ai/docs/agents/)
- [Nix agent system](../agents/agent-system.md)
- [Nix security-hook model](../agents/security-hooks.md)
- [Nix skill style guide](../agents/skill-style-guide.md)
