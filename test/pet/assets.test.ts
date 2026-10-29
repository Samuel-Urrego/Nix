import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { readPetAssets } from "../../src/pet/assets.js";

test("a project without pet-assets keeps the built-in companion", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-pet-assets-"));
  try {
    assert.equal((await readPetAssets(root)).size, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("one file per state is discovered with its content type, and video wins", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-pet-assets-"));
  try {
    const folder = path.join(root, "pet-assets");
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "idle.webm"), "webm");
    await writeFile(path.join(folder, "idle.apng"), "apng");
    await writeFile(path.join(folder, "thinking.apng"), "apng");
    await writeFile(path.join(folder, "error.png"), "png");
    await writeFile(path.join(folder, "notes.txt"), "ignore me");
    await writeFile(path.join(folder, "dancing.webm"), "unknown state");

    const assets = await readPetAssets(root);
    assert.deepEqual([...assets.keys()].sort(), ["error", "idle", "thinking"]);
    assert.equal(assets.get("idle")?.contentType, "video/webm", "webm is preferred over apng for the same state");
    assert.equal(assets.get("thinking")?.contentType, "image/apng");
    assert.equal(assets.get("error")?.contentType, "image/png");
    assert.match(assets.get("idle")?.file ?? "", /pet-assets[\\/]idle\.webm$/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
