import { readdir } from "node:fs/promises";
import path from "node:path";

import type { PetState } from "./state.js";

export const PET_STATES: ReadonlyArray<PetState> = ["idle", "thinking", "working", "waiting", "success", "error"];

export interface PetAsset {
  readonly file: string;
  readonly contentType: string;
}

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".webm": "video/webm",
  ".apng": "image/apng",
  ".png": "image/png",
  ".gif": "image/gif"
};

/**
 * Animated art for the pet lives in `<project>/pet-assets/<state>.<ext>`, one file
 * per state, all with the same canvas so switching states never jumps. Without
 * that directory the window falls back to its built-in SVG companion.
 */
export async function readPetAssets(directory: string): Promise<ReadonlyMap<PetState, PetAsset>> {
  const folder = path.join(path.resolve(directory), "pet-assets");
  let files: string[];
  try {
    files = await readdir(folder);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Map();
    throw error;
  }

  const assets = new Map<PetState, PetAsset>();
  // Explicit preference: an alpha video beats an animated PNG beats a GIF.
  for (const extension of [".webm", ".apng", ".gif", ".png"]) {
    const contentType = CONTENT_TYPES[extension];
    if (!contentType) continue;
    for (const file of files) {
      if (path.extname(file).toLowerCase() !== extension) continue;
      const state = path.basename(file, path.extname(file)) as PetState;
      if (!PET_STATES.includes(state) || assets.has(state)) continue;
      assets.set(state, { file: path.join(folder, file), contentType });
    }
  }
  return assets;
}
