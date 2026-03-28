---
name: review-task-docs
description: Independently review task documents created by another agent or teammate, challenge scope and assumptions, and decide whether the task is executable, overscoped, underspecified, or should be split.
---

# Review Task Docs

## Purpose

Perform an independent review of task documents before implementation begins.

This skill is skeptical in the same way `review-doc-changes` is skeptical, but its target is different:

- task quality, not general documentation quality
- execution readiness, not prose polish
- scope control, assumptions, decomposition, and approval gates

## When To Use

Use when:

- another agent or teammate created a task doc and you want a second pass
- the user asks whether a task doc is executable as written
- the user wants task scope challenged before implementation
- the user wants to know whether one task should be split into sub tasks

## When Not To Use

Do not use when:

- there is no task doc or draft to review
- the user wants the initial task doc created from scratch
  Use `task-doc`
- the target is a general documentation review rather than a task artifact
  Use `review-doc-changes`

## Required Inputs

You need:

- one or more task docs or drafts to review
- access to the current codebase when the task makes claims about existing behavior, dependencies, or reusable patterns

Do not assume the task is correct because it looks structured.

## Review Criteria

Audit the task doc for:

- **Bounded objective** — is this one task, not a disguised program of work?
- **Scope discipline** — are included and excluded items explicit and coherent?
- **Executability** — could another agent act on this without hidden chat context?
- **Assumptions** — are they explicit, justified, and limited?
- **Verification quality** — do checklist items prove completion rather than restate intent?
- **Approval gates** — are they present where needed and absent where not needed?
- **Decomposition** — should this be split into sub tasks?

## Decision Rules

- Prefer rejecting a vague task over approving a task that will drift during implementation
- If the task hides multiple independently shippable outcomes, recommend splitting it
- If a task lacks exclusions, treat that as a real risk, not a formatting omission
- If deliverables do not map clearly back to the source request, call that out
- Verify codebase-dependent claims against the repo instead of trusting the task wording
- Accept all is a valid outcome when the task doc is strong

## Step-By-Step Instructions

1. Read the task doc as written.
2. Identify the claimed objective, source context, and task boundaries.
3. Check whether the task is actually one bounded unit of work.
4. Independently inspect the codebase where existing-state claims matter.
5. Audit scope, exclusions, assumptions, verification, and approval gates.
6. Decide whether to accept, trim, split, or rewrite.
7. Apply low-risk corrections directly if asked to edit; otherwise report findings and recommendations.

## Verdicts

Use one of these verdicts:

- `accept` — task is ready to execute
- `trim` — task is broadly correct but too wide, too long, or over-specified
- `split` — task contains multiple real sub tasks and should be decomposed
- `rewrite` — task is not dependable enough to execute safely

## Output

Produce:

- a verdict for each reviewed task doc
- the highest-risk findings first
- recommended corrections or decomposition plan
- explicit acceptance if the task is already strong

## Cautions / Common Failure Modes

- treating section completeness as proof of quality
- reviewing wording without checking executability
- allowing hidden assumptions to slip through
- preserving a bloated task because the source feature is important
- splitting work into tiny implementation steps instead of real sub tasks

