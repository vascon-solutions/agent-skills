---
name: task-doc
description: Create a durable task document for feature-grade work from a roadmap item, issue, PRD, user brief, or codebase findings. Rejects small work that should stay in normal plan mode. Does not implement.
---

# Task Doc

## Purpose

Create a durable execution task document for feature-grade work.

This skill produces a document, not an implementation. Do not implement any part of the task after creating the doc. Do not start coding.

It is not a backlog manager, and it is not a replacement for normal plan mode on small work.

## When To Use

Use when:

- the work is feature-grade: spans multiple files, modules, or sessions
- the output will be handed across agents or teammates
- the task needs explicit scope, exclusions, verification, or approval gates
- the source material exists in a roadmap, issue, PRD, feature brief, or codebase findings

## When Not To Use

Do not use when:

- the task is a small bug fix, local UI tweak, narrow cleanup, or one-file change
- the user only needs an immediate implementation plan for the current session
- the work is too vague to define as a bounded task artifact

When not using this skill, default to normal plan mode and say so.

## Constraints

- **Do not implement.** This skill produces a task document only. Do not write code, create implementation files, or begin any work described in the task.
- **Reject small work.** If the work does not justify a durable artifact, refuse and recommend plan mode. This is not optional — agents default to creating what was asked; this skill must override that instinct.
- **Prefer omission over invention.** Do not add scope, requirements, or features the source did not ask for. When in doubt, leave it out and add it to Excluded.
- **Exclusions are mandatory.** Every task doc must have an Excluded section. Missing exclusions invite scope creep during implementation.
- **Split conservatively.** Only decompose when the task contains multiple independently shippable outcomes with different verification or risk profiles. Do not split for minor sequencing or obvious implementation steps.

## Required Inputs

You need:

- a source input, or enough user context to derive one
- a task title, or enough source detail to infer one safely

Optional: target path, task ID convention, frozen reference docs, example task docs to match.

## Decision Rules

### Classify the source mode

Choose exactly one:

- `roadmap` — bounded roadmap entry
- `issue` — tracker item, bug ticket, or feature request
- `prd` — feature spec or product requirement document
- `brief` — user request, meeting notes, or freeform direction
- `codebase-derived` — inferred from repo state (TODOs, missing integrations, repeated manual work)

See [references/source-modes.md](references/source-modes.md).

### Choose generation style

Use `transform-only` when the source is already authoritative and bounded. Transform-only restructures the source into task-doc format without adding scope, requirements, or assumptions.

Use `synthesized` when the source is incomplete and the task must be inferred from multiple inputs. In synthesized mode:

- label all assumptions explicitly
- do not invent major requirements without user direction
- use strong exclusions to prevent drift

### Protect scope

- Separate included scope from excluded scope
- Keep implementation detail out of the objective unless it is already part of the source
- Add approval gates only for: security, auth, compliance, finance, destructive data work, infra changes, or permission model changes

### Decide on decomposition

Break into sub tasks only when most of these are true:

- multiple independently shippable outcomes exist
- different areas of the repo can be implemented and verified separately
- different approval gates or risk profiles apply to different parts
- a single task doc would become vague or hard to execute safely

When decomposition is needed, list proposed sub tasks under Follow-ups. Do not generate multiple task docs unless the user explicitly asked for that.

## Workflow

1. Determine whether this is feature-grade work. If not, refuse and recommend plan mode.
2. Classify the source mode.
3. Choose `transform-only` or `synthesized`.
4. Decide whether the work stays as one task or needs decomposition.
5. Draft the task doc using [references/task-template.md](references/task-template.md).
6. Verify the draft against the validation checks below.
7. Output the task doc. Do not add commentary unless the user asked for it.

Read [references/examples.md](references/examples.md) for example outcomes and rejection cases.

## Validation

Before declaring complete, verify:

- the work is large enough to deserve a durable artifact (re-check the rejection gate)
- the task is not silently hiding multiple major sub tasks
- scope and excluded items are both present
- the doc can be executed by another agent without relying on hidden chat context
- any proposed sub tasks are real separable workstreams, not implementation steps

## Output

Produce exactly one of:

- a completed task document using [references/task-template.md](references/task-template.md)
- a brief refusal with a recommendation to use normal plan mode

If the user asked for a file, write it in the requested location. Otherwise provide the content directly.

Do not implement. Do not start coding.

## Cautions

- Turning small work into heavyweight ceremony
- Inventing requirements that were never in the source
- Hiding assumptions inside assertive wording
- Collapsing multiple major workstreams into one vague task
- Omitting exclusions
- Generating a checklist that another agent cannot actually execute
