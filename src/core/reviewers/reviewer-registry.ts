import { access, readFile } from "node:fs/promises";
import path from "node:path";

import type { ReviewerSpec } from "../contracts/reviewer-spec.js";
import { builtinReviewers } from "./builtin-reviewers.js";

const REVIEWERS_FILE_NAME = "reviewers.json";

export async function loadReviewers(
  baseDirectory: string = process.cwd()
): Promise<{
  readonly reviewers: ReadonlyArray<ReviewerSpec>;
  readonly sources: ReadonlyArray<string>;
}> {
  const filePath = path.join(baseDirectory, REVIEWERS_FILE_NAME);

  try {
    await access(filePath);
  } catch {
    return {
      reviewers: builtinReviewers,
      sources: ["builtin"]
    };
  }

  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as ReadonlyArray<ReviewerSpec>;

  return {
    reviewers: [...builtinReviewers, ...parsed],
    sources: ["builtin", filePath]
  };
}
