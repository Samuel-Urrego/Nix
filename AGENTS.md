# Nix Agent Instructions

## Mission

Nix is a personal AI stack for disciplined software delivery. Its core foundations are SDD, strict TDD, reviewer workflows, Judgment Day, and persistent memory through Engram.

## Architecture rules

- Keep orchestration decisions centralized.
- Treat memory, review, and external tooling as adapters behind clear contracts.
- Do not couple workflow policy to a single implementation detail.
- Prefer small, composable project skills over giant generic prompts.

## Project layout

- `C:\Proyectos\Nix\src` — runtime implementation
- `C:\Proyectos\Nix\skills` — reusable project skills
- `C:\Proyectos\Nix\agents` — agent catalogs, role definitions, and specialization plans
- `C:\Proyectos\Nix\docs` — architecture, conventions, and planning docs

## Skill creation rule

When a workflow becomes repeatable, encode it as a project skill instead of re-explaining it in chat.

Use `agents/skill-style-guide.md` as the normative guide for new project skills.

## Project skills

- `nix-core` (`skills/nix-core/SKILL.md`) — Nix architecture and safe-delivery conventions; activate for Nix AI Stack work.
- `blind-judge` (`skills/blind-judge/SKILL.md`) — isolated idea evaluation with pro/con groups and five neutral evaluators; optional decision support.
- `araxys-integration` (`skills/araxys-integration/SKILL.md`) — version-verified, consumer-only Araxys integration; never modifies the library repository.
- `python-fastapi` (`skills/python-fastapi/SKILL.md`) — uv, async FastAPI, explicit validation, and pytest conventions.
- `mcp-authoring` (`skills/mcp-authoring/SKILL.md`) — MCP tool contracts, input validation, side-effect boundaries, and adapter tests.

## Agent strategy

- Use one core orchestrator.
- Add specialized agents by domain, not by hype.
- Create a dedicated agent only when the domain has stable constraints, repeated workflows, or non-trivial review heuristics.

## Language rule

Project artifacts default to English unless a specific artifact explicitly needs another language.
