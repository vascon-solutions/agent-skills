# Task Template

Use this section order unless the repo already has a stronger established format.
Headings are intentionally unnumbered so conditional sections do not create numbering drift.

## Objective

State the user-facing or system-facing outcome.
Describe the goal, not the implementation sequence.

## Source Context

State where the task came from:

- roadmap item
- issue
- PRD
- brief
- codebase findings

If the task is synthesized from multiple inputs, say so and list the inputs briefly.

## Design Reference

List the design/spec/roadmap docs the implementing agent should treat as authoritative.
If the task is derived from a spec, include `Source Spec: <path>`.
If none apply, say `None`.

## Architecture Summary

Summarize the intended approach in 2-5 sentences.
Focus on how the work fits into the existing system, not the full implementation sequence.
Do not invent an architecture when the source does not provide one; state the known boundary and unresolved decision instead.

## Code Evidence

List read-only, code-backed facts the task relies on.
This section proves current behavior or existing patterns at doc-creation time.
Prefer file plus symbol/section. Add line numbers when a claim depends on a narrow implementation detail.
Prefer a table:

| Behavior | Source |
|---|---|
| Existing behavior or pattern | `path/to/file.ts#SymbolOrSection` |
| Narrow implementation detail | `path/to/file.ts:120-140#SymbolOrSection` |

If the task does not depend on current code behavior, say `None`.

## Current Behavior To Preserve

List invariants, contracts, guardrails, user-visible behavior, or compliance behavior that must remain true after implementation.
For load-bearing areas such as auth, payments, workflow, permissions, migrations, or public APIs, this section should rarely be `None`.
If there is no current behavior constraint, say `None`.

## Prerequisites

List dependencies, completed tasks, existing systems, or required repo state.
If none apply, say `None`.

## Scope

List included work only.
Keep items concrete and bounded.

## Excluded

List adjacent work that will not ship in this task.
Use this section aggressively to prevent scope creep during implementation.

## Pre-Implementation Verification

List checks the agent must perform before implementing.
This is execution-time validation because the codebase may have changed since the task doc was written.

- whether relevant behavior still exists
- whether there is still a reusable pattern
- whether assumptions are still valid in the current codebase

## Likely Files To Touch

List likely files or directories the implementing agent should inspect or modify for the new work.
This is write-target and inspection orientation, not evidence of current behavior and not a command to edit every listed file.
If no file changes are expected, list the docs or external artifacts to inspect and say why no code files are expected.

## Decisions Required Before Implementation

List unresolved decisions that must be made before implementation starts.
For each unresolved decision, include at least two realistic options, their implications or tradeoffs, and who or what should resolve it.
If this section is non-empty, the implementing agent must stop and resolve these decisions before writing code.
If all decisions are already settled by the source, say `None`.

## Execution Rules

List constraints that control how the task should be executed:

- preserve existing contracts
- reuse existing patterns
- avoid certain classes of changes
- meet required validation commands

## Deliverables

List concrete outputs or outcomes expected from the task.
These should be reviewable and map back to the source request.

## Completion Verification

List inspectable completion checks.
Prefer observable outcomes over vague statements like "works correctly".

## Approval Gates

Only include this section when relevant.
Do not add approval gates for excluded follow-up work unless the current task itself touches that gated area.
Use it for work involving:

- security
- auth
- permissions
- compliance
- finance
- destructive migrations
- infra or deployment-sensitive changes

## Completion Criteria

State what must be true for the task to count as done.

## Follow-ups

List logical next tasks, deferred work, or intentional future extensions that should be handled as separate task docs.
Follow-ups may include excluded work that becomes valid after this task is complete.
If none apply, say `None`.
