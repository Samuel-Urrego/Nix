/**
 * Full-screen viewport primitives.
 *
 * A TUI that appends panels to the scrollback is not a single-page application:
 * every step pushes the previous one up, the terminal keeps its history and a
 * long panel overflows the visible area. `Screen` instead paints one viewport on
 * the alternate buffer, exactly like htop or lazygit: the scrollback is left
 * untouched, every paint replaces the whole screen, and content that does not
 * fit scrolls inside its own frame.
 */

const MIN_COLUMNS = 24;
const MIN_ROWS = 8;
const MAX_FRAME_WIDTH = 96;

export function columnsOf(output: NodeJS.WritableStream): number {
  const columns = (output as NodeJS.WriteStream).columns;
  return typeof columns === "number" && columns > 0 ? columns : 80;
}

export function rowsOf(output: NodeJS.WritableStream): number {
  const rows = (output as NodeJS.WriteStream).rows;
  return typeof rows === "number" && rows > 0 ? rows : 24;
}

/** Splits a line so no rendered row ever exceeds the frame's inner width. */
export function wrapLine(line: string, width: number): string[] {
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

/**
 * Builds the exact physical rows of a frame. One column always stays free: a row
 * as wide as the terminal auto-wraps into an extra physical row and any in-place
 * redraw after that lands one row off.
 */
export function buildFrame(title: string, lines: readonly string[], columns: number): string[] {
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

export interface ScreenLayout {
  /** Exactly `rows` physical lines, ready to paint. */
  readonly lines: readonly string[];
  /** Total wrapped content lines, so callers know how far they can scroll. */
  readonly total: number;
  /** Visible content lines between the two borders. */
  readonly bodyRows: number;
  /** Characters available inside the borders. */
  readonly innerWidth: number;
  readonly scroll: number;
}

/** Width of the frame itself, one column short of the terminal. */
export function frameWidth(columns: number): number {
  return Math.max(4, Math.min(MAX_FRAME_WIDTH, columns));
}

/**
 * Places a frame plus a one-line key hint inside the viewport. The frame never
 * grows past the screen: the body is a window over the wrapped content.
 */
export function layoutScreen(options: {
  readonly title: string;
  readonly lines: readonly string[];
  readonly scroll: number;
  readonly columns: number;
  readonly rows: number;
  readonly footer: string;
}): ScreenLayout {
  const width = frameWidth(options.columns);
  const innerWidth = width - 4;
  const wrapped = options.lines.flatMap((line) => wrapLine(line, innerWidth));
  const bodyRows = Math.max(1, options.rows - 3);
  const maxScroll = Math.max(0, wrapped.length - bodyRows);
  const scroll = Math.max(0, Math.min(options.scroll, maxScroll));
  const visible = wrapped.slice(scroll, scroll + bodyRows);

  const visibleTitle = options.title.slice(0, Math.max(0, width - 4));
  const topLabel = visibleTitle ? ` ${visibleTitle} ` : "";
  const topFill = Math.max(0, width - topLabel.length - 2);
  const lines: string[] = [`╭${topLabel}${"─".repeat(topFill)}╮`];
  for (let index = 0; index < bodyRows; index += 1) {
    lines.push(`│ ${(visible[index] ?? "").padEnd(innerWidth)} │`);
  }
  lines.push(`╰${"─".repeat(width - 2)}╯`);
  lines.push(options.footer.slice(0, Math.max(0, options.columns - 1)));
  return { lines, total: wrapped.length, bodyRows, innerWidth, scroll };
}

/** Scrolls just far enough to keep `[start, start + height)` inside the window. */
export function scrollToShow(start: number, height: number, current: number, bodyRows: number): number {
  if (start < current) return start;
  if (start + height > current + bodyRows) return Math.max(0, start + height - bodyRows);
  return current;
}

/** Full-screen viewport on the alternate buffer. */
export class Screen {
  private opened = false;
  private lastLines: readonly string[] = [];
  private readonly resize = (): void => {
    if (this.opened && this.lastLines.length > 0) this.paint(this.lastLines);
  };

  constructor(private readonly output: NodeJS.WriteStream) {}

  get columns(): number {
    return Math.max(MIN_COLUMNS, columnsOf(this.output) - 1);
  }

  get rows(): number {
    return Math.max(MIN_ROWS, rowsOf(this.output));
  }

  open(): void {
    if (this.opened) return;
    this.opened = true;
    this.output.write("\u001b[?1049h\u001b[?25l\u001b[2J\u001b[H");
    this.output.on("resize", this.resize);
  }

  close(): void {
    if (!this.opened) return;
    this.opened = false;
    this.output.removeListener("resize", this.resize);
    this.output.write("\u001b[?25h\u001b[?1049l");
  }

  /** Replaces the whole viewport. Nothing is appended to the scrollback. */
  paint(lines: readonly string[]): void {
    this.lastLines = lines;
    const width = this.columns;
    const height = this.rows;
    // Every cell is repainted, so a shorter view never leaves stale rows behind.
    const body: string[] = [];
    for (let index = 0; index < height; index += 1) {
      body.push((lines[index] ?? "").padEnd(width).slice(0, width));
    }
    this.output.write(`\u001b[H${body.join("\r\n")}`);
  }
}
