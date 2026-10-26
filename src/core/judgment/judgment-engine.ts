import { createHash } from "node:crypto";

import {
  defaultMinimumNeutralQuorum,
  evidenceKinds,
  judgeRoleInstructions,
  judgmentSchemaVersion,
  neutralEvaluatorCount,
  type ArgumentAssessment,
  type AssessmentConclusion,
  type EvidenceItem,
  type EvidenceKind,
  type JudgeContext,
  type JudgeExecutor,
  type JudgeRole,
  type JudgmentAudit,
  type JudgmentGroups,
  type JudgmentInput,
  type JudgmentIssue,
  type JudgmentOptions,
  type JudgmentResult,
  type JudgmentSynthesis,
  type NeutralVote,
  type NeutralVoteValue
} from "./judgment-contracts.js";

type ParseResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string };

type RunResult<T> =
  | { readonly status: "ok"; readonly value: T }
  | {
      readonly status: "missing" | "invalid";
      readonly judgeId: string;
      readonly role: JudgeRole;
      readonly reason: string;
    };

/**
 * Runs the blind-judge protocol. Isolation is enforced by constructing
 * separate frozen contexts: pro and con never see each other's output, and
 * neutral evaluators see only the idea and the evidence bundle.
 */
export async function evaluateIdea(
  input: JudgmentInput,
  groups: JudgmentGroups,
  options: JudgmentOptions = {}
): Promise<JudgmentResult> {
  const normalized = normalizeInput(input);
  const minimumQuorum = options.minimumQuorum ?? defaultMinimumNeutralQuorum;
  validateGroups(groups, minimumQuorum);

  const evidenceHash = hashValue(normalized.evidence);
  const inputHash = hashValue(normalized);

  const proContexts = groups.pro.map((_, index) => makeContext("pro", index + 1, normalized, evidenceHash));
  const conContexts = groups.con.map((_, index) => makeContext("con", index + 1, normalized, evidenceHash));
  const neutralContexts = groups.neutral.map((_, index) => makeContext("neutral", index + 1, normalized, evidenceHash));

  const [proRuns, conRuns, neutralRuns] = await Promise.all([
    Promise.all(groups.pro.map((executor, index) => runAssessment(executor, proContexts[index]!))),
    Promise.all(groups.con.map((executor, index) => runAssessment(executor, conContexts[index]!))),
    Promise.all(groups.neutral.map((executor, index) => runVote(executor, neutralContexts[index]!)))
  ]);

  const pro = proRuns.filter((run): run is Extract<RunResult<ArgumentAssessment>, { status: "ok" }> => run.status === "ok").map((run) => run.value);
  const con = conRuns.filter((run): run is Extract<RunResult<ArgumentAssessment>, { status: "ok" }> => run.status === "ok").map((run) => run.value);
  const votes = neutralRuns.filter((run): run is Extract<RunResult<NeutralVote>, { status: "ok" }> => run.status === "ok").map((run) => run.value);

  const allRuns: ReadonlyArray<RunResult<ArgumentAssessment> | RunResult<NeutralVote>> = [...proRuns, ...conRuns, ...neutralRuns];
  const missing = allRuns.flatMap((run): JudgmentIssue[] =>
    run.status === "missing" ? [{ judgeId: run.judgeId, role: run.role, reason: run.reason }] : []
  );
  const invalid = allRuns.flatMap((run): JudgmentIssue[] =>
    run.status === "invalid" ? [{ judgeId: run.judgeId, role: run.role, reason: run.reason }] : []
  );

  const correlated = detectCorrelatedRisks(groups, votes);
  const status = missing.length === 0 && invalid.length === 0 ? "complete" : "partial";
  const synthesis = synthesize(pro, con, votes, minimumQuorum, missing, invalid, correlated.risks);

  const audit: JudgmentAudit = {
    inputHash,
    evidenceHash,
    isolation: {
      proContexts: proContexts.length,
      conContexts: conContexts.length,
      neutralContexts: neutralContexts.length,
      crossGroupExposure: false,
      neutralSawArguments: false
    },
    missing,
    invalid,
    correlatedRisks: correlated.risks,
    models: correlated.models
  };

  return {
    schemaVersion: judgmentSchemaVersion,
    evaluatedAt: (options.now ?? (() => new Date()))().toISOString(),
    status,
    pro,
    con,
    votes,
    synthesis,
    audit
  };
}

