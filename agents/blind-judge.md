# Blind-Judge Idea Evaluation

The blind-judge workflow evaluates an idea with isolated adversarial groups and five independent neutral evaluators. It produces an auditable verdict with explicit uncertainty. It supports a decision; it does not guarantee that the idea is correct.

## When to use it

Use it when the decision is consequential, evidence exists, and disagreement is useful: adopting a feature, choosing an architecture direction, or committing to a product bet.

Do not use it for code review, execution planning, or decisions that are already made. Code review belongs to the reviewer and Judgment Day workflows.

## Roles

| Role | Count | What it sees | What it produces |
|------|-------|--------------|------------------|
| Pro judge | At least 1; default 3 | Idea, evidence bundle, pro instruction, own judge id | Strongest evidence-grounded case for the idea |
| Con judge | At least 1; default 3 | Idea, evidence bundle, con instruction, own judge id | Strongest evidence-grounded case against the idea |
| Neutral evaluator | Exactly 5 | Idea, evidence bundle, neutral instruction, own judge id | One independent `adopt`, `reject`, or `defer` vote |

Pro and con groups never receive each other's arguments, identities, or outputs. Neutral evaluators never receive pro or con arguments before voting. The engine builds separate frozen contexts for every judge.

## Evidence

Every evidence item requires:

| Field | Rule |
|-------|------|
| `id` | Unique within the bundle. |
| `claim` | Non-empty statement being evaluated. |
| `source` | Non-empty origin: link, file, ticket, observation record, or named assumption owner. |
| `kind` | `fact`, `observation`, `constraint`, `assumption`, or `testimony`. |
| `retrievedAt` | Optional timestamp. |

Assumptions are allowed only when labeled `assumption` and given a source that names who owns the assumption. Unsourced claims are not evidence.

## Input schema

```ts
interface JudgmentInput {
  idea: {
    title: string;
    statement: string;
    constraints?: string[];
  };
  evidence: EvidenceItem[];
}
```

The engine normalizes strings, sorts evidence by id, rejects duplicate ids, and hashes the normalized input. The same normalized input produces the same `inputHash` and `evidenceHash`.

## Output schema

```ts
interface JudgmentResult {
  schemaVersion: 1;
  evaluatedAt: string;
  status: "complete" | "partial";
  pro: ArgumentAssessment[];
  con: ArgumentAssessment[];
  votes: NeutralVote[];
  synthesis: JudgmentSynthesis;
  audit: JudgmentAudit;
}
```

`ArgumentAssessment` records the judge id, role, conclusion (`strong`, `weak`, or `mixed`), confidence, arguments, evidence references, assumptions, and unknowns.

`NeutralVote` records the judge id, vote (`adopt`, `reject`, or `defer`), confidence, rationale, evidence references, conditions, and risks.

The synthesis records:

- `verdict`, `confidence`, `agreement`, and `quorum`;
- `disagreement` with each dissenting judge id, vote, and rationale;
- `uncertainty` lines for partial evaluation, low confidence, ties, and correlated risks;
- `evidenceRefs`, `conditions`, `strongestPro`, and `strongestCon`;
- `limitations`, including the decision-support caveat.

The audit records input and evidence hashes, isolation counts, missing and invalid assessments, correlated-risk signals, and the models reported by neutral evaluators.

## Execution

1. **Normalize.** Validate the idea and evidence; reject unsafe or ambiguous input before any judge runs.
2. **Isolate.** Build separate contexts for pro, con, and neutral judges. No context contains another group's output or identities.
3. **Run.** Execute the groups concurrently. A thrown executor is `missing`; a malformed output is `invalid`.
4. **Collect.** Keep only valid outputs in the result arrays. Record every missing or invalid assessment in the audit.
5. **Synthesize.** Count valid neutral votes and apply the quorum and majority rules.
6. **Report.** Return the full result, including dissent and uncertainty.

## Quorum, majority, and confidence

- Exactly five neutral evaluators are required.
- Quorum is three valid votes.
- A verdict needs at least `floor(validVotes / 2) + 1` votes for `adopt` or `reject`. Otherwise the verdict is `defer`.
- A tie or divided vote therefore produces `defer`, not a forced decision.
- Confidence is bounded to `0..1`: `agreement × average confidence of the matching votes × penalties`.
- Missing or invalid assessments apply a `0.7` penalty. Correlated reasoning risks apply a `0.8` penalty. Below quorum, confidence is `0`.
- The result always states the vote split, the valid-vote count, and the reason for a `defer`.

## Correlated reasoning risks

The engine detects:

| Signal | Meaning |
|--------|---------|
| `shared-model` | More than one neutral evaluator reports the same explicit model. |
| `duplicate-rationale` | Two or more neutral votes normalize to the same rationale. |
| `single-evidence-dependence` | All valid votes cite the same single evidence item. |

These signals do not invalidate the votes. They reduce confidence and appear in `uncertainty` so a human can judge whether the agreement is independent.

## Repeatability and auditability

- The synthesis is deterministic for the same normalized input and executor outputs.
- The clock is injectable, so tests can compare complete results.
- Input and evidence hashes make the evaluated bundle identifiable.
- Missing and invalid assessments remain visible; they are never silently repaired.
- The result includes dissenting rationales and the strongest arguments from both sides.

## Limits

- Context isolation is enforced by the engine; it is not a process sandbox. A hostile executor can still read ambient process state.
- The engine does not call an AI provider. Executors are supplied by the caller; the skill describes how an agent should orchestrate them.
- There is no standalone CLI command for the judgment engine itself. The workflow catalog exposes the idea path as `workflow:command --id=new-idea` and the OpenCode `/new-idea` command; the engine still requires caller-supplied executors.
- A verdict is decision support. It is not proof, a security guarantee, or a substitute for domain expertise.
- Five evaluators can still share blind spots. Correlated-risk signals are heuristics, not proof of independence.

## References

- [`skills/blind-judge/SKILL.md`](../skills/blind-judge/SKILL.md)
- [`src/core/judgment/judgment-contracts.ts`](../src/core/judgment/judgment-contracts.ts)
- [`src/core/judgment/judgment-engine.ts`](../src/core/judgment/judgment-engine.ts)
- [`docs/roadmap.md`](../docs/roadmap.md)
