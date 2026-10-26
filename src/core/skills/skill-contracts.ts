export type SkillAgent = "opencode" | "codex";
export type SkillLicense = "MIT" | "Apache-2.0";

export type SkillDependency =
  | { readonly kind: "command"; readonly name: string; readonly description: string; readonly required: boolean }
  | { readonly kind: "file"; readonly path: string; readonly description: string; readonly required: boolean }
  | { readonly kind: "runtime"; readonly name: string; readonly description: string; readonly required: boolean }
  | { readonly kind: "network"; readonly name: string; readonly description: string; readonly required: boolean };

export type SkillSource = GitSkillSource | BundledSkillSource;

export interface GitSkillSource {
  readonly kind: "git";
  readonly repo: string;
  readonly ref: string;
  readonly path: string;
  readonly licensePath: string;
  readonly noticePath?: string;
}

export interface BundledSkillSource {
  readonly kind: "bundled";
  /** Package-relative path containing the skill directory. */
  readonly path: string;
}

export function describeSkillSource(source: SkillSource): string {
  return source.kind === "git"
    ? `${source.repo}@${source.ref} (${source.path})`
    : `Nix package (${source.path})`;
}

export interface SkillCatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly source: SkillSource;
  readonly license: SkillLicense;
  readonly version: string;
  readonly dependencies: ReadonlyArray<SkillDependency>;
  readonly compatibleAgents: ReadonlyArray<SkillAgent>;
  readonly installPaths: Readonly<Record<SkillAgent, string>>;
  readonly updatePolicy: "pinned";
  readonly stackTags: ReadonlyArray<string>;
}

export type SkillFileMap = ReadonlyMap<string, Buffer>;
export type SkillFetcher = (entry: SkillCatalogEntry) => Promise<SkillFileMap>;
