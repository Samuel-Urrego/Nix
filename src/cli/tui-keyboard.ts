import { StringDecoder } from "node:string_decoder";

type KeyboardInput = NodeJS.ReadStream;

export interface KeyboardSelectionOptions {
  readonly input: NodeJS.ReadStream;
  readonly output: NodeJS.WritableStream;
  readonly prompt: string;
  readonly choices: readonly string[];
  readonly title?: string;
  /** Extra lines drawn above the frame, typically a welcome banner. */
  readonly banner?: readonly string[];
  /** Row highlighted on the first render. Defaults to the first choice. */
  readonly initialIndex?: number;
}

export interface KeyboardMultiSelectOptions {
  readonly input: NodeJS.ReadStream;
  readonly output: NodeJS.WritableStream;
  readonly prompt: string;
  readonly choices: readonly string[];
  readonly title?: string;
  /** Indexes checked by default; callers usually pass every index. */
  readonly initialSelected?: readonly number[];
}

/**
 * Draws the same rows in place instead of clearing the screen, so changing the
 * selection does not make the terminal flicker.
 */
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

function columnsOf(output: NodeJS.WritableStream): number {
  const columns = (output as NodeJS.WriteStream).columns;
  return typeof columns === "number" && columns > 0 ? columns : 80;
}

/** A key the selectors understand, already free of escape-sequence ambiguity. */
export type DecodedKey =
  | { readonly kind: "up" | "down" | "enter" | "escape" | "space" | "backspace" | "interrupt" }
  | { readonly kind: "text"; readonly value: string };

/**
 * How long a lone ESC waits for the rest of an escape sequence before it counts
 * as the Escape key. Node's own decoder keeps a pending ESC inside a per-stream
 * generator, so a later selector inherits it and arrow keys stop working; this
 * reader owns the buffer for the lifetime of one selector and drops it on close.
 */
const ESCAPE_FLUSH_MS = 50;

/**
 * Turns raw terminal bytes into keys. Raw mode delivers arrows as `ESC [ A`,
 * so the parser has to hold the ESC until it knows whether a sequence follows.
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

  const drain = (): void => {
    for (;;) {
      if (closed || pending.length === 0) return;
      if (pending.startsWith("\u001b")) {
        if (pending.length === 1) {
          scheduleEscapeFlush();
          return;
        }
        const second = pending[1];
        if (second === undefined || (second !== "[" && second !== "O")) {
          pending = pending.slice(1);
          stopTimer();
          onKey({ kind: "escape" });
          continue;
        }
        if (pending.length < 3) {
          scheduleEscapeFlush();
          return;
        }
        const code = pending[2];
        pending = pending.slice(3);
        stopTimer();
        if (code === "A") onKey({ kind: "up" });
        else if (code === "B") onKey({ kind: "down" });
        // Other sequences (left, right, home, delete) carry no meaning here.
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

export async function selectWithKeyboard({ input, output, prompt, choices, title = "NIX AI-STACK", banner, initialIndex = 0 }: KeyboardSelectionOptions): Promise<number> {
  if (choices.length === 0) return -1;
  const terminalInput = input as KeyboardInput;
  if (typeof terminalInput.setRawMode !== "function") {
    throw new Error("Keyboard selection requires an interactive terminal.");
  }

  const wasRaw = terminalInput.isRaw ?? false;
  const screen = new InPlaceScreen(output);
  let selected = initialIndex >= 0 && initialIndex < choices.length ? initialIndex : 0;
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
    const render = (): void => {
      const body = [prompt, "", ...choices.map((choice, index) => `${index === selected ? "›" : " "} ${choice}`), "", "↑↓ Navigate · Enter Select · Esc Back"];
      screen.draw([...(banner ?? []), ...(banner && banner.length > 0 ? [""] : []), ...buildFrame(title, body, columnsOf(output))]);
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
  initialSelected = []
}: KeyboardMultiSelectOptions): Promise<readonly number[] | undefined> {
  if (choices.length === 0) return [];
  const terminalInput = input as KeyboardInput;
  if (typeof terminalInput.setRawMode !== "function") {
    throw new Error("Keyboard selection requires an interactive terminal.");
  }

  const wasRaw = terminalInput.isRaw ?? false;
  const screen = new InPlaceScreen(output);
  const checked = new Set<number>(initialSelected.filter((index) => index >= 0 && index < choices.length));
  let cursor = 0;
  let filter = "";
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
    const render = (): void => {
      const rows = visible();
      const items = rows.map((choiceIndex, position) => {
        const marker = position === cursor ? "›" : " ";
        const box = checked.has(choiceIndex) ? "x" : " ";
        return `${marker} [${box}] ${choices[choiceIndex]}`;
      });
      const selectedLabel = `${checked.size}/${choices.length} selected`;
      const nextMarker = cursor === rows.length ? "›" : " ";
      const body = [
        prompt,
        "",
        `Search: ${filter.length > 0 ? filter : "type to filter"}`,
        "",
        ...items,
        ...(rows.length === 0 ? ["  No match for this search."] : []),
        "",
        `${nextMarker} Next →  (${selectedLabel})`,
        "",
        "↑↓ Move · Space Toggle · a Toggle all · Enter Next · Esc Back"
      ];
      screen.draw(buildFrame(title, body, columnsOf(output)));
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

export interface ProgressReporter {
  /** Renders the bar for a step that is about to run. */
  update(completed: number, label: string): void;
  /** Replaces the bar with the final report, optionally under a new title. */
  finish(lines: readonly string[], title?: string): void;
}

