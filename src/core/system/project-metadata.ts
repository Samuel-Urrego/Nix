export interface ProjectMetadata {
  readonly name: string;
  readonly packageName: string;
  readonly version: string;
  readonly runtime: string;
  readonly packageManager: string;
}

export const projectMetadata: ProjectMetadata = {
  name: "Nix",
  packageName: "nix-ai-stack",
  version: "0.1.1",
  runtime: "TypeScript / Node.js",
  packageManager: "npm-compatible"
};
