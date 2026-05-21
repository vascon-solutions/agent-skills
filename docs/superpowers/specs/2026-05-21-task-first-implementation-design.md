# Task-First Implementation Skill Design

Date: 2026-05-21
Status: Proposed for deliberation
Target repository: `~/agent-skills`
Proposed skill name: `task-first-implementation`
Source mode: user brief + service request UI workflow retrospective + existing skill review

## Objective

Create a lightweight orchestration skill for frontend, backend, full-stack, and shared-package improvements where the user wants a deliberate review-first workflow before code changes.

The skill should guide the agent through discovery, focused questioning, shared understanding, a durable task document, optional visual artifact generation, and explicit review gates before implementation. Its purpose is not to create a new documentation format. Its purpose is to compose existing skills consistently so repeated improvement work follows the user's preferred rhythm:

1. gather change requests from chat and code context
2. reflect the agent's understanding back to the user
3. produce a task doc as the implementation source of truth
4. optionally use an early UI visual to de-risk visual discussion, or generate a quick companion artifact from the task doc
5. pause for user or second-agent review
6. implement only after approval
7. validate and review the finished implementation against the task doc

## Problem Statement

In interactive implementation sessions, it is easy for an agent to gather the requested changes in memory and move directly into code. That can be efficient, but it loses useful checkpoints:

- no durable task document exists for second review
- no explicit included/excluded scope is captured
- no quick visual summary exists for UI or architecture direction
- no review gate prevents the agent from implementing a misunderstood request
- later agents cannot recover the reasoning from chat history alone

The service requests UI session showed the good part of the current workflow: the agent could absorb several user-provided changes, infer intended behavior, inspect reference patterns, and implement coherently. It also showed the missing part: before implementation, the agent should have converted the gathered change list into a task doc and optional visual overview, then waited for review.

## Existing Skill Fit

This skill should orchestrate existing skills instead of duplicating them.

When this spec says to use another skill, the eventual `SKILL.md` should invoke that skill through the skill mechanism when available. If a named skill is unavailable in the environment, follow its documented workflow from repo-local skill files when possible and state the fallback. Do not silently inline or skip skill checklists.

### `brainstorming`

Use its discovery pattern: explore context, ask one focused question at a time, reflect understanding, propose approaches, and get approval.

This skill replaces the heavy `brainstorming` -> `writing-plans` path for improvement-grade work where desired behavior is already mostly known. Use the full `brainstorming` path only when product direction, architecture options, or feature decomposition are still genuinely open.

The eventual skill trigger must not use `brainstorm`, `brainstorming`, or similar wording in frontmatter. Those words collide with the existing `brainstorming` trigger. Keep router-facing language centered on `task-doc-first`, `review-gated`, and `improvement-grade` implementation.

### `task-doc`

Use this as the canonical durable artifact for implementation work. The task doc should capture objective, included scope, excluded scope, current behavior to preserve, likely files, code evidence, decisions, and validation. For the target workflow, this is usually more appropriate than a brainstorming design spec because the user often already knows the desired changes.

The existing `task-doc` skill rejects small local tweaks by default. This orchestration skill must define a narrow exception for review-gated improvement work: if the task is classified as `improvement` or `feature-grade`, use `task-doc` even when the work includes UI tweaks or incremental fixes. If the task is classified as `small`, respect `task-doc` downshift behavior and use a short plan/checkpoint unless the user explicitly asks for a durable task doc.

### `image-artifact`

Use after the task doc exists when a visual summary would improve review speed. For UI work, this skill may also offer an early exploratory variant board before clarifying questions when visual direction is a blocker. Early visuals are conversation aids only; the Markdown task doc remains the implementation source of truth.

Recommended kinds:

- UI work: `ui-variant-board`, `summary-card`, or `decision-board`
- backend/API work: `architecture-diagram` or `api-flow`
- full-stack work: `api-flow` plus a low-text boundary diagram

The Markdown task doc remains the source of truth. The image is a quick overview, not a replacement for the task doc.

### `html-artifact`

Offer when a browser artifact adds value beyond reading Markdown: interactive prototypes, annotated diffs, browsable route/state tables, linked acceptance criteria, or side-by-side review surfaces. Prefer HTML over image when detailed wording must remain faithful and browsing or interaction is part of the review.

### `review-task-docs`

Use for second review before implementation when the user asks for another review or when the task has meaningful risk, ambiguity, or cross-module scope.

### `review-implementation`

Use after implementation to review finished code against the task doc, acceptance criteria, or validation requirements. This skill exists in `~/agent-skills/skills/review-implementation`; if it is not exposed in the active skill catalog, perform the same report-only review locally and state that fallback.

