import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { findSpecialistAgent, specialistAgentCatalog } from "../../src/core/agents/agent-catalog.js";

test("Araxys specialist is a Nix-owned consumer-only role for both global agent targets", () => {
  const agent = findSpecialistAgent("araxys-specialist");
  assert.ok(agent);
  assert.equal(agent.source, "nix-catalog");
  assert.equal(agent.ownership, "nix");
  assert.deepEqual(agent.supportedAgents, ["opencode", "codex"]);
  assert.match(agent.instructions, /consuming FastAPI application/i);
  assert.match(agent.instructions, /installed Araxys version/i);
  assert.match(agent.instructions, /Never edit, create, commit, or otherwise mutate files in the Araxys library repository/i);
  const python = findSpecialistAgent("python-fastapi-specialist");
  assert.ok(python);
  assert.deepEqual(python.supportedAgents, ["opencode", "codex"]);
  assert.match(python.instructions, /FastAPI/i);
  assert.match(python.instructions, /async boundaries/i);
  assert.match(python.instructions, /Araxys-specific guidance in the dedicated araxys-integration skill/i);
  assert.equal(specialistAgentCatalog.length, 4);
});

test("Nix orchestrator is an OpenCode primary agent that runs the ODD flow", () => {
  const nix = findSpecialistAgent("nix");
  assert.ok(nix);
  assert.equal(nix.name, "Nix");
  assert.equal(nix.source, "nix-catalog");
  assert.equal(nix.ownership, "nix");
  assert.deepEqual(nix.supportedAgents, ["opencode"]);
  assert.equal(nix.mode, "primary");
  for (const marker of [
    "Organic Driven Development",
    "AUTHORIZE",
    "EXPLORE",
    "CLASSIFY",
    "TRACK",
    "IMPLEMENT",
    "VERIFY",
    "CLOSE",
    "Delegation",
    "Work units and commits",
    "Risk classification",
  ]) {
    assert.match(nix.instructions, new RegExp(marker), `the orchestrator prompt must define ${marker}`);
  }
  assert.match(nix.instructions, /Never claim a result you have not observed/i);
  assert.match(nix.instructions, /Push, pull requests, merges, and releases are the user's decisions/i);
  // Nix must route work through the installed skills and the specialist roster.
  for (const marker of [
    "Skills",
    "Specialist subagents",
    "skill tool",
    "never invent a skill id",
    "araxys-specialist",
    "python-fastapi-specialist",
    "skill-runner",
  ]) {
    assert.match(nix.instructions, new RegExp(marker), `the orchestrator prompt must define ${marker}`);
  }
  // Any installed skill is reachable through a delegated specialist, not just the two named domains.
  const runner = findSpecialistAgent("skill-runner");
  assert.ok(runner, "a skill runner must exist so every skill can be delegated");
  assert.deepEqual(runner.supportedAgents, ["opencode", "codex"]);
  assert.equal(runner.mode, undefined, "the skill runner is a delegated role");
  for (const marker of ["skill id", "Load the named skill", "edit surfaces", "Never widen scope", "not a pass"]) {
    assert.match(runner.instructions, new RegExp(marker), `the skill runner must define ${marker}`);
  }
  // Every other catalog entry stays a delegated subagent role.
  for (const entry of specialistAgentCatalog.filter((item) => item.id !== "nix")) {
    assert.equal(entry.mode, undefined, `${entry.id} must keep the default subagent mode`);
  }
});

test("Python FastAPI skill is distinct from Araxys integration and uses the project contract", async () => {
  const skill = await readFile(path.resolve("skills/python-fastapi/SKILL.md"), "utf8");
  assert.match(skill, /^---\nname: python-fastapi\n/);
  assert.match(skill, /`uv run pytest`/);
  assert.match(skill, /Araxys-specific integration guidance in `araxys-integration`/);
  assert.match(skill, /installed version/i);
});

test("Araxys skill follows the project contract and links only to a local role reference", async () => {
  const skill = await readFile(path.resolve("skills/araxys-integration/SKILL.md"), "utf8");
  assert.match(skill, /^---\nname: araxys-integration\n/);
  for (const section of ["Activation Contract", "Hard Rules", "Decision Gates", "Execution Steps", "Output Contract", "References"]) {
    assert.match(skill, new RegExp(`## ${section}`));
  }
  assert.match(skill, /installed Araxys version/i);
  assert.match(skill, /Never create, edit, or commit files in the Araxys library repository/i);
  assert.match(skill, /agents\/araxys-specialist\.md/);
});

