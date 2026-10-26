import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { SecurityHooksInstaller } from "../../src/core/security/security-hooks-installer.js";
import { useProjectHome } from "../helpers/home.js";

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "nix-security-hooks-"));
  const sourceRoot = path.join(directory, "nix");
  const projectRoot = path.join(directory, "project");
  const runtime = path.join(sourceRoot, "dist", "core", "security");
  await mkdir(runtime, { recursive: true });
  await mkdir(projectRoot, { recursive: true });
  const restoreHome = useProjectHome(projectRoot);
  for (const name of SecurityHooksInstaller.runtimeFiles) {
    await writeFile(path.join(runtime, name), `// ${name}\n`);
  }
  return { directory, projectRoot, restoreHome, installer: new SecurityHooksInstaller(sourceRoot) };
}

function codexHooksPath(projectRoot: string): string {
  return path.join(projectRoot, ".codex", "hooks.json");
}

function openCodePluginPath(projectRoot: string): string {
  return path.join(projectRoot, ".config", "opencode", "plugins", "nix-ai-security");
}

function managedCommand(projectRoot: string): string {
  const runtime = path.join(projectRoot, ".codex", "hooks", "nix-ai-security", "codex-hook-runtime.js");
  return `node "${runtime}"`;
}

test("preview is read-only and global", async () => {
  const value = await fixture();
  try {
    const plan = await value.installer.preview(value.projectRoot);
    assert.equal(plan.action, "install");
    assert.equal(plan.targets.codex, codexHooksPath(value.projectRoot));
    assert.equal(plan.targets.opencode, openCodePluginPath(value.projectRoot));
    assert.deepEqual(plan.targets.shells, ["PowerShell", "cmd.exe", "Git Bash/MSYS"]);
    assert.equal((await readdir(value.projectRoot)).length, 0);
  } finally { value.restoreHome(); await rm(value.directory, { recursive: true, force: true }); }
});

test("install preserves user Codex hooks and creates the global OpenCode plugin", async () => {
  const value = await fixture();
  try {
    await mkdir(path.dirname(codexHooksPath(value.projectRoot)), { recursive: true });
    await writeFile(codexHooksPath(value.projectRoot), JSON.stringify({ hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "user-hook" }] }] } }, null, 2));
    const result = await value.installer.install(value.projectRoot);
    assert.equal(result.action, "installed");
    const config = JSON.parse(await readFile(codexHooksPath(value.projectRoot), "utf8")) as { hooks: { PreToolUse: Array<{ hooks: Array<{ command: string }> }> } };
    assert.equal(config.hooks.PreToolUse.length, 2);
    assert.equal(config.hooks.PreToolUse[0]?.hooks[0]?.command, "user-hook");
    assert.equal(config.hooks.PreToolUse[1]?.hooks[0]?.command, managedCommand(value.projectRoot));
    assert.equal(await readFile(path.join(openCodePluginPath(value.projectRoot), "opencode-plugin.js"), "utf8"), "// opencode-plugin.js\n");
    assert.equal((await value.installer.status(value.projectRoot)).enabled, true);
  } finally { value.restoreHome(); await rm(value.directory, { recursive: true, force: true }); }
});

test("uninstall removes only Nix-owned hooks and plugin files", async () => {
  const value = await fixture();
  try {
    await mkdir(path.dirname(codexHooksPath(value.projectRoot)), { recursive: true });
    await mkdir(openCodePluginPath(value.projectRoot), { recursive: true });
    await writeFile(codexHooksPath(value.projectRoot), JSON.stringify({ hooks: { PreToolUse: [
      { matcher: "Bash", hooks: [{ type: "command", command: "user-hook" }] },
      { matcher: "Bash|PowerShell|Cmd", hooks: [{ type: "command", command: managedCommand(value.projectRoot) }] }
    ] } }, null, 2));
    await writeFile(path.join(openCodePluginPath(value.projectRoot), "opencode-plugin.js"), "// opencode-plugin.js\n");
    await writeFile(path.join(openCodePluginPath(value.projectRoot), "user-note.txt"), "preserve\n");
    await value.installer.uninstall(value.projectRoot);
    assert.deepEqual(JSON.parse(await readFile(codexHooksPath(value.projectRoot), "utf8")), { hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "user-hook" }] }] } });
    assert.equal(await readFile(path.join(openCodePluginPath(value.projectRoot), "user-note.txt"), "utf8"), "preserve\n");
    assert.equal((await value.installer.status(value.projectRoot)).enabled, false);
  } finally { value.restoreHome(); await rm(value.directory, { recursive: true, force: true }); }
});

test("install refuses malformed or user-owned plugin targets without overwriting them", async () => {
  const value = await fixture();
  try {
    await mkdir(openCodePluginPath(value.projectRoot), { recursive: true });
    await writeFile(path.join(openCodePluginPath(value.projectRoot), "user.ts"), "user-owned\n");
    await assert.rejects(value.installer.install(value.projectRoot), /conflict|unowned/i);
    assert.equal(await readFile(path.join(openCodePluginPath(value.projectRoot), "user.ts"), "utf8"), "user-owned\n");
  } finally { value.restoreHome(); await rm(value.directory, { recursive: true, force: true }); }
});

test("preview permits recovery from a partial install when existing managed files match", async () => {
  const value = await fixture();
  try {
    const codexAssets = path.join(value.projectRoot, ".codex", "hooks", "nix-ai-security");
    await mkdir(codexAssets, { recursive: true });
    await writeFile(path.join(codexAssets, "security-policy.js"), "// security-policy.js\n");
    assert.equal((await value.installer.preview(value.projectRoot)).action, "install");
    assert.equal((await value.installer.install(value.projectRoot)).action, "installed");
    assert.equal((await value.installer.status(value.projectRoot)).enabled, true);
  } finally { value.restoreHome(); await rm(value.directory, { recursive: true, force: true }); }
});
