---
name: task-first-implementation
description: Use when a bounded frontend, backend, full-stack, shared-package, bugfix, existing implementation improvement, or follow-up change needs a task-doc-first review gate before code changes.
---

# Task-First Implementation

## Purpose

Use this orchestration skill for review-gated improvement work where desired behavior is mostly known but code should wait for a durable task doc and explicit approval.

This replaces the heavy `brainstorming` -> `writing-plans` path for improvement-grade work. Escalate to full `brainstorming` when product behavior, architecture options, or decomposition are still open.

When using another skill, invoke it through the skill mechanism when available. If unavailable, follow its repo-local `SKILL.md` workflow and state the fallback.

## Classify First

State the classification and one-sentence rationale.

- `small`: one file and one behavior; no API/schema/route contract, cross-module dependency, new persistent state, auth/permission, migration, or recoverability need. Output: `Skipping task doc - classified small because <reason>. Plan: <1-3 steps>.`
- `improvement`: bounded change to an existing screen, endpoint, service, package, or workflow; desired behavior is known; may touch nearby files or need visual/acceptance review.
- `feature-grade`: multiple modules/layers, new endpoint/route, schema/model change, background job, auth boundary, shared package contract, cross-app workflow, migration, or cross-session implementation.
- `open-ended`: product behavior or architecture direction is still being decided. Use `brainstorming`.

The agent makes the first call; the user may override. If the target area is unfamiliar enough to need a code-grounded map, use `implementation-map` before continuing.

## Discovery

Inspect relevant repo context before deep questions. Infer from chat when details are already clear. Ask one focused question at a time, with no more than three clarifying questions before an understanding check unless blocked.

For UI work, offer an early exploratory `image-artifact` variant board only when visual direction blocks shared understanding. Early visuals are conversation aids; the task doc remains source of truth.

Before writing the task doc, present:

- objective
- requested changes
- behavior to preserve
- excluded scope
- likely risk areas
- unresolved decisions

Ask for approval or corrections. Do not write code. If decisions block a safe task doc, continue the question loop. If decisions only block implementation, put them in `Decisions Required Before Implementation`.

## Task Doc

Invoke `task-doc` for `improvement` and `feature-grade` work, including UI tweaks or incremental fixes. Respect `task-doc` downshift behavior for `small` work unless the user explicitly wants a durable doc.

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
</HARD-GATE>

Proactively recommend `review-task-docs` when `Decisions Required Before Implementation` is non-empty or the task spans cross-module, auth, migration, or other high-risk scope.

Close planning with:

`Task doc written to <path>. Optional artifacts: <paths or skipped>. Please review or ask me to run a second task-doc review before implementation.`

Ambiguous replies such as "looks fine" or "continue" count only if they clearly refer to implementation approval; otherwise ask a concise confirmation.

## Implementation And Review

After approval, implement against the task doc. For risky or feature-grade work, use a short internal plan or `writing-plans` when the task doc is large enough. Write or update tests first where practical. Keep edits scoped and do not add excluded scope.

Validate by executing the task doc's `Validation Plan`. If it is empty or incomplete, discover validation from repo conventions and report the gap.

Run `review-implementation` against the task doc when available; otherwise perform the same report-only review locally and state the fallback. If findings exist, use `address-review-findings` to evaluate and fix valid gaps. Report changed files, validation, review/remediation results, and follow-ups.
