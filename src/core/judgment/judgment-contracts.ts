export const neutralEvaluatorCount = 5;
export const defaultMinimumNeutralQuorum = 3;
export const judgmentSchemaVersion = 1;

export type JudgeRole = "pro" | "con" | "neutral";
export type EvidenceKind = "fact" | "observation" | "constraint" | "assumption" | "testimony";

export interface JudgmentIdea {
  readonly title: string;
  readonly statement: string;
  readonly constraints?: ReadonlyArray<string>;
}

export interface EvidenceItem {
  readonly id: string;
  readonly claim: string;
  readonly source: string;
  readonly kind: EvidenceKind;
  readonly retrievedAt?: string;
}

export interface JudgmentInput {
  readonly idea: JudgmentIdea;
  readonly evidence: ReadonlyArray<EvidenceItem>;
}

export interface JudgeContext {
  readonly judgeId: string;
  readonly role: JudgeRole;
  readonly slot: number;
  readonly idea: JudgmentIdea;
  readonly evidence: ReadonlyArray<EvidenceItem>;
  readonly evidenceHash: string;
  readonly instructions: string;
}

export interface JudgeExecutor {
  readonly id: string;
  readonly model?: string;
  execute(context: JudgeContext): Promise<unknown>;
}

export interface JudgmentGroups {
  readonly pro: ReadonlyArray<JudgeExecutor>;
  readonly con: ReadonlyArray<JudgeExecutor>;
  readonly neutral: ReadonlyArray<JudgeExecutor>;
}

export type AssessmentConclusion = "strong" | "weak" | "mixed";

export interface ArgumentAssessment {
  readonly judgeId: string;
  readonly role: "pro" | "con";
  readonly conclusion: AssessmentConclusion;
  readonly confidence: number;
  readonly arguments: ReadonlyArray<string>;
  readonly evidenceRefs: ReadonlyArray<string>;
  readonly assumptions: ReadonlyArray<string>;
  readonly unknowns: ReadonlyArray<string>;
}

export type NeutralVoteValue = "adopt" | "reject" | "defer";

export interface NeutralVote {
  readonly judgeId: string;
  readonly vote: NeutralVoteValue;
  readonly confidence: number;
  readonly rationale: string;
  readonly evidenceRefs: ReadonlyArray<string>;
  readonly conditions: ReadonlyArray<string>;
  readonly risks: ReadonlyArray<string>;
}

export interface JudgmentIssue {
  readonly judgeId: string;
  readonly role: JudgeRole;
  readonly reason: string;
}

export interface JudgmentDisagreement {
  readonly judgeId: string;
  readonly vote: NeutralVoteValue;
  readonly rationale: string;
}

export interface JudgmentQuorum {
  readonly valid: number;
  readonly required: number;
  readonly total: number;
}

export interface JudgmentSynthesis {
  readonly verdict: NeutralVoteValue;
  readonly confidence: number;
  readonly agreement: number;
  readonly quorum: JudgmentQuorum;
  readonly disagreement: ReadonlyArray<JudgmentDisagreement>;
  readonly uncertainty: ReadonlyArray<string>;
  readonly evidenceRefs: ReadonlyArray<string>;
  readonly strongestPro: ReadonlyArray<string>;
  readonly strongestCon: ReadonlyArray<string>;
  readonly conditions: ReadonlyArray<string>;
  readonly limitations: ReadonlyArray<string>;
}

export interface JudgmentIsolation {
  readonly proContexts: number;
  readonly conContexts: number;
  readonly neutralContexts: number;
  readonly crossGroupExposure: false;
  readonly neutralSawArguments: false;
}

export interface JudgmentAudit {
  readonly inputHash: string;
  readonly evidenceHash: string;
  readonly isolation: JudgmentIsolation;
  readonly missing: ReadonlyArray<JudgmentIssue>;
  readonly invalid: ReadonlyArray<JudgmentIssue>;
  readonly correlatedRisks: ReadonlyArray<string>;
  readonly models: Readonly<Record<string, number>>;
}

export interface JudgmentResult {
  readonly schemaVersion: 1;
  readonly evaluatedAt: string;
  readonly status: "complete" | "partial";
  readonly pro: ReadonlyArray<ArgumentAssessment>;
  readonly con: ReadonlyArray<ArgumentAssessment>;
  readonly votes: ReadonlyArray<NeutralVote>;
  readonly synthesis: JudgmentSynthesis;
  readonly audit: JudgmentAudit;
}

export interface JudgmentOptions {
  readonly now?: () => Date;
  readonly minimumQuorum?: number;
}

export const evidenceKinds: ReadonlyArray<EvidenceKind> = [
  "fact",
  "observation",
  "constraint",
  "assumption",
  "testimony"
];

export const judgeRoleInstructions: Readonly<Record<JudgeRole, string>> = {
  pro: "Argue the strongest evidence-grounded case in favor of the idea. You see only the idea, the evidence bundle, and your own judge id. Do not assume, request, or reference any other judge group's arguments or identities.",
  con: "Argue the strongest evidence-grounded case against the idea. You see only the idea, the evidence bundle, and your own judge id. Do not assume, request, or reference any other judge group's arguments or identities.",
  neutral:
    "Evaluate the idea using only the idea and the evidence bundle. No pro or con arguments are provided. Vote adopt, reject, or defer. Cite evidence ids, state conditions, and name risks. Your vote is independent and must not be coordinated with any other evaluator."
};
