---
name: task-doc
description: Create a durable task document for feature-grade work from a roadmap item, issue, PRD, user brief, or codebase findings. Use when work is large enough to need a reviewable execution artifact rather than an ephemeral plan.
---

# Task Doc

## Purpose

Create a durable execution task document for major work.

This skill standardizes task artifacts across coding agents and repos.
It is not a backlog manager, and it is not a replacement for normal plan mode on small work.

## When To Use

Use when:

- the user wants a durable task doc for a feature, migration, major refactor, or cross-cutting change
- the work is likely to span multiple files, modules, or sessions
- the task needs explicit scope, exclusions, verification, or approval gates
- the output will be handed across agents or teammates
- the source material exists in a roadmap, issue, PRD, feature brief, meeting notes, or codebase findings
- the agent needs to decide whether the work is one bounded task or should be split into sub tasks

## When Not To Use

Do not use when:

- the task is a small bug fix, local UI tweak, narrow cleanup, or one-file change
- the user only needs an immediate implementation plan for the current session
- the work is too vague to define as a bounded task artifact

When not using this skill, default to the coding agent's normal plan mode.

## Required Inputs

You need:

- a source input, or enough user context to derive one
- a task title, or enough source detail to infer one safely

Optional but useful:

- target path or filename convention
- task ID or numbering convention
- frozen reference docs the task must respect
- example task docs to match

Read [references/source-modes.md](references/source-modes.md) when the source type is unclear.

## Decision Rules

### 1. Decide whether a durable task doc is warranted

Create a task doc when one or more of these are true:

- the work is feature-grade or a major change
- the work touches multiple modules or systems
- the work requires explicit verification or approval gates
- the work is likely to be handed across people, sessions, or agents
- the source material is important enough to preserve as a stable execution contract

Reject task-doc creation and recommend normal plan mode when most of these are true:

- the task is isolated and can be completed in one short implementation pass
- scope is obvious from the user request alone
- no durable artifact would be useful after the work is done
- failure modes are local and easy to inspect directly in code

### 2. Classify the source mode

Choose exactly one source mode:

- `roadmap`
- `issue`
- `prd`
- `brief`
- `codebase-derived`

See [references/source-modes.md](references/source-modes.md).

### 3. Choose generation style

Use `transform-only` when the source is already authoritative and bounded.

Use `synthesized` when the source is incomplete and the task must be inferred from multiple inputs. In this mode:

- clearly label assumptions
- do not invent major requirements without user direction
- add exclusions to prevent scope drift

### 4. Protect scope

- Separate included scope from excluded scope
- Prefer omission over invention
- Keep implementation detail out of the objective unless it is already part of the source
- Add approval gates for security, auth, compliance, finance, destructive data work, infra changes, or permission model changes

### 5. Discover when decomposition is required

Break the work into sub tasks when most of these are true:

- the request contains multiple independently shippable outcomes
- different areas of the repo can be implemented and verified separately
- one part is blocked by another part's prerequisite work
- a single task doc would become vague, bloated, or hard to execute safely
- different approval gates or risk profiles apply to different parts

When decomposition is needed:

- keep the current task doc focused on the parent feature or bounded first slice
- list proposed sub tasks under `Follow-ups` unless the user explicitly asked for multiple task docs now
- do not explode work into sub tasks for minor sequencing or obvious implementation steps

## Workflow

1. Inspect the source inputs and determine whether this is feature-grade work or normal-plan work.
2. If it should stay in plan mode, do not create a task doc. State that a durable task artifact would be overkill here.
3. Classify the source mode.
4. Decide whether the task should be `transform-only` or `synthesized`.
5. Decide whether the work should stay as one task or be split into sub tasks.
6. Draft the task doc using [references/task-template.md](references/task-template.md).
7. Fill each section with bounded, execution-ready content.
8. Add assumptions only when the source is incomplete, and label them clearly.
9. Add exclusions, verify-first checks, and approval gates where warranted.
10. If decomposition is needed, list proposed sub tasks in `Follow-ups` or generate multiple task docs if the user asked for that explicitly.
11. Review the draft for scope inflation, hidden implementation decisions, and missing verification.
12. Output only the task doc unless the user explicitly asks for commentary around it.

Read [references/examples.md](references/examples.md) for example outcomes and rejection cases.

## Validation

Before declaring the task doc complete, verify:

- the task is large enough to deserve a durable artifact
- the title and objective describe one bounded piece of work
- the task is not silently hiding multiple major sub tasks
- scope and excluded items are both present
- verify-first checks exist when current repo state matters
- deliverables are concrete and reviewable
- verification checklist items are testable or inspectable
- approval gates are present only when they truly apply
- any proposed sub tasks are real work slices, not mere implementation steps
- the doc can be executed by another agent without relying on hidden chat context

## Output

Produce exactly one of the following:

- a completed task document using the standard section order in [references/task-template.md](references/task-template.md)
- a brief refusal to create a task doc, with a recommendation to use normal plan mode instead

If the user asked for a file, write the file in the requested location.
If no location was specified, provide the task doc content directly.

## Cautions / Common Failure Modes

- turning small work into heavyweight ceremony
- inventing requirements that were never requested
- hiding assumptions inside assertive wording
- collapsing multiple major workstreams into one vague task
- mixing execution guidance with implementation details that should stay flexible
- omitting exclusions, which invites scope creep
- generating a checklist that another agent cannot actually execute
