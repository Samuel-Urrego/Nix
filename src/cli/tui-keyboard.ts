import { StringDecoder } from "node:string_decoder";

import {
  buildFrame,
  columnsOf,
  frameWidth,
  layoutScreen,
  Screen,
  scrollToShow,
  wrapLine,
  writeFrame
} from "./tui-screen.js";

export { buildFrame, columnsOf, writeFrame } from "./tui-screen.js";
export { Screen } from "./tui-screen.js";

type KeyboardInput = NodeJS.ReadStream;

export interface KeyboardSelectionOptions {
  readonly input: NodeJS.ReadStream;
  readonly output: NodeJS.WritableStream;
  readonly prompt: string;
  readonly choices: readonly string[];
  readonly title?: string;
  /** Extra lines drawn above the prompt, typically a welcome banner. */
  readonly banner?: readonly string[];
  /** Row highlighted on the first render. Defaults to the first choice. */
  readonly initialIndex?: number;
  /** Shared viewport so every screen replaces the previous one. */
  readonly screen?: Screen;
}

export interface KeyboardMultiSelectOptions {
  readonly input: NodeJS.ReadStream;
  readonly output: NodeJS.WritableStream;
  readonly prompt: string;
  readonly choices: readonly string[];
  readonly title?: string;
  /** Indexes checked by default; callers usually pass every index. */
  readonly initialSelected?: readonly number[];
  readonly screen?: Screen;
}

export interface KeyboardViewOptions {
  readonly input: NodeJS.ReadStream;
  readonly output: NodeJS.WritableStream;
  readonly title: string;
  readonly lines: readonly string[];
  readonly footer?: string;
  readonly screen?: Screen;
}

/** A key the selectors understand, already free of escape-sequence ambiguity. */
export type DecodedKey =
  | {
      readonly kind:
        | "up"
        | "down"
        | "pgup"
        | "pgdn"
        | "home"
        | "end"
        | "enter"
        | "escape"
        | "space"
        | "backspace"
        | "interrupt";
    }
  | { readonly kind: "text"; readonly value: string };

/**
 * How long a lone ESC waits for the rest of an escape sequence before it counts
 * as the Escape key. Node's own decoder keeps a pending ESC inside a per-stream
 * generator, so a later selector inherits it; this reader owns the buffer for the
 * lifetime of one screen and drops it on close.
 */
const ESCAPE_FLUSH_MS = 50;
const MAX_SEQUENCE_LENGTH = 12;

/**
 * Turns raw terminal bytes into keys. Raw mode delivers arrows as `ESC [ A`, so
 * the parser holds the ESC until it knows whether a sequence follows.
 */
