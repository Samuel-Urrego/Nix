import type {
  ArchitectureOption,
  ArchitectureSelectionInput,
  ArchitectureSelector
} from "../contracts/architecture-selector.js";
import { architectureOptions } from "./architecture-options.js";

export class DefaultArchitectureSelector implements ArchitectureSelector {
  async recommend(
    input: ArchitectureSelectionInput
  ): Promise<ReadonlyArray<ArchitectureOption>> {
    if (input.complexity === "high" || input.teamSize === "large") {
      return architectureOptions.filter((option) =>
        ["clean-architecture", "modular-monolith"].includes(option.id)
      );
    }

    if (input.projectType === "mcp" || input.projectType === "tooling") {
      return architectureOptions.filter((option) =>
        ["simple-modular", "layered"].includes(option.id)
      );
    }

    if (input.complexity === "medium") {
      return architectureOptions.filter((option) =>
        ["layered", "modular-monolith"].includes(option.id)
      );
    }

    return architectureOptions.filter((option) =>
      ["simple-modular", "layered"].includes(option.id)
    );
  }
}
