# Feature Implementation Report Skill Design

Date: 2026-05-18  
Status: Proposed for deliberation  
Target repository: `~/agent-skills`  
Proposed skill name: `implementation-report`  
Source mode: user brief + prototype report findings  

## Objective

Create a reusable agent skill that generates a code-grounded implementation report for a completed or in-progress feature. The report should help reviewers, maintainers, and future agents understand how a feature was implemented without manually tracing routes, components, hooks, API bindings, stores, shared packages, tests, and lifecycle side effects.

The skill should produce a Markdown report as the source of truth and optionally render an HTML artifact companion through the existing `html-artifact` skill. Its main value is not a pretty file inventory. Its value is a useful implementation anatomy: what runs, where it starts, which modules participate, what lifecycle and data flows exist, what tests cover the work, and what gaps or improvement candidates remain.

## Usefulness Verdict

This is useful when the feature spans multiple files, packages, routes, or state layers and when understanding the implementation requires reading across boundaries.

It is especially useful for:

- feature acceptance review after an agent or teammate finishes a slice
- onboarding a new agent before continuing work
- identifying hidden coupling, missing tests, duplicated code, or extraction candidates
- preparing technical review notes before a PR, roadmap update, or follow-up task doc
- preserving implementation context after a long-running session

It is less useful for:

- one-file changes
- small bug fixes
- pure copy, styling, or config edits
- features with no meaningful lifecycle, API, state, or test surface

The skill should include a rejection gate. If the target is too small, the correct output is a short refusal recommending normal review or a brief summary instead of creating an oversized artifact.

## Problem Statement

In feature-grade frontend and full-stack work, implementation knowledge is spread across:

- route files and loaders
- feature barrels and public APIs
- components and shared UI wrappers
- hooks and stores
- API helpers and request clients
- shared packages and factories
- background jobs and side effects
- tests and task documents

Without a repeatable reporting workflow, reviewers manually rediscover the implementation graph. That wastes time and makes gap analysis inconsistent. A generated report can reduce that cost if it is evidence-backed and opinionated about useful structure.

## Prototype Evidence

The Needs Assessment implementation report demonstrated that a feature anatomy report can reveal useful implementation shape quickly:

- entry routes and route loaders
- page tab structure and workflow boundaries
- API factories and request helper usage
- state sources across TanStack Query, router search, Zustand, background jobs, and local storage
- components grouped by workflow
- NOCOPO submission/import lifecycle
- test coverage by layer
- improvement candidates such as dense orchestration components and unresolved backend payload gaps

The same prototype also showed two risks:

- a report can drift into a skill proposal if the purpose is not bounded
- a manual report is slow unless the skill provides a repeatable evidence checklist

## Proposed Skill Scope

The skill should generate an implementation report for one target feature.

Accepted target inputs:

- feature name, such as `needs assessment`
- route path, such as `/needs-assessment`
- file path, such as `apps/procurement-ui/src/features/needs-assessment/index.ts`
- task doc path, PR summary, or implementation brief that names a feature

Required output:

- Markdown report written to the appropriate repo or artifact location chosen by the user or skill workflow

Optional output:

- HTML companion generated through `html-artifact`

## Non-Goals

The skill does not:

- implement code changes
- create a PR
- replace code review
- replace task docs or roadmap docs
- create an architecture decision record unless explicitly requested
- infer product requirements beyond the code and source material
- generate diagrams unless routed through a separate artifact skill
- include sensitive secrets, tokens, or raw private payloads

## Report Quality Bar

A report is useful only if it answers these questions:

1. Where does the feature start?
2. What user workflows or lifecycle phases does it implement?
3. Which components, hooks, APIs, stores, shared packages, and tests participate?
4. How does data move from route/load to render to mutation to invalidation?
5. What current behavior must be preserved?
6. What gaps, risks, or improvement candidates are visible from code evidence?
7. What should a future implementer inspect first?

If the report cannot answer most of these questions, the skill should say the source is too small or too ambiguous.

## Required Report Structure

The generated Markdown report should use this structure by default:

