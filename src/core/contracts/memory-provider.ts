export interface MemorySearchResult {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly score?: number;
}

export interface MemorySaveInput {
  readonly title: string;
  readonly type:
    | "decision"
    | "architecture"
    | "discovery"
    | "pattern"
    | "config"
    | "bugfix"
    | "preference";
  readonly topicKey?: string;
  readonly content: string;
}

export interface MemoryProvider {
  readonly name: string;
  save(input: MemorySaveInput): Promise<void>;
  search(query: string): Promise<ReadonlyArray<MemorySearchResult>>;
  summarizeSession(summary: string): Promise<void>;
}
