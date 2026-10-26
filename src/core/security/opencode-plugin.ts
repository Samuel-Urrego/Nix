import { createOpenCodeV1Hooks } from "./opencode-v1-hook-adapter.js";
import { registerOpenCodeV2Hooks } from "./opencode-v2-hook-adapter.js";

/** Shared auto-discovered entrypoint; V1 and V2 each call their native lifecycle method. */
export default {
  id: "nix-ai-security",
  async setup(context: Parameters<typeof registerOpenCodeV2Hooks>[1]): Promise<void> {
    await registerOpenCodeV2Hooks("windows-auto", context);
  },
  async server() {
    return createOpenCodeV1Hooks("windows-auto");
  }
};
