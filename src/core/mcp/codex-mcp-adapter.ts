import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getCodexConfigPath } from "../config/global-paths.js";
import type { McpAgentAdapter } from "./mcp-agent-adapter.js";
import type { McpLocalServer } from "./mcp-contracts.js";

interface Section {
  readonly start: number;
  readonly end: number;
  readonly body: string;
}

export function codexConfigPath(_root: string): string {
  return getCodexConfigPath();
}

export function createCodexMcpAdapter(): McpAgentAdapter {
  return {
    agent: "codex",
    configPath: codexConfigPath,
    async readServer(root, id) {
      const text = await readConfig(root);
      const section = findSection(text, id);
      return section ? parseSection(section.body, id) : undefined;
    },
    async listServers(root) {
      const text = await readConfig(root);
      return [...new Set(sectionIds(text))].sort();
    },
    async writeServer(root, id, server) {
      const text = await readConfig(root);
      const section = findSection(text, id);
      const block = `${serializeServer(id, server)}\n`;
      const next = section
        ? `${text.slice(0, section.start)}${block}${text.slice(section.end)}`
        : `${text}${text && !text.endsWith("\n") ? "\n" : ""}${text ? "\n" : ""}${block}`;
      await writeConfig(root, next);
    },
    async removeServer(root, id) {
      const text = await readConfig(root);
      const section = findSection(text, id);
      if (!section) return;
      const next = `${text.slice(0, section.start)}${text.slice(section.end)}`.replace(/\n{3,}/g, "\n\n").trimEnd();
      await writeConfig(root, next ? `${next}\n` : "");
    }
  };
}

async function readConfig(root: string): Promise<string> {
  try {
    return await readFile(codexConfigPath(root), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

async function writeConfig(root: string, content: string): Promise<void> {
  const file = codexConfigPath(root);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, "utf8");
}

function findSection(text: string, id: string): Section | undefined {
  const matches = [...text.matchAll(/^\[mcp_servers\.([^\]]+)\]\s*$/gm)];
  const found = matches.filter((match) => match[1] === id);
  if (found.length > 1) throw new Error(`Codex configuration has a duplicate [mcp_servers.${id}] section`);
  const match = found[0];
  if (!match || match.index === undefined) return undefined;
  const start = match.index;
  const afterHeader = start + match[0].length;
  const remainder = text.slice(afterHeader);
  const nextHeader = /^\[/m.exec(remainder);
  const end = nextHeader?.index === undefined ? text.length : afterHeader + nextHeader.index;
  return { start, end, body: text.slice(start, end) };
}

function sectionIds(text: string): string[] {
  return [...text.matchAll(/^\[mcp_servers\.([^\]]+)\]\s*$/gm)].map((match) => match[1] ?? "");
}

function parseSection(body: string, id: string): McpLocalServer {
  const command = parseString(body, "command");
  if (!command) throw new Error(`Invalid Codex MCP section for ${id}: command is missing`);
  const args = parseArgs(body);
  const cwd = parseString(body, "cwd");
  const environment = parseEnvironment(body);
  const timeout = parseInteger(body, "startup_timeout_sec");
  return {
    type: "local",
    command: [command, ...args],
    ...(cwd ? { cwd } : {}),
    ...(environment ? { environment } : {}),
    ...(timeout !== undefined ? { timeout } : {})
  };
}

function parseString(body: string, key: string): string | undefined {
  const match = new RegExp(`^${key}\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"`, "m").exec(body);
  return match?.[1] === undefined ? undefined : unescape(match[1]);
}

function parseInteger(body: string, key: string): number | undefined {
  const match = new RegExp(`^${key}\\s*=\\s*(\\d+)`, "m").exec(body);
  return match?.[1] === undefined ? undefined : Number.parseInt(match[1], 10);
}

function parseArgs(body: string): string[] {
  const match = /^args\s*=\s*\[([\s\S]*?)\]/m.exec(body);
  if (!match?.[1]) return [];
  return [...match[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((item) => unescape(item[1] ?? ""));
}

function parseEnvironment(body: string): Record<string, string> | undefined {
  const match = /^env\s*=\s*\{([\s\S]*?)\}/m.exec(body);
  if (!match?.[1]) return undefined;
  const entries: Record<string, string> = {};
  for (const pair of match[1].matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"((?:[^"\\]|\\.)*)"/g)) {
    entries[pair[1] ?? ""] = unescape(pair[2] ?? "");
  }
  return Object.keys(entries).length > 0 ? entries : undefined;
}

function serializeServer(id: string, server: McpLocalServer): string {
  const [executable, ...args] = server.command;
  if (!executable) throw new Error("An MCP server command requires an executable.");
  const lines = [`[mcp_servers.${id}]`, `command = ${quote(executable)}`];
  if (args.length > 0) {
    lines.push("args = [", ...args.map((arg) => `  ${quote(arg)},`), "]");
  }
  if (server.cwd) lines.push(`cwd = ${quote(server.cwd)}`);
  if (server.environment) {
    const pairs = Object.entries(server.environment).map(([key, value]) => `${key} = ${quote(value)}`);
    lines.push(`env = { ${pairs.join(", ")} }`);
  }
  if (server.timeout !== undefined) lines.push(`startup_timeout_sec = ${server.timeout}`);
  return lines.join("\n");
}

function quote(value: string): string {
  return JSON.stringify(value);
}

function unescape(value: string): string {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value;
  }
}
