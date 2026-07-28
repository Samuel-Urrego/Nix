export interface SkillSpec {
  readonly name: string;
  readonly path: string;
  readonly triggers: ReadonlyArray<string>;
  readonly description: string;
}

export interface SkillRegistry {
  list(): Promise<ReadonlyArray<SkillSpec>>;
}