function makeContext(role: JudgeRole, slot: number, input: JudgmentInput, evidenceHash: string): JudgeContext {
  return deepFreeze({
    judgeId: `${role}-${slot}`,
    role,
    slot,
    idea: input.idea,
    evidence: input.evidence,
    evidenceHash,
    instructions: judgeRoleInstructions[role]
  });
}

async function runAssessment(executor: JudgeExecutor, context: JudgeContext): Promise<RunResult<ArgumentAssessment>> {
  try {
    const raw = await executor.execute(context);
    if (raw === null || raw === undefined) {
      return { status: "missing", judgeId: context.judgeId, role: context.role, reason: "executor returned no assessment" };
    }
    const parsed = parseAssessment(raw, context);
    if (!parsed.ok) return { status: "invalid", judgeId: context.judgeId, role: context.role, reason: parsed.reason };
    return { status: "ok", value: parsed.value };
  } catch (error) {
    return { status: "missing", judgeId: context.judgeId, role: context.role, reason: message(error) };
  }
}

async function runVote(executor: JudgeExecutor, context: JudgeContext): Promise<RunResult<NeutralVote>> {
  try {
    const raw = await executor.execute(context);
    if (raw === null || raw === undefined) {
      return { status: "missing", judgeId: context.judgeId, role: context.role, reason: "executor returned no vote" };
    }
    const parsed = parseVote(raw, context);
    if (!parsed.ok) return { status: "invalid", judgeId: context.judgeId, role: context.role, reason: parsed.reason };
    return { status: "ok", value: parsed.value };
  } catch (error) {
    return { status: "missing", judgeId: context.judgeId, role: context.role, reason: message(error) };
  }
}

function parseAssessment(raw: unknown, context: JudgeContext): ParseResult<ArgumentAssessment> {
  if (!isRecord(raw)) return invalid("assessment must be an object");
  if (raw.judgeId !== context.judgeId) return invalid("judgeId does not match the assigned judge");
  if (context.role !== "pro" && context.role !== "con") return invalid("assessment context must be pro or con");
  if (raw.role !== context.role) return invalid("role does not match the assigned judge role");
  const conclusion = raw.conclusion;
  if (conclusion !== "strong" && conclusion !== "weak" && conclusion !== "mixed") {
    return invalid("conclusion must be strong, weak, or mixed");
  }
  if (!isConfidence(raw.confidence)) return invalid("confidence must be a number between 0 and 1");
  const argumentsResult = parseStringArray(raw.arguments, "arguments", true);
  if (!argumentsResult.ok) return argumentsResult;
  const evidenceRefs = parseEvidenceRefs(raw.evidenceRefs, context);
  if (!evidenceRefs.ok) return evidenceRefs;
  const assumptions = parseStringArray(raw.assumptions, "assumptions", false);
  if (!assumptions.ok) return assumptions;
  const unknowns = parseStringArray(raw.unknowns, "unknowns", false);
  if (!unknowns.ok) return unknowns;

  return {
    ok: true,
    value: {
      judgeId: context.judgeId,
      role: context.role,
      conclusion: conclusion as AssessmentConclusion,
      confidence: raw.confidence,
      arguments: argumentsResult.value,
      evidenceRefs: evidenceRefs.value,
      assumptions: assumptions.value,
      unknowns: unknowns.value
    }
  };
}