1. Title and metadata
2. TL;DR
3. Entry points
4. Workflow map
5. Route and lifecycle flow
6. Component map
7. Hooks, stores, and state sources
8. API and request layer
9. Shared code and reuse boundaries
10. Background jobs and side effects, if present
11. Error handling and guards
12. Test coverage map
13. Current behavior to preserve
14. Gaps and improvement candidates
15. File inventory
16. Review notes

Sections with no evidence should say `None found` or be omitted when clearly irrelevant. The report should not pad weak sections with speculation.

## Evidence Rules

The skill must ground claims in local files or supplied source material.

Required evidence collection:

- read repo instructions such as `AGENTS.md`, `CLAUDE.md`, and README/doc map when present
- identify feature entry points through route files, feature index exports, package exports, or task docs
- inspect imports and exports for the target feature
- inspect related API helpers and request clients
- inspect hooks and stores used by the feature
- inspect tests in matching feature, package, API, and utility folders
- inspect shared packages imported by the feature
- inspect task docs or artifact reports if the user provided them

Evidence format in the report:

- use file paths in tables
- name symbols when useful
- include line numbers only when a claim depends on a narrow implementation detail
- distinguish code evidence from inference

The skill should not claim coverage, behavior, or architectural intent unless supported by code or supplied docs.

## Discovery Workflow

1. Confirm the target feature and reject if the request is too small or ambiguous.
2. Read repo instructions and architecture docs relevant to the target repo.
3. Locate likely entry points:
   - route path files
   - feature folder and `index.ts` barrel
   - package exports
   - API modules
   - task docs or implementation docs
4. Build an evidence set:
   - components
   - hooks
   - stores
   - API helpers
   - shared package imports
   - tests
   - background jobs
   - validators and guards
5. Group files by workflow rather than by folder alone.
6. Trace primary lifecycle flows:
   - route load
   - render composition
   - user action
   - mutation
   - cache invalidation or navigation
   - error handling
7. Identify gaps using code evidence.
8. Write the Markdown report.
9. Validate that the report answers the quality-bar questions.
10. Offer or run `html-artifact` only when requested or when the user asked for an HTML companion.

## Gap Analysis Heuristics

The skill should surface gaps conservatively.

High-confidence gap signals:

- TODO or follow-up comments tied to shipped behavior
- untested hooks, reducers, workflow helpers, or API helpers in a tested feature area
- components that own route loading, mutation, filtering, dialogs, and navigation all at once
- duplicated request helpers or raw fetch calls where repo rules require a request client
- feature imports that bypass public barrels against repo conventions
- app-to-app imports in monorepos where shared packages are the required bridge
- missing error states or disabled reasons for guarded actions
- stale docs that contradict current code
- route guards implemented in render when repo conventions require route-level guards

Low-confidence signals should be worded as review candidates, not defects.

## Output Location Rules

The skill should support two location modes:

1. Repo-local Markdown report when the user wants the report committed with the project.
2. Agent artifact workspace when the user wants a shareable artifact outside the repo.

Default behavior should be explicit:

- If the user names a repo path, write there.
- If the user asks for an artifact, write under `~/agent-artifacts/<repo-name>/`.
- If the user asks for a durable repo doc, prefer an existing docs/artifacts convention if present.
- If no destination is clear, ask one focused question before writing.

The skill must not silently create `.agent/queues`, `.agent/tasks`, or repo-local agent folders unless the user explicitly asks for that repo-local convention.

## Relationship To Existing Skills

This skill should complement, not replace:

- `task-doc`: creates implementation task documents before work
- `review-task-docs`: validates task docs before implementation
- `prepare-frontend-handoff`: documents API/UI contracts for frontend handoff
- `prepare-qa-handoff`: documents QA validation scope
- `html-artifact`: renders Markdown into a browser artifact
- `repo-docs-audit`: audits repository documentation
- `repo-skill-scan`: finds repeated patterns that may become skills

The implementation-report skill sits after or during implementation review. Its output is descriptive and diagnostic.

## Proposed Skill Files

Potential structure:

