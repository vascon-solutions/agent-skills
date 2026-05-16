---
name: review-task-docs
description: Validate task documents created by another agent or teammate. Report verdicts and findings only — never implement or edit the task doc. Use for cross-agent review before implementation begins.
---

# Review Task Docs

## Purpose

Validate task documents before implementation begins. This is a review-only skill.

You must never implement any part of the task, and you must never edit the task doc directly. Your only output is a verdict and findings.

## When To Use

Use when:

- another agent or teammate created a task doc and you want independent validation
- the user wants task scope challenged before handing the task to an implementing agent
- the user wants to know whether one task should be split

## When Not To Use

Do not use when:

- the user wants the task doc created — use `task-doc`
- the target is general documentation, not a task artifact — use `review-doc-changes`

## Constraints

- **Do not implement.** Do not write code, create files, or begin any work described in the task.
- **Do not edit the task doc.** Report findings. The author or user decides what to change.
- **Do not trust structure as proof of quality.** A well-formatted doc can still be unexecutable.
- **Verify against the codebase.** When the task claims something about existing behavior, dependencies, or patterns, check the repo.

## Review Criteria

Audit for:

- **Bounded objective** — is this one task, not a disguised program of work?
- **Design Reference** — does it link to the authoritative specs, roadmap, PRD, issue, or source brief the implementer should follow, including `Source Spec` when the task is derived from a spec?
- **Architecture Summary** — does it state the intended approach and system boundary clearly enough to prevent wrong implementation choices?
- **Code Evidence** — are codebase claims backed by file references rather than memory or assertion, using file plus symbol/section and line numbers for narrow implementation details?
- **Current Behavior To Preserve** — does it capture invariants, contracts, or user/compliance behavior that must remain true after implementation?
- **Scope discipline** — are included and excluded items explicit, with Excluded limited to work that will not ship in this task and Follow-ups kept as separate future tasks? Missing exclusions are a risk.
- **Executability** — could another agent act on this without hidden context?
- **Likely Files To Touch** — does it orient the implementer to probable files/directories without pretending to be a complete implementation plan?
- **Decisions Required Before Implementation** — are unresolved choices called out before implementation starts with options, implications, and a resolver, and are they treated as blockers before code changes?
- **Assumptions** — are they labeled and limited, or buried in assertive wording?
- **Verification quality** — do Pre-Implementation Verification items re-check drift-prone assumptions, and do Completion Verification items prove the finished task rather than restating intent?
- **Approval gates** — present where needed, absent where not, and not aimed only at excluded follow-up work?
- **Completion Criteria** — does completion depend only on current-task deliverables, not excluded or follow-up work?
- **Decomposition** — does this hide multiple independently shippable outcomes that should be split?

## Verdicts

Assign exactly one:

- `accept` — ready to execute as written
- `revise` — broadly correct but needs targeted additions, removals, or clarification before execution
- `split` — contains multiple real sub tasks that should be separate docs
- `rewrite` — not safe to execute; needs a new draft

Use these thresholds:

- Missing or fabricated Architecture Summary for implementation work: `rewrite`.
- Codebase claims without Code Evidence in a code-dependent task: `rewrite`. A code-dependent task changes code or depends on current code behavior; pure product discovery is not code-dependent.
- Narrow implementation claims without line-level or symbol-level evidence: `revise`.
- Missing Current Behavior To Preserve for load-bearing code such as auth, payments, workflow, permissions, migrations, or public APIs: `rewrite`.
- Non-empty Decisions Required Before Implementation that are not treated as blockers or lack options, implications, and a resolver: `rewrite`.
- Missing Excluded section: `rewrite`.
- Missing Source Spec when the task is explicitly derived from a spec: `revise`.
- Missing Design Reference when another authoritative source exists: `revise`.
- Missing or weak Likely Files To Touch when the task is otherwise executable: `revise`.
- Approval gates, deliverables, or completion criteria aimed only at excluded follow-up work: `revise`.
- Multiple independently shippable outcomes: `split`.
- Extra implementation detail that bloats the doc but does not make it unsafe: `revise`.

## Workflow

1. Read the task doc.
2. Check whether the objective describes one bounded piece of work.
3. Inspect the codebase where the task makes claims about existing state.
4. Audit against the review criteria above.
5. Assign a verdict.
6. Report findings, highest-risk first.

## Output

Produce only:

- a verdict
- findings ordered by severity
- recommended changes (for the author to apply, not you)
- explicit `accept` when the doc is strong — do not invent problems

## Cautions

- Do not implement. Do not edit the task doc. Report only.
- Do not treat section completeness as proof of quality.
- Do not split work into tiny implementation steps — only real separable workstreams.
- Do not preserve a bloated task because the feature sounds important.
- Do not accept completion criteria that depend on excluded or future work.
- Do not accept vague open decisions that lack options, implications, and a resolver.
