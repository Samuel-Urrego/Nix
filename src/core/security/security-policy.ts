export type SupportedShell = "powershell" | "cmd" | "git-bash";
export type SecurityShell = SupportedShell | "windows-auto";
export type SecurityDecisionAction = "allow" | "block" | "unsupported";

export interface SecurityDecision {
  readonly action: SecurityDecisionAction;
  readonly reason: string;
  readonly rule?: "broad-file-deletion" | "destructive-sql";
}

interface Token {
  readonly value: string;
  readonly quoted: boolean;
}

const allow: SecurityDecision = { action: "allow", reason: "No supported destructive operation was detected." };

/** A deliberately narrow, defense-in-depth policy for common Windows shell invocations. */
export function evaluateDestructiveCommand(shell: SupportedShell, command: string): SecurityDecision {
  if (!command.trim()) return allow;
  if (shell === "powershell" && /(?:^|\s)-(?:encodedcommand|enc)(?:\s|$)/i.test(command)) {
    return { action: "unsupported", reason: "Encoded PowerShell payloads cannot be inspected safely." };
  }

  const parsed = tokenize(command, shell);
  if (!parsed) return { action: "unsupported", reason: "Unbalanced quoting or unsupported command syntax." };
  if (parsed.some((token) => /(?:\$\(|`|\|\s*(?:sh|bash|cmd|powershell)\b)/i.test(token.value) && !token.quoted)) {
    return { action: "unsupported", reason: "Dynamic command construction cannot be inspected safely." };
  }

  const groups = splitCommands(parsed);
  for (const group of groups) {
    const decision = inspectInvocation(shell, group, 0);
    if (decision.action !== "allow") return decision;
  }
  return allow;
}

/** Conservatively covers OpenCode's configurable Windows shell when its active shell is not exposed by the hook event. */
export function evaluateWindowsDestructiveCommand(command: string): SecurityDecision {
  const decisions = (["powershell", "cmd", "git-bash"] as const).map((shell) => evaluateDestructiveCommand(shell, command));
  const blocked = decisions.find((decision) => decision.action === "block");
  if (blocked) return blocked;
  const unsupported = decisions.find((decision) => decision.action === "unsupported");
  return unsupported ?? allow;
}

function inspectInvocation(shell: SupportedShell, tokens: readonly Token[], depth: number): SecurityDecision {
  if (depth > 3) return { action: "unsupported", reason: "Nested shell wrapper depth exceeds the inspection limit." };
  const words = tokens.map(({ value }) => value);
  if (words.length === 0) return allow;

  const first = basename(words[0] ?? "").toLowerCase();
  if (shell === "cmd" && first === "cmd") {
    const marker = words.findIndex((word) => /^\/(?:c|k)$/i.test(word));
    if (marker < 0) return allow;
    return inspectInvocation("cmd", tokens.slice(marker + 1), depth + 1);
  }
  if (shell === "powershell" && /^(?:powershell|pwsh)(?:\.exe)?$/i.test(first)) {
    if (words.some((word) => /^-(?:encodedcommand|enc)$/i.test(word))) return { action: "unsupported", reason: "Encoded PowerShell payloads cannot be inspected safely." };
    const marker = words.findIndex((word) => /^-(?:command|c)$/i.test(word));
    if (marker < 0) return allow;
    return inspectInvocation("powershell", tokenize(words.slice(marker + 1).join(" "), "powershell") ?? [], depth + 1);
  }
  if (shell === "git-bash" && /^(?:bash|sh|zsh)(?:\.exe)?$/i.test(first)) {
    const marker = words.findIndex((word) => /^-c$/i.test(word));
    if (marker < 0) return allow;
    return inspectInvocation("git-bash", tokenize(words.slice(marker + 1).join(" "), "git-bash") ?? [], depth + 1);
  }

  const fileDecision = inspectFileDeletion(shell, words);
  if (fileDecision) return fileDecision;
  return inspectSql(words);
}

function inspectFileDeletion(shell: SupportedShell, words: readonly string[]): SecurityDecision | undefined {
  const command = basename(words[0] ?? "").toLowerCase();
  if (shell === "powershell" && /^(?:remove-item|ri|rm|rmdir|del|erase)$/i.test(command)) {
    const recursive = words.some((word) => /^-(?:recurse|r)$/i.test(word));
    const force = words.some((word) => /^-(?:force|f)$/i.test(word));
    const targets = words.slice(1).filter((word) => !word.startsWith("-"));
    if (recursive && targets.some(isBroadTarget)) return deletionBlock("PowerShell", targets.find(isBroadTarget) ?? "");
    if (recursive && force && targets.length === 0) return deletionBlock("PowerShell", "<implicit target>");
  }
  if (shell === "cmd" && /^(?:del|erase|rd|rmdir)$/i.test(command)) {
    const recursive = words.some((word) => /^\/s$/i.test(word));
    const targets = words.slice(1).filter((word) => !/^\//.test(word));
    if (recursive && targets.some(isBroadTarget)) return deletionBlock("cmd.exe", targets.find(isBroadTarget) ?? "");
    if (recursive && targets.length === 0) return deletionBlock("cmd.exe", "<implicit target>");
  }
  if (shell === "git-bash" && /^(?:rm|unlink)$/i.test(command)) {
    const recursive = words.some((word) => /^-(?=.*r)(?=.*f)[a-z]+$/i.test(word) || /^--recursive$/i.test(word));
    const targets = words.slice(1).filter((word) => !word.startsWith("-"));
    if (recursive && targets.some(isBroadTarget)) return deletionBlock("Git Bash", targets.find(isBroadTarget) ?? "");
    if (recursive && targets.length === 0) return deletionBlock("Git Bash", "<implicit target>");
  }
  return undefined;
}

function inspectSql(words: readonly string[]): SecurityDecision {
  const executable = basename(words[0] ?? "").toLowerCase();
  if (!/^(?:psql|mysql|mariadb|sqlite3|sqlcmd)(?:\.exe)?$/.test(executable)) return allow;
  const marker = words.findIndex((word) => /^(?:-c|--command|--execute|-e)$/i.test(word));
  if (marker < 0) return allow;
  const sql = words.slice(marker + 1).join(" ");
  const normalized = stripSqlComments(sql).replace(/;\s*$/, "").trim();
  const destructive = /\b(?:drop|truncate)\s+(?:table|database|schema|index|view|sequence|function|procedure|trigger|role|user)\b/i.test(normalized)
    || /\bdelete\s+from\s+[\w."`\[\]-]+\s*(?:;|$)/i.test(normalized)
    || /\bupdate\s+[\w."`\[\]-]+\s+set\b[\s\S]*?(?:;|$)/i.test(normalized) && !/\bwhere\b/i.test(normalized);
  return destructive
    ? { action: "block", rule: "destructive-sql", reason: "The SQL statement may destroy database objects or affect every row; inspect and scope it before re-submitting." }
    : allow;
}

function tokenize(command: string, shell: SupportedShell): Token[] | undefined {
  const result: Token[] = [];
  let value = "";
  let quote: "'" | '"' | undefined;
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < command.length; index += 1) {
    const char = command[index] ?? "";
    if (escaped) { value += char; escaped = false; continue; }
    if (shell !== "powershell" && char === "\\" && quote !== "'" && /[\s'"\\]/.test(command[index + 1] ?? "")) {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = undefined;
      else value += char;
      continue;
    }
    if (char === "'" || char === '"') { quote = char; quoted = true; continue; }
    if (/\s/.test(char)) {
      if (value) { result.push({ value, quoted }); value = ""; quoted = false; }
      continue;
    }
    value += char;
  }
  if (escaped) value += "\\";
  if (quote) return undefined;
  if (value) result.push({ value, quoted });
  return result;
}

function splitCommands(tokens: readonly Token[]): Token[][] {
  const groups: Token[][] = [[]];
  for (const token of tokens) {
    if ([";", "&&", "||", "&"].includes(token.value) && !token.quoted) groups.push([]);
    else groups[groups.length - 1]?.push(token);
  }
  return groups;
}

function isBroadTarget(target: string): boolean {
  const value = target.replace(/["']/g, "").replace(/\\/g, "/").trim();
  return /^(?:\/|\*|\.\/\*|\.\.\/\*|[a-z]:\/?|[a-z]:\/?(?:\*|\.\*)?)$/i.test(value)
    || /^(?:[a-z]:\/)?(?:\*|\.\*)$/i.test(value)
    || /^(?:[a-z]:\/)?(?:windows|system32|users|program files)\/?$/i.test(value);
}

function deletionBlock(shellName: string, target: string): SecurityDecision {
  return { action: "block", rule: "broad-file-deletion", reason: `${shellName} recursive deletion targets a filesystem root, broad wildcard, or protected system directory (${target}); narrow the target and re-submit.` };
}

function basename(path: string): string { return path.split(/[\\/]/).at(-1) ?? path; }

function stripSqlComments(sql: string): string {
  return sql.replace(/--[^\r\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
}
