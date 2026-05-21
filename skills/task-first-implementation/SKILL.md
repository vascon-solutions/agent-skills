---
name: task-first-implementation
description: Use when a bounded frontend, backend, full-stack, shared-package, bugfix, refactor/refactoring idea, existing implementation improvement, page-by-page UI/form improvement, or follow-up change needs a task-doc-first review gate before code changes.
---

# Task-First Implementation

## Purpose

Use this orchestration skill for review-gated improvement work where desired behavior is mostly known but code should wait for a durable task doc and explicit approval.

This replaces the heavy `brainstorming` -> design spec -> `writing-plans` path for improvement-grade work where the desired outcome can be captured directly as a task doc.

Use `brainstorming` for the discovery/interview phase when the user wants guided questioning, step-by-step page refinement, visual/product exploration, or when product behavior is still being shaped. In this orchestration, the approved interview/design output feeds the task doc gate instead of starting implementation planning.

Escalate to the full standalone `brainstorming` workflow only when the work needs a separate design spec before tasking, broad architecture/product direction is still open, or the user explicitly asks for the full brainstorming-to-plan flow.

This is especially useful for page-by-page improvement passes and behavior-preserving refactors over an existing implementation: collect the user's intended changes interactively or from provided notes, combine them with repo findings, then turn the agreed scope into a task doc when the work is large enough to need one.

When using another skill, invoke it through the skill mechanism when available. If unavailable, follow its repo-local `SKILL.md` workflow and state the fallback.

## Skill Composition

- `guided interview` intake: invoke `brainstorming` first and follow its one-question-at-a-time discovery discipline, approach exploration, and design approval behavior. Stop before its design-doc/commit/`writing-plans` terminal path unless the user explicitly wants the full standalone brainstorming workflow.
- `notes-first` intake: use `brainstorming` only if notes reveal unresolved product behavior, visual direction, or architecture choices that need interview-style exploration before a task doc.
- `codebase-derived` intake: use repo inspection first; invoke `brainstorming` only when findings expose product/design choices that cannot be safely inferred.
- After the interview/design understanding is approved, continue with this skill's task-doc flow and review gate.

## Classify First

State the classification and one-sentence rationale before deciding the intake mode.

- `small`: one file and one behavior; no API/schema/route contract, cross-module dependency, new persistent state, auth/permission, migration, or recoverability need. Output: `Skipping task doc - classified small because <reason>. Plan: <1-3 steps>.`
- `fix`: a known bug with a clear repro or stated symptom and no new behavior to design; may touch a few files plus a test; no API/schema/route contract change, auth boundary change, migration, or new persistent state. Output: `Classified fix - skipping task doc. Repro: <…>. Fix plan: <1-3 steps>.`
- `improvement`: bounded change or behavior-preserving refactor to an existing screen, endpoint, service, package, or workflow; desired behavior is known; may touch nearby files or need visual/acceptance review.
- `feature-grade`: multiple modules/layers, new endpoint/route, schema/model change, background job, auth boundary, shared package contract, cross-app workflow, migration, broad refactor, or cross-session implementation.
- `open-ended`: product behavior, architecture direction, or refactoring direction is still being decided. Use `brainstorming`.

`small` and `fix` skip Intake Mode, Discovery, the Final Pre-Task-Doc Summary, and the Review Gate. State the classification line and proceed directly to implementation; still run the relevant tests or validation afterward.

Refactoring is an intent, not a separate scale. Classify refactors by risk:

- local behavior-preserving cleanup, extraction, rename, or dead-code removal -> `small` or user-forced one-shot
- bounded multi-file cleanup with known boundaries and behavior to preserve -> `improvement`
- cross-module/package/app refactor, public API/import contract changes, or unclear architecture direction -> `feature-grade` or `open-ended`

The agent makes the first call; the user may override. If the target area is unfamiliar enough to need a code-grounded map, use `implementation-map` before continuing.

### User Overrides

