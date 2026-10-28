import { spawn } from "node:child_process";

export interface UpgradePlan {
  /** Exact command line printed to the user before it runs. */
  readonly commandLine: string;
  /** `name@latest`, the spec npm resolves against the registry. */
  readonly packageSpec: string;
}

/**
 * Builds the plan for moving a global install to the newest published version.
 *
 * Only the registry is consulted: an upgrade never resolves a Git branch, a
 * local checkout, or a tag that has not been published.
 */
export function createUpgradePlan(packageName: string): UpgradePlan {
  const packageSpec = `${packageName}@latest`;
  return {
    commandLine: `npm install --global ${packageSpec}`,
    packageSpec
  };
}

export type UpgradeRunner = (plan: UpgradePlan) => Promise<number>;

/**
 * Runs the plan through npm and resolves with its exit code.
 *
 * The command line is assembled from constant parts, so `shell: true` is used
 * only to reach the platform's `npm` shim and carries no user input.
 */
export const spawnUpgrade: UpgradeRunner = (plan) =>
  new Promise<number>((resolve, reject) => {
    const child = spawn(plan.commandLine, { stdio: "inherit", shell: true });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