### `address-review-findings`

Use after `review-implementation` when the report finds valid gaps. The post-implementation chain is: implement -> validate -> `review-implementation` -> if findings exist, `address-review-findings`.

### Related Skills

Use `implementation-map` before this skill when the target area is unfamiliar and the agent needs a code-grounded map of entry points, runtime flow, ownership boundaries, tests, or refactoring candidates. Do not use `implementation-map` for one-file changes or pure styling edits.

Use `markdown-artifact` for polished standalone Markdown artifacts under `~/agent-artifacts/`, not as the implementation source of truth for code work. Code implementation scope should live in the repo-local task doc when a task-doc convention exists.

## Proposed Skill Scope

The skill should apply when the user wants task-doc-first, review-gated implementation of changes, fixes, or improvements before code changes.

Accepted work:

- frontend UI improvements
- backend endpoint/service changes
- full-stack workflow changes
- shared-package behavior changes
- bug fixes with cross-file impact
- existing implementation improvements
- follow-up changes discovered during a prior implementation

The skill may reject or downshift when the work is too small. For a one-line or one-file fix, it should recommend a short plan/checkpoint instead of creating a durable task doc unless the user explicitly wants the ceremony.

This skill does not replace the full creative design path. Open-ended product or architecture work still escalates to `brainstorming`; improvement-grade work with known desired behavior stays in this lighter task-doc-first path.

## Non-Goals

The skill does not:

- create another spec/task format
- replace `task-doc`
- replace `brainstorming`
- replace `writing-plans` for large implementation plans
- treat generated images as the source of truth
- create final companion artifacts before a source Markdown task doc exists, except for explicitly exploratory UI visuals used during discovery
- implement code before the review gate is cleared
- force heavy process for trivial changes
- bypass repo instructions, validation rules, or existing task conventions

## Workflow

### 1. Classify the Request

Determine whether the work is:

- `small`: narrow one-file or one-behavior change
- `improvement`: bounded FE/BE/shared change with known desired behavior
- `feature-grade`: multi-file, workflow-level, or cross-boundary work
- `open-ended`: product/design direction is not yet clear

The agent classifies the request first and states the classification with a one-sentence rationale. The user can override the classification; if the user asks for a task doc or review gate, treat that as an explicit preference unless it conflicts with repo instructions or safety constraints.

Classification cues:

- `small`: one file and one behavior, no API/schema/route contract change, no cross-module dependency, no new persistent state, no auth/permissions/data migration, and no need for a future agent to recover context.
- `improvement`: bounded change to an existing screen, endpoint, service, package, or workflow; desired behavior is known; may touch several nearby files; may need acceptance criteria or visual review; does not introduce a new product concept or major architecture choice.
- `feature-grade`: multiple modules or layers, new endpoint or route, schema/model change, background job, auth/permission boundary, shared package contract, cross-app workflow, migration, or any change where implementation must be recoverable across sessions or agents.
- `open-ended`: user is still deciding product behavior, comparing multiple architecture approaches, asking for ideation, or describing a broad capability that should decompose into separate task docs.

Default handling:

- `small`: use a short explicit plan unless the user requests a task doc. Output: `Skipping task doc - classified small because <reason>. Plan: <1-3 steps>.`
- `improvement`: use this skill and produce a task doc
- `feature-grade`: use this skill and consider `review-task-docs`
- `open-ended`: use full `brainstorming` and potentially a brainstorming spec

### 2. Run the Question Loop

For UI work, before asking clarifying questions, assess whether a visual decision is blocking shared understanding. If so, offer a quick exploratory UI variant board as its own step. Skip this branch when desired behavior is already visually clear. Early visuals do not replace the task doc, and implementation still waits for the task-doc review gate.

Use the `brainstorming` style for the discovery loop:

- inspect relevant repo context before asking deep questions
- infer from conversation history when the user has already supplied details
- ask one focused question at a time only when missing information blocks a safe task doc
- reflect back the current understanding after each meaningful user answer
- distinguish included scope from excluded scope early

The agent should not ask redundant questions when the user has already provided a clear instruction. It should gather the changes from memory and code context, then present the understanding.

### 3. Present Understanding Before Writing

Before creating the task doc, present a compact understanding check:

- objective
- requested changes
- behavior to preserve
- excluded scope
- likely risk areas
- unresolved decisions, if any

Ask for approval or corrections. Do not write code.

If unresolved decisions block a safe task doc, loop back to focused questions before writing. If decisions do not block documentation but must be resolved before code, write the task doc with `Decisions Required Before Implementation` populated and keep the implementation gate closed until those decisions are resolved.

### 4. Create the Task Doc

