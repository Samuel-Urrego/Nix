export interface ArchitectureOption {
  readonly id: string;
  readonly name: string;
  readonly fitFor: ReadonlyArray<string>;
  readonly avoidWhen: ReadonlyArray<string>;
}

export interface ArchitectureSelectionInput {
  readonly projectType: string;
  readonly complexity: "low" | "medium" | "high";
  readonly teamSize: "solo" | "small" | "medium" | "large";
}

export interface ArchitectureSelector {
  recommend(input: ArchitectureSelectionInput): Promise<ReadonlyArray<ArchitectureOption>>;
}
