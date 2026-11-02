export interface NixConfig {
  readonly projectName: string;
  readonly defaultArchitecture: string;
  readonly reviewerSources: ReadonlyArray<string>;
  readonly scanRoots: ReadonlyArray<string>;
  readonly preferredTestRoot?: string;
  readonly architectureHints?: ReadonlyArray<string>;
  /** Model assigned to an installed agent, keyed `<target>:<agent-id>`. */
  readonly agentModels?: Readonly<Record<string, string>>;
}

export const defaultNixConfig: NixConfig = {
  projectName: "Nix",
  defaultArchitecture: "simple-modular",
  reviewerSources: ["builtin"],
  scanRoots: ["."]
};
