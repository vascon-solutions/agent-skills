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
- **Implementation orientation sections are mandatory.** Include the sections for design references, architecture summary, code evidence, current behavior to preserve, likely files to touch, and decisions required before implementation. Use `None` when the source genuinely lacks the input; do not invent context to satisfy a heading.
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

Use `transform-only` when the source is already authoritative and bounded. Transform-only restructures the source into task-doc format without adding scope, requirements, or assumptions. Codebase reading is still allowed in transform-only mode when it only verifies existing behavior, identifies reusable patterns, or fills implementation-orientation sections; it must not expand the task.

Use `synthesized` when the source is incomplete and the task must be inferred from multiple inputs. In synthesized mode:

- label all assumptions explicitly
- do not invent major requirements without user direction
- use strong exclusions to prevent drift

### Protect scope

- Separate included scope from excluded scope
- Keep implementation detail out of the objective unless it is already part of the source
- Preserve the difference between design intent and execution guidance: task docs should orient implementers without becoming line-by-line implementation plans
- Treat **Excluded** as work that will not ship in this task. Treat **Follow-ups** as separate future tasks, including excluded work that may become valid later. Approval gates for excluded follow-up work belong in the follow-up task, not the current one.
- Add approval gates only for: security, auth, compliance, finance, destructive data work, infra changes, or permission model changes

### Add implementation orientation

Every task doc should carry enough context for an implementing agent to start safely without hidden chat history.

- **Design Reference:** Link to authoritative specs, roadmaps, PRDs, issues, or task source docs. If the task is derived from a spec, include `Source Spec: <path>`. If the source is only the user brief, say so.
- **Architecture Summary:** Give a compact explanation of the intended approach and system boundary. This should be shorter than a spec, but clear enough to prevent wrong architecture.
- **Code Evidence:** Cite files for read-only claims about current behavior, patterns, dependencies, or service ownership. Prefer file plus symbol/section; add line numbers when a claim depends on a narrow implementation detail. Do not cite code when the task is pure product discovery and no codebase claim is being made.
- **Current Behavior To Preserve:** List invariants, contracts, guardrails, user-visible behavior, or compliance behavior that must remain true after implementation. Use `None` only when there is no current behavior constraint.
- **Likely Files To Touch:** List probable write targets or inspection points for new work. This is orientation, not a mandate to edit every file and not a substitute for code evidence.
- **Decisions Required Before Implementation:** List unresolved choices that block safe execution. Each unresolved decision must include at least two realistic options, implications or tradeoffs, and who or what should resolve it. If none remain, explicitly say `None`. If this section is non-empty, the implementing agent must resolve those decisions before writing code.

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

Before choosing an output path, detect any existing task-doc convention in this order:

1. a user-specified path
2. repo instructions such as `AGENTS.md`, `CLAUDE.md`, or docs that explicitly name a task-doc location or naming convention
3. existing task-doc directories or file patterns, such as repeated task files under `.agent/tasks/`, `tasks/`, `docs/tasks/`, or similarly named folders
4. existing filename conventions used for comparable task artifacts in the repo

If no clear convention is found, do not invent one. Provide the task doc content directly.

## Validation

Before declaring complete, verify:

- the work is large enough to deserve a durable artifact (re-check the rejection gate)
- the task is not silently hiding multiple major sub tasks
- scope and excluded items are both present
- design references, architecture summary, code evidence, current behavior to preserve, likely files, and decision points are present and useful
- spec-derived tasks include a `Source Spec` reference
- non-empty decision points include options, implications, and a resolver, and are explicit blockers rather than implementation-time suggestions
- excluded work is not mixed into current-task approval gates, deliverables, or completion criteria
- the doc can be executed by another agent without relying on hidden chat context
- any proposed sub tasks are real separable workstreams, not implementation steps

## Output

Produce exactly one of:

- a completed task document using [references/task-template.md](references/task-template.md)
- a brief refusal with a recommendation to use normal plan mode

If the user specified a path, write the file there. Otherwise, if the repo has a clear existing task-doc convention, follow it. If no clear convention is found, provide the content directly instead of inventing a repo-specific default path. If the user asks for output only, provide the content directly instead of writing a file.

Do not implement. Do not start coding.

## HTML Companion

After the task document is written (or a refusal is issued), append this as a separate follow-up line — not part of the task document itself:

> "HTML companion available. Run `html-artifact` on this file for a browser-ready version. (yes / skip)"

If the user says yes, invoke `html-artifact` on the output path. This is a post-completion affordance. It does not modify the task document, does not count as commentary, and does not affect the "Produce exactly one of" output contract above.

## Cautions

- Turning small work into heavyweight ceremony
- Inventing requirements that were never in the source
- Inventing architecture choices or code evidence to fill mandatory sections
- Omitting behavior invariants for load-bearing code such as auth, payments, workflow, permissions, or migrations
- Listing likely files from guesswork when codebase inspection is required
- Turning Likely Files To Touch into a stealth implementation plan
- Putting approval gates, deliverables, or completion criteria for excluded follow-up work in the current task
- Hiding assumptions inside assertive wording
- Collapsing multiple major workstreams into one vague task
- Omitting exclusions
- Generating a checklist that another agent cannot actually execute
