import assert from "node:assert/strict";
import test from "node:test";

import { ELECTRON_MISSING, resolveElectronPath } from "../../src/pet/electron-path.js";

test("the pet finds the electron binary when it is installed", async () => {
  const path = await resolveElectronPath(async () => ({ default: "C:/node_modules/electron/dist/electron.exe" }));
  assert.equal(path, "C:/node_modules/electron/dist/electron.exe");
});

test("a missing electron fails with the exact install command", async () => {
  await assert.rejects(resolveElectronPath(async () => { throw new Error("MODULE_NOT_FOUND"); }), new RegExp(ELECTRON_MISSING.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  await assert.rejects(resolveElectronPath(async () => ({})), /npm install --save-dev electron/);
  await assert.rejects(resolveElectronPath(async () => ({ default: "" })), /npm install --save-dev electron/);
});

test("the missing-electron message is actionable on its own", () => {
  assert.match(ELECTRON_MISSING, /^The pet window needs Electron\./);
  assert.match(ELECTRON_MISSING, /npm install --save-dev electron$/);
});
