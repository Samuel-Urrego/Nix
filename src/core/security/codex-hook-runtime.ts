import { adaptCodexPreToolUse } from "./codex-hook-adapter.js";

async function main(): Promise<void> {
  let payload = "";
  for await (const chunk of process.stdin) payload += chunk.toString();
  try {
    const result = adaptCodexPreToolUse(JSON.parse(payload) as unknown as Parameters<typeof adaptCodexPreToolUse>[0]);
    if (result.status === "block") process.stdout.write(`${JSON.stringify(result.stdout)}\n`);
    else if (result.status === "unsupported") process.stderr.write(`${result.error ?? result.decision?.reason ?? "Unsupported Codex hook payload."}\n`);
    else if (result.status === "runtime-failure") throw new Error(result.error ?? "Codex security hook runtime failed.");
  } catch (error) {
    process.stderr.write(`Nix security hook failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}

await main();
