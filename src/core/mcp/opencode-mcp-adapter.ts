import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getOpenCodeConfigPath } from "../config/global-paths.js";
import type { McpAgentAdapter } from "./mcp-agent-adapter.js";
import type { McpLocalServer } from "./mcp-contracts.js";

interface JsoncProperty {
  readonly key: string;
  readonly keyStart: number;
  readonly keyEnd: number;
  readonly valueStart: number;
  readonly valueEnd: number;
  readonly value: JsoncNode;
  readonly commaAfter?: number;
}

type JsoncNode =
  | { readonly type: "object"; readonly start: number; readonly end: number; readonly properties: ReadonlyArray<JsoncProperty>; readonly hasTrailingComma: boolean }
  | { readonly type: "array"; readonly start: number; readonly end: number; readonly items: ReadonlyArray<JsoncNode> }
  | { readonly type: "string"; readonly start: number; readonly end: number; readonly value: string }
  | { readonly type: "number"; readonly start: number; readonly end: number; readonly value: number }
  | { readonly type: "boolean"; readonly start: number; readonly end: number; readonly value: boolean }
  | { readonly type: "null"; readonly start: number; readonly end: number };

export function openCodeConfigPath(_root: string): string {
  return getOpenCodeConfigPath();
}

export function createOpenCodeMcpAdapter(): McpAgentAdapter {
  return {
    agent: "opencode",
    configPath: openCodeConfigPath,
    async readServer(root, id) {
      const text = await readConfig(root);
      if (text === null) return undefined;
      const rootNode = parseDocument(text);
      const mcp = findObjectProperty(rootNode, "mcp");
      if (!mcp) return undefined;
      const servers = findObjectProperty(mcp, "servers");
      const fromServers = servers ? findProperty(servers, id) : undefined;
      if (fromServers) return nodeValue(fromServers.value);
      const direct = findProperty(mcp, id);
      return direct ? nodeValue(direct.value) : undefined;
    },
    async listServers(root) {
      const text = await readConfig(root);
      if (text === null) return [];
      const rootNode = parseDocument(text);
      const mcp = findObjectProperty(rootNode, "mcp");
      if (!mcp) return [];
      const servers = findObjectProperty(mcp, "servers");
      const ids = new Set<string>();
      if (servers) for (const property of servers.properties) ids.add(property.key);
      for (const property of mcp.properties) {
        if (property.key !== "servers" && property.key !== "timeout") ids.add(property.key);
      }
      return [...ids].sort();
    },
    async writeServer(root, id, server) {
      const file = openCodeConfigPath(root);
      const existing = await readConfig(root);
      let text = existing ?? "{\n  \"$schema\": \"https://opencode.ai/config.json\"\n}\n";
      text = writeServerIntoDocument(text, id, server);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, text, "utf8");
    },
    async removeServer(root, id) {
      const file = openCodeConfigPath(root);
      const existing = await readConfig(root);
      if (existing === null) return;
      let text = existing;
      text = removeServerFromDocument(text, id);
      await writeFile(file, text, "utf8");
    }
  };
}

