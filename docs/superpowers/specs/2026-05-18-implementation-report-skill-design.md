# Feature Implementation Map Skill Design

Date: 2026-05-18
Status: Proposed for deliberation
Target repository: `~/agent-skills`
Proposed skill name: `implementation-map`
Source mode: user brief + prototype report findings + deliberation

## Objective

Create a reusable agent skill that generates a code-grounded implementation map for a completed or in-progress feature. The map should help developers, reviewers, maintainers, and future agents quickly understand a feature's flow and implementation architecture without manually browsing through routes, controllers, components, services, hooks, API bindings, stores, jobs, shared packages, tests, and lifecycle side effects.

The skill should produce a Markdown implementation map as the source of truth. After the Markdown is complete, the skill should decide whether to produce an HTML companion through `html-artifact`, a static visual companion through `image-artifact`, both, or neither. Its main value is not a pretty file inventory. Its value is a useful developer map: where the feature starts, how the user flow maps to code, how runtime data moves, which modules own which responsibilities, what architecture boundaries exist, what tests explain behavior, and what refactoring or improvement opportunities are visible from code evidence.

## Usefulness Verdict

This is useful when the feature spans multiple files, packages, routes, services, state layers, jobs, or API boundaries and when understanding the implementation requires reading across boundaries.

It is especially useful for:

- feature acceptance review after an agent or teammate finishes a slice
- onboarding a new agent before continuing work
- onboarding a developer who needs the feature flow before changing code
- identifying hidden coupling, missing tests, duplicated code, or extraction candidates
- planning refactoring or implementation improvements
- preparing technical review notes before a PR, roadmap update, or follow-up task doc
- preserving implementation context after a long-running session

It is less useful for:

- one-file changes
- small bug fixes
- pure copy, styling, or config edits
- features with no meaningful lifecycle, API, state, persistence, architecture boundary, or test surface

The skill should include a rejection gate. If the target is too small, the correct output is a short refusal recommending normal review or a brief summary instead of creating an oversized artifact.

## Problem Statement

In feature-grade frontend, backend, full-stack, and shared-package work, implementation knowledge is spread across:

- route files, pages, loaders, controllers, or resolvers
- feature barrels, public APIs, modules, and package exports
- components, shared UI wrappers, services, use cases, and repositories
- hooks, stores, caches, transactions, validators, schemas, and guards
- API helpers, request clients, DTOs, contracts, and shared types
- shared packages, factories, libraries, and domain helpers
- background jobs, queues, events, imports, exports, and side effects
- tests and task documents

Without a repeatable mapping workflow, developers manually rediscover the implementation graph before they can make safe changes. That wastes time and makes architecture and refactoring analysis inconsistent. A generated implementation map can reduce that cost if it is evidence-backed, opinionated about useful structure, and visual enough to make flows understandable quickly.

## Prototype Evidence

The Needs Assessment implementation report demonstrated that a feature anatomy map can reveal useful implementation shape quickly:

- entry routes and route loaders
- page tab structure and workflow boundaries
- API factories and request helper usage
- state sources across TanStack Query, router search, Zustand, background jobs, and local storage
- components grouped by workflow
- NOCOPO submission/import lifecycle
- test coverage by layer
- improvement candidates such as dense orchestration components and unresolved backend payload gaps

The same prototype also showed two risks:

- a map can drift into a skill proposal if the purpose is not bounded
- a manual map is slow unless the skill provides a repeatable evidence checklist
- text-only output can be slower to digest than a diagram-backed map for lifecycle, API, and architecture flows

## Proposed Skill Scope

The skill should generate an implementation map for one target feature, module, package capability, backend workflow, or full-stack vertical.

Accepted target inputs:

- feature name, such as `needs assessment`
- route path, such as `/needs-assessment`
- file path, such as `apps/procurement-ui/src/features/needs-assessment/index.ts`
- backend module, controller, service, job, or package path
- task doc path, PR summary, or implementation brief that names a feature

Required output:

- Markdown implementation map written to the appropriate repo or artifact location chosen by the user or skill workflow

Companion artifact output:

- HTML companion generated through `html-artifact` when readable detail, file paths, tables, and snippets should be navigable in a browser
- image companion generated through `image-artifact` when a static architecture diagram, API flow, user flow, or refactoring hotspot map would improve understanding
- both HTML and image companions for complex full-stack or refactor-oriented features
- neither when the feature is simple enough for Markdown alone

