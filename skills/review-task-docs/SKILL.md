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
- **Scope discipline** — are included and excluded items explicit? Missing exclusions are a risk.
- **Executability** — could another agent act on this without hidden context?
- **Assumptions** — are they labeled and limited, or buried in assertive wording?
- **Verification quality** — do checklist items prove completion, or restate intent?
- **Approval gates** — present where needed, absent where not?
- **Decomposition** — does this hide multiple independently shippable outcomes that should be split?

## Verdicts

Assign exactly one:

- `accept` — ready to execute as written
- `trim` — broadly correct but overscoped or over-specified
- `split` — contains multiple real sub tasks that should be separate docs
- `rewrite` — not safe to execute; needs a new draft

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