function parseVote(raw: unknown, context: JudgeContext): ParseResult<NeutralVote> {
  if (!isRecord(raw)) return invalid("vote must be an object");
  if (raw.judgeId !== context.judgeId) return invalid("judgeId does not match the assigned judge");
  const vote = raw.vote;
  if (vote !== "adopt" && vote !== "reject" && vote !== "defer") {
    return invalid("vote must be adopt, reject, or defer");
  }
  if (!isConfidence(raw.confidence)) return invalid("confidence must be a number between 0 and 1");
  if (typeof raw.rationale !== "string" || raw.rationale.trim().length === 0) {
    return invalid("rationale must be a non-empty string");
  }
  const evidenceRefs = parseEvidenceRefs(raw.evidenceRefs, context);
  if (!evidenceRefs.ok) return evidenceRefs;
  const conditions = parseStringArray(raw.conditions, "conditions", false);
  if (!conditions.ok) return conditions;
  const risks = parseStringArray(raw.risks, "risks", false);
  if (!risks.ok) return risks;

  return {
    ok: true,
    value: {
      judgeId: context.judgeId,
      vote,
      confidence: raw.confidence,
      rationale: raw.rationale.trim(),
      evidenceRefs: evidenceRefs.value,
      conditions: conditions.value,
      risks: risks.value
    }
  };
}

function parseStringArray(value: unknown, field: string, requireNonEmpty: boolean): ParseResult<ReadonlyArray<string>> {
  if (!Array.isArray(value)) return invalid(`${field} must be an array of strings`);
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item.trim().length === 0) return invalid(`${field} must contain non-empty strings`);
    result.push(item.trim());
  }
  if (requireNonEmpty && result.length === 0) return invalid(`${field} must contain at least one item`);
  return { ok: true, value: result };
}

function parseEvidenceRefs(value: unknown, context: JudgeContext): ParseResult<ReadonlyArray<string>> {
  if (!Array.isArray(value)) return invalid("evidenceRefs must be an array of evidence ids");
  const known = new Set(context.evidence.map((item) => item.id));
  const refs: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item.trim().length === 0) return invalid("evidenceRefs must contain non-empty ids");
    const id = item.trim();
    if (!known.has(id)) return invalid(`unknown evidence id: ${id}`);
    refs.push(id);
  }
  return { ok: true, value: [...new Set(refs)].sort((left, right) => left.localeCompare(right)) };
}