export function createKeyReader(input: NodeJS.ReadStream, onKey: (key: DecodedKey) => void): () => void {
  const decoder = new StringDecoder("utf8");
  let pending = "";
  let timer: NodeJS.Timeout | undefined;
  let closed = false;

  const stopTimer = (): void => {
    if (!timer) return;
    clearTimeout(timer);
    timer = undefined;
  };

  const scheduleEscapeFlush = (): void => {
    stopTimer();
    timer = setTimeout(() => {
      timer = undefined;
      if (closed) return;
      pending = "";
      onKey({ kind: "escape" });
    }, ESCAPE_FLUSH_MS);
  };

  const emitSequence = (params: string, final: string): void => {
    if (final === "A") onKey({ kind: "up" });
    else if (final === "B") onKey({ kind: "down" });
    else if (final === "~" && params === "5") onKey({ kind: "pgup" });
    else if (final === "~" && params === "6") onKey({ kind: "pgdn" });
    else if (final === "H" || (final === "~" && (params === "1" || params === "7"))) onKey({ kind: "home" });
    else if (final === "F" || (final === "~" && (params === "4" || params === "8"))) onKey({ kind: "end" });
    // Left, right, delete and modified arrows carry no meaning here.
  };

  const drain = (): void => {
    for (;;) {
      if (closed || pending.length === 0) return;
      if (pending.startsWith("\u001b")) {
        if (pending.length === 1) {
          scheduleEscapeFlush();
          return;
        }
        const second = pending[1];
        if (second !== "[" && second !== "O") {
          if (second === undefined) {
            scheduleEscapeFlush();
            return;
          }
          pending = pending.slice(1);
          stopTimer();
          onKey({ kind: "escape" });
          continue;
        }
        // A CSI sequence ends at the first byte in 0x40..0x7E.
        let end = -1;
        for (let index = 2; index < pending.length; index += 1) {
          const code = pending.charCodeAt(index);
          if (code >= 0x40 && code <= 0x7e) {
            end = index;
            break;
          }
        }
        if (end < 0) {
          if (pending.length > MAX_SEQUENCE_LENGTH) {
            pending = "";
            return;
          }
          scheduleEscapeFlush();
          return;
        }
        const params = pending.slice(2, end);
        const final = pending[end] ?? "";
        pending = pending.slice(end + 1);
        stopTimer();
        emitSequence(params, final);
        continue;
      }
      const char = pending[0] ?? "";
      pending = pending.slice(1);
      stopTimer();
      if (char === "\r" || char === "\n") onKey({ kind: "enter" });
      else if (char === "\u007f" || char === "\b") onKey({ kind: "backspace" });
      else if (char === "\u0003") onKey({ kind: "interrupt" });
      else if (char === " ") onKey({ kind: "space" });
      else if (char >= " ") onKey({ kind: "text", value: char });
      // Other control bytes are ignored on purpose.
    }
  };

  const onData = (chunk: Buffer | string): void => {
    pending += typeof chunk === "string" ? chunk : decoder.write(chunk);
    stopTimer();
    drain();
  };

  input.on("data", onData);
  return () => {
    closed = true;
    stopTimer();
    pending = "";
    input.removeListener("data", onData);
  };
}

interface ScreenRuntime {
  readonly screen: Screen;
  readonly bodyRows: number;
  readonly inner: number;
}

function runtimeFor(screen: Screen): ScreenRuntime {
  return { screen, bodyRows: Math.max(1, screen.rows - 3), inner: frameWidth(screen.columns) - 4 };
}

function paintView(runtime: ScreenRuntime, title: string, lines: readonly string[], scroll: number, footer: string): number {
  const layout = layoutScreen({
    title,
    lines,
    scroll,
    columns: runtime.screen.columns,
    rows: runtime.screen.rows,
    footer
  });
  runtime.screen.paint(layout.lines);
  return layout.scroll;
}

export async function selectWithKeyboard({
  input,
  output,
  prompt,
  choices,
  title = "NIX AI-STACK",
  banner,
  initialIndex = 0,
  screen = new Screen(output as NodeJS.WriteStream)
}: KeyboardSelectionOptions): Promise<number> {
  if (choices.length === 0) return -1;
  const terminalInput = input as KeyboardInput;
  if (typeof terminalInput.setRawMode !== "function") {
    throw new Error("Keyboard selection requires an interactive terminal.");
  }

  const wasRaw = terminalInput.isRaw ?? false;
  const runtime = runtimeFor(screen);
  const footer = "↑↓ Navigate · Enter Select · Esc Back";
  let selected = initialIndex >= 0 && initialIndex < choices.length ? initialIndex : 0;
  let scroll = 0;
  let settled = false;

  return new Promise<number>((resolve, reject) => {
    let closeReader: () => void = () => {};
    const cleanup = (): void => {
      closeReader();
      input.removeListener("close", onClose);
      input.removeListener("error", onError);
      terminalInput.setRawMode(wasRaw);
      output.write("\u001b[?25h");
    };
    const finish = (value: number): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const body = (): { readonly lines: readonly string[]; readonly start: number; readonly height: number } => {
      const lines: string[] = [...(banner ?? []), ...(banner && banner.length > 0 ? [""] : []), prompt, ""];
      const starts: number[] = [];
      const ends: number[] = [];
      for (const choice of choices) {
        const index = starts.length;
        const text = `${index === selected ? "›" : " "} ${choice}`;
        starts.push(lines.length);
        const wrapped = wrapLine(text, runtime.inner);
        lines.push(...wrapped);
        ends.push(lines.length);
      }
      const start = starts[selected] ?? 0;
      return { lines, start, height: Math.max(1, (ends[selected] ?? start) - start) };
    };
    const render = (): void => {
      const view = body();
      scroll = scrollToShow(view.start, view.height, scroll, runtime.bodyRows);
      scroll = paintView(runtime, title, view.lines, scroll, footer);
    };
    const onKey = (key: DecodedKey): void => {
      if (key.kind === "interrupt" || key.kind === "escape") {
        finish(-1);
      } else if (key.kind === "up") {
        selected = (selected + choices.length - 1) % choices.length;
        render();
      } else if (key.kind === "down") {
        selected = (selected + 1) % choices.length;
        render();
      } else if (key.kind === "home") {
        selected = 0;
        render();
      } else if (key.kind === "end") {
        selected = choices.length - 1;
        render();
      } else if (key.kind === "enter") {
        finish(selected);
      } else if (key.kind === "text" && key.value.toLowerCase() === "q") {
        finish(-1);
      }
    };
    const onClose = (): void => finish(-1);
    const onError = (error: Error): void => fail(error);

    input.once("close", onClose);
    input.once("error", onError);
    closeReader = createKeyReader(input, onKey);
    terminalInput.setRawMode(true);
    input.resume();
    output.write("\u001b[?25l");
    render();
  });
}

