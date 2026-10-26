export interface ComponentSource {
  readonly kind: "nix-authored";
  readonly relativePath: string;
  readonly license: "Apache-2.0";
  readonly dependencies: ReadonlyArray<string>;
}

export interface ComponentFile {
  readonly sourcePath: string;
  readonly targetPath: string;
}

export interface ComponentManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly kind: "skill";
  readonly agentTargets: ReadonlyArray<"codex">;
  readonly installRelativePath: string;
  readonly source: ComponentSource;
  readonly files: ReadonlyArray<ComponentFile>;
}

export const nixCoreSkill: ComponentManifest = {
  id: "skill.nix-core",
  name: "Nix Core",
  version: "1.0.0",
  kind: "skill",
  agentTargets: ["codex"],
  installRelativePath: ".agents/skills/nix-core",
  source: {
    kind: "nix-authored",
    relativePath: "skills/nix-core",
    license: "Apache-2.0",
    dependencies: []
  },
  files: [{ sourcePath: "skills/nix-core/SKILL.md", targetPath: "SKILL.md" }]
};

export const componentCatalog: ReadonlyArray<ComponentManifest> = [nixCoreSkill];

export function getComponent(id: string): ComponentManifest | undefined {
  return componentCatalog.find((component) => component.id === id);
}
