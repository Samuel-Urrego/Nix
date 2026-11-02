/**
 * The range grammar an MCP prerequisite needs, and nothing more: `||` between
 * alternatives, whitespace between ANDed comparators, and the operators `^`,
 * `>=`, `>`, `<=`, `<`, `=`. Wildcards (`x`, `*`) mean "any".
 *
 * It exists so a prerequisite can say "Node ^22.23.4 || ^24.22.1 || >=26.12.1"
 * and Nix refuses to install an integration that cannot possibly run.
 */
export interface Version {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

const VERSION_PATTERN = /(\d+)\.(\d+)\.(\d+)/;

/** Reads the first `x.y.z` in a command's output, ignoring a leading `v`. */
export function parseVersion(text: string): Version | undefined {
  const match = VERSION_PATTERN.exec(text);
  if (!match) return undefined;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

export function formatVersion(version: Version): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

export function compareVersions(left: Version, right: Version): number {
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  return left.patch - right.patch;
}

export function satisfiesRange(version: Version, range: string): boolean {
  return range
    .split("||")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .some((part) => satisfiesAll(version, part));
}

function satisfiesAll(version: Version, part: string): boolean {
  const comparators = part.split(/\s+/).filter((token) => token.length > 0);
  return comparators.length > 0 && comparators.every((token) => satisfiesComparator(version, token));
}

function satisfiesComparator(version: Version, token: string): boolean {
  const match = /^(>=|<=|>|<|=|\^)?v?(\d+)(?:\.(\d+|x|X|\*))?(?:\.(\d+|x|X|\*))?$/.exec(token);
  if (!match) return false;

  const operator = match[1] ?? "=";
  const major = Number(match[2]);
  const minorText = match[3];
  const patchText = match[4];

  // A wildcard (or a missing segment) makes the lower bound the floor of that segment.
  const anyMinor = minorText === undefined || /^(x|X|\*)$/.test(minorText);
  const anyPatch = patchText === undefined || /^(x|X|\*)$/.test(patchText);
  const lower: Version = { major, minor: anyMinor ? 0 : Number(minorText), patch: anyPatch ? 0 : Number(patchText) };

  switch (operator) {
    case ">=":
      return compareVersions(version, lower) >= 0;
    case ">":
      return compareVersions(version, lower) > 0;
    case "<=":
      return compareVersions(version, lower) <= 0;
    case "<":
      return compareVersions(version, lower) < 0;
    case "^": {
      // npm caret rules: ^1.2.3 <2.0.0, ^0.2.3 <0.3.0, ^0.0.3 <0.0.4.
      if (compareVersions(version, lower) < 0) return false;
      const upper: Version = lower.major > 0
        ? { major: lower.major + 1, minor: 0, patch: 0 }
        : lower.minor > 0
          ? { major: 0, minor: lower.minor + 1, patch: 0 }
          : { major: 0, minor: 0, patch: lower.patch + 1 };
      return compareVersions(version, upper) < 0;
    }
    default:
      if (anyMinor || anyPatch) {
        // `=26` or `=26.12` compare only the segments that were given.
        if (version.major !== lower.major) return false;
        if (anyMinor) return true;
        return version.minor === lower.minor;
      }
      return compareVersions(version, lower) === 0;
  }
}
