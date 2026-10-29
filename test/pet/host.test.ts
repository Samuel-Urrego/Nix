import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { startPetHost } from "../../src/pet/host.js";
import { idleMood, type PetMood } from "../../src/pet/state.js";

test("the pet host serves the page, accepts a reply and streams the mood", async () => {
  const received: string[] = [];
  const host = await startPetHost({ bridge: { send: async (text) => { received.push(text); } } });
  try {
    const page = await fetch(host.url);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /<title>Nix pet<\/title>/);
    assert.match(html, /Reply to the agent/);

    const stream = await fetch(new URL("/mood", host.url).toString(), { signal: AbortSignal.timeout(4000) });
    assert.equal(stream.status, 200);
    assert.match(stream.headers.get("content-type") ?? "", /text\/event-stream/);
    const reader = stream.body!.getReader();
    const first = await reader.read();
    assert.match(new TextDecoder().decode(first.value), /: connected/);

    const mood: PetMood = { state: "waiting", label: "needs you", holdMs: 0 };
    host.push(mood);
    const second = await reader.read();
    const payload = new TextDecoder().decode(second.value);
    assert.match(payload, /data: /);
    assert.deepEqual(JSON.parse(payload.replace(/^data: /, "").trim()), mood);
    await reader.cancel();

    const sent = await fetch(new URL("/send", host.url).toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "  go ahead  " })
    });
    assert.equal(sent.status, 202);
    assert.deepEqual(received, ["  go ahead  "], "the bridge receives the text as typed; it trims it itself");
  } finally {
    await host.close();
  }
});

test("the pet host serves the art it finds and says when a state has none", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "nix-pet-host-"));
  try {
    const folder = path.join(root, "pet-assets");
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "idle.webm"), Buffer.from("fake-webm-bytes"));

    const host = await startPetHost({ bridge: { send: async () => undefined }, directory: root });
    try {
      const list = await fetch(new URL("/assets", host.url).toString());
      assert.equal(list.status, 200);
      assert.deepEqual(await list.json(), [{ state: "idle", url: "/pet/idle", type: "video/webm" }]);

      const art = await fetch(new URL("/pet/idle", host.url).toString());
      assert.equal(art.status, 200);
      assert.equal(art.headers.get("content-type"), "video/webm");
      assert.equal(await art.text(), "fake-webm-bytes");

      const missing = await fetch(new URL("/pet/thinking", host.url).toString());
      assert.equal(missing.status, 404);

      const invalid = await fetch(new URL("/pet/..%2Fsecret", host.url).toString());
      assert.equal(invalid.status, 404, "only known states are served");
    } finally {
      await host.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the page drags the frameless window and can close it", async () => {
  const host = await startPetHost({ bridge: { send: async () => undefined } });
  try {
    const html = await (await fetch(host.url)).text();
    assert.match(html, /-webkit-app-region: drag/);
    assert.match(html, /-webkit-app-region: no-drag/);
    assert.match(html, /class="close"/);
    assert.match(html, /window\.close\(\)/);
    assert.match(html, /id="art"/, "the window can play animated art when the project provides it");
  } finally {
    await host.close();
  }
});

test("the pet host rejects an empty reply and unknown routes", async () => {
  const host = await startPetHost({ bridge: { send: async () => undefined } });
  try {
    const empty = await fetch(new URL("/send", host.url).toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "   " })
    });
    assert.equal(empty.status, 400);

    const invalid = await fetch(new URL("/send", host.url).toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ not json"
    });
    assert.equal(invalid.status, 400);

    const missing = await fetch(new URL("/nope", host.url).toString());
    assert.equal(missing.status, 404);

    // The idle mood is a valid payload the window can render before any event.
    assert.equal(idleMood.state, "idle");
  } finally {
    await host.close();
  }
});