Invoke `task-doc` when available. If the skill is unavailable, follow the repo-local `task-doc` workflow and state that fallback. The task doc is the implementation source of truth.

Before creating a new task doc, check whether the current chat/session already has a task doc for the same page, endpoint, workflow, or implementation thread. When subsequent improvements belong to that same active task, update the existing task doc instead of creating a near-duplicate. Create a new task doc only when the new request is independently shippable, has materially different risk/validation, or the user explicitly asks for a separate artifact.

Path resolution should follow `task-doc` rules:

1. user-specified path
2. repo instructions
3. existing task-doc convention, such as `.agent/tasks/`
4. direct output if no convention exists

The task doc should include, at minimum:

- Objective
- Source Context
- Included Scope
- Excluded Scope
- Current Behavior To Preserve
- Architecture Summary
- Code Evidence
- Likely Files To Touch
- Decisions Required Before Implementation
- Acceptance Criteria
- Validation Plan
- Follow-ups

Choose source mode using `task-doc` rules. Chat-derived work often maps to `brief`; follow-up work discovered from implementation or repo inspection may map to `codebase-derived`. Do not force one source mode from this orchestration skill.

### 5. Offer or Generate Visual Companion

After the task doc exists, decide whether a visual companion is useful.

Use `image-artifact` when the user wants a quick overview image or when the work has visual/API/architecture shape. Keep it low-text.

Use `html-artifact` when the review needs browsable, linked, interactive, or side-by-side presentation beyond plain Markdown.

Recommended default behavior:

- UI task doc: offer image companion by default after the task doc, unless an early exploratory visual already answered the review need
- backend/API task doc: offer image companion when flow or boundaries matter
- HTML companion: offer only when browsing or interaction adds value, such as interactive prototypes, annotated diffs, route/state tables, linked criteria, or side-by-side review
- small task doc: skip artifacts unless requested

The skill should not create final review artifacts from unstabilized chat notes. The normal source for companion artifacts should be the reviewed task doc.

### 6. Review Gate

Stop before implementation.

The eventual `SKILL.md` must include this hard gate:

```xml
<HARD-GATE>
Do NOT write code, edit implementation files, scaffold implementation artifacts, run implementation generators, or begin any implementation task until the task doc has been written or updated and the user explicitly approves implementation after that review point.

Approval of the understanding check is approval to write or update the task doc only. Approval of the task doc is the implementation gate. If the user asks for a second task-doc review, implementation remains blocked until that review is complete and the user explicitly approves implementation.
</HARD-GATE>
```

The close of the planning phase should say:

> Task doc written to `<path>`. Optional artifacts: `<paths or skipped>`. Please review or ask me to run a second task-doc review before implementation.

Implementation begins only after the user explicitly approves implementation after the task doc review point. Ambiguous replies such as "looks fine" or "continue" count only if they clearly refer to implementation approval; otherwise ask a concise confirmation.

### 7. Implementation Mode

After approval, implement against the task doc.

For feature-grade or risky work:

- use a short internal plan or `writing-plans` if the task doc is large enough
- write or update tests first where practical
- keep edits scoped to the task doc
- do not silently add excluded scope

### 8. Post-Implementation Review

After implementation and validation:

- execute the commands listed in the task doc's `Validation Plan`
- if `Validation Plan` is empty or incomplete, discover validation from repo conventions and report the gap
- use `review-implementation` against the task doc when available; otherwise run a local report-only review against the same criteria
- if review findings exist, route valid findings through `address-review-findings`
- report changed files and validation results
- note any follow-up work separately

## Decision Rules

### Task Doc vs Brainstorming Spec

Use a task doc by default when:

- the user already knows the desired change
- the work improves an existing implementation
- the main risk is execution quality, not product direction
- another agent or developer should be able to implement from the artifact

Use a brainstorming design spec when:

- product behavior is still open
- multiple architecture options need deliberate comparison
- the work should decompose into multiple task docs
- the user asks for a formal design spec

### Task Doc vs Normal Plan

Use normal plan mode when:

- the change is tiny
- no durable artifact would help future review
- the user explicitly wants speed over ceremony

Use task doc when:

- the change spans multiple files or modules
- another reviewer should inspect the intended scope
- validation or acceptance criteria need to be preserved
- there is meaningful ambiguity, risk, or cross-boundary behavior

### Image vs HTML Companion

Use image when:

- visual hierarchy, UI state, architecture shape, or API flow should be understood quickly
- the output can stay low-text

Use HTML when:

- interactive prototypes, annotated diffs, browsable route/state tables, linked acceptance criteria, or side-by-side review surfaces would help
- exact wording, tables, links, route names, command lists, and criteria matter and browsing adds value beyond Markdown

