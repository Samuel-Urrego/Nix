import { OpenCode } from "@opencode/client";
import { Service } from "@opencode/client/service";

import { idleMood, moodForEvent, type PetMood } from "./state.js";

/** The slice of the OpenCode client the pet depends on. */
export interface PetClientLike {
  readonly event: { subscribe(input?: unknown, options?: unknown): AsyncIterable<{ readonly type: string }> };
  readonly session: {
    list(input?: unknown): Promise<unknown>;
    create(input?: unknown): Promise<{ readonly id: string }>;
    prompt(input: { readonly sessionID: string; readonly text: string }): Promise<unknown>;
  };
}

export interface PetBridgeOptions {
  readonly directory: string;
  readonly client?: PetClientLike;
  readonly onMood?: (mood: PetMood) => void;
  readonly setTimer?: (callback: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
}

interface SessionShape {
  readonly id?: unknown;
}

function sessionIdFrom(response: unknown): string | undefined {
  const candidates = Array.isArray(response)
    ? response
    : (response as { data?: unknown } | null)?.data;
  if (!Array.isArray(candidates)) return undefined;
  for (const candidate of candidates as SessionShape[]) {
    if (typeof candidate?.id === "string" && candidate.id.length > 0) return candidate.id;
  }
  return undefined;
}

/**
 * Bridges one OpenCode session to the pet window: it turns the event stream into
 * a mood and sends what the user types back into the session.
 *
 * A session that does not exist yet is created in the given directory, so the pet
 * works on a fresh project without asking the user to open the TUI first.
 */
export class PetBridge {
  private readonly directory: string;
  private readonly onMood: (mood: PetMood) => void;
  private readonly setTimer: (callback: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;
  private client: PetClientLike | undefined;
  private sessionID: string | undefined;
  private stopped = false;
  private holdHandle: unknown;

  constructor(options: PetBridgeOptions) {
    this.directory = options.directory;
    this.client = options.client;
    this.onMood = options.onMood ?? (() => undefined);
    this.setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
    this.clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as NodeJS.Timeout));
  }

  /** Connects to the local OpenCode service when no client was injected. */
  static async connect(options: PetBridgeOptions): Promise<PetBridge> {
    const bridge = new PetBridge(options);
    if (!options.client) {
      const endpoint = await Service.ensure();
      const client = OpenCode.make({ baseUrl: endpoint.url, headers: Service.headers(endpoint) });
      // The generated client is wider than the slice the pet uses; the cast keeps
      // the bridge testable with a fake and the real client verified by typecheck.
      bridge.client = client as unknown as PetClientLike;
    }
    return bridge;
  }

  get currentSessionID(): string | undefined {
    return this.sessionID;
  }

  async start(): Promise<void> {
    const client = this.requireClient();
    this.sessionID = await this.resolveSession();
    this.publish(idleMood);
    const subscription = client.event.subscribe();
    void (async () => {
      try {
        for await (const event of subscription) {
          if (this.stopped) return;
          const mood = moodForEvent(event.type);
          if (mood) this.publish(mood);
        }
      } catch {
        if (!this.stopped) this.publish({ state: "error", label: "disconnected", holdMs: 0 });
      }
    })();
  }

  stop(): void {
    this.stopped = true;
    if (this.holdHandle !== undefined) {
      this.clearTimer(this.holdHandle);
      this.holdHandle = undefined;
    }
  }

  async send(text: string): Promise<void> {
    const message = text.trim();
    if (message.length === 0) return;
    const client = this.requireClient();
    const sessionID = this.sessionID ?? (this.sessionID = await this.resolveSession());
    this.publish({ state: "thinking", label: "thinking", holdMs: 0 });
    await client.session.prompt({ sessionID, text: message });
  }

  private requireClient(): PetClientLike {
    if (!this.client) throw new Error("The pet is not connected to OpenCode.");
    return this.client;
  }

  private async resolveSession(): Promise<string> {
    const client = this.requireClient();
    const existing = sessionIdFrom(await client.session.list({ location: { directory: this.directory } }));
    if (existing) return existing;
    const created = await client.session.create({ title: "Nix pet", location: { directory: this.directory } });
    if (!created?.id) throw new Error("OpenCode did not return a session id.");
    return created.id;
  }

  private publish(mood: PetMood): void {
    if (this.holdHandle !== undefined) {
      this.clearTimer(this.holdHandle);
      this.holdHandle = undefined;
    }
    this.onMood(mood);
    if (mood.holdMs > 0) {
      this.holdHandle = this.setTimer(() => {
        this.holdHandle = undefined;
        if (!this.stopped) this.onMood(idleMood);
      }, mood.holdMs);
    }
  }
}
