/**
 * The pet's visible state, derived from OpenCode V2 event types.
 *
 * The mapping is exhaustive over the documented event families so the pet never
 * guesses: anything unknown leaves the current state alone.
 */
export type PetState = "idle" | "thinking" | "working" | "waiting" | "success" | "error";

export interface PetMood {
  readonly state: PetState;
  /** Short label shown under the pet. */
  readonly label: string;
  /** How long the state stays before falling back to idle, when it is transient. */
  readonly holdMs: number;
}

const MOODS: ReadonlyArray<readonly [prefix: string, mood: PetMood]> = [
  ["permission.asked", { state: "waiting", label: "needs you", holdMs: 0 }],
  ["permission.replied", { state: "thinking", label: "thinking", holdMs: 0 }],
  ["session.execution.started", { state: "thinking", label: "thinking", holdMs: 0 }],
  ["session.reasoning.", { state: "thinking", label: "thinking", holdMs: 0 }],
  ["session.text.", { state: "working", label: "writing", holdMs: 0 }],
  ["session.tool.called", { state: "working", label: "using a tool", holdMs: 0 }],
  ["session.tool.progress", { state: "working", label: "working", holdMs: 0 }],
  ["session.tool.input.", { state: "working", label: "working", holdMs: 0 }],
  ["session.step.started", { state: "working", label: "working", holdMs: 0 }],
  ["session.step.streamed", { state: "working", label: "working", holdMs: 0 }],
  ["session.compaction.", { state: "thinking", label: "compacting", holdMs: 0 }],
  ["session.retry.scheduled", { state: "waiting", label: "retrying", holdMs: 0 }],
  ["session.execution.succeeded", { state: "success", label: "done", holdMs: 2500 }],
  ["session.execution.failed", { state: "error", label: "failed", holdMs: 5000 }],
  ["session.execution.interrupted", { state: "idle", label: "stopped", holdMs: 2500 }],
  ["session.step.failed", { state: "error", label: "failed", holdMs: 5000 }],
  ["session.tool.failed", { state: "error", label: "tool failed", holdMs: 5000 }],
  ["session.idle", { state: "idle", label: "idle", holdMs: 0 }]
];

export function moodForEvent(type: string): PetMood | undefined {
  for (const [prefix, mood] of MOODS) {
    if (type === prefix || type.startsWith(prefix)) return mood;
  }
  return undefined;
}

export const idleMood: PetMood = { state: "idle", label: "idle", holdMs: 0 };
