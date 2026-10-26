import assert from "node:assert/strict";
import test from "node:test";

import type {
  ArgumentAssessment,
  EvidenceItem,
  JudgeContext,
  JudgeExecutor,
  JudgmentGroups,
  JudgmentInput,
  NeutralVote
} from "../../src/core/judgment/judgment-contracts.js";
import { evaluateIdea } from "../../src/core/judgment/judgment-engine.js";

const fixedNow = () => new Date("2026-10-21T12:00:00.000Z");

function idea() {
  return {
    title: "Adopt the new onboarding flow",
    statement: "Replace the current onboarding with a guided three-step flow.",
    constraints: ["Ship within two sprints"]
  };
}

function evidence(): EvidenceItem[] {
  return [
    { id: "e1", claim: "Support tickets mention onboarding confusion.", source: "support export 2026-10", kind: "fact" },
    { id: "e2", claim: "The guided flow needs one new service.", source: "architecture review", kind: "observation" },
    { id: "e3", claim: "The team has capacity next sprint.", source: "sprint plan", kind: "assumption" }
  ];
}

function input(items: EvidenceItem[] = evidence()): JudgmentInput {
  return { idea: idea(), evidence: items };
}

function assessment(context: JudgeContext, conclusion: "strong" | "weak" | "mixed" = "strong"): ArgumentAssessment {
  return {
    judgeId: context.judgeId,
    role: context.role === "con" ? "con" : "pro",
    conclusion,
    confidence: 0.8,
    arguments: context.role === "con" ? ["Con argument"] : ["Pro argument"],
    evidenceRefs: ["e1"],
    assumptions: [],
    unknowns: []
  };
}

function vote(context: JudgeContext, value: NeutralVote["vote"] = "adopt", confidence = 0.8): NeutralVote {
  return {
    judgeId: context.judgeId,
    vote: value,
    confidence,
    rationale: `Neutral rationale from ${context.judgeId}.`,
    evidenceRefs: ["e1"],
    conditions: [],
    risks: []
  };
}

function executor(id: string, model: string, run: (context: JudgeContext) => unknown): JudgeExecutor {
  return { id, model, execute: async (context) => run(context) };
}

function validGroups(neutralOverrides: Array<(context: JudgeContext) => unknown> = []): JudgmentGroups {
  return {
    pro: [
      executor("pro-1", "pro-model", (context) => assessment(context)),
      executor("pro-2", "pro-model", (context) => assessment(context)),
      executor("pro-3", "pro-model", (context) => assessment(context))
    ],
    con: [
      executor("con-1", "con-model", (context) => assessment(context, "weak")),
      executor("con-2", "con-model", (context) => assessment(context, "weak")),
      executor("con-3", "con-model", (context) => assessment(context, "weak"))
    ],
    neutral: Array.from({ length: 5 }, (_, index) => {
      const id = `neutral-${index + 1}`;
      const override = neutralOverrides[index];
      return executor(id, `neutral-model-${index + 1}`, override ?? ((context) => vote(context)));
    })
  };
}

