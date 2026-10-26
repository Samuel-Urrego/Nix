---
name: blind-judge
description: "Trigger: blind judge, idea evaluation, pro and con judges, neutral evaluators, bounded verdict. Evaluate an idea with isolated judges and an auditable synthesis."
license: Apache-2.0
metadata:
  author: "surre"
  version: "1.0"
---

## Activation Contract

Use this skill when a decision needs structured adversarial evaluation: whether to adopt an idea, feature, architecture, or product direction.

Do not use it for code review; `judgment-day` covers code changes. Do not use it when the decision is already made and only execution remains.

## Hard Rules

- Normalize one evidence bundle before any judge runs.
- Keep pro and con groups isolated: never pass one group's arguments, votes, or identities to the other.
- Run exactly five neutral evaluators. Each receives the same evidence bundle and no pro or con arguments.
- Do not reveal one neutral vote to another before all five have voted.
- Treat missing or invalid votes as audit data; never repair, infer, or replace them.
- Require at least three valid neutral votes. A verdict needs a strict majority; otherwise return `defer`.
- Cite evidence ids in every argument and vote. Label assumptions as assumptions.
- State uncertainty and dissent. Do not present the verdict as a correctness guarantee.

## Decision Gates

| Situation | Action |
|-----------|--------|
| Decision needs adversarial evaluation | Run the full blind-judge protocol |
| Evidence is missing or unsourced | Collect evidence first; do not judge |
| Fewer than three valid neutral votes | Return `defer` |
| Tie or no strict majority | Return `defer` with the vote split |
| Correlated rationales or shared model detected | Lower confidence and state the risk |
| Decision is already made | Skip; use execution workflows |
| Code change needs review | Use `judgment-day`, not this skill |

## Execution Steps

1. Normalize the idea, constraints, and evidence. Reject duplicate ids, empty claims, missing sources, and unsupported kinds.
2. Run the pro group and the con group in separate contexts. The documented default is three judges per group; at least one is required.
3. Run five neutral evaluators with the same idea and evidence bundle. Do not include pro or con output in their context.
4. Collect all outputs. Record thrown, missing, and schema-invalid results without changing them.
5. Synthesize the five votes: quorum, majority, agreement, confidence, dissent, evidence references, strongest pro and con arguments, conditions, correlated risks, and limitations.
6. Return the auditable result. State that it supports a decision and does not guarantee correctness.

## Output Contract

Return a `JudgmentResult`:

- `status`: `complete` or `partial`;
- `pro` and `con`: validated argument assessments;
- `votes`: validated neutral votes only;
- `synthesis`: `verdict`, `confidence`, `agreement`, `quorum`, `disagreement`, `uncertainty`, `evidenceRefs`, `strongestPro`, `strongestCon`, `conditions`, `limitations`;
- `audit`: input and evidence hashes, isolation counts, missing and invalid assessments, correlated risks, and neutral models.

The runtime contract is `src/core/judgment/judgment-contracts.ts`; the enforcing engine is `src/core/judgment/judgment-engine.ts`.

## References

- `agents/blind-judge.md`
- `src/core/judgment/judgment-contracts.ts`
- `src/core/judgment/judgment-engine.ts`
- `agents/skill-style-guide.md`
