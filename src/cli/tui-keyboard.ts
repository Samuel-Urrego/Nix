import { emitKeypressEvents } from "node:readline";

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
  return (output as NodeJS.WriteStream).columns ?? 80;
}

export async function selectWithKeyboard({ input, output, prompt, choices, title = "NIX AI-STACK", banner, initialIndex = 0 }: KeyboardSelectionOptions): Promise<number> {
  if (choices.length === 0) return -1;
  const terminalInput = input as KeyboardInput;
  if (typeof terminalInput.setRawMode !== "function") {
    throw new Error("Keyboard selection requires an interactive terminal.");
  }

  emitKeypressEvents(input);
  const wasRaw = terminalInput.isRaw ?? false;
  const screen = new InPlaceScreen(output);
  let selected = initialIndex >= 0 && initialIndex < choices.length ? initialIndex : 0;
  let settled = false;

  return new Promise<number>((resolve, reject) => {
    const cleanup = (): void => {
      input.removeListener("keypress", onKeypress);
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
    const onKeypress = (value: string, key?: { readonly name?: string; readonly ctrl?: boolean }): void => {
      if (key?.ctrl && key.name === "c") {
        finish(-1);
      } else if (key?.name === "up") {
        selected = (selected + choices.length - 1) % choices.length;
        render();
      } else if (key?.name === "down") {
        selected = (selected + 1) % choices.length;
        render();
      } else if (key?.name === "return" || key?.name === "enter") {
        finish(selected);
      } else if (key?.name === "escape" || value.toLowerCase() === "q") {
        finish(-1);
      }
    };
    const onClose = (): void => finish(-1);
    const onError = (error: Error): void => fail(error);

    input.on("keypress", onKeypress);
    input.once("close", onClose);
    input.once("error", onError);
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
}: KeyboardMultiSelectOptions): Promise<readonly number[]> {
  if (choices.length === 0) return [];
  const terminalInput = input as KeyboardInput;
  if (typeof terminalInput.setRawMode !== "function") {
    throw new Error("Keyboard selection requires an interactive terminal.");
  }

  emitKeypressEvents(input);
  const wasRaw = terminalInput.isRaw ?? false;
  const screen = new InPlaceScreen(output);
  const checked = new Set<number>(initialSelected.filter((index) => index >= 0 && index < choices.length));
  let cursor = 0;
  let filter = "";
  let settled = false;

  return new Promise<readonly number[]>((resolve, reject) => {
    const visible = (): ReadonlyArray<number> =>
      choices
        .map((label, index) => ({ label, index }))
        .filter(({ label }) => filter.length === 0 || label.toLowerCase().includes(filter.toLowerCase()))
        .map(({ index }) => index);
    const nextRow = (): number => visible().length;

    const cleanup = (): void => {
      input.removeListener("keypress", onKeypress);
      input.removeListener("close", onClose);
      input.removeListener("error", onError);
      terminalInput.setRawMode(wasRaw);
      output.write("\u001b[?25h");
    };
    const finish = (value: readonly number[]): void => {
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
    const onKeypress = (value: string, key?: { readonly name?: string; readonly ctrl?: boolean; readonly meta?: boolean }): void => {
      if (key?.ctrl && key.name === "c") {
        finish([]);
        return;
      }
      if (key?.name === "up") {
        const limit = nextRow();
        cursor = cursor <= 0 ? limit : cursor - 1;
        render();
        return;
      }
      if (key?.name === "down") {
        const limit = nextRow();
        cursor = cursor >= limit ? 0 : cursor + 1;
        render();
        return;
      }
      if (key?.name === "return" || key?.name === "enter") {
        finish([...checked].sort((left, right) => left - right));
        return;
      }
      if (key?.name === "escape") {
        finish([]);
        return;
      }
      if (key?.name === "backspace" || key?.name === "delete") {
        filter = filter.slice(0, -1);
        clampCursor();
        render();
        return;
      }
      if (key?.name === "space" || value === " ") {
        const rows = visible();
        const target = rows[cursor];
        if (target !== undefined) {
          if (checked.has(target)) checked.delete(target);
          else checked.add(target);
        }
        render();
        return;
      }
      if (!key?.ctrl && !key?.meta && value === "a") {
        const rows = visible();
        const allChecked = rows.length > 0 && rows.every((index) => checked.has(index));
        for (const index of rows) {
          if (allChecked) checked.delete(index);
          else checked.add(index);
        }
        render();
        return;
      }
      if (!key?.ctrl && !key?.meta && value.length === 1 && value >= " ") {
        filter += value;
        clampCursor();
        render();
      }
    };
    const onClose = (): void => finish([]);
    const onError = (error: Error): void => fail(error);

    input.on("keypress", onKeypress);
    input.once("close", onClose);
    input.once("error", onError);
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
  const width = Math.max(4, Math.min(76, columns));
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
