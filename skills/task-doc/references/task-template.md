# Task Template

Use this section order unless the repo already has a stronger established format.

## 1. Objective

State the user-facing or system-facing outcome.
Describe the goal, not the implementation sequence.

## 2. Source Context

State where the task came from:

- roadmap item
- issue
- PRD
- brief
- codebase findings

If the task is synthesized from multiple inputs, say so and list the inputs briefly.

## 3. Prerequisites

List dependencies, completed tasks, existing systems, or required repo state.
If none apply, say `None`.

## 4. Scope

List included work only.
Keep items concrete and bounded.

## 5. Excluded

List adjacent work that should not be pulled into this task.
Use this section aggressively to prevent scope creep.

## 6. Verify First

List checks the agent must perform before implementing:

- whether relevant behavior already exists
- whether there is a reusable pattern
- whether assumptions are still valid in the current codebase

## 7. Execution Rules

List constraints that control how the task should be executed:

- preserve existing contracts
- reuse existing patterns
- avoid certain classes of changes
- meet required validation commands

## 8. Deliverables

List concrete outputs or outcomes expected from the task.
These should be reviewable and map back to the source request.

## 9. Verification Checklist

List inspectable completion checks.
Prefer observable outcomes over vague statements like "works correctly".

## 10. Approval Gates

Only include this section when relevant.
Use it for work involving:

- security
- auth
- permissions
- compliance
- finance
- destructive migrations
- infra or deployment-sensitive changes

## 11. Completion Criteria

State what must be true for the task to count as done.

## 12. Follow-ups

List logical next tasks, deferred work, or intentional future extensions.
If none apply, say `None`.

