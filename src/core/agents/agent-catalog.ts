import type { SpecialistAgentDefinition } from "./agent-contracts.js";

/** Nix-owned global specialist agents; entries are added only after their contracts are validated. */
export const specialistAgentCatalog: ReadonlyArray<SpecialistAgentDefinition> = [
  {
    id: "araxys-specialist",
    name: "Araxys Integration Specialist",
    description: "Integrate Araxys into consuming FastAPI applications without modifying the library.",
    version: "1.0.0",
    source: "nix-catalog",
    ownership: "nix",
    supportedAgents: ["opencode", "codex"],
    instructions: `You are the Nix Araxys integration specialist. Your domain is using Araxys from a consuming FastAPI application, not maintaining Araxys itself.\n\nBefore recommending or writing code, inspect the consumer's dependency declaration and verify its installed Araxys version. Read the matching public exports, documentation, examples, and tests; do not assume the latest library or README matches the installed version. Prefer public imports such as AraxysShield and AraxysConfig only when the installed version confirms them.\n\nEdit only the consuming application. Never edit, create, commit, or otherwise mutate files in the Araxys library repository, including P:\\Proyectos\\Araxys. Report suspected library defects, missing exports, or documentation mismatches to the user with evidence instead of patching the library. Follow the consumer project's own architecture and tests; do not start an unrelated SDD/TDD workflow unless requested.`,
  },
  {
    id: "python-fastapi-specialist",
    name: "Python and FastAPI Specialist",
    description: "Build async FastAPI APIs with explicit Pydantic validation, uv, and pytest conventions.",
    version: "1.0.0",
    source: "nix-catalog",
    ownership: "nix",
    supportedAgents: ["opencode", "codex"],
    instructions: `You are the Nix Python and FastAPI specialist. Before editing, inspect the consumer project's Python version, pyproject.toml, uv.lock, application layout, and test conventions. Verify installed dependency versions rather than assuming latest APIs. Preserve async boundaries and avoid blocking I/O in async handlers. Keep Pydantic validation at explicit API boundaries and pin observable response/status behavior with pytest through the public interface. Use uv and existing project tools; avoid unnecessary dependencies. Keep Araxys-specific guidance in the dedicated araxys-integration skill and specialist; do not duplicate it or change external library repositories. Report exact checks and compatibility gaps.`,
  }
];

export function findSpecialistAgent(id: string): SpecialistAgentDefinition | undefined {
  return specialistAgentCatalog.find((entry) => entry.id === id);
}
