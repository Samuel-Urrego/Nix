export interface NixConfig {
  readonly projectName: string;
  readonly defaultArchitecture: string;
  readonly reviewerSources: ReadonlyArray<string>;
  readonly scanRoots: ReadonlyArray<string>;
  readonly preferredTestRoot?: string;
  readonly architectureHints?: ReadonlyArray<string>;
}

export const defaultNixConfig: NixConfig = {
  projectName: "Nix",
  defaultArchitecture: "simple-modular",
  reviewerSources: ["builtin"],
  scanRoots: ["."]
};
