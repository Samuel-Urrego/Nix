import path from "node:path";

const HOME_KEYS = ["HOME", "USERPROFILE", "APPDATA", "XDG_CONFIG_HOME", "CODEX_HOME", "NIX_AI_HOME"] as const;

/**
 * Points every global resolver at a throwaway directory for the current test.
 * Returns a restore function so tests never leak state into the next one.
 */
export function useProjectHome(root: string): () => void {
  const previous = new Map<string, string | undefined>();
  const values: Record<(typeof HOME_KEYS)[number], string> = {
    HOME: root,
    USERPROFILE: root,
    APPDATA: path.join(root, "AppData"),
    XDG_CONFIG_HOME: path.join(root, ".config"),
    CODEX_HOME: path.join(root, ".codex"),
    NIX_AI_HOME: path.join(root, ".nix-ai")
  };

  for (const key of HOME_KEYS) {
    previous.set(key, process.env[key]);
    process.env[key] = values[key];
  }

  return () => {
    for (const key of HOME_KEYS) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}