## Non-Goals

The skill does not:

- implement code changes
- create a PR
- replace code review
- replace task docs or roadmap docs
- create an architecture decision record unless explicitly requested
- infer product requirements beyond the code and source material
- hand-roll artifact generation that belongs to `html-artifact` or `image-artifact`
- include full source files or large code dumps in generated artifacts
- include sensitive secrets, tokens, or raw private payloads

## Map Quality Bar

A map is useful only if it answers these questions:

1. Where does the feature start?
2. What user workflows or lifecycle phases does it implement?
3. Which frontend, backend, shared-package, job, state, API, persistence, and test surfaces participate?
4. How does data move from entry point to rendering or handling, mutation, persistence, invalidation, navigation, response, or side effect?
5. What current behavior must be preserved?
6. What gaps, risks, or improvement candidates are visible from code evidence?
7. What should a future implementer inspect first?
8. What implementation architecture and ownership boundaries matter for refactoring?
9. Which diagrams or visual flows would make the feature easier to understand?

If the map cannot answer most of these questions, the skill should say the source is too small or too ambiguous.

## Stack Profiles

The skill should be stack-agnostic and should not split into separate frontend and backend skills in v1. Instead, it should detect the relevant profile and activate the right evidence sections.

Profiles:

- `frontend`: routes/pages/loaders, components, hooks, client state, request clients, cache invalidation, UI tests
- `backend`: routes/controllers/resolvers, services/use cases, repositories/models, DTOs/schemas, guards/policies, transactions, jobs, integration tests
- `full-stack`: frontend entry points, backend endpoints, contracts, shared types, request/response lifecycle, cross-boundary failures
- `library/package`: public exports, factories, domain helpers, consumers, test contract, compatibility boundaries
- `mixed/unknown`: enough evidence to orient the developer while marking uncertain boundaries as inference

## Required Map Structure

The generated Markdown implementation map should use this structure by default:

1. Title and metadata
2. 30-second summary
3. Stack profile and scope
4. Start here: first files to open, in order
5. User or business flow mapped to code
6. Runtime flow
7. Implementation architecture
8. Ownership boundaries
9. State, data, persistence, and side effects
10. API, request, contract, or messaging layer
11. Error handling, guards, and permissions
12. Tests to read and test gaps
13. Current behavior to preserve
14. Coupling, complexity, and refactoring opportunities
15. Visuals and artifact decision
16. File inventory
17. Review notes

Sections with no evidence should say `None found` or be omitted when clearly irrelevant. The map should not pad weak sections with speculation.

## Required Visuals

For medium or complex features, the Markdown map should include at least one visual flow description that can be rendered by an artifact companion. The visual may be expressed as Mermaid, ASCII, table-driven flow steps, or a clear artifact prompt section, depending on what the downstream artifact skill can use faithfully.

Useful visual types:

- user flow diagram
- runtime sequence flow
- frontend/backend boundary diagram
- API or event flow diagram
- state ownership map
- persistence and side-effect map
- refactoring hotspot map

Small features may skip diagrams when the Markdown flow is enough.

## Artifact Decision Rules

The skill should always write the Markdown implementation map first. After the Markdown is complete, it should decide whether a companion artifact will materially improve understanding.

Use `html-artifact` when the reader needs:

- faithful readable text
- file paths, symbols, tables, links, and exact labels
- compact code snippets
- navigable sections
- side-by-side flow and architecture views
- a browser-ready developer handoff

Use `image-artifact` when the reader needs:

- low-text architecture or API flow visualization
- static system boundary diagram
- user flow or lifecycle diagram
- refactoring hotspot map
- stakeholder-friendly visual summary

Use both when the feature is complex, full-stack, or refactor-oriented enough that developers benefit from both readable detail and a quick visual map.

Use neither when the target is small enough that the Markdown source is already clear.

HTML artifacts may include compact code snippets, but not full files. Snippets should explain the implementation pattern, entry point, lifecycle step, or boundary. Image artifacts should keep text short and avoid dense code blocks or large file inventories.

## Evidence Rules

The skill must ground claims in local files or supplied source material.

Required evidence collection:

