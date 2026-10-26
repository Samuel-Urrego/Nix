# Agents

This folder stores agent guidance, role definitions, catalogs, and future specialization plans for Nix agents.

## Suggested structure

```text
agents/
├── README.md
├── agent-system.md
├── tech-agent-roadmap.md
├── skill-agent-matrix.md
├── architecture.md
├── architecture-selector.md
├── blind-judge.md
├── command-catalog.md
├── component-catalog.md
├── mcp-integrations.md
├── pattern-review-rules.md
├── product-vision.md
├── reviewer-spec.md
├── reviewer-strategy.md
├── security-hooks.md
├── skill-authoring.md
├── skill-catalog.md
├── skill-compatibility.md
├── skill-style-guide.md
├── stack-inventory.md
├── workflows.md
└── specs/
    └── {agent-name}.md
```

The top-level Markdown files define the agent, skill, architecture, reviewer, security-hook, and stack guidance used by this project. Put individual agent specifications in `specs/`.

## Rule

Do not create a specialist agent until the domain has repeated workflows and clear decision boundaries.
