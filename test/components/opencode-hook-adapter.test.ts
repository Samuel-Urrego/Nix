import assert from "node:assert/strict";
import test from "node:test";
import { createOpenCodeV1Hooks, OpenCodeV1HookError } from "../../src/core/security/opencode-v1-hook-adapter.js";
import { registerOpenCodeV2Hooks, OpenCodeV2HookError } from "../../src/core/security/opencode-v2-hook-adapter.js";

test("OpenCode V1 blocks dangerous shell commands with its native hook error", async () => {
  const hooks = createOpenCodeV1Hooks("powershell");
  await assert.rejects(
    hooks["tool.execute.before"]({ tool: "bash" }, { args: { command: "Remove-Item -Recurse C:\\" } }),
    (error: unknown) => error instanceof OpenCodeV1HookError && error.kind === "block" && /recursive deletion/i.test(error.message),
  );
});

test("OpenCode V1 auto mode covers PowerShell syntax under the Windows bash tool", async () => {
  const hook = createOpenCodeV1Hooks("windows-auto")["tool.execute.before"];
  await assert.rejects(hook({ tool: "bash" }, { args: { command: "Remove-Item -Recurse C:\\" } }), (error: unknown) => {
    assert.ok(error instanceof OpenCodeV1HookError);
    assert.equal(error.kind, "block");
    return true;
  });
});

test("OpenCode V1 passes benign commands and reports unsupported events separately", async () => {
  const hooks = createOpenCodeV1Hooks("git-bash");
  await hooks["tool.execute.before"]({ tool: "bash" }, { args: { command: "echo safe" } });
  await assert.rejects(
    hooks["tool.execute.before"]({ tool: "bash" }, { args: {} }),
    (error: unknown) => error instanceof OpenCodeV1HookError && error.kind === "unsupported",
  );
});

test("OpenCode V2 registers execute.before and blocks with its native hook error", async () => {
  let callback: ((event: unknown) => void | Promise<void>) | undefined;
  await registerOpenCodeV2Hooks("cmd", {
    tool: { hook: async (name, handler) => { assert.equal(name, "execute.before"); callback = handler; } },
  });
  assert.ok(callback);
  await assert.rejects(
    Promise.resolve().then(() => callback!({ tool: "bash", input: { command: "rmdir /s /q C:\\" } })),
    (error: unknown) => error instanceof OpenCodeV2HookError && error.kind === "block" && /recursive deletion/i.test(error.message),
  );
});

test("OpenCode V2 auto mode covers cmd.exe syntax when the configured shell is opaque", async () => {
  let callback: ((event: unknown) => void | Promise<void>) | undefined;
  await registerOpenCodeV2Hooks("windows-auto", { tool: { hook: (_name, handler) => { callback = handler; } } });
  assert.ok(callback);
  await assert.rejects(Promise.resolve().then(() => callback?.({ tool: "bash", input: { command: "rmdir /s /q C:\\" } })), (error: unknown) => {
    assert.ok(error instanceof OpenCodeV2HookError);
    assert.equal(error.kind, "block");
    return true;
  });
});

test("OpenCode V2 reports malformed shell events as unsupported, not blocks", async () => {
  let callback: ((event: unknown) => void | Promise<void>) | undefined;
  await registerOpenCodeV2Hooks("git-bash", {
    tool: { hook: async (_name, handler) => { callback = handler; } },
  });
  assert.ok(callback);
  await assert.rejects(Promise.resolve().then(() => callback!({ tool: "bash", input: null })), (error: unknown) =>
    error instanceof OpenCodeV2HookError && error.kind === "unsupported");
});

test("OpenCode V1 surfaces hook runtime failures distinctly from policy blocks", async () => {
  const hooks = createOpenCodeV1Hooks("git-bash");
  const args = Object.defineProperty({}, "command", { get() { throw new Error("event accessor failed"); } });
  await assert.rejects(
    hooks["tool.execute.before"]({ tool: "bash" }, { args }),
    (error: unknown) => error instanceof OpenCodeV1HookError && error.kind === "runtime-failure",
  );
});