async function readConfig(root: string): Promise<string | null> {
  const file = openCodeConfigPath(root);
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function writeServerIntoDocument(text: string, id: string, server: McpLocalServer): string {
  let root = parseDocument(text);
  const mcpProperty = findObjectProperty(root, "mcp");
  const value = JSON.stringify(server, null, 2);

  if (!mcpProperty) {
    const mcpValue = JSON.stringify({ servers: { [id]: server } }, null, 2);
    return insertProperty(text, root, "mcp", mcpValue);
  }

  const servers = findObjectProperty(mcpProperty, "servers");
  if (servers) {
    return setOrInsertProperty(text, servers, id, value);
  }

  return setOrInsertProperty(text, mcpProperty, id, value);
}

function removeServerFromDocument(text: string, id: string): string {
  let next = text;
  let root = parseDocument(next);
  let mcp = findObjectProperty(root, "mcp");
  if (!mcp) return next;

  const servers = findObjectProperty(mcp, "servers");
  if (servers && findProperty(servers, id)) {
    next = removeProperty(next, servers, id);
    root = parseDocument(next);
    mcp = findObjectProperty(root, "mcp");
    if (!mcp) return next;
  }

  if (findProperty(mcp, id)) next = removeProperty(next, mcp, id);
  return next;
}

type JsoncObject = Extract<JsoncNode, { type: "object" }>;
type JsoncString = Extract<JsoncNode, { type: "string" }>;
type JsoncNumber = Extract<JsoncNode, { type: "number" }>;
type JsoncBoolean = Extract<JsoncNode, { type: "boolean" }>;
type JsoncNull = Extract<JsoncNode, { type: "null" }>;

function parseDocument(text: string): JsoncObject {
  const parser = new JsoncParser(text);
  const node = parser.parse();
  if (node.type !== "object") throw new Error("OpenCode configuration must be a JSON object.");
  return node;
}

class JsoncParser {
  private index = 0;

  constructor(private readonly text: string) {}

  parse(): JsoncNode {
    this.skipTrivia();
    const value = this.parseValue();
    this.skipTrivia();
    if (this.index !== this.text.length) this.fail("Unexpected content after the root value");
    return value;
  }

  private parseValue(): JsoncNode {
    this.skipTrivia();
    const char = this.text[this.index];
    if (char === "{") return this.parseObject();
    if (char === "[") return this.parseArray();
    if (char === "\"") return this.parseString();
    if (char === "t" || char === "f") return this.parseBoolean();
    if (char === "n") return this.parseNull();
    if (char === undefined) this.fail("Unexpected end of input");
    return this.parseNumber();
  }

  private parseObject(): JsoncNode {
    const start = this.index;
    this.index += 1;
    const properties: JsoncProperty[] = [];
    this.skipTrivia();
    if (this.text[this.index] === "}") {
      this.index += 1;
      return { type: "object", start, end: this.index, properties, hasTrailingComma: false };
    }
    let hasTrailingComma = false;
    while (true) {
      this.skipTrivia();
      if (this.text[this.index] !== "\"") this.fail("Expected an object key");
      const key = this.parseString();
      this.skipTrivia();
      if (this.text[this.index] !== ":") this.fail("Expected ':' after an object key");
      this.index += 1;
      const value = this.parseValue();
      this.skipTrivia();
      let commaAfter: number | undefined;
      if (this.text[this.index] === ",") {
        commaAfter = this.index;
        this.index += 1;
        this.skipTrivia();
        if (this.text[this.index] === "}") {
          hasTrailingComma = true;
          this.index += 1;
          properties.push({ key: key.value, keyStart: key.start, keyEnd: key.end, valueStart: value.start, valueEnd: value.end, value, ...(commaAfter === undefined ? {} : { commaAfter }) });
          return { type: "object", start, end: this.index, properties, hasTrailingComma };
        }
      } else if (this.text[this.index] === "}") {
        this.index += 1;
        properties.push({ key: key.value, keyStart: key.start, keyEnd: key.end, valueStart: value.start, valueEnd: value.end, value });
        return { type: "object", start, end: this.index, properties, hasTrailingComma };
      } else {
        this.fail("Expected ',' or '}' in an object");
      }
      properties.push({ key: key.value, keyStart: key.start, keyEnd: key.end, valueStart: value.start, valueEnd: value.end, value, ...(commaAfter === undefined ? {} : { commaAfter }) });
    }
  }

  private parseArray(): JsoncNode {
    const start = this.index;
    this.index += 1;
    const items: JsoncNode[] = [];
    this.skipTrivia();
    if (this.text[this.index] === "]") {
      this.index += 1;
      return { type: "array", start, end: this.index, items };
    }
    while (true) {
      items.push(this.parseValue());
      this.skipTrivia();
      if (this.text[this.index] === ",") {
        this.index += 1;
        this.skipTrivia();
        if (this.text[this.index] === "]") {
          this.index += 1;
          return { type: "array", start, end: this.index, items };
        }
        continue;
      }
      if (this.text[this.index] === "]") {
        this.index += 1;
        return { type: "array", start, end: this.index, items };
      }
      this.fail("Expected ',' or ']' in an array");
    }
  }

  private parseString(): JsoncString {
    const start = this.index;
    this.index += 1;
    while (this.index < this.text.length) {
      const char = this.text[this.index];
      if (char === "\\") {
        this.index += 2;
        continue;
      }
      if (char === "\"") {
        this.index += 1;
        const raw = this.text.slice(start, this.index);
        return { type: "string", start, end: this.index, value: JSON.parse(raw) as string };
      }
      this.index += 1;
    }
    this.fail("Unterminated string");
  }

  private parseBoolean(): JsoncBoolean {
    const start = this.index;
    const value = this.text.startsWith("true", this.index);
    const length = value ? 4 : 5;
    if (!value && !this.text.startsWith("false", this.index)) this.fail("Invalid literal");
    this.index += length;
    return { type: "boolean", start, end: this.index, value };
  }

  private parseNull(): JsoncNull {
    const start = this.index;
    if (!this.text.startsWith("null", this.index)) this.fail("Invalid literal");
    this.index += 4;
    return { type: "null", start, end: this.index };
  }

  private parseNumber(): JsoncNumber {
    const start = this.index;
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(this.text.slice(this.index));
    if (!match) this.fail("Invalid value");
    this.index += match[0].length;
    return { type: "number", start, end: this.index, value: Number(match[0]) };
  }

  private skipTrivia(): void {
    while (this.index < this.text.length) {
      const char = this.text[this.index];
      if (char !== undefined && /\s/.test(char)) {
        this.index += 1;
        continue;
      }
      if (char === "/" && this.text[this.index + 1] === "/") {
        this.index += 2;
        while (this.index < this.text.length && this.text[this.index] !== "\n") this.index += 1;
        continue;
      }
      if (char === "/" && this.text[this.index + 1] === "*") {
        this.index += 2;
        while (this.index < this.text.length && !(this.text[this.index] === "*" && this.text[this.index + 1] === "/")) this.index += 1;
        if (this.index >= this.text.length) this.fail("Unterminated block comment");
        this.index += 2;
        continue;
      }
      break;
    }
  }

  private fail(reason: string): never {
    throw new Error(`Invalid OpenCode JSONC at offset ${this.index}: ${reason}`);
  }
}

function findObjectProperty(node: JsoncNode, key: string): Extract<JsoncNode, { type: "object" }> | undefined {
  const property = findProperty(node, key);
  return property?.value.type === "object" ? property.value : undefined;
}

function findProperty(node: JsoncNode, key: string): JsoncProperty | undefined {
  return node.type === "object" ? node.properties.find((property) => property.key === key) : undefined;
}

function nodeValue(node: JsoncNode): unknown {
  switch (node.type) {
    case "object":
      return Object.fromEntries(node.properties.map((property) => [property.key, nodeValue(property.value)]));
    case "array":
      return node.items.map(nodeValue);
    case "string":
    case "number":
    case "boolean":
      return node.value;
    case "null":
      return null;
  }
}

function setOrInsertProperty(text: string, object: Extract<JsoncNode, { type: "object" }>, key: string, valueText: string): string {
  const property = findProperty(object, key);
  const indent = propertyIndent(text, object);
  if (!property) return insertProperty(text, object, key, valueText);
  const formatted = formatValue(valueText, lineIndent(text, property.keyStart));
  return `${text.slice(0, property.valueStart)}${formatted}${text.slice(property.valueEnd)}`;
}

function insertProperty(text: string, object: Extract<JsoncNode, { type: "object" }>, key: string, valueText: string): string {
  const indent = propertyIndent(text, object);
  const closingIndent = lineIndent(text, object.start);
  const formatted = formatValue(valueText, indent);
  const entry = `${JSON.stringify(key)}: ${formatted}`;

  if (object.properties.length === 0) {
    const insert = `\n${indent}${entry}\n${closingIndent}`;
    return `${text.slice(0, object.start + 1)}${insert}${text.slice(object.end - 1)}`;
  }

  const last = object.properties[object.properties.length - 1]!;
  if (object.hasTrailingComma && last.commaAfter !== undefined) {
    const insert = `\n${indent}${entry},`;
    return `${text.slice(0, last.commaAfter + 1)}${insert}${text.slice(last.commaAfter + 1)}`;
  }

  const insert = `,\n${indent}${entry}`;
  return `${text.slice(0, last.valueEnd)}${insert}${text.slice(last.valueEnd)}`;
}

function removeProperty(text: string, object: Extract<JsoncNode, { type: "object" }>, key: string): string {
  const property = findProperty(object, key);
  if (!property) return text;

  let start = property.keyStart;
  let end = property.valueEnd;

  let scan = property.valueEnd;
  while (scan < text.length && /\s/.test(text[scan] ?? "")) scan += 1;
  if (text[scan] === ",") {
    end = scan + 1;
  } else {
    const previous = object.properties[object.properties.indexOf(property) - 1];
    const previousComma = previous?.commaAfter;
    if (previousComma !== undefined) start = previousComma;
  }

  let next = `${text.slice(0, start)}${text.slice(end)}`;
  next = next.replace(/,\s*,/g, ",").replace(/\{\s*,/g, "{").replace(/,\s*\}/g, "}");
  return next;
}

function propertyIndent(text: string, object: Extract<JsoncNode, { type: "object" }>): string {
  const first = object.properties[0];
  if (first) return lineIndent(text, first.keyStart);
  return `${lineIndent(text, object.start)}  `;
}

function lineIndent(text: string, index: number): string {
  const lineStart = text.lastIndexOf("\n", Math.max(0, index - 1)) + 1;
  const line = text.slice(lineStart, index);
  return /^[ \t]*/.exec(line)?.[0] ?? "";
}

function formatValue(valueText: string, indent: string): string {
  return valueText.split("\n").map((line, index) => index === 0 ? line : `${indent}${line}`).join("\n");
}
