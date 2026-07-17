---
name: task-doc-intake
description: Use when a page, route, form, workflow, refactor idea, loose notes, screenshots, acceptance criteria, or codebase findings need guided-interview or notes-first discovery before a durable task document. Classifies and downshifts small work; ends at an explicit implementation gate.
---

# Task Doc Intake

## Purpose

Turn a guided interview, a set of notes, or codebase-derived findings into an approved change inventory, then a durable task doc via `task-doc`, ending at an explicit implementation gate.

This skill owns task discovery only. `task-doc` renders the document; `task-doc-delivery-loop` implements after approval. This skill never writes code.

It is self-contained: the interview discipline is inlined below and does not depend on any external discovery skill. If a product-discovery skill such as `brainstorming` is installed and the work needs broad product/architecture exploration first, you may use it for that phase and return here — never require it.

## Classify First

State the classification and a one-sentence rationale before choosing an intake mode.

- `small`: one file, one behavior; no API/schema/route contract, cross-module dependency, new persistent state, auth/permission, migration, or recoverability need. Output: `Skipping task doc — classified small because <reason>. Plan: <1-3 steps>.` Then stop — implementation belongs to the normal session, not this skill.
- `fix`: a known bug with a clear repro or stated symptom and no new behavior to design; no contract, auth boundary, migration, or new persistent state change. Output: `Classified fix — skipping task doc. Repro: <…>. Fix plan: <1-3 steps>.` Then stop, as above.
- `improvement`: bounded change or behavior-preserving refactor to an existing screen, endpoint, service, package, or workflow; desired behavior is known.
- `feature-grade`: multiple modules/layers, new endpoint/route, schema/model change, background job, auth boundary, shared-package contract, cross-app workflow, migration, or broad refactor.
- `open-ended`: product behavior, architecture, or refactoring direction is still being decided. Run the guided interview until it resolves into one of the above. Before converging, propose 2-3 realistic approaches with trade-offs and lead with your recommendation — do not settle on the first viable design.

If the request spans multiple independent subsystems (e.g., "a platform with chat, billing, and analytics"), flag that immediately instead of refining details: help the user decompose into separately shippable pieces and their order, then run intake on the first piece. Each piece gets its own inventory and task doc.

Classify refactors by risk: local behavior-preserving cleanup → `small`; bounded multi-file cleanup with known boundaries → `improvement`; cross-module/package/app refactor or public contract change → `feature-grade` or `open-ended`.

The agent makes the first call; the user may override. If the target area needs a code-grounded map first, use `implementation-map`.

### User Overrides

Wording such as `one-shot`, `fix`, `no task doc`, or `skip task doc` forces a downshift. Honor it: state `User-forced downshift to <fix|small>: <one-line rationale>.` and stop intake. If the change would cross a hard scope boundary (contract, auth/permission, migration, new persistent state, cross-module refactor), flag the specific risk in one sentence and ask the user to confirm the bypass first.

## Intake Mode

State the intake mode immediately after classification.

- `guided interview`: default when the user names a page, route, form, workflow, or a starting change without a complete list of desired changes. Bare page references such as `/service-requests/new?budgetYear=2032` hard-default here.
- `notes-first`: use when the user provides notes, screenshots, acceptance criteria, or a list of requested changes. Map each item to code findings, then interview only the gaps.
- `codebase-derived`: use when the user asks for findings, cleanup opportunities, or refactoring ideas without product input. Inspect the code, propose candidate changes, and label assumptions.

## Guided Interview Discipline

Run the interview yourself, one question at a time — never dump every question at once.

- Start exactly where the user pointed. Inspect only enough code to ask the next useful question.
- Ask one focused question, wait, then add the answer to a working change inventory with code evidence before asking the next.
- Move through adjacent concerns as they become relevant: route/search params, entry state, step sequence, field groups, validation, data selection, review/submit behavior, navigation, loading/empty/error states, permissions, and tests.
- Use understanding checks as checkpoints, not as the end of discovery. Never produce the Final Summary on the first response.
- Continue until the user approves the accumulated scope. The working inventory is conversation state, not the task doc.

## Inventory

For page, route, or form work, build a page-local change inventory from both inputs: the user's answers/notes/screenshots/criteria, and codebase findings about current behavior, route state, data flow, validation, permissions, tests, and nearby reusable patterns.

For refactors, build a refactor inventory: goal or suspected smell; current behavior and tests that must stay unchanged; code evidence for coupling, duplication, size, or repetition; proposed extraction/move/rename/decomposition; risk boundary and the validation that proves behavior is preserved; follow-up scope that must not be smuggled in.

Each entry records: user intent or source note; current behavior with code evidence; proposed change or realistic options; decision needed, if any; excluded or follow-up scope.

Keep scopes page-local. Do not absorb broader roadmap items, sibling-role workflows, backend contract changes, or adjacent pages unless the user explicitly asks to combine them.

For UI work, offer an early exploratory `image-artifact` variant board only when visual direction blocks shared understanding; early visuals are conversation aids, not the source of truth.

## Final Summary

Present only after the inventory has accumulated and the user is ready to decide whether it becomes a task doc: classification and rationale; intake mode; objective; change or refactor inventory; requested changes; behavior to preserve; excluded scope; likely risk areas; unresolved decisions.

Ask for approval or corrections. If decisions block a safe task doc, continue the question loop. If they only block implementation, record them under `Decisions Required Before Implementation`.

## Handoff And Gate

On approval of the Final Summary, invoke `task-doc` to render the document (interview/notes work usually maps to `brief`, codebase-derived findings to `codebase-derived`). Intake's classification is authoritative at this handoff: an approved Final Summary for `improvement` or `feature-grade` work satisfies `task-doc`'s size rejection gate — the accumulated inventory is the evidence the work justifies a durable artifact, so `task-doc` renders rather than re-litigating scale. Work small enough to be rejected was already downshifted in Classify First and never reaches this step.

Before creating a new doc, check for an active same-session doc for the same page, endpoint, or workflow and update it instead of duplicating.

<HARD-GATE>
Do NOT write code, edit implementation files, scaffold implementation artifacts, or run implementation generators. Approval of the Final Summary approves writing the task doc only. Implementation requires explicit user approval of the task doc itself, and belongs to `task-doc-delivery-loop` (or the normal session for downshifted work) — not to this skill.
</HARD-GATE>

Recommend `review-task-docs` when `Decisions Required Before Implementation` is non-empty or the scope spans cross-module, auth, migration, or other high-risk work. Offer `image-artifact` or `html-artifact` companions when a visual or browsable review surface would speed approval.

Close with: `Task doc written to <path>. Intake complete — review it, or ask me to run review-task-docs. On your approval, task-doc-delivery-loop implements it.`

Ambiguous replies such as "looks fine" or "continue" approve implementation only if they clearly refer to the task doc; otherwise ask a concise confirmation before any handoff to implementation.
