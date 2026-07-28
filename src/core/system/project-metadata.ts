export interface ProjectMetadata {
  readonly name: string;
  readonly version: string;
  readonly runtime: string;
  readonly packageManager: string;
}

export const projectMetadata: ProjectMetadata = {
  name: "Nix",
  version: "0.1.0",
  runtime: "TypeScript / Node.js",
  packageManager: "npm-compatible"
};
