/**
 * Electron is not a dependency of the installer: nobody should download a browser
 * runtime just to install skills. The pet resolves it at run time and fails with
 * the exact command when it is missing.
 */
export const ELECTRON_MISSING =
  "The pet window needs Electron. Install it with: npm install --save-dev electron";

type Importer = (name: string) => Promise<unknown>;

export async function resolveElectronPath(importer: Importer = (name) => import(name)): Promise<string> {
  try {
    const imported = (await importer("electron")) as { readonly default?: unknown } | undefined;
    const path = imported?.default;
    if (typeof path === "string" && path.length > 0) return path;
  } catch {
    // fall through: the caller gets the actionable message below
  }
  throw new Error(ELECTRON_MISSING);
}