export async function multiSelectWithKeyboard({
  input,
  output,
  prompt,
  choices,
  title = "NIX AI-STACK",
  initialSelected = [],
  screen = new Screen(output as NodeJS.WriteStream)
}: KeyboardMultiSelectOptions): Promise<readonly number[] | undefined> {
  if (choices.length === 0) return [];
  const terminalInput = input as KeyboardInput;
  if (typeof terminalInput.setRawMode !== "function") {
    throw new Error("Keyboard selection requires an interactive terminal.");
  }

  const wasRaw = terminalInput.isRaw ?? false;
  const runtime = runtimeFor(screen);
  const footer = "↑↓ Move · Space Toggle · a All · Enter Next · Esc Back";
  const checked = new Set<number>(initialSelected.filter((index) => index >= 0 && index < choices.length));
  let cursor = 0;
  let filter = "";
  let scroll = 0;
  let settled = false;

  return new Promise<readonly number[] | undefined>((resolve, reject) => {
    // undefined means cancelled: an empty selection is a real answer, going back is not.
    let closeReader: () => void = () => {};
    const visible = (): ReadonlyArray<number> =>
      choices
        .map((label, index) => ({ label, index }))
        .filter(({ label }) => filter.length === 0 || label.toLowerCase().includes(filter.toLowerCase()))
        .map(({ index }) => index);
    const nextRow = (): number => visible().length;

    const cleanup = (): void => {
      closeReader();
      input.removeListener("close", onClose);
      input.removeListener("error", onError);
      terminalInput.setRawMode(wasRaw);
      output.write("\u001b[?25h");
    };
    const finish = (value: readonly number[] | undefined): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const clampCursor = (): void => {
      const limit = nextRow();
      if (cursor > limit) cursor = limit;
      if (cursor < 0) cursor = 0;
    };
    const body = (): { readonly lines: readonly string[]; readonly start: number; readonly height: number } => {
      const rows = visible();
      const lines: string[] = [
        prompt,
        "",
        `Search: ${filter.length > 0 ? filter : "type to filter"}`,
        "",
        ...(rows.length === 0 ? ["  No match for this search."] : [])
      ];
      const starts: number[] = [];
      const ends: number[] = [];
      rows.forEach((choiceIndex, position) => {
        const marker = position === cursor ? "›" : " ";
        const box = checked.has(choiceIndex) ? "x" : " ";
        const text = `${marker} [${box}] ${choices[choiceIndex]}`;
        starts.push(lines.length);
        const wrapped = wrapLine(text, runtime.inner);
        lines.push(...wrapped);
        ends.push(lines.length);
      });
      lines.push("", `${cursor === rows.length ? "›" : " "} Next →  (${checked.size}/${choices.length} selected)`);
      const nextStart = lines.length - 1;
      const start = cursor === rows.length ? nextStart : (starts[cursor] ?? 0);
      const height = cursor === rows.length ? 1 : Math.max(1, (ends[cursor] ?? start) - start);
      return { lines, start, height };
    };
    const render = (): void => {
      const view = body();
      scroll = scrollToShow(view.start, view.height, scroll, runtime.bodyRows);
      scroll = paintView(runtime, title, view.lines, scroll, footer);
    };
    const onKey = (key: DecodedKey): void => {
      if (key.kind === "interrupt" || key.kind === "escape") {
        finish(undefined);
        return;
      }
      if (key.kind === "up") {
        const limit = nextRow();
        cursor = cursor <= 0 ? limit : cursor - 1;
        render();
        return;
      }
      if (key.kind === "down") {
        const limit = nextRow();
        cursor = cursor >= limit ? 0 : cursor + 1;
        render();
        return;
      }
      if (key.kind === "pgup" || key.kind === "home") {
        cursor = 0;
        render();
        return;
      }
      if (key.kind === "pgdn" || key.kind === "end") {
        cursor = nextRow();
        render();
        return;
      }
      if (key.kind === "enter") {
        finish([...checked].sort((left, right) => left - right));
        return;
      }
      if (key.kind === "backspace") {
        filter = filter.slice(0, -1);
        clampCursor();
        render();
        return;
      }
      if (key.kind === "space") {
        const rows = visible();
        const target = rows[cursor];
        if (target !== undefined) {
          if (checked.has(target)) checked.delete(target);
          else checked.add(target);
        }
        render();
        return;
      }
      if (key.kind === "text" && key.value === "a") {
        const rows = visible();
        const allChecked = rows.length > 0 && rows.every((index) => checked.has(index));
        for (const index of rows) {
          if (allChecked) checked.delete(index);
          else checked.add(index);
        }
        render();
        return;
      }
      if (key.kind === "text" && key.value >= " ") {
        filter += key.value;
        clampCursor();
        render();
      }
    };
    const onClose = (): void => finish(undefined);
    const onError = (error: Error): void => fail(error);

    input.once("close", onClose);
    input.once("error", onError);
    closeReader = createKeyReader(input, onKey);
    terminalInput.setRawMode(true);
    input.resume();
    output.write("\u001b[?25l");
    render();
  });
}

