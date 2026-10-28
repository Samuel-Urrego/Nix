import { emitKeypressEvents } from "node:readline";

type KeyboardInput = NodeJS.ReadStream;

export interface KeyboardSelectionOptions {
  readonly input: NodeJS.ReadStream;
  readonly output: NodeJS.WritableStream;
  readonly prompt: string;
  readonly choices: readonly string[];
  readonly title?: string;
}

export async function selectWithKeyboard({ input, output, prompt, choices, title = "NIX AI-STACK" }: KeyboardSelectionOptions): Promise<number> {
  if (choices.length === 0) return -1;
  const terminalInput = input as KeyboardInput;
  if (typeof terminalInput.setRawMode !== "function") {
    throw new Error("Keyboard selection requires an interactive terminal.");
  }

  emitKeypressEvents(input);
  const wasRaw = terminalInput.isRaw ?? false;
  let selected = 0;
  let settled = false;

  return new Promise<number>((resolve, reject) => {
    const cleanup = (): void => {
      input.removeListener("keypress", onKeypress);
      input.removeListener("close", onClose);
      input.removeListener("error", onError);
      terminalInput.setRawMode(wasRaw);
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
      output.write("\u001b[2J\u001b[H");
      const lines = [prompt, "", ...choices.map((choice, index) => `${index === selected ? "›" : " "} ${choice}`), "", "↑↓ Navigate · Enter Select · Esc Back"];
      writeFrame(output, title, lines);
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
    render();
  });
}

export function writeFrame(output: NodeJS.WritableStream, title: string, lines: readonly string[]): void {
  const columns = (output as NodeJS.WriteStream).columns ?? 80;
  const width = Math.max(4, Math.min(76, columns));
  const innerWidth = width - 4;
  const wrapped = lines.flatMap((line) => wrapLine(line, innerWidth));
  const visibleTitle = title.slice(0, Math.max(0, width - 4));
  const topLabel = visibleTitle ? ` ${visibleTitle} ` : "";
  const topFill = Math.max(0, width - topLabel.length - 2);
  output.write(`╭${topLabel}${"─".repeat(topFill)}╮\n`);
  for (const line of wrapped) output.write(`│ ${line.padEnd(innerWidth)} │\n`);
  output.write(`╰${"─".repeat(width - 2)}╯\n`);
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