/** Framed, in-place progress bar for multi-step work. */
export function createProgress(output: NodeJS.WritableStream, title: string, total: number): ProgressReporter {
  const screen = new InPlaceScreen(output);
  const steps = Math.max(1, total);
  const barWidth = Math.max(10, Math.min(28, Math.min(76, columnsOf(output)) - 26));
  const draw = (completed: number, label: string, frameTitle: string): void => {
    const bounded = Math.max(0, Math.min(steps, completed));
    const filled = Math.round((barWidth * bounded) / steps);
    const bar = `${"█".repeat(filled)}${"░".repeat(barWidth - filled)}`;
    const percent = Math.round((100 * bounded) / steps);
    screen.draw(buildFrame(frameTitle, [bar, `${bounded}/${steps} steps · ${percent}%`, "", label], columnsOf(output)));
  };
  return {
    update: (completed, label) => draw(completed, label, title),
    finish: (lines, frameTitle) => {
      screen.draw(buildFrame(frameTitle ?? title, lines, columnsOf(output)));
    }
  };
}

/** Builds the exact physical rows of a frame, wrapping to the terminal width. */
export function buildFrame(title: string, lines: readonly string[], columns: number): string[] {
  // One column must stay free: a row as wide as the terminal auto-wraps into an
  // extra physical row, and the in-place redraw then moves up one row too few,
  // so the selection looks frozen even though it is changing.
  const width = Math.max(4, Math.min(76, columns - 1));
  const innerWidth = width - 4;
  const wrapped = lines.flatMap((line) => wrapLine(line, innerWidth));
  const visibleTitle = title.slice(0, Math.max(0, width - 4));
  const topLabel = visibleTitle ? ` ${visibleTitle} ` : "";
  const topFill = Math.max(0, width - topLabel.length - 2);
  const rows = [`╭${topLabel}${"─".repeat(topFill)}╮`];
  for (const line of wrapped) rows.push(`│ ${line.padEnd(innerWidth)} │`);
  rows.push(`╰${"─".repeat(width - 2)}╯`);
  return rows;
}

export function writeFrame(output: NodeJS.WritableStream, title: string, lines: readonly string[]): void {
  output.write(`${buildFrame(title, lines, columnsOf(output)).join("\n")}\n`);
}

function wrapLine(line: string, width: number): string[] {
  if (width <= 0) return [""];
  if (line.length <= width) return [line];
  const wrapped: string[] = [];
  let remaining = line;
  while (remaining.length > width) {
    let splitAt = remaining.lastIndexOf(" ", width);
    if (splitAt < 1) splitAt = width;
    wrapped.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  wrapped.push(remaining);
  return wrapped;
}
