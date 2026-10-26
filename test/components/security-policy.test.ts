import assert from "node:assert/strict";
import test from "node:test";
import { evaluateDestructiveCommand, evaluateWindowsDestructiveCommand } from "../../src/core/security/security-policy.js";

test("blocks broad recursive deletion commands across supported Windows shells", () => {
  for (const [shell, command] of [
    ["powershell", "Remove-Item -Recurse -Force C:\\"],
    ["cmd", "rmdir /s /q C:\\"],
    ["git-bash", "rm -rf /"],
  ] as const) {
    assert.equal(evaluateDestructiveCommand(shell, command).action, "block", `${shell}: ${command}`);
  }
});

test("does not block destructive-looking text inside an echo argument", () => {
  assert.equal(evaluateDestructiveCommand("git-bash", "echo 'rm -rf /'").action, "allow");
});

test("does not treat cmd.exe quiet mode as recursive deletion", () => {
  assert.equal(evaluateDestructiveCommand("cmd", "rmdir /q C:\\").action, "allow");
});

test("blocks unscoped destructive SQL while allowing scoped updates", () => {
  assert.equal(evaluateDestructiveCommand("git-bash", "psql -c \"DELETE FROM users\"").action, "block");
  assert.equal(evaluateDestructiveCommand("git-bash", "psql -c \"UPDATE users SET active = false WHERE id = 1\"").action, "allow");
});

test("marks encoded shell payloads as unsupported instead of claiming protection", () => {
  assert.equal(evaluateDestructiveCommand("powershell", "powershell -EncodedCommand SQBFAFgA").action, "unsupported");
});

test("Windows auto mode blocks high-confidence deletion in each supported shell dialect", () => {
  assert.equal(evaluateWindowsDestructiveCommand("Remove-Item -Recurse C:\\").action, "block");
  assert.equal(evaluateWindowsDestructiveCommand("rmdir /s /q C:\\").action, "block");
  assert.equal(evaluateWindowsDestructiveCommand("rm -rf /").action, "block");
  assert.equal(evaluateWindowsDestructiveCommand("echo hello").action, "allow");
});
