import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// Isolate every test process from the real user configuration. All global
// resolvers read process.env dynamically, so a per-process temp root is enough
// to keep tests from writing to ~/.config, ~/.codex, or %APPDATA%.
const root = mkdtempSync(path.join(os.tmpdir(), "nix-test-home-"));
const home = path.join(root, "home");

process.env.HOME = home;
process.env.USERPROFILE = home;
process.env.APPDATA = path.join(root, "appdata");
process.env.XDG_CONFIG_HOME = path.join(root, "xdg");
process.env.CODEX_HOME = path.join(root, "codex");
process.env.NIX_AI_HOME = path.join(root, "nix-home");

process.on("exit", () => {
  rmSync(root, { recursive: true, force: true });
});
