---
name: startup-tank
description: "Trigger: startup idea, /new-startup, would investors fund this, shark tank, venture viability. Run an isolated investor panel and synthesize a verdict with the disagreements named."
license: Apache-2.0
metadata:
  author: "surre"
  version: "1.0"
---

## Activation Contract

Use this skill when someone wants to know whether a startup idea is worth building or funding, not when they want a business plan or a pitch deck. The output is a verdict with evidence gaps, not encouragement.

## Hard Rules

- Each investor judges alone. Give every investor the same brief and never let one see another's verdict before it has committed to a score.
- An investor must state a decision (`invest` or `pass`), a score from 1 to 5, the reasoning, and the single fact that would flip the decision.
- The orchestrator never invents or adjusts a score. It reports what the panel produced, including the spread.
- No invented market data, competitor, traction or benchmark. If a number is not in the brief or verifiable, it is an assumption and must be labelled as one.
- A verdict is not a promise. State what must be true and what would have to be measured before the next round of money or time.

## Panel

Run four independent investors, in this order, each in its own context:

| Investor | Question they own |
| --- | --- |
| The Operator | Can this team actually build and sell it with the people and money they have? |
| The Growth Investor | Is there a distribution path with a plausible acquisition cost, or only a good product? |
| Technical Diligence | Is it buildable with today's tooling, at what cost, and what is the defensible part? |
| The Market Analyst | Is the market real, growing, reachable, and is this the right moment? |

Each investor answers with:

1. `decision`: invest or pass.
2. `confidence`: 1-5.
3. `thesis`: three sentences at most.
4. `strengths`: the two strongest points.
5. `risks`: the two that could kill it.
6. `flip`: the single fact that would change the decision.
7. `checks`: the evidence that must exist before a term sheet, stated as things to measure.

## Isolation Protocol

1. Write one brief: the idea, the target customer, the proposed wedge, the team, the money available, and the timeline. Ask for missing fields once; otherwise mark them as unknown and continue.
2. Dispatch one subagent per investor with the same brief and its own role above. Never include another investor's output in a later prompt.
3. If the runtime has no subagent mechanism, run the four roles as four sequential passes, resetting your reasoning between them, and say in the final report that isolation was simulated rather than enforced.
4. Collect the four verdicts before writing any synthesis.

## Synthesis

Produce:

1. **Verdict**: fund, iterate, or pass, in one paragraph, based on the panel and not on enthusiasm.
2. **Score table**: investor, decision, confidence, and the one-line thesis.
3. **The disagreement**: where the panel split and why, named explicitly. A unanimous pass and a unanimous invest both deserve the reason.
4. **Kill risks**: the two risks that, if true, make everything else irrelevant.
5. **Evidence gaps**: what must be measured or verified next, with the cheapest experiment that would settle each one.
6. **Next 30 days**: the smallest set of actions that would change an investor's mind, and which investor's mind.

## Decision Gates

| Situation | Action |
| --- | --- |
| The panel is split | Report the split and the flip facts; do not average it into a fake consensus. |
| A score is missing | Ask the investor role again; never fill it in yourself. |
| The idea depends on an unverified market number | Mark it as unknown and make the measurement the next action. |
| The idea is a feature, not a company | Say so, and say what would make it a company. |

## Failure Modes

- Cheerleading disguised as analysis.
- A verdict that ignores the strongest counter-argument.
- Averages that hide a 1 and a 5 in the same panel.
- A "next steps" list that is really a business plan.

Write all artifacts in English. Reply in the language the user used.
