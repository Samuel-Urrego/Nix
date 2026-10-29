import { createRequire } from "node:module";

import { PetBridge } from "./bridge.js";
import { startPetHost } from "./host.js";
import type { PetMood } from "./state.js";

/**
 * Electron entry point for the pet window. The window is transparent, frameless
 * and always on top; the page it loads is served by the local pet host.
 */
interface ElectronLike {
  readonly app: {
    whenReady(): Promise<void>;
    on(event: string, listener: () => void): void;
    quit(): void;
  };
  readonly BrowserWindow: new (options: Record<string, unknown>) => {
    loadURL(url: string): Promise<void> | void;
    on(event: string, listener: () => void): void;
  };
}

const require = createRequire(import.meta.url);
const electron = require("electron") as ElectronLike;

async function main(): Promise<void> {
  const directory = process.cwd();
  let host: Awaited<ReturnType<typeof startPetHost>> | undefined;

  const bridge = await PetBridge.connect({
    directory,
    onMood: (mood: PetMood) => host?.push(mood)
  });
  host = await startPetHost({ bridge });
  await bridge.start();

  await electron.app.whenReady();
  const window = new electron.BrowserWindow({
    width: 320,
    height: 430,
    transparent: true,
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  await window.loadURL(host.url);

  electron.app.on("before-quit", () => {
    bridge.stop();
    void host?.close();
  });
  electron.app.on("window-all-closed", () => electron.app.quit());
}

main().catch((error: unknown) => {
  console.error(`Nix pet failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
  electron.app.quit();
});
