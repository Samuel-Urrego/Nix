import { evaluateDestructiveCommand, evaluateWindowsDestructiveCommand } from "./security-policy.js";
import type { OpenCodeShell } from "./opencode-v1-hook-adapter.js";

export type OpenCodeV2OutcomeKind = "allow" | "block" | "unsupported" | "runtime-failure";

export class OpenCodeV2HookError extends Error {
  constructor(readonly kind: Exclude<OpenCodeV2OutcomeKind, "allow">, message: string) {
    super(message);
    this.name = "OpenCodeV2HookError";
  }
}

interface V2ToolHookContext {
  readonly tool: {
    hook(name: "execute.before", callback: (event: unknown) => void | Promise<void>): Promise<unknown> | unknown;
  };
}

/** Registers the V2 `ctx.tool.hook("execute.before", ...)` plugin adapter. */
export async function registerOpenCodeV2Hooks(shell: OpenCodeShell, ctx: V2ToolHookContext): Promise<void> {
  try {
    await ctx.tool.hook("execute.before", (event: unknown) => inspectV2Event(shell, event));
  } catch (error) {
    if (error instanceof OpenCodeV2HookError) throw error;
    throw runtimeFailure(error);
  }
}

function inspectV2Event(shell: OpenCodeShell, event: unknown): void {
  let tool: unknown;
  let input: unknown;
  try {
    if (!event || typeof event !== "object") throw new OpenCodeV2HookError("unsupported", "OpenCode V2 execute.before event is not an object.");
    tool = (event as { tool?: unknown }).tool;
    input = (event as { input?: unknown }).input;
  } catch (error) {
    if (error instanceof OpenCodeV2HookError) throw error;
    throw runtimeFailure(error);
  }
  if (typeof tool !== "string") {
    throw new OpenCodeV2HookError("unsupported", "OpenCode V2 execute.before event has no supported tool name.");
  }
  if (tool !== "bash") return;
  if (!input || typeof input !== "object" || !("command" in input)) {
    throw new OpenCodeV2HookError("unsupported", "OpenCode V2 shell event has no supported command payload.");
  }

  let command: unknown;
  try { command = (input as { command?: unknown }).command; }
  catch (error) { throw runtimeFailure(error); }
  if (typeof command !== "string") {
    throw new OpenCodeV2HookError("unsupported", "OpenCode V2 shell command must be a string.");
  }
  try {
    const decision = shell === "windows-auto" ? evaluateWindowsDestructiveCommand(command) : evaluateDestructiveCommand(shell, command);
    if (decision.action === "block") throw new OpenCodeV2HookError("block", decision.reason);
    if (decision.action === "unsupported") throw new OpenCodeV2HookError("unsupported", decision.reason);
  } catch (error) {
    if (error instanceof OpenCodeV2HookError) throw error;
    throw runtimeFailure(error);
  }
}

function runtimeFailure(error: unknown): OpenCodeV2HookError {
  return new OpenCodeV2HookError("runtime-failure", `OpenCode V2 security hook failed: ${error instanceof Error ? error.message : String(error)}`);
}
