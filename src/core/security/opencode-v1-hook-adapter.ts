import { evaluateDestructiveCommand, evaluateWindowsDestructiveCommand, type SupportedShell } from "./security-policy.js";

export type OpenCodeShell = SupportedShell | "windows-auto";

export type OpenCodeV1OutcomeKind = "allow" | "block" | "unsupported" | "runtime-failure";

export class OpenCodeV1HookError extends Error {
  constructor(readonly kind: Exclude<OpenCodeV1OutcomeKind, "allow">, message: string) {
    super(message);
    this.name = "OpenCodeV1HookError";
  }
}

export interface OpenCodeV1Input { readonly tool?: unknown }
export interface OpenCodeV1Output { readonly args?: unknown }

/** Builds the V1 `tool.execute.before` hook with V1's input/output callback contract. */
export function createOpenCodeV1Hooks(shell: OpenCodeShell) {
  return {
    "tool.execute.before": async (input: OpenCodeV1Input, output: OpenCodeV1Output): Promise<void> => {
      let tool: unknown;
      let args: unknown;
      try {
        if (!input || typeof input !== "object") {
          throw new OpenCodeV1HookError("unsupported", "OpenCode V1 tool event is not a supported object.");
        }
        tool = input?.tool;
        args = output?.args;
      } catch (error) {
        if (error instanceof OpenCodeV1HookError) throw error;
        throw runtimeFailure(error);
      }
      if (typeof tool !== "string") {
        throw new OpenCodeV1HookError("unsupported", "OpenCode V1 tool event has no supported tool name.");
      }
      if (tool !== "bash") return;
      if (!args || typeof args !== "object" || !("command" in args)) {
        throw new OpenCodeV1HookError("unsupported", "OpenCode V1 shell event has no supported command payload.");
      }

      let command: unknown;
      try { command = (args as { command?: unknown }).command; }
      catch (error) { throw runtimeFailure(error); }
      if (typeof command !== "string") {
        throw new OpenCodeV1HookError("unsupported", "OpenCode V1 shell command must be a string.");
      }
      try {
        const decision = shell === "windows-auto" ? evaluateWindowsDestructiveCommand(command) : evaluateDestructiveCommand(shell, command);
        if (decision.action === "block") throw new OpenCodeV1HookError("block", decision.reason);
        if (decision.action === "unsupported") throw new OpenCodeV1HookError("unsupported", decision.reason);
      } catch (error) {
        if (error instanceof OpenCodeV1HookError) throw error;
        throw runtimeFailure(error);
      }
    },
  };
}

function runtimeFailure(error: unknown): OpenCodeV1HookError {
  return new OpenCodeV1HookError("runtime-failure", `OpenCode V1 security hook failed: ${error instanceof Error ? error.message : String(error)}`);
}
