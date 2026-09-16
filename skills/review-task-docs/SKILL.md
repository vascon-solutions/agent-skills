---
name: review-task-docs
description: Review task documents for executability, scope, evidence, and unresolved decisions before implementation. Report findings without editing.
---

# Review Task Docs

Assess whether another agent can safely execute the task without hidden context. Review the substance, not the author's process or section count. Do not edit the document or implement it; return findings to the author or authorized remediation workflow.

Read the task, authoritative sources, relevant repo instructions, and code needed to verify current-behavior claims. Challenge stale baselines, unsupported dependencies, invented scope, and verification that cannot prove the stated outcome.

Check objective, source/design references, architecture/system boundary, code evidence, preserved behavior, included/excluded scope, prerequisites, likely files, and completion verification. Equivalent information under another heading satisfies the requirement. A missing heading alone is not grounds for a rewrite; missing load-bearing information is.

Unresolved material decisions must identify the choices, implications, resolver, and affected work that cannot start yet. Preserve already accepted decisions; do not demand approval again simply because the task touches a sensitive area. Current-task gates must not depend on excluded follow-ups.

Use risk-calibrated verification. A UI behavior claim may need rendered evidence; a database invariant may need real database coverage. Do not require permanent tests of ordinary copy, CSS, or DOM structure merely to satisfy a task template.

Split only when outcomes are independently shippable and grouping makes scope, ownership, risk, or verification materially harder. Different files or UI concerns alone do not establish that split is needed. Preserve a coherent vertical change and its necessary dependencies.

## Verdict

- `accept`: executable with adequate scope and evidence; do not invent findings.
- `revise`: targeted clarification, stale reference, missing evidence, or verification gap can be corrected without changing the fundamental task.
- `split`: multiple distinct deliveries should be separated for a concrete reason.
- `rewrite`: the task's architecture, scope, evidence, or required invariants are substantially absent, fabricated, or contradictory, making it unsafe to execute as a bounded task.

Report a verdict per task, findings ordered by risk with file/section references, impact, and smallest recommended change. Distinguish confirmed contradictions from open questions. Report-only review does not independently trigger repairs, implementation, or publication.