The user may force a downshift with keywords such as `one-shot`, `one-shot refactor`, `fix`, `no task doc`, or `skip task doc` in the invocation. Honor it: state `User-forced downshift to <fix|small>: <one-line rationale>.` and proceed without a task doc.

If the change would cross a hard scope boundary (API/schema/route contract, auth/permission boundary, migration, new persistent state, cross-module or cross-app refactor), flag the specific risk in one sentence and ask the user to confirm the bypass before continuing. Do not silently expand a forced `fix` into wider rework — if you find adjacent issues, note them as follow-ups instead of fixing them in the same pass.

## Intake Mode

State the intake mode immediately after classification.

- `guided interview`: default when the user names a page, route, form, workflow, or starting change without a complete list of desired changes. Bare page references such as `/service-requests/new?budgetYear=2032` hard-default here.
- `notes-first`: use when the user provides notes, screenshots, acceptance criteria, or a list of requested changes. Map them to code findings, then ask about gaps.
- `codebase-derived`: use when the user explicitly asks for findings, cleanup opportunities, or refactoring ideas without product input. Inspect the code and propose candidate changes, labeling assumptions.

<HARD-GATE>
For `guided interview`, invoke `brainstorming` before any final synthesis, broad understanding check, or task-doc summary. Follow its one-question-at-a-time discovery discipline, but return to this skill for the task doc gate instead of writing a separate design spec or invoking `writing-plans` unless the user explicitly asks for the full standalone brainstorming workflow.

Do not ask for all notes in one dump. Do not produce the final pre-task-doc summary on the first response. Start where the user pointed, inspect only enough code to ask the next useful question, update the working change inventory after each answer, and continue until the user approves the accumulated page-local scope.
</HARD-GATE>

### Guided Interview Example

User: `$task-first-implementation guided interview for /service-requests/new?budgetYear=2032. Start with the form step order.`

Agent:

1. State classification and intake mode.
2. Invoke `brainstorming` for guided discovery.
3. Inspect the current route/page surface.
4. Ask one question: `What steps should the form have, in order?`
5. After the user answers, add that answer to the working change inventory with code evidence, then ask the next adjacent question, such as what should happen after DDD selection.

## Discovery

Inspect relevant repo context before deep questions. Infer from chat when details are already clear. Ask one focused question at a time. For interactive intake, use understanding checks as checkpoints, not as the end of discovery.

For page, route, or form improvement requests, first build a page-local change inventory from both possible inputs:

- user-provided answers, brainstorm notes, requested changes, questions, screenshots, or acceptance notes
- codebase findings about the current page behavior, route state, data flow, validation, permissions, tests, and nearby reusable patterns

For refactoring requests, build a refactor inventory before proposing edits:

- refactor goal or suspected code smell
- current behavior and tests that must stay unchanged
- code evidence for coupling, duplication, size, naming, ownership, or repeated patterns
- proposed extraction, move, rename, simplification, or decomposition
- risk boundary and validation needed to prove behavior is preserved
- follow-up scope that should not be smuggled into the refactor

In guided interview mode, if the user starts with a specific change such as step order, begin there, then proceed through adjacent page concerns such as route/search params, entry state, step sequence, field groups, validation, data selection, review/submit behavior, navigation, loading/empty/error states, permissions, and tests.

Do not write the task doc until the user approves the accumulated page-local understanding. The working change inventory is conversation state, not the task doc.

For each requested change or open question, summarize:

- user intent or source note
- current behavior / code evidence
- proposed change or realistic options
- decision needed, if any
- excluded or follow-up scope, if it would otherwise expand the page task

Keep page improvement scopes page-local. Do not absorb broader roadmap items, sibling-role workflows, seeded data work, backend contract changes, or adjacent pages unless the user explicitly asks to combine them.

For UI work, offer an early exploratory `image-artifact` variant board only when visual direction blocks shared understanding. Early visuals are conversation aids; the task doc remains source of truth.

### Final Pre-Task-Doc Summary

