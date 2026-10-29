import assert from "node:assert/strict";
import test from "node:test";

import { idleMood, moodForEvent } from "../../src/pet/state.js";

test("the documented V2 events map to the pet's visible states", () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ["permission.asked", "waiting"],
    ["permission.replied", "thinking"],
    ["session.execution.started", "thinking"],
    ["session.reasoning.delta", "thinking"],
    ["session.text.delta", "working"],
    ["session.tool.called", "working"],
    ["session.tool.progress", "working"],
    ["session.step.started", "working"],
    ["session.compaction.started", "thinking"],
    ["session.retry.scheduled", "waiting"],
    ["session.execution.succeeded", "success"],
    ["session.execution.failed", "error"],
    ["session.step.failed", "error"],
    ["session.tool.failed", "error"],
    ["session.execution.interrupted", "idle"],
    ["session.idle", "idle"]
  ];

  for (const [event, state] of cases) {
    assert.equal(moodForEvent(event)?.state, state, `${event} must map to ${state}`);
  }
});

test("events the pet does not understand leave the mood alone", () => {
  assert.equal(moodForEvent("config.updated"), undefined);
  assert.equal(moodForEvent("tui.toast.show"), undefined);
  assert.equal(moodForEvent("session.created"), undefined);
  assert.equal(moodForEvent(""), undefined);
});

test("done and error states are transient, work states are not", () => {
  assert.ok((moodForEvent("session.execution.succeeded")?.holdMs ?? 0) > 0);
  assert.ok((moodForEvent("session.execution.failed")?.holdMs ?? 0) > 0);
  assert.equal(moodForEvent("session.text.delta")?.holdMs, 0);
  assert.equal(moodForEvent("session.idle")?.holdMs, 0);
  assert.deepEqual(idleMood, { state: "idle", label: "idle", holdMs: 0 });
});
