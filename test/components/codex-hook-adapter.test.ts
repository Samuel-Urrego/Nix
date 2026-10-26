import assert from "node:assert/strict";
import test from "node:test";
import { adaptCodexPreToolUse } from "../../src/core/security/codex-hook-adapter.js";

test("maps a destructive Bash pre-tool invocation to Codex native denial", () => {
  const result = adaptCodexPreToolUse({
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: { command: "rm -rf /" },
  });
  assert.equal(result.status, "block");
  assert.deepEqual(result.stdout, {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: result.decision.reason,
    },
  });
});

test("allows harmless Bash commands without asserting they were blocked", () => {
  const result = adaptCodexPreToolUse({
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: { command: "echo hello" },
  });
  assert.equal(result.status, "allow");
  assert.deepEqual(result.stdout, {});
});

test("inspects Codex Bash commands against all supported Windows shell dialects", () => {
  const result = adaptCodexPreToolUse({
    hook_event_name: "PreToolUse",
    tool_name: "Bash",
    tool_input: { command: "Remove-Item -Recurse C:\\" },
  });
  assert.equal(result.status, "block");
  assert.equal(result.decision?.rule, "broad-file-deletion");
});

test("reports unsupported events and payloads distinctly", () => {
  assert.equal(adaptCodexPreToolUse({ hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: "rm -rf /" } }).status, "unsupported");
  assert.equal(adaptCodexPreToolUse({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: {} }).status, "unsupported");
  assert.equal(adaptCodexPreToolUse({ hook_event_name: "PreToolUse", tool_name: "Other", tool_input: { command: "rm -rf /" } }).status, "unsupported");
});

test("reports policy runtime failures rather than claiming a block", () => {
  const result = adaptCodexPreToolUse({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "rm -rf /" } }, () => { throw new Error("policy unavailable"); });
  assert.equal(result.status, "runtime-failure");
  assert.match(result.error ?? "", /policy unavailable/);
  assert.deepEqual(result.stdout, {});
});