function synthesize(
  pro: ReadonlyArray<ArgumentAssessment>,
  con: ReadonlyArray<ArgumentAssessment>,
  votes: ReadonlyArray<NeutralVote>,
  minimumQuorum: number,
  missing: ReadonlyArray<JudgmentIssue>,
  invalid: ReadonlyArray<JudgmentIssue>,
  correlatedRisks: ReadonlyArray<string>
): JudgmentSynthesis {
  const counts: Record<NeutralVoteValue, number> = { adopt: 0, reject: 0, defer: 0 };
  for (const vote of votes) counts[vote.vote] += 1;

  const valid = votes.length;
  const quorumMet = valid >= minimumQuorum;
  const majority = valid === 0 ? 0 : Math.floor(valid / 2) + 1;
  let verdict: NeutralVoteValue = "defer";
  if (quorumMet) {
    if (counts.adopt >= majority) verdict = "adopt";
    else if (counts.reject >= majority) verdict = "reject";
  }

  const matchingVotes = votes.filter((vote) => vote.vote === verdict);
  const maxCount = Math.max(counts.adopt, counts.reject, counts.defer);
  const agreement = valid === 0 ? 0 : quorumMet ? matchingVotes.length / valid : maxCount / valid;
  const averageConfidence = matchingVotes.length === 0
    ? 0
    : matchingVotes.reduce((total, vote) => total + vote.confidence, 0) / matchingVotes.length;
  const penalty = (missing.length + invalid.length > 0 ? 0.7 : 1) * (correlatedRisks.length > 0 ? 0.8 : 1);
  const confidence = quorumMet ? round(clamp(agreement * averageConfidence * penalty, 0, 1), 2) : 0;

  const uncertainty: string[] = [];
  if (!quorumMet) {
    uncertainty.push(`insufficient quorum: ${valid} of ${neutralEvaluatorCount} valid votes; at least ${minimumQuorum} required`);
  } else if (verdict === "defer") {
    if (counts.defer === valid) {
      uncertainty.push("all valid neutral votes deferred");
    } else {
      uncertainty.push(`no majority: adopt ${counts.adopt}, reject ${counts.reject}, defer ${counts.defer}`);
    }
  }
  if (valid < neutralEvaluatorCount) uncertainty.push(`only ${valid} of ${neutralEvaluatorCount} neutral votes were valid`);
  if (missing.length + invalid.length > 0) {
    uncertainty.push(`partial evaluation: ${missing.length} missing, ${invalid.length} invalid`);
  }
  if (correlatedRisks.length > 0) {
    uncertainty.push(`correlated reasoning risk: ${correlatedRisks.join(", ")}`);
  }
  const lowConfidence = votes.filter((vote) => vote.confidence < 0.6).length;
  if (lowConfidence > 0) uncertainty.push(`${lowConfidence} neutral vote(s) reported confidence below 0.6`);

  const limitations = [
    "This workflow supports a decision; it does not guarantee that the idea is correct.",
    "Neutral evaluators see only the idea and evidence bundle; pro and con arguments are recorded after voting and do not influence neutral votes."
  ];
  if (missing.length + invalid.length > 0) {
    limitations.push("Missing or invalid assessments reduce confidence and may force a defer verdict.");
  }
  if (correlatedRisks.length > 0) {
    limitations.push("Correlated reasoning risk was detected; treat agreement as weaker evidence.");
  }

  return {
    verdict,
    confidence,
    agreement: round(agreement, 2),
    quorum: { valid, required: minimumQuorum, total: neutralEvaluatorCount },
    disagreement: votes
      .filter((vote) => vote.vote !== verdict)
      .map((vote) => ({ judgeId: vote.judgeId, vote: vote.vote, rationale: vote.rationale })),
    uncertainty,
    evidenceRefs: uniqueStrings(votes.flatMap((vote) => vote.evidenceRefs)),
    strongestPro: strongestArguments(pro),
    strongestCon: strongestArguments(con),
    conditions: uniqueStrings(votes.flatMap((vote) => vote.conditions)),
    limitations
  };
}

function strongestArguments(assessments: ReadonlyArray<ArgumentAssessment>): ReadonlyArray<string> {
  const argumentsList = [...assessments]
    .sort((left, right) => right.confidence - left.confidence || left.judgeId.localeCompare(right.judgeId))
    .flatMap((assessment) => assessment.arguments);
  return [...new Set(argumentsList)].slice(0, 3);
}

function detectCorrelatedRisks(
  groups: JudgmentGroups,
  votes: ReadonlyArray<NeutralVote>
): { readonly risks: ReadonlyArray<string>; readonly models: Readonly<Record<string, number>> } {
  const models: Record<string, number> = {};
  const explicitModels = new Map<string, number>();
  for (const executor of groups.neutral) {
    const model = executor.model?.trim() || "unspecified";
    models[model] = (models[model] ?? 0) + 1;
    if (executor.model?.trim()) {
      const explicit = executor.model.trim();
      explicitModels.set(explicit, (explicitModels.get(explicit) ?? 0) + 1);
    }
  }

  const risks = new Set<string>();
  if ([...explicitModels.values()].some((count) => count > 1)) risks.add("shared-model");

  const rationales = new Map<string, number>();
  for (const vote of votes) {
    const normalized = normalizeText(vote.rationale);
    rationales.set(normalized, (rationales.get(normalized) ?? 0) + 1);
  }
  if ([...rationales.values()].some((count) => count > 1)) risks.add("duplicate-rationale");

  if (votes.length > 1) {
    const evidenceSets = new Set(votes.map((vote) => [...vote.evidenceRefs].sort().join("|")));
    if (evidenceSets.size === 1 && (votes[0]?.evidenceRefs.length ?? 0) <= 1) {
      risks.add("single-evidence-dependence");
    }
  }

  return {
    risks: [...risks].sort((left, right) => left.localeCompare(right)),
    models: Object.fromEntries(Object.entries(models).sort(([left], [right]) => left.localeCompare(right)))
  };
}