test("pro and con groups are isolated and neutral evaluators share one evidence bundle", async () => {
  const captured: JudgeContext[] = [];
  const groups: JudgmentGroups = {
    pro: [
      executor("pro-1", "pro-model", (context) => {
        captured.push(context);
        return assessment(context);
      })
    ],
    con: [
      executor("con-1", "con-model", (context) => {
        captured.push(context);
        return assessment(context, "weak");
      })
    ],
    neutral: Array.from({ length: 5 }, (_, index) =>
      executor(`neutral-${index + 1}`, `neutral-model-${index + 1}`, (context) => {
        captured.push(context);
        return vote(context);
      })
    )
  };

  const result = await evaluateIdea(input(), groups, { now: fixedNow });

  const proContext = captured.find((context) => context.role === "pro");
  const conContext = captured.find((context) => context.role === "con");
  const neutralContexts = captured.filter((context) => context.role === "neutral");
  assert.ok(proContext);
  assert.ok(conContext);
  assert.equal(neutralContexts.length, 5);

  assert.equal(JSON.stringify(proContext).includes("con-1"), false);
  assert.equal(JSON.stringify(proContext).includes("Con argument"), false);
  assert.equal(JSON.stringify(conContext).includes("pro-1"), false);
  assert.equal(JSON.stringify(conContext).includes("Pro argument"), false);
  assert.equal(JSON.stringify(neutralContexts).includes("Pro argument"), false);
  assert.equal(JSON.stringify(neutralContexts).includes("Con argument"), false);
  assert.equal(JSON.stringify(neutralContexts).includes("pro-1"), false);
  assert.equal(JSON.stringify(neutralContexts).includes("con-1"), false);
  assert.equal(new Set(neutralContexts.map((context) => context.evidenceHash)).size, 1);
  assert.deepEqual(neutralContexts[0]?.evidence, neutralContexts[4]?.evidence);
  assert.equal(result.audit.isolation.crossGroupExposure, false);
  assert.equal(result.audit.isolation.neutralSawArguments, false);
  assert.equal(result.audit.isolation.proContexts, 1);
  assert.equal(result.audit.isolation.conContexts, 1);
  assert.equal(result.audit.isolation.neutralContexts, 5);
});

test("a strict majority produces a bounded adopt verdict with recorded dissent", async () => {
  const groups = validGroups([
    (context) => vote(context, "adopt", 0.9),
    (context) => vote(context, "adopt", 0.8),
    (context) => vote(context, "adopt", 0.7),
    (context) => vote(context, "reject", 0.6),
    (context) => vote(context, "reject", 0.5)
  ]);

  const result = await evaluateIdea(input(), groups, { now: fixedNow });

  assert.equal(result.status, "complete");
  assert.equal(result.votes.length, 5);
  assert.equal(result.pro.length, 3);
  assert.equal(result.con.length, 3);
  assert.equal(result.synthesis.verdict, "adopt");
  assert.equal(result.synthesis.agreement, 0.6);
  assert.deepEqual(result.synthesis.quorum, { valid: 5, required: 3, total: 5 });
  assert.equal(result.synthesis.disagreement.length, 2);
  assert.ok(result.synthesis.confidence > 0 && result.synthesis.confidence <= 1);
  assert.ok(result.synthesis.strongestPro.length > 0);
  assert.ok(result.synthesis.strongestCon.length > 0);
  assert.ok(result.synthesis.limitations.some((line) => /does not guarantee/i.test(line)));
  assert.deepEqual(result.synthesis.evidenceRefs, ["e1"]);
});

test("a tie produces defer and states that no majority exists", async () => {
  const groups = validGroups([
    (context) => vote(context, "adopt", 0.9),
    (context) => vote(context, "adopt", 0.8),
    (context) => vote(context, "reject", 0.8),
    (context) => vote(context, "reject", 0.7),
    (context) => vote(context, "defer", 0.6)
  ]);

  const result = await evaluateIdea(input(), groups, { now: fixedNow });

  assert.equal(result.synthesis.verdict, "defer");
  assert.ok(result.synthesis.uncertainty.some((line) => /no majority/i.test(line)));
  assert.ok(result.synthesis.confidence < 0.5);
  assert.equal(result.synthesis.disagreement.length, 4);
  assert.ok(result.synthesis.disagreement.some((item) => item.vote === "adopt"));
  assert.ok(result.synthesis.disagreement.some((item) => item.vote === "reject"));
});

