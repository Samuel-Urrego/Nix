import {
  evaluateDestructiveCommand,
  evaluateWindowsDestructiveCommand,
  type SecurityDecision,
  type SecurityShell,
  type SupportedShell,
} from "./security-policy.js";

export interface CodexPreToolUseInput {
  readonly hook_event_name?: unknown;
  readonly tool_name?: unknown;
  readonly tool_input?: unknown;
}

export type CodexHookStatus = "allow" | "block" | "unsupported" | "runtime-failure";

export interface CodexHookResult {
  readonly status: CodexHookStatus;
  readonly decision?: SecurityDecision;
  readonly error?: string;
  readonly stdout: Readonly<Record<string, unknown>>;
}

type Evaluator = (shell: SupportedShell, command: string) => SecurityDecision;

/** Translates Codex's PreToolUse payload and decision into the native hook contract. */
export function adaptCodexPreToolUse(input: CodexPreToolUseInput, evaluator: Evaluator = evaluateDestructiveCommand): CodexHookResult {
  if (input?.hook_event_name !== "PreToolUse") return unsupported("Only Codex PreToolUse events are supported.");
  const shell = shellForTool(input.tool_name);
  if (!shell) return unsupported("This Codex tool is not a supported shell invocation.");
  if (!isRecord(input.tool_input) || typeof input.tool_input.command !== "string") {
    return unsupported("Codex PreToolUse payload must include tool_input.command as a string.");
  }

  try {
    const decision = shell === "windows-auto"
      ? evaluator === evaluateDestructiveCommand
        ? evaluateWindowsDestructiveCommand(input.tool_input.command)
        : evaluateWithEveryWindowsShell(evaluator, input.tool_input.command)
      : evaluator(shell, input.tool_input.command);
    if (decision.action === "unsupported") return { status: "unsupported", decision, stdout: {} };
    if (decision.action === "block") return {
      status: "block",
      decision,
      stdout: { hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: decision.reason,
      } },
    };
    return { status: "allow", decision, stdout: {} };
  } catch (error) {
    return { status: "runtime-failure", error: error instanceof Error ? error.message : String(error), stdout: {} };
  }
}

function evaluateWithEveryWindowsShell(evaluator: Evaluator, command: string): SecurityDecision {
  const decisions = (["powershell", "cmd", "git-bash"] as const).map((shell) => evaluator(shell, command));
  return decisions.find((decision) => decision.action === "block")
    ?? decisions.find((decision) => decision.action === "unsupported")
    ?? { action: "allow", reason: "No supported destructive operation was detected." };
}

function shellForTool(tool: unknown): SecurityShell | undefined {
  if (tool === "Bash") return "windows-auto";
  if (tool === "PowerShell") return "powershell";
  if (tool === "Cmd") return "cmd";
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unsupported(reason: string): CodexHookResult {
  return { status: "unsupported", error: reason, stdout: {} };
}