/** Scrollable full-screen view: the SPA replacement for a report plus a pause. */
export async function viewWithKeyboard({
  input,
  output,
  title,
  lines,
  footer = "↑↓ Scroll · PgUp/PgDn Page · Enter Continue · Esc Back",
  screen = new Screen(output as NodeJS.WriteStream)
}: KeyboardViewOptions): Promise<void> {
  const terminalInput = input as KeyboardInput;
  if (typeof terminalInput.setRawMode !== "function") {
    throw new Error("Keyboard selection requires an interactive terminal.");
  }

  const wasRaw = terminalInput.isRaw ?? false;
  const runtime = runtimeFor(screen);
  let scroll = 0;
  let settled = false;

  return new Promise<void>((resolve, reject) => {
    let closeReader: () => void = () => {};
    const cleanup = (): void => {
      closeReader();
      input.removeListener("close", onClose);
      input.removeListener("error", onError);
      terminalInput.setRawMode(wasRaw);
      output.write("\u001b[?25h");
    };
    const finish = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const render = (): void => {
      scroll = paintView(runtime, title, lines, scroll, footer);
    };
    const onKey = (key: DecodedKey): void => {
      if (key.kind === "enter" || key.kind === "escape" || key.kind === "interrupt") {
        finish();
        return;
      }
      if (key.kind === "up") scroll = Math.max(0, scroll - 1);
      else if (key.kind === "down") scroll += 1;
      else if (key.kind === "pgup") scroll = Math.max(0, scroll - runtime.bodyRows);
      else if (key.kind === "pgdn") scroll += runtime.bodyRows;
      else if (key.kind === "home") scroll = 0;
      else if (key.kind === "end") scroll = Number.MAX_SAFE_INTEGER;
      else return;
      render();
    };
    const onClose = (): void => finish();
    const onError = (error: Error): void => fail(error);

    input.once("close", onClose);
    input.once("error", onError);
    closeReader = createKeyReader(input, onKey);
    terminalInput.setRawMode(true);
    input.resume();
    output.write("\u001b[?25l");
    render();
  });
}