```text
skills/implementation-report/
+-- SKILL.md
+-- references/
|   +-- report-template.md
|   +-- gap-heuristics.md
|   +-- discovery-checklist.md
+-- scripts/
    +-- collect-feature-evidence.js
```

The first version can ship without scripts if the workflow is still being validated. A script becomes useful when repeated manual scans stabilize, especially for:

- collecting matching files
- scanning imports
- listing tests
- calculating rough file sizes
- detecting TODOs and raw fetch calls

## Design Options

### Option A: Instruction-Only Skill

Create only `SKILL.md` and a concise report template reference.

Benefits:

- fastest to implement
- easiest to revise after real use
- avoids premature automation

Costs:

- evidence gathering remains manual
- output consistency depends on agent discipline

### Option B: Skill With Evidence Collector

Create `SKILL.md`, references, and a small script that scans a target path for files, imports, tests, TODOs, and file sizes.

Benefits:

- more repeatable reports
- lower manual tracing cost
- easier to compare reports across features

Costs:

- script must handle many repo shapes
- may overfit to TypeScript/React unless carefully scoped

### Option C: Artifact-First Workflow

Make the skill always produce Markdown and HTML in `~/agent-artifacts`.

Benefits:

- shareable by default
- consistent with artifact skills

Costs:

- wrong default when users need repo-local docs
- risks duplicating `html-artifact` responsibilities

Recommended path: start with Option A plus strong output-location rules, then add the evidence collector after two or three real reports expose stable automation needs.

## Decisions Required Before Implementation

1. Skill name:
   - Option A: `implementation-report`
   - Option B: `feature-implementation-report`
   - Recommendation: `implementation-report` because it is short and can still cover backend or cross-stack features.

2. Default output destination:
   - Option A: ask unless user specifies repo-local or artifact
   - Option B: default to `~/agent-artifacts`
   - Recommendation: ask when ambiguous. Silent destination choices already caused confusion in the prototype.

3. First version automation:
   - Option A: no script
   - Option B: simple evidence collector
   - Recommendation: no script for v1; use the first few reports to determine script shape.

4. HTML companion behavior:
   - Option A: always offer after Markdown
   - Option B: only generate when explicitly requested
   - Recommendation: offer, but do not generate unless requested.

5. Repo-local docs convention:
   - Option A: detect `docs/artifacts/`
   - Option B: ask for every repo-local write
   - Recommendation: detect existing `docs/artifacts/`; otherwise ask.

## Validation Plan

Before shipping the skill:

1. Run it against the Needs Assessment module and compare output to the existing implementation report.
2. Run it against a smaller service request feature and confirm it either produces a concise useful report or rejects if too small.
3. Check whether another agent can use the generated report to identify entry points, lifecycle, tests, and gaps without reading hidden chat context.
4. Confirm the skill does not invent requirements or implementation intent.
5. Confirm repo-local output and agent-artifact output are both explicit and predictable.

## Acceptance Criteria

The skill is ready when:

- `skills/implementation-report/SKILL.md` exists with clear trigger metadata
- the skill has a concise report template or references
- it rejects small or ambiguous requests
- it has explicit output-location rules
- it requires code evidence for claims
- it produces a report with entry points, lifecycle, components, hooks/stores, APIs, shared code, tests, gaps, and file inventory
- it preserves separation from `task-doc`, `prepare-qa-handoff`, and `html-artifact`
- it has been validated against at least one real feature report

## Open Questions For Deliberation

- Should the skill be global in `~/agent-skills`, or should some repo-specific report variants live in repo-local skills?
- Should reports include code metrics such as file size, import fan-in/fan-out, and test count in v1?
- Should reports include Mermaid diagrams, or should diagrams stay as optional artifact follow-ups?
- Should the skill create both repo-local Markdown and agent-artifact HTML when a user asks for both, or should that remain two explicit steps?
- What threshold makes a feature "large enough" for this report: route count, file count, package boundary count, lifecycle complexity, or user judgment?

## Excluded From This Spec

- Implementing the skill.
- Adding `implementation-report` to `README.md`.
- Updating `bin/link-skills.sh`.
- Creating an HTML companion for this spec.
- Moving or editing the existing Needs Assessment report.