Present this only after the working change inventory has been accumulated across the interactive loop or mapped from user-provided notes, and only when the user is ready to decide whether the scope should become a task doc.

- classification and rationale
- intake mode
- objective
- page-local change inventory, when the target is a page, route, or form
- refactor inventory, when the target is cleanup or refactoring
- requested changes
- behavior to preserve
- excluded scope
- likely risk areas
- unresolved decisions

Ask for approval or corrections. Do not write code. If decisions block a safe task doc, continue the question loop. If decisions only block implementation, put them in `Decisions Required Before Implementation`.

## Task Doc

Invoke `task-doc` for `improvement` and `feature-grade` work, including UI tweaks, incremental fixes, and non-trivial refactors. Respect `task-doc` downshift behavior for `small` work unless the user explicitly wants a durable doc.

Before creating a new task doc, check for an active same-session task doc for the same page, endpoint, workflow, or implementation thread. Update it instead of creating duplicates unless the new request is independently shippable, has different risk/validation, or the user asks for separation.

Follow `task-doc` path rules: user path, repo instructions, existing conventions such as `.agent/tasks/`, then direct output. Let `task-doc` choose source mode; chat work often maps to `brief`, implementation-discovered follow-up may map to `codebase-derived`.

## Companion Artifacts

After the task doc exists, offer `image-artifact` when a low-text visual summary, UI variant board, architecture diagram, or API flow would improve review speed. Skip if an early visual already resolved the need.

For UI task docs, offer `image-artifact` by default after the task doc unless an early exploratory visual already covered the review. Treat "always generate" preferences as session-only unless persisted in `AGENTS.md` or `CLAUDE.md`.

Recommended kinds: UI -> `ui-variant-board`, `summary-card`, or `decision-board`; backend/API -> `architecture-diagram` or `api-flow`; full-stack -> `api-flow` plus a low-text boundary diagram.

Offer `html-artifact` only when browsing or interaction adds value beyond Markdown: prototypes, annotated diffs, route/state tables, linked criteria, or side-by-side review surfaces.

Use `markdown-artifact` for polished standalone artifacts under `~/agent-artifacts/`, not as the implementation source of truth.

## Review Gate

<HARD-GATE>
Do NOT write code, edit implementation files, scaffold implementation artifacts, run implementation generators, or begin any implementation task until the task doc has been written or updated and the user explicitly approves implementation after that review point.

Approval of the understanding check is approval to write or update the task doc only. Approval of the task doc is the implementation gate. If the user asks for `review-task-docs`, implementation remains blocked until that review is complete and the user explicitly approves implementation.

This gate applies to `improvement` and `feature-grade` classifications, including non-trivial refactors. `small`, `fix`, local one-shot refactors, and user-forced downshifts skip this gate per the Classify First rule; proceed directly to implementation after stating the classification line.
</HARD-GATE>

Proactively recommend `review-task-docs` when `Decisions Required Before Implementation` is non-empty or the task spans cross-module, auth, migration, or other high-risk scope.

Close planning with:

`Task doc written to <path>. Optional artifacts: <paths or skipped>. Please review or ask me to run a second task-doc review before implementation.`

Ambiguous replies such as "looks fine" or "continue" count only if they clearly refer to implementation approval; otherwise ask a concise confirmation.

## Implementation And Review

After approval, implement against the task doc. For risky or feature-grade work, use a short internal plan or `writing-plans` when the task doc is large enough. Write or update tests first where practical. For refactors, keep behavior unchanged unless explicitly scoped and validate the preserved behavior. Keep edits scoped and do not add excluded scope.

Validate by executing the task doc's `Validation Plan`. If it is empty or incomplete, discover validation from repo conventions and report the gap.

Run `review-implementation` against the task doc when available; otherwise perform the same report-only review locally and state the fallback. If findings exist, use `address-review-findings` to evaluate and fix valid gaps. Report changed files, validation, review/remediation results, and follow-ups.