Use both when:

- the task benefits from both a browsable/interactive review surface and a quick visual board

## Proposed Skill Trigger Description

Draft frontmatter description:

```yaml
name: task-first-implementation
description: Use for task-doc-first, review-gated implementation of bounded frontend, backend, full-stack, or shared-package improvements when desired behavior is mostly known. Creates or updates a task doc, optionally adds image/html companion artifacts, waits for explicit implementation approval, then implements and reviews against the task doc.
```

## Proposed Skill Body Shape

The eventual `SKILL.md` should stay concise and delegate detail to existing skills:

1. Purpose
2. When to use
3. When not to use
4. Required orchestration sequence
5. Decision table for task doc vs brainstorming spec vs normal plan
6. Artifact companion rules
7. Review gates
8. Related-skill routing and fallback mechanics
9. Final reporting requirements

V1 should stay small: keep `SKILL.md` at or below 100 lines unless examples are split into references, and ask no more than three clarifying questions before an understanding check unless a blocking decision prevents a safe task doc.

## Example Flow

User says:

> Let's make UI improvements on the `/service-requests` landing. I know exactly what needs to change.

Expected behavior:

1. Agent uses brainstorming-style context gathering.
2. Agent gathers each requested change from chat.
3. Agent inspects relevant route/table/reference code.
4. Agent presents an understanding check.
5. Agent creates `.agent/tasks/YYYY-MM-DD-service-requests-landing-ui.md` if the repo has that convention, or updates the existing active task doc for the same page/workflow.
6. Agent offers an image artifact showing the landing page work at a glance.
7. Agent stops for review.
8. After approval, agent implements and validates.
9. Agent reviews finished implementation against the task doc.

## Open Questions

1. Skill name: `task-first-implementation`, `review-gated-implementation`, or `spec-first-improvements`?
2. Should the skill always offer `review-task-docs`, or only when the task doc has non-empty decisions/risk?
3. Should repo-local task docs be preferred over `~/agent-artifacts` for all code implementation work?
4. Should image artifacts be opt-in every time, or auto-generated for UI work when the user has previously stated this preference? If the preference should persist across sessions, store it in repo instructions such as `AGENTS.md` or `CLAUDE.md`; otherwise treat it as session-local and ask again next session.

## Recommended V1 Decisions

1. Use `task-first-implementation` as the skill name because the task doc is the source of truth.
2. Offer `review-task-docs`; do not run it automatically unless the user asks or the task has unresolved decisions.
3. Prefer repo-local task docs when the target repo has a convention. Otherwise, use `task-doc` direct output rules.
4. Auto-offer image artifacts for UI work, but ask before generating unless a repo instruction or current-session instruction says to always generate them. Do not assume an unstored preference across sessions.
5. Keep router-facing trigger language free of `brainstorm`/`brainstorming`; explain the relationship to `brainstorming` inside the skill body.
6. Reuse and update the active same-session task doc for follow-up improvements on the same implementation thread.
7. Let the agent make the first classification call using explicit cues, with user override allowed.
8. Keep `task-first-implementation` as the v1 name; `review-gated-implementation` is the strongest alternate if behavior-first naming becomes preferable.

## Acceptance Criteria

- The skill clearly composes `brainstorming`, `task-doc`, `image-artifact`, `html-artifact`, `review-task-docs`, and `review-implementation`.
- The skill does not introduce a competing task/spec format.
- The skill prevents direct implementation before a task doc and review gate for improvement-grade work.
- The skill supports both frontend and backend work.
- The v1 `SKILL.md` stays at or below 100 lines unless examples are split into references, and the workflow asks no more than three clarifying questions before an understanding check unless blocked.
- The skill includes downshift behavior for small fixes.
- The skill includes escalation behavior for open-ended feature design.
- The skill trigger does not collide with `brainstorming` frontmatter.
- The skill contains a hard review gate that blocks implementation until explicit post-task-doc approval.
- The skill includes concrete classification heuristics and names who decides.
- The skill updates an existing same-session task doc for repeated improvements instead of creating duplicate task stubs.
- The skill lets `task-doc` classify source mode instead of forcing `brief`.
- The skill ties validation to the task doc's `Validation Plan` and falls back to repo convention discovery when needed.
- The skill routes post-review findings through `address-review-findings`.
- The skill explains when to use adjacent `implementation-map` and `markdown-artifact` skills.

## Implementation Notes

Likely files for the eventual skill:

- Create `skills/task-first-implementation/SKILL.md`
- Optionally create `skills/task-first-implementation/agents/openai.yaml`
- Update `README.md` skill list and typical usage section

No bundled scripts or references are needed for v1 unless examples become useful after initial usage.