- read repo instructions such as `AGENTS.md`, `CLAUDE.md`, and README/doc map when present
- identify feature entry points through route files, feature index exports, package exports, or task docs
- inspect imports and exports for the target feature
- inspect related API helpers and request clients
- inspect hooks and stores used by the feature
- inspect controllers, resolvers, services, repositories, DTOs, validators, guards, jobs, events, and schemas when backend evidence exists
- inspect tests in matching feature, package, API, and utility folders
- inspect shared packages imported by the feature
- inspect task docs or artifact reports if the user provided them

Evidence format in the map:

- use file paths in tables
- name symbols when useful
- include line numbers only when a claim depends on a narrow implementation detail
- distinguish code evidence from inference

The skill should not claim coverage, behavior, or architectural intent unless supported by code or supplied docs. Refactoring opportunities must be tied to evidence such as file responsibility density, duplicated logic, cross-boundary imports, missing tests, stale docs, TODOs, or inconsistent guard/error handling.

## Discovery Workflow

1. Confirm the target feature and reject if the request is too small or ambiguous.
2. Read repo instructions and architecture docs relevant to the target repo.
3. Determine the stack profile: frontend, backend, full-stack, library/package, or mixed/unknown.
4. Locate likely entry points:
   - route path files
   - controllers or resolvers
   - feature folder and `index.ts` barrel
   - backend module/service/job files
   - package exports
   - API modules
   - task docs or implementation docs
5. Build an evidence set:
   - components
   - hooks
   - stores
   - API helpers
   - controllers, services, repositories, DTOs, schemas, guards, policies
   - shared package imports
   - tests
   - background jobs
   - validators and guards
6. Group files by workflow rather than by folder alone.
7. Trace primary lifecycle flows:
   - route load
   - render composition
   - controller or resolver handling
   - service/use-case execution
   - repository or external dependency interaction
   - user action
   - mutation
   - transaction, event, queue, or job
   - cache invalidation or navigation
   - error handling
8. Identify implementation architecture, ownership boundaries, and refactoring opportunities using code evidence.
9. Write the Markdown implementation map.
10. Validate that the map answers the quality-bar questions.
11. Decide whether visual artifacts are useful.
12. Invoke `html-artifact`, `image-artifact`, both, or neither based on the artifact decision rules. Artifact generation happens only after the Markdown map is complete.

## Gap Analysis Heuristics

The skill should surface gaps conservatively.

High-confidence gap signals:

- TODO or follow-up comments tied to shipped behavior
- untested hooks, reducers, workflow helpers, or API helpers in a tested feature area
- components that own route loading, mutation, filtering, dialogs, and navigation all at once
- backend services that own validation, persistence, policy, orchestration, and external calls all at once
- duplicated request helpers or raw fetch calls where repo rules require a request client
- duplicated DTO/schema/validation logic across layers
- feature imports that bypass public barrels against repo conventions
- app-to-app imports in monorepos where shared packages are the required bridge
- missing error states or disabled reasons for guarded actions
- route/controller guards implemented inconsistently with repo conventions
- transactions or jobs with unclear retry, rollback, or idempotency behavior
- stale docs that contradict current code
- route guards implemented in render when repo conventions require route-level guards

Low-confidence signals should be worded as review candidates, not defects.

## Output Location Rules

The skill should support two location modes:

1. Repo-local Markdown map when the user wants the map committed with the project.
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
- `image-artifact`: creates low-text visual companions such as architecture diagrams, API flows, and refactoring hotspot maps
- `repo-docs-audit`: audits repository documentation
- `repo-skill-scan`: finds repeated patterns that may become skills

The implementation-map skill sits after or during implementation review, or before maintenance/refactoring work. Its output is descriptive, diagnostic, and developer-oriented.

## Proposed Skill Files

Potential structure:

