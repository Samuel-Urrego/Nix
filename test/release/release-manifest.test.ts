import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { projectMetadata } from "../../src/core/system/project-metadata.js";
import {
  createReleaseManifest,
  loadReleaseManifest,
  releaseCompatibility,
  verifyReleaseManifest,
  writeReleaseManifest
} from "../../src/core/release/release-manifest.js";

async function fixture(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "nix-release-manifest-"));
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

test("release manifest records compatibility, sorted files, and SHA-256 checksums", async () => {
  const root = await fixture();
  try {
    const dist = path.join(root, "dist");
    await mkdir(path.join(dist, "cli"), { recursive: true });
    await writeFile(path.join(dist, "README.txt"), "release notes\n", "utf8");
    await writeFile(path.join(dist, "cli", "index.js"), "console.log('nix');\n", "utf8");
    await writeFile(path.join(dist, "release-manifest.json"), "ignored\n", "utf8");

    const manifest = await createReleaseManifest({
      distDirectory: dist,
      version: "0.1.0",
      generatedAt: "2026-10-21T00:00:00.000Z"
    });

    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.name, "nix-ai-stack");
    assert.equal(manifest.version, "0.1.0");
    assert.equal(manifest.generatedAt, "2026-10-21T00:00:00.000Z");
    assert.deepEqual(manifest.compatibility, releaseCompatibility);
    assert.deepEqual(manifest.files.map((file) => file.path), ["README.txt", "cli/index.js"]);
    assert.equal(manifest.files[0]?.sha256, sha256("release notes\n"));
    assert.equal(manifest.files[0]?.bytes, Buffer.byteLength("release notes\n"));
    assert.equal(manifest.files[1]?.sha256, sha256("console.log('nix');\n"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("manifest round-trips and verification reports missing, modified, and extra files", async () => {
  const root = await fixture();
  try {
    const dist = path.join(root, "dist");
    await mkdir(dist, { recursive: true });
    await writeFile(path.join(dist, "a.txt"), "alpha\n", "utf8");
    await writeFile(path.join(dist, "b.txt"), "bravo\n", "utf8");
    const manifest = await createReleaseManifest({ distDirectory: dist, version: "0.1.0" });
    const manifestPath = path.join(root, "release-manifest.json");
    await writeReleaseManifest(manifest, manifestPath);
    assert.deepEqual(await loadReleaseManifest(manifestPath), manifest);

    assert.deepEqual(await verifyReleaseManifest(dist, manifest), {
      ok: true,
      missing: [],
      modified: [],
      extra: []
    });

    await rm(path.join(dist, "a.txt"));
    await writeFile(path.join(dist, "b.txt"), "changed\n", "utf8");
    await writeFile(path.join(dist, "extra.txt"), "extra\n", "utf8");
    const broken = await verifyReleaseManifest(dist, manifest);
    assert.equal(broken.ok, false);
    assert.deepEqual(broken.missing, ["a.txt"]);
    assert.deepEqual(broken.modified, ["b.txt"]);
    assert.deepEqual(broken.extra, ["extra.txt"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("invalid release manifests are rejected", async () => {
  const root = await fixture();
  try {
    const file = path.join(root, "release-manifest.json");
    await writeFile(file, JSON.stringify({ schemaVersion: 2, files: [] }), "utf8");
    await assert.rejects(loadReleaseManifest(file), /schema/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("package version matches the CLI project metadata version", async () => {
  const packageJson = JSON.parse(await readFile(path.join(process.cwd(), "package.json"), "utf8")) as { version?: string };
  assert.equal(packageJson.version, projectMetadata.version);
});