function validateGroups(groups: JudgmentGroups, minimumQuorum: number): void {
  if (!Number.isInteger(minimumQuorum) || minimumQuorum < 1 || minimumQuorum > neutralEvaluatorCount) {
    throw new Error(`minimumQuorum must be an integer between 1 and ${neutralEvaluatorCount}.`);
  }
  if (groups.pro.length === 0) throw new Error("At least one pro judge is required.");
  if (groups.con.length === 0) throw new Error("At least one con judge is required.");
  if (groups.neutral.length !== neutralEvaluatorCount) {
    throw new Error(`Exactly five neutral evaluators are required; received ${groups.neutral.length}.`);
  }

  const ids = new Set<string>();
  for (const executor of [...groups.pro, ...groups.con, ...groups.neutral]) {
    if (typeof executor.id !== "string" || executor.id.trim().length === 0) throw new Error("Every judge executor requires a non-empty id.");
    if (typeof executor.execute !== "function") throw new Error(`Judge executor ${executor.id} is missing execute().`);
    const id = executor.id.trim();
    if (ids.has(id)) throw new Error(`Judge executor ids must be unique: ${id}.`);
    ids.add(id);
  }
}

function normalizeInput(input: JudgmentInput): JudgmentInput {
  const value: unknown = input;
  if (!isRecord(value)) throw new Error("Judgment input must be an object.");
  const normalizedIdea = normalizeIdea(value.idea);
  if (!Array.isArray(value.evidence) || value.evidence.length === 0) {
    throw new Error("At least one evidence item is required.");
  }
  const evidence = value.evidence.map((item) => normalizeEvidence(item)).sort((left, right) => left.id.localeCompare(right.id));
  const ids = new Set<string>();
  for (const item of evidence) {
    if (ids.has(item.id)) throw new Error(`Evidence ids must be unique: ${item.id}.`);
    ids.add(item.id);
  }
  return deepFreeze({ idea: normalizedIdea, evidence });
}

function normalizeIdea(value: unknown): JudgmentInput["idea"] {
  if (!isRecord(value)) throw new Error("Idea must be an object.");
  const title = requireText(value.title, "Idea title");
  const statement = requireText(value.statement, "Idea statement");
  if (value.constraints === undefined) return { title, statement };
  if (!Array.isArray(value.constraints)) throw new Error("Idea constraints must be an array of strings.");
  const constraints = value.constraints.map((item, index) => requireText(item, `Idea constraint ${index + 1}`));
  return { title, statement, constraints };
}

function normalizeEvidence(value: unknown): EvidenceItem {
  if (!isRecord(value)) throw new Error("Every evidence item must be an object.");
  const id = requireText(value.id, "Evidence id");
  const claim = requireText(value.claim, `Evidence ${id} claim`);
  const source = requireText(value.source, `Evidence ${id} source`);
  const kind = value.kind;
  if (typeof kind !== "string" || !evidenceKinds.includes(kind as EvidenceKind)) {
    throw new Error(`Evidence ${id} has an unsupported kind: ${String(kind)}.`);
  }
  const base = { id, claim, source, kind: kind as EvidenceKind };
  if (value.retrievedAt === undefined) return base;
  return { ...base, retrievedAt: requireText(value.retrievedAt, `Evidence ${id} retrievedAt`) };
}

function requireText(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}

function hashValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function isConfidence(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(reason: string): ParseResult<never> {
  return { ok: false, reason };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function uniqueStrings(values: ReadonlyArray<string>): ReadonlyArray<string> {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as unknown as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}
