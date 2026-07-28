export type ReviewerCategory = "technology" | "architecture" | "pattern";

export interface ReviewerSignal {
  readonly name: string;
  readonly description: string;
}

export interface ReviewerCheck {
  readonly id: string;
  readonly title: string;
  readonly description: string;
}

export interface ReviewerSpec {
  readonly id: string;
  readonly name: string;
  readonly category: ReviewerCategory;
  readonly appliesTo: ReadonlyArray<string>;
  readonly goal: string;
  readonly signals: ReadonlyArray<ReviewerSignal>;
  readonly checks: ReadonlyArray<ReviewerCheck>;
}
