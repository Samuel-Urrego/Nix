export function readOption(
  args: ReadonlyArray<string>,
  name: string
): string | undefined {
  const normalizedName = `--${name}`;

  for (const arg of args) {
    const [key, rawValue] = arg.split("=");

    if (key === normalizedName && rawValue) {
      return rawValue;
    }
  }

  return undefined;
}
