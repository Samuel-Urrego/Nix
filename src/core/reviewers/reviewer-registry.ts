import { access, readFile } from "node:fs/promises";
import path from "node:path";

import type { ReviewerSpec } from "../contracts/reviewer-spec.js";
import { builtinReviewers } from "./builtin-reviewers.js";
import { loadNixConfig } from "../config/config-loader.js";

const REVIEWERS_FILE_NAME = "reviewers.json";

export async function loadReviewers(
  baseDirectory: string = process.cwd()
): Promise<{
  readonly reviewers: ReadonlyArray<ReviewerSpec>;
  readonly sources: ReadonlyArray<string>;
}> {
  const { config } = await loadNixConfig(baseDirectory);
  const configuredPaths = config.reviewerSources
    .filter((source) => source !== "builtin")
    .map((source) => path.isAbsolute(source) ? source : path.join(baseDirectory, source));

  const candidatePaths = [
    path.join(baseDirectory, REVIEWERS_FILE_NAME),
    path.join(baseDirectory, ".nix", REVIEWERS_FILE_NAME),
    ...configuredPaths
  ];
  const loadedReviewers: ReviewerSpec[] = [...builtinReviewers];
  const sources: string[] = ["builtin"];

  for (const filePath of candidatePaths) {
    try {
      await access(filePath);
    } catch {
      continue;
    }

    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as ReadonlyArray<ReviewerSpec>;

    loadedReviewers.push(...parsed);
    sources.push(filePath);
  }

  return {
    reviewers: loadedReviewers,
    sources
  };
}
