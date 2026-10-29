import assert from "node:assert/strict";
import test from "node:test";

import { PetBridge, type PetClientLike } from "../../src/pet/bridge.js";
import type { PetMood } from "../../src/pet/state.js";

function fakeClient(options: {
  readonly sessions?: unknown;
  readonly created?: string;
  readonly events?: ReadonlyArray<string>;
} = {}): PetClientLike & { readonly prompts: string[]; readonly createdWith: unknown[] } {
  const prompts: string[] = [];
  const createdWith: unknown[] = [];
  let release: (() => void) | undefined;
  return {
    prompts,
    createdWith,
    event: {
      subscribe: () => (async function* () {
        for (const type of options.events ?? []) yield { type };
        await new Promise<void>((resolve) => { release = resolve; });
      })()
    },
    session: {
      list: async () => options.sessions ?? { data: [] },
      create: async (input?: unknown) => {
        createdWith.push(input);
        return { id: options.created ?? "created-1" };
      },
      prompt: async (input: { readonly sessionID: string; readonly text: string }) => {
        prompts.push(`${input.sessionID}:${input.text}`);
        return { ok: true };
      }
    }
  };
}

test("the bridge reuses the newest session and sends the typed text into it", async () => {
  const client = fakeClient({ sessions: { data: [{ id: "session-1" }, { id: "session-2" }] } });
  const moods: PetMood[] = [];
  const bridge = new PetBridge({ directory: "/tmp/project", client, onMood: (mood) => moods.push(mood) });

  await bridge.start();
  assert.equal(bridge.currentSessionID, "session-1");
  await bridge.send("  continue  ");
  await bridge.send("   ");

  assert.deepEqual(client.prompts, ["session-1:continue"], "blank input is ignored and text is trimmed");
  assert.equal(moods[0]?.state, "idle");
  assert.ok(moods.some((mood) => mood.state === "thinking"), "sending shows the thinking state immediately");
  bridge.stop();
});

test("the bridge creates a session when the project has none", async () => {
  const client = fakeClient({ created: "fresh-session" });
  const bridge = new PetBridge({ directory: "/tmp/project", client, onMood: () => undefined });

  await bridge.start();
  assert.equal(bridge.currentSessionID, "fresh-session");
  assert.deepEqual(client.createdWith, [{ title: "Nix pet", location: { directory: "/tmp/project" } }]);
  bridge.stop();
});

test("events become moods and transient states fall back to idle", async () => {
  const client = fakeClient({ sessions: { data: [{ id: "s1" }] }, events: ["session.execution.started", "session.execution.succeeded"] });
  const moods: PetMood[] = [];
  const timers: Array<() => void> = [];
  const bridge = new PetBridge({
    directory: "/tmp/project",
    client,
    onMood: (mood) => moods.push(mood),
    setTimer: (callback) => {
      timers.push(callback);
      return callback;
    },
    clearTimer: () => undefined
  });

  await bridge.start();
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(moods.map((mood) => mood.state), ["idle", "thinking", "success"]);
  assert.equal(timers.length, 1, "the success state schedules its own fall back");
  timers[0]!();
  assert.equal(moods.at(-1)?.state, "idle");
  bridge.stop();
});