test("missing and invalid votes are audited, never repaired, and force defer below quorum", async () => {
  const groups = validGroups([
    () => {
      throw new Error("judge timed out");
    },
    (context) => ({ ...vote(context), vote: "maybe" }),
    (context) => ({ ...vote(context), confidence: 2 }),
    (context) => ({ ...vote(context), evidenceRefs: ["missing-evidence"] }),
    (context) => vote(context, "adopt", 0.9)
  ]);

  const result = await evaluateIdea(input(), groups, { now: fixedNow });

  assert.equal(result.status, "partial");
  assert.equal(result.votes.length, 1);
  assert.equal(result.audit.missing.length, 1);
  assert.equal(result.audit.missing[0]?.judgeId, "neutral-1");
  assert.match(result.audit.missing[0]?.reason ?? "", /timed out/);
  assert.deepEqual(result.audit.invalid.map((item) => item.judgeId), ["neutral-2", "neutral-3", "neutral-4"]);
  assert.equal(result.synthesis.verdict, "defer");
  assert.deepEqual(result.synthesis.quorum, { valid: 1, required: 3, total: 5 });
  assert.ok(result.synthesis.uncertainty.some((line) => /insufficient quorum/i.test(line)));
  assert.ok(result.synthesis.uncertainty.some((line) => /partial evaluation/i.test(line)));
});

test("correlated reasoning risks are detected and reduce confidence", async () => {
  const groups: JudgmentGroups = {
    ...validGroups(),
    neutral: Array.from({ length: 5 }, (_, index) =>
      executor(`neutral-${index + 1}`, "shared-model", (context) => ({
        ...vote(context, "adopt", 0.9),
        rationale: "The evidence is sufficient.",
        evidenceRefs: ["e1"]
      }))
    )
  };

  const result = await evaluateIdea(input(), groups, { now: fixedNow });

  assert.equal(result.status, "complete");
  assert.ok(result.audit.correlatedRisks.includes("shared-model"));
  assert.ok(result.audit.correlatedRisks.includes("duplicate-rationale"));
  assert.ok(result.audit.correlatedRisks.includes("single-evidence-dependence"));
  assert.equal(result.audit.models["shared-model"], 5);
  assert.ok(result.synthesis.confidence < 0.9);
  assert.ok(result.synthesis.uncertainty.some((line) => /correlated reasoning risk/i.test(line)));
});

test("the same normalized input and deterministic executors produce the same result", async () => {
  const first = await evaluateIdea(input([evidence()[2]!, evidence()[0]!, evidence()[1]!]), validGroups(), { now: fixedNow });
  const second = await evaluateIdea(input([evidence()[1]!, evidence()[2]!, evidence()[0]!]), validGroups(), { now: fixedNow });

  assert.deepEqual(first, second);
  assert.equal(first.audit.inputHash, second.audit.inputHash);
  assert.equal(first.audit.evidenceHash, second.audit.evidenceHash);
  assert.equal(first.evaluatedAt, "2026-10-21T12:00:00.000Z");
});

test("input and executor validation rejects ambiguous or unsafe configurations", async () => {
  const duplicateEvidence = [
    { id: "e1", claim: "First", source: "source-a", kind: "fact" as const },
    { id: "e1", claim: "Second", source: "source-b", kind: "fact" as const }
  ];
  await assert.rejects(evaluateIdea(input(duplicateEvidence), validGroups(), { now: fixedNow }), /unique/i);

  const missingSource = [{ id: "e1", claim: "No source", source: "", kind: "fact" as const }];
  await assert.rejects(evaluateIdea(input(missingSource), validGroups(), { now: fixedNow }), /source/i);

  const unsupportedKind = [{ id: "e1", claim: "Claim", source: "source", kind: "rumor" as never }];
  await assert.rejects(evaluateIdea(input(unsupportedKind), validGroups(), { now: fixedNow }), /kind/i);

  const groups = validGroups();
  await assert.rejects(
    evaluateIdea(input(), { ...groups, neutral: groups.neutral.slice(0, 4) }, { now: fixedNow }),
    /five/i
  );

  await assert.rejects(
    evaluateIdea(input(), { ...groups, con: [...groups.con, groups.pro[0]!] }, { now: fixedNow }),
    /unique/i
  );
});
