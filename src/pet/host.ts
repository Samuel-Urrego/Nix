import { createServer, type Server, type ServerResponse } from "node:http";

import { petPageHtml } from "./page.js";
import type { PetMood } from "./state.js";

export interface PetBridgeLike {
  send(text: string): Promise<void>;
}

export interface PetHost {
  readonly url: string;
  /** Pushes one mood to every open window. */
  push(mood: PetMood): void;
  close(): Promise<void>;
}

const MAX_BODY_BYTES = 8 * 1024;

/**
 * Serves the pet page, streams the agent's mood over server-sent events and
 * accepts what the user types. Keeping this in a local HTTP host means the window
 * needs no preload script and the same page can be opened in a browser to check it.
 */
export async function startPetHost(options: {
  readonly bridge: PetBridgeLike;
  readonly host?: string;
  readonly port?: number;
}): Promise<PetHost> {
  const clients = new Set<ServerResponse>();
  const server: Server = createServer((request, response) => {
    const url = request.url ?? "/";
    if (request.method === "GET" && url === "/") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      response.end(petPageHtml);
      return;
    }
    if (request.method === "GET" && url === "/mood") {
      response.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-store",
        connection: "keep-alive"
      });
      response.write(": connected\n\n");
      clients.add(response);
      request.on("close", () => clients.delete(response));
      return;
    }
    if (request.method === "POST" && url === "/send") {
      let body = "";
      request.on("data", (chunk: Buffer) => {
        if (body.length > MAX_BODY_BYTES) {
          response.writeHead(413).end();
          request.destroy();
          return;
        }
        body += chunk.toString("utf8");
      });
      request.on("end", () => {
        if (response.writableEnded) return;
        let text = "";
        try {
          const parsed = JSON.parse(body) as { text?: unknown };
          if (typeof parsed.text === "string") text = parsed.text;
        } catch {
          response.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ error: "invalid json" }));
          return;
        }
        if (text.trim().length === 0) {
          response.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ error: "empty text" }));
          return;
        }
        void options.bridge
          .send(text)
          .then(() => response.writeHead(202, { "content-type": "application/json" }).end(JSON.stringify({ accepted: true })))
          .catch((error: unknown) =>
            response
              .writeHead(502, { "content-type": "application/json" })
              .end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
          );
      });
      return;
    }
    response.writeHead(404, { "content-type": "application/json" }).end(JSON.stringify({ error: "not found" }));
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, options.host ?? "127.0.0.1", () => resolve());
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  return {
    url: `http://${options.host ?? "127.0.0.1"}:${port}/`,
    push: (mood) => {
      const payload = `data: ${JSON.stringify(mood)}\n\n`;
      for (const client of clients) client.write(payload);
    },
    close: () =>
      new Promise<void>((resolve) => {
        for (const client of clients) client.end();
        clients.clear();
        server.close(() => resolve());
      })
  };
}