/** Waits for Enter without repainting: the caller already painted the view. */
export async function waitForKeyboard({
  input,
  output
}: {
  readonly input: NodeJS.ReadStream;
  readonly output: NodeJS.WritableStream;
}): Promise<void> {
  const terminalInput = input as KeyboardInput;
  if (typeof terminalInput.setRawMode !== "function") return;
  const wasRaw = terminalInput.isRaw ?? false;

  return new Promise<void>((resolve, reject) => {
    let closeReader: () => void = () => {};
    let settled = false;
    const cleanup = (): void => {
      closeReader();
      input.removeListener("close", onClose);
      input.removeListener("error", onError);
      terminalInput.setRawMode(wasRaw);
    };
    const done = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const onKey = (key: DecodedKey): void => {
      if (key.kind === "enter" || key.kind === "escape" || key.kind === "interrupt") done();
    };
    const onClose = (): void => done();
    const onError = (error: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    input.once("close", onClose);
    input.once("error", onError);
    closeReader = createKeyReader(input, onKey);
    terminalInput.setRawMode(true);
    input.resume();
    void output;
  });
}

export interface ProgressReporter {
  /** Renders the bar for a step that is about to run. */
  update(completed: number, label: string): void;
  /** Replaces the bar with the final report, optionally under a new title. */
  finish(lines: readonly string[], title?: string): void;
}

/** Legacy in-place writer for runs that render to a plain stream (tests). */
class InPlaceScreen {
  private rows = 0;
  private started = false;

  constructor(private readonly output: NodeJS.WritableStream) {}

  draw(lines: readonly string[]): void {
    if (!this.started) {
      this.output.write(`${lines.join("\n")}\n`);
      this.started = true;
      this.rows = lines.length;
      return;
    }
    const height = Math.max(this.rows, lines.length);
    this.output.write(`\u001b[${this.rows}A`);
    for (let index = 0; index < height; index += 1) {
      this.output.write(`\u001b[2K${lines[index] ?? ""}\n`);
    }
    const extra = height - lines.length;
    if (extra > 0) this.output.write(`\u001b[${extra}A`);
    this.rows = lines.length;
  }
}

/** Framed progress bar: full-screen when a shared viewport is provided. */
export function createProgress(
  output: NodeJS.WritableStream,
  title: string,
  total: number,
  screen?: Screen
): ProgressReporter {
  const steps = Math.max(1, total);
  const runtime = screen ? runtimeFor(screen) : undefined;
  const legacy = runtime ? undefined : new InPlaceScreen(output);
  const barWidth = Math.max(10, Math.min(28, (runtime ? runtime.inner : frameWidth(columnsOf(output)) - 4) - 6));
  const draw = (content: readonly string[], frameTitle: string, footer: string): void => {
    if (runtime) {
      paintView(runtime, frameTitle, content, 0, footer);
      return;
    }
    legacy?.draw(buildFrame(frameTitle, content, columnsOf(output)));
  };
  return {
    update: (completed, label) => {
      const bounded = Math.max(0, Math.min(steps, completed));
      const filled = Math.round((barWidth * bounded) / steps);
      const bar = `${"█".repeat(filled)}${"░".repeat(barWidth - filled)}`;
      const percent = Math.round((100 * bounded) / steps);
      draw([bar, `${bounded}/${steps} steps · ${percent}%`, "", label], title, "Installing — please wait");
    },
    finish: (lines, frameTitle) => {
      draw(lines, frameTitle ?? title, "Press Enter to continue");
    }
  };
}
