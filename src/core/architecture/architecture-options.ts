import type { ArchitectureOption } from "../contracts/architecture-selector.js";

export const architectureOptions: ReadonlyArray<ArchitectureOption> = [
  {
    id: "simple-modular",
    name: "Simple Modular Application",
    fitFor: ["internal tools", "small products", "solo projects", "mcp utilities"],
    avoidWhen: ["high rule density", "large teams", "many integration boundaries"]
  },
  {
    id: "layered",
    name: "Layered Architecture",
    fitFor: ["standard backends", "conventional business apps", "moderate complexity"],
    avoidWhen: ["fake layers", "domain-heavy systems that need stronger isolation"]
  },
  {
    id: "clean-architecture",
    name: "Clean Architecture",
    fitFor: ["enterprise systems", "complex business rules", "high change pressure"],
    avoidWhen: ["small CRUD apps", "low complexity tools", "ceremony without pressure"]
  },
  {
    id: "modular-monolith",
    name: "Modular Monolith",
    fitFor: ["growing products", "multiple domains", "feature-rich platforms"],
    avoidWhen: ["tiny systems", "teams without module discipline"]
  }
];
