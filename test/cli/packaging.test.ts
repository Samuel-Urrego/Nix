import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { createUpgradePlan } from "../../src/core/system/npm-upgrade.js";
import { projectMetadata } from "../../src/core/system/project-metadata.js";

const root = process.cwd();

interface PackageJson {
  readonly name?: string;
  readonly version?: string;
  readonly private?: boolean;
  readonly license?: string;
  readonly scripts?: Record<string, string>;
  readonly bin?: Record<string, string>;
  readonly files?: ReadonlyArray<string>;
  readonly publishConfig?: { readonly access?: string };
}

async function readPackage(): Promise<PackageJson> {
  return JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as PackageJson;
}

test("package is publishable to the public npm registry", async () => {
  const pkg = await readPackage();
  assert.notEqual(pkg.private, true, "package.json must not be private");
  assert.equal(pkg.license, "MIT");
  assert.equal(pkg.publishConfig?.access, "public");
  assert.ok(pkg.files?.includes("dist"), "the published package must ship the compiled dist tree");
});

test("the published package ships the nix-ai binary built before packing", async () => {
  const pkg = await readPackage();
  assert.equal(pkg.bin?.["nix-ai"], "./dist/cli/index.js");
  assert.equal(pkg.scripts?.prepack, "npm run build");
  assert.equal(pkg.scripts?.prepare, undefined, "prepare runs on consumer installs in some npm versions and must not be needed");
  assert.match(pkg.scripts?.prepublishOnly ?? "", /npm run typecheck/);
});

test("package name and version match the CLI project metadata", async () => {
  const pkg = await readPackage();
  assert.equal(projectMetadata.packageName, pkg.name);
  assert.equal(projectMetadata.version, pkg.version);
});

test("upgrade installs the latest published version and never a branch", () => {
  const plan = createUpgradePlan("nix-ai-stack");
  assert.equal(plan.packageSpec, "nix-ai-stack@latest");
  assert.equal(plan.commandLine, "npm install --global nix-ai-stack@latest");
  assert.doesNotMatch(plan.commandLine, /github\.com|git\+|#/);
});