```text
skills/implementation-map/
+-- SKILL.md
+-- references/
|   +-- map-template.md
|   +-- gap-heuristics.md
|   +-- discovery-checklist.md
|   +-- artifact-decision-rules.md
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

Create only `SKILL.md` and concise map template/artifact decision references.

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

- more repeatable maps
- lower manual tracing cost
- easier to compare maps across features

Costs:

- script must handle many repo shapes
- may overfit to TypeScript/React unless carefully scoped

### Option C: Artifact-Aware Workflow

Make the skill always produce Markdown and then automatically decide whether to create HTML, image, both, or neither.

Benefits:

- makes diagrams and flows first-class for comprehension
- delegates browser and visual rendering to existing artifact skills
- supports both developer-readable detail and quick architecture visuals

Costs:

- can overproduce artifacts for simple features unless the decision gate is strict
- requires the implementation-map skill to understand artifact tradeoffs
- must avoid duplicating `html-artifact` or `image-artifact` responsibilities

Recommended path: start with Option A plus artifact decision rules and strong output-location rules, then add the evidence collector after two or three real maps expose stable automation needs.

## Decisions Required Before Implementation

1. Skill name:
   - Option A: `implementation-map`
   - Option B: `feature-architecture-map`
   - Recommendation: `implementation-map` because it covers flow, architecture, and refactoring without being frontend- or backend-specific.

2. Default output destination:
   - Option A: ask unless user specifies repo-local or artifact
   - Option B: default to `~/agent-artifacts`
   - Recommendation: ask when ambiguous. Silent destination choices already caused confusion in the prototype.

3. First version automation:
   - Option A: no script
   - Option B: simple evidence collector
   - Recommendation: no script for v1; use the first few reports to determine script shape.

4. Companion artifact behavior:
   - Option A: decide after Markdown whether HTML, image, both, or neither improves understanding
   - Option B: only generate companions when explicitly requested
   - Recommendation: decide automatically after Markdown using strict artifact decision rules. HTML is for readable detail and snippets; image is for low-text diagrams and flows.

5. Repo-local docs convention:
   - Option A: detect `docs/artifacts/`
   - Option B: ask for every repo-local write
   - Recommendation: detect existing `docs/artifacts/`; otherwise ask.

6. Frontend/backend split:
   - Option A: one agnostic skill with stack profiles
   - Option B: separate frontend and backend skills
   - Recommendation: one agnostic `implementation-map` skill in v1. Split only if repeated usage proves the workflows diverge enough to justify duplication.

## Validation Plan

Before shipping the skill:

1. Run it against the Needs Assessment module and compare output to the existing implementation report.
2. Run it against a smaller service request feature and confirm it either produces a concise useful report or rejects if too small.
3. Run it against at least one backend or shared-package feature and confirm the stack profile sections adapt without frontend assumptions.
4. Check whether another developer or agent can use the generated map to identify entry points, runtime flow, architecture boundaries, tests, and gaps without reading hidden chat context.
5. Confirm the artifact decision creates useful HTML/image companions for complex features and skips companions for simple ones.
6. Confirm HTML companions include only compact snippets, not full source files.
7. Confirm image companions are low-text diagrams or flow maps, not dense text screenshots.
8. Confirm the skill does not invent requirements or implementation intent.
9. Confirm repo-local output and agent-artifact output are both explicit and predictable.

## Acceptance Criteria

The skill is ready when:

- `skills/implementation-map/SKILL.md` exists with clear trigger metadata
- the skill has a concise map template or references
- it rejects small or ambiguous requests
- it has explicit output-location rules
- it requires code evidence for claims
- it produces a map with start-here files, user/business flow, runtime flow, implementation architecture, ownership boundaries, state/data/side effects, APIs or messaging, tests, gaps, refactoring opportunities, and file inventory
- it adapts across frontend, backend, full-stack, and shared-package profiles
- it decides when to use `html-artifact`, `image-artifact`, both, or neither
- generated HTML companions contain diagrams/flows and compact snippets without copying full source files
- generated image companions are low-text architecture, API, user-flow, or refactoring hotspot visuals
- it preserves separation from `task-doc`, `prepare-qa-handoff`, `prepare-frontend-handoff`, `html-artifact`, and `image-artifact`
- it has been validated against at least one real feature map

## Open Questions For Deliberation

- Should the skill be global in `~/agent-skills`, or should some repo-specific map variants live in repo-local skills?
- Should maps include code metrics such as file size, import fan-in/fan-out, and test count in v1?
- Should implementation maps include Mermaid diagrams by default, or should visual flow descriptions stay artifact-tool-neutral?
- Should generated HTML artifacts use a dedicated implementation-map layout with flow panels, snippets, and architecture cards?
- Should image companions default to `architecture-diagram`, `api-flow`, or a new `implementation-flow` kind?
- What threshold makes a feature "large enough" for this map: route/controller count, file count, package boundary count, lifecycle complexity, refactoring need, or user judgment?

## Excluded From This Spec

- Implementing the skill.
- Adding `implementation-map` to `README.md`.
- Updating `bin/link-skills.sh`.
- Creating an HTML companion for this spec.
- Creating an image companion for this spec.
- Moving or editing the existing Needs Assessment report.
