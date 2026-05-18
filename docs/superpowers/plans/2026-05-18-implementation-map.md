# Implementation Map Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a stack-agnostic `implementation-map` skill that produces code-grounded developer maps for feature flow, implementation architecture, refactoring opportunities, and companion artifact decisions.

**Architecture:** Create a new instruction-only skill under `skills/implementation-map/` with focused reference files for the map template, discovery checklist, gap heuristics, and artifact decision rules. Register it in the skill linker and README without adding scripts in v1, because the approved design keeps automation deferred until repeated maps expose stable collection needs.

**Tech Stack:** Markdown skill files, POSIX shell validation, existing `bin/link-skills.sh`, existing `html-artifact` and `image-artifact` skill contracts.

**Spec:** `docs/superpowers/specs/2026-05-18-implementation-report-skill-design.md`

---

## Source Context

Synthesized from the approved implementation-map design spec and current repository patterns for global skills, reference files, README registration, and link-script registration.

## Design Reference

- Source Spec: `docs/superpowers/specs/2026-05-18-implementation-report-skill-design.md`
- Existing skill installation guidance: `README.md`
- Existing skill symlink registry: `bin/link-skills.sh`
- Artifact companion contracts: `skills/html-artifact/SKILL.md`, `skills/image-artifact/SKILL.md`

## Architecture Summary

Add one global `implementation-map` skill instead of separate frontend/backend skills. The skill detects a stack profile, writes a Markdown implementation map as source of truth, then decides whether `html-artifact`, `image-artifact`, both, or neither will materially improve comprehension. v1 is instruction-only with reference files; no evidence collector script is added.

## Code Evidence

| Behavior | Source |
|---|---|
| Skills are registered by adding the directory name to `SKILL_NAMES`; missing skill sources make the linker fail. | `bin/link-skills.sh` |
| README lists the canonical tree, skill table, usage workflows, and "How To Add a Skill" checklist. | `README.md` |
| Skills with supporting docs keep references under `skills/<skill>/references/`. | `skills/task-doc/references/`, `skills/roadmap-todo/references/`, `skills/html-artifact/references/` |
| `html-artifact` is the right companion when exact readable text, file paths, tables, links, and snippets matter. | `skills/html-artifact/SKILL.md` |
| `image-artifact` is the right companion for low-text architecture diagrams, API flows, and visual summaries from existing Markdown. | `skills/image-artifact/SKILL.md` |

## Current Behavior To Preserve

- Existing skills must keep their current names, ordering, and behavior.
- `bin/link-skills.sh` must remain idempotent and continue failing when a registered skill directory is missing.
- `html-artifact` and `image-artifact` remain separate renderer skills; `implementation-map` only decides whether to invoke them after its Markdown map exists.
- The new skill must stay global and framework-agnostic. It must not hardcode NCDMB, FLOATSTAR, TanStack, NestJS, or any repo-specific conventions as requirements.
- No scanner script is added in v1.

## Prerequisites

- The approved source spec exists at `docs/superpowers/specs/2026-05-18-implementation-report-skill-design.md`.
- The implementing branch may already contain unrelated worktree changes. Do not stage, revert, or rewrite unrelated files.
- The implementation should use `apply_patch` for file edits.

## Scope

- Create `skills/implementation-map/SKILL.md`.
- Create reference files:
  - `skills/implementation-map/references/map-template.md`
  - `skills/implementation-map/references/discovery-checklist.md`
  - `skills/implementation-map/references/gap-heuristics.md`
  - `skills/implementation-map/references/artifact-decision-rules.md`
- Register `implementation-map` in `bin/link-skills.sh`.
- Update `README.md` tree, skill table, and usage section.
- Validate Markdown wiring and linker behavior.

## Excluded

- Implementing an evidence collector script.
- Generating an implementation map for another repo.
- Generating HTML or image companions for this spec.
- Adding new artifact kinds to `html-artifact` or `image-artifact`.
- Refactoring existing artifact skills.
- Committing or pushing changes.

## Assumptions

- `implementation-map` belongs in the global skill pack because the workflow is stack-agnostic.
- The existing spec filename keeps `implementation-report` for history; the skill name and content should use `implementation-map`.
- README ordering can place `implementation-map` near review/task/documentation skills, before artifact rendering skills.

## Pre-Implementation Verification

- Re-open `docs/superpowers/specs/2026-05-18-implementation-report-skill-design.md` and confirm the approved name remains `implementation-map`.
- Re-open `README.md` and `bin/link-skills.sh` to confirm insertion points still match this plan.
- Check `git status --short` before staging anything so unrelated current worktree changes are preserved.

## Likely Files To Touch

- `skills/implementation-map/SKILL.md`
- `skills/implementation-map/references/map-template.md`
- `skills/implementation-map/references/discovery-checklist.md`
- `skills/implementation-map/references/gap-heuristics.md`
- `skills/implementation-map/references/artifact-decision-rules.md`
- `bin/link-skills.sh`
- `README.md`

## Decisions Required Before Implementation

None. The source spec resolves the skill name, cross-stack scope, artifact behavior, v1 automation level, and frontend/backend split decision.

## Execution Rules

- Keep v1 instruction-only.
- Keep Markdown map generation as the source-of-truth step before companion artifacts.
- Do not duplicate `html-artifact` or `image-artifact` rendering instructions beyond decision rules and handoff guidance.
- Do not make the skill generate full source-file code dumps.
- Keep generated-image guidance low-text and diagram-oriented.
- Keep HTML guidance readable, navigable, and snippet-oriented.
- Commit steps in this plan are for implementers; do not stage unrelated pre-existing changes.

## Deliverables

- New `implementation-map` skill with frontmatter, workflow, output contract, validation, and cautions.
- Four reference files used by the skill.
- Link script registration.
- README registration and usage notes.
- Verification evidence from shell checks and linker dry run or actual link run.

## Completion Verification

- `test -f skills/implementation-map/SKILL.md`
- `test -f skills/implementation-map/references/map-template.md`
- `test -f skills/implementation-map/references/discovery-checklist.md`
- `test -f skills/implementation-map/references/gap-heuristics.md`
- `test -f skills/implementation-map/references/artifact-decision-rules.md`
- `rg -n "implementation-map" README.md bin/link-skills.sh skills/implementation-map`
- `rg -n "implementation-report" skills/implementation-map README.md bin/link-skills.sh` returns no matches.
- `bin/link-skills.sh` exits 0.
- `git diff --check -- README.md bin/link-skills.sh skills/implementation-map` exits 0.

## Approval Gates

None. This task does not change auth, permissions, compliance, finance, destructive data behavior, or deployment infrastructure.

## Completion Criteria

The task is complete when the new `implementation-map` skill is registered, documented, supported by reference files, and verified through the completion commands without introducing scripts or changing unrelated skill behavior.

## Follow-ups

- Add an evidence collector script after two or three real implementation maps show stable automation needs.
- Consider a dedicated HTML implementation-map layout in `html-artifact`.
- Consider a new image artifact kind such as `implementation-flow` if `architecture-diagram` and `api-flow` are not expressive enough.
- Validate the skill against the Needs Assessment feature and at least one backend or shared-package feature.

---

## File Structure

Create:

- `skills/implementation-map/SKILL.md` - main invocation surface, workflow, output contract, artifact decision behavior, validation, and cautions.
- `skills/implementation-map/references/map-template.md` - default Markdown implementation map structure.
- `skills/implementation-map/references/discovery-checklist.md` - stack-aware evidence collection checklist.
- `skills/implementation-map/references/gap-heuristics.md` - conservative refactoring and improvement signal list.
- `skills/implementation-map/references/artifact-decision-rules.md` - HTML/image/both/neither decision rules.

Modify:

- `bin/link-skills.sh` - add `implementation-map` to `SKILL_NAMES`.
- `README.md` - add the skill to the tree, skill table, and usage workflows.

Do not modify unrelated current worktree changes.

---

### Task 1: Prepare Directory And Registration Edits

**Files:**
- Create directory: `skills/implementation-map/references/`
- Modify: `bin/link-skills.sh`
- Modify: `README.md`

- [ ] **Step 1: Confirm the approved spec still names `implementation-map`**

Run:

```bash
rg -n "Proposed skill name: `implementation-map`|Stack Profiles|Artifact Decision Rules" docs/superpowers/specs/2026-05-18-implementation-report-skill-design.md
```

Expected: output includes all three matched concepts.

- [ ] **Step 2: Check current worktree state**

Run:

```bash
git status --short
```

Expected: note any pre-existing unrelated changes and do not stage or revert them.

- [ ] **Step 3: Create the skill directories**

Run:

```bash
mkdir -p skills/implementation-map/references
```

Expected: command exits 0 and `skills/implementation-map/references` exists.

- [ ] **Step 4: Register the skill in `bin/link-skills.sh`**

Modify the `SKILL_NAMES` block so `implementation-map` appears after `review-task-docs` and before `repo-skill-scan`:

```sh
review-doc-changes
review-task-docs
implementation-map
repo-skill-scan
roadmap-todo
```

- [ ] **Step 5: Add `implementation-map` to the README tree**

In the `skills/` tree in `README.md`, add:

```text
    ├── review-task-docs/
    ├── implementation-map/
    ├── repo-skill-scan/
```

- [ ] **Step 6: Add the README skill table row**

Add this row near `review-task-docs`:

```markdown
| `implementation-map`      | Generate code-grounded developer maps for feature flow, implementation architecture, ownership boundaries, tests, refactoring opportunities, and HTML/image artifact decisions |
```

- [ ] **Step 7: Add the README usage workflow**

Add this section after "Reviewing and tracking feature work":

```markdown
### Understanding implemented feature flow

1. `implementation-map` — generate a code-grounded map of a feature's entry points, user/business flow, runtime flow, architecture boundaries, tests, and refactoring opportunities. The skill writes Markdown first, then decides whether `html-artifact`, `image-artifact`, both, or neither will improve understanding.
```

- [ ] **Step 8: Verify directory and registration edits**

Run:

```bash
test -d skills/implementation-map/references
rg -n "implementation-map" README.md bin/link-skills.sh
```

Expected: the `test` command exits 0 and `rg` shows README and link script matches.

- [ ] **Step 9: Leave registration edits uncommitted until the skill files exist**

Run:

```bash
git status --short
```

Expected: README and link-script edits may be present. Do not commit yet; `bin/link-skills.sh` should only be run after Tasks 2 and 3 create the registered skill files.

---

### Task 2: Write The Main Skill Workflow

**Files:**
- Modify: `skills/implementation-map/SKILL.md`

- [ ] **Step 1: Replace `SKILL.md` with the complete skill content**

Replace `skills/implementation-map/SKILL.md` with:

```markdown
---
name: implementation-map
description: Generate code-grounded developer implementation maps for feature flow, implementation architecture, ownership boundaries, refactoring opportunities, and companion HTML/image artifact decisions.
---

# Implementation Map

## Purpose

Create a code-grounded developer map for a completed or in-progress feature, module, package capability, backend workflow, or full-stack vertical.

The map helps a developer quickly understand where the feature starts, how the flow works, which modules participate, what architecture boundaries exist, what behavior must be preserved, and where safe refactoring or improvement opportunities are visible from evidence.

Markdown is the source of truth. After the Markdown map is complete, decide whether to invoke `html-artifact`, `image-artifact`, both, or neither.

## When To Use

Use when:

- a developer needs to understand an implemented feature before changing it
- a reviewer needs implementation flow, architecture boundaries, and test orientation
- an agent needs onboarding context before continuing feature work
- a feature spans multiple routes, controllers, components, services, hooks, stores, jobs, packages, APIs, or tests
- the user asks for implementation architecture, feature flow, refactoring opportunities, or code-grounded feature mapping

## When Not To Use

Do not use when:

- the change is a one-file fix, small bug, pure copy edit, style tweak, or config-only task
- the user needs a task document before implementation; use `task-doc`
- the user needs frontend API/UI migration instructions; use `prepare-frontend-handoff`
- the user needs QA-facing behavior notes; use `prepare-qa-handoff`
- the user needs a whole-repo documentation audit; use `repo-docs-audit`
- there is no meaningful lifecycle, API, state, persistence, architecture boundary, or test surface to map

When the target is too small, refuse briefly and recommend a short summary or normal review instead.

## Required Inputs

Accept any of:

- feature name
- route or URL path
- file or directory path
- backend module, controller, service, resolver, job, or package path
- task doc, PR summary, implementation brief, or existing artifact report that names a feature

If the target feature or destination is ambiguous, ask one focused question before writing.

## Stack Profiles

Detect exactly one primary profile:

- `frontend` - routes/pages/loaders, components, hooks, client state, request clients, cache invalidation, UI tests
- `backend` - routes/controllers/resolvers, services/use cases, repositories/models, DTOs/schemas, guards/policies, transactions, jobs, integration tests
- `full-stack` - frontend entry points, backend endpoints, contracts, shared types, request/response lifecycle, cross-boundary failures
- `library/package` - public exports, factories, domain helpers, consumers, test contract, compatibility boundaries
- `mixed/unknown` - enough evidence to orient the developer while marking uncertain boundaries as inference

Do not split into separate frontend and backend workflows. Adapt sections based on evidence.

## Output Contract

Produce exactly one of:

- a Markdown implementation map
- a brief refusal when the target is too small or too ambiguous

The Markdown map must include an `Artifact Decision` section that says whether to generate:

- HTML companion through `html-artifact`
- image companion through `image-artifact`
- both
- neither

If generating a companion, invoke the relevant artifact skill only after the Markdown map is complete.

## Output Location

Resolve the Markdown destination in this order:

1. user-specified path
2. existing repo `docs/artifacts/` convention when the user asks for a durable repo doc
3. `~/agent-artifacts/<repo-name>/markdown/` when the user asks for an artifact workspace
4. ask one focused destination question when no destination is clear

Do not silently create `.agent/`, `.agents/`, `.cursor/`, task queues, or repo-local agent folders.

## Evidence Rules

Ground claims in local files or supplied source material.

Required evidence collection:

- read repo instructions such as `AGENTS.md`, `CLAUDE.md`, README, or architecture docs when present
- identify entry points through routes, controllers, resolvers, feature barrels, package exports, services, jobs, or task docs
- inspect imports and exports for the target
- inspect API helpers, request clients, DTOs, schemas, validators, and contracts
- inspect hooks, stores, caches, jobs, queues, transactions, guards, policies, and repositories when present
- inspect tests in matching feature, package, API, integration, and utility folders
- inspect shared packages imported by the feature
- inspect supplied task docs, PR summaries, or previous artifact reports

Evidence format:

- cite file paths in tables
- name symbols when useful
- include line numbers only when a claim depends on a narrow implementation detail
- distinguish code evidence from inference
- do not claim behavior, coverage, intent, or architecture unless supported by code or supplied docs

## Workflow

1. Confirm the target feature and reject if too small or ambiguous.
2. Read relevant repo instructions and architecture docs.
3. Determine the stack profile.
4. Locate entry points.
5. Build an evidence set across frontend, backend, shared packages, jobs, state, APIs, persistence, and tests as applicable.
6. Group files by workflow rather than by folder alone.
7. Trace the primary user/business flow.
8. Trace the runtime flow from entry point through state/API/persistence/side effects.
9. Identify implementation architecture and ownership boundaries.
10. Identify coupling, complexity, gaps, and refactoring opportunities using code evidence.
11. Write the Markdown map using `references/map-template.md`.
12. Validate the map against the quality bar.
13. Decide whether `html-artifact`, `image-artifact`, both, or neither improves understanding using `references/artifact-decision-rules.md`.
14. Invoke companion artifact skills only when the decision says they are useful.

## Quality Bar

The map is useful only if it answers:

1. Where does the feature start?
2. What user or business flow does it implement?
3. What runtime flow executes behind that user/business flow?
4. Which frontend, backend, package, job, state, API, persistence, and test surfaces participate?
5. What architecture and ownership boundaries matter?
6. What behavior must be preserved during maintenance or refactoring?
7. What tests explain behavior fastest?
8. What gaps, coupling, complexity, or refactoring opportunities are visible from code evidence?
9. What should a developer inspect first?
10. Which visual or artifact companion would make the map easier to understand?

If the map cannot answer most of these questions, refuse or ask for a narrower target.

## Visual Requirements

For medium or complex features, include at least one visual flow description in the Markdown map. Use the simplest faithful format:

- Mermaid when the downstream artifact can preserve it
- ASCII flow when plain Markdown is enough
- table-driven flow when exact steps matter
- artifact prompt notes when `image-artifact` should create a static diagram

Useful visuals:

- user flow diagram
- runtime sequence flow
- frontend/backend boundary diagram
- API or event flow diagram
- state ownership map
- persistence and side-effect map
- refactoring hotspot map

Small features may skip diagrams when the Markdown flow is enough.

## Artifact Companion Rules

Use `html-artifact` when the reader needs faithful readable text, file paths, symbols, tables, links, compact snippets, navigable sections, or side-by-side flow and architecture views.

Use `image-artifact` when the reader needs a low-text architecture diagram, API flow, lifecycle diagram, user flow, system boundary visual, or refactoring hotspot map.

Use both when the feature is complex, full-stack, or refactor-oriented enough that developers benefit from readable detail and a quick visual map.

Use neither when the Markdown source is already clear and a companion would add ceremony.

HTML companions may include compact code snippets, but never full files. Image companions should avoid dense text and code blocks.

## References

- [Map template](references/map-template.md)
- [Discovery checklist](references/discovery-checklist.md)
- [Gap heuristics](references/gap-heuristics.md)
- [Artifact decision rules](references/artifact-decision-rules.md)

## Validation

Before reporting completion:

- confirm the map answers the quality bar
- confirm every architecture/refactoring claim has code or supplied-doc evidence
- confirm small or ambiguous targets were rejected instead of padded
- confirm the artifact decision is present
- confirm any generated HTML or image companion follows the selected artifact skill's validation rules

## Output

Report:

- Markdown map path, or refusal reason
- stack profile
- key entry points found
- artifact decision and any generated companion paths
- validation run
- validation not run and why

## Cautions

- Do not turn this into a task doc for future work.
- Do not write product requirements not present in code or supplied docs.
- Do not list files without explaining flow and ownership.
- Do not call every weakness a defect; low-confidence signals are review candidates.
- Do not generate full source dumps.
- Do not invoke companion artifact skills before the Markdown map exists.
- Do not create separate frontend/backend variants unless repeated future usage proves v1 is insufficient.
```

- [ ] **Step 2: Verify the skill frontmatter and reference links**

Run:

```bash
sed -n '1,40p' skills/implementation-map/SKILL.md
rg -n "references/map-template.md|references/discovery-checklist.md|references/gap-heuristics.md|references/artifact-decision-rules.md" skills/implementation-map/SKILL.md
```

Expected: frontmatter includes `name: implementation-map`, and all four reference links are present.

- [ ] **Step 3: Commit the main skill workflow**

Run:

```bash
git add skills/implementation-map/SKILL.md
git commit -m "feat: define implementation-map workflow"
```

Expected: commit succeeds with only `skills/implementation-map/SKILL.md` staged.

---

### Task 3: Write The Reference Files

**Files:**
- Modify: `skills/implementation-map/references/map-template.md`
- Modify: `skills/implementation-map/references/discovery-checklist.md`
- Modify: `skills/implementation-map/references/gap-heuristics.md`
- Modify: `skills/implementation-map/references/artifact-decision-rules.md`

- [ ] **Step 1: Replace `map-template.md`**

Replace `skills/implementation-map/references/map-template.md` with:

````markdown
# Implementation Map Template

Use this structure by default. Omit irrelevant sections only when there is clearly no evidence for them.

```markdown
# <Feature Name> Implementation Map

Generated: <YYYY-MM-DD>
Repository: `<repo-name>`
Stack profile: `<frontend | backend | full-stack | library/package | mixed/unknown>`
Scope: <one sentence>

## 30-Second Summary

<What the feature does, where it starts, and the main implementation shape.>

## Start Here

| Order | File | Why open it first |
|---|---|---|
| 1 | `<path>` | <entry point or orchestration reason> |

## User Or Business Flow

| Step | User/business event | Code surface | Notes |
|---|---|---|---|
| 1 | <event> | `<path>` / `<symbol>` | <behavior> |

## Runtime Flow

```text
<entry point>
  -> <loader/controller/component/service>
  -> <state/API/persistence/job>
  -> <invalidation/response/navigation/side effect>
```

## Implementation Architecture

| Layer | Files/symbols | Responsibility |
|---|---|---|
| Entry | `<path>` | <responsibility> |
| Orchestration | `<path>` | <responsibility> |
| Domain/shared | `<path>` | <responsibility> |

## Ownership Boundaries

| Boundary | Belongs here | Should not leak here |
|---|---|---|
| <app/service/package> | <owned behavior> | <foreign behavior> |

## State, Data, Persistence, And Side Effects

| Source | File | Role | Invalidates or affects |
|---|---|---|---|
| <query/store/db/job/cache> | `<path>` | <role> | <effect> |

## API, Contract, Or Messaging Layer

| Surface | File | Request/response/event | Notes |
|---|---|---|---|
| <endpoint/helper/topic> | `<path>` | <shape> | <behavior> |

## Error Handling, Guards, And Permissions

| Guard/error path | File | Behavior |
|---|---|---|
| <case> | `<path>` | <behavior> |

## Tests To Read

| Test | What it explains |
|---|---|
| `<path>` | <behavior or contract> |

## Current Behavior To Preserve

- <invariant backed by code or supplied docs>

## Coupling, Complexity, And Refactoring Opportunities

| Priority | Opportunity | Evidence | Suggested direction |
|---|---|---|---|
| Medium | <candidate> | `<path>` | <safe improvement direction> |

## Visual Flow

<Mermaid, ASCII, table flow, or artifact prompt notes.>

## Artifact Decision

Decision: `<html-artifact | image-artifact | both | neither>`

Reason:

- <why this medium helps or why Markdown is enough>

Suggested companion:

- <exact artifact skill invocation or `None`>

## File Inventory

| Category | Representative files |
|---|---|
| Entry points | `<path>` |
| Tests | `<path>` |

## Review Notes

- <what a future maintainer should inspect first>
```
````

- [ ] **Step 2: Replace `discovery-checklist.md`**

Replace `skills/implementation-map/references/discovery-checklist.md` with:

```markdown
# Discovery Checklist

Use this checklist to collect evidence before writing an implementation map.

## Common Setup

- Read repo instructions: `AGENTS.md`, `CLAUDE.md`, README, architecture docs, contributing docs.
- Identify the target from the user input: feature name, path, route, controller, package export, task doc, PR summary, or report.
- Reject or ask one focused question if the target is too small or ambiguous.
- Search with `rg` and `rg --files` first.
- Prefer code evidence over docs when they disagree.

## Frontend Evidence

- Routes, pages, layouts, loaders, search-param validators.
- Feature barrels and public exports.
- Components grouped by user workflow.
- Hooks, stores, query keys, cache invalidation, local storage, URL state.
- API helpers, request clients, generated clients, shared contracts.
- UI guards, disabled states, error boundaries, empty states.
- Component, hook, route, and utility tests.

## Backend Evidence

- Routes, controllers, resolvers, RPC handlers.
- Modules, services, use cases, command/query handlers.
- Repositories, ORM models, migrations, transactions.
- DTOs, schemas, validators, serializers.
- Guards, policies, middleware, role checks, permission tests.
- Queues, jobs, events, schedulers, webhooks.
- Integration, service, controller, repository, and contract tests.

## Full-Stack Evidence

- Frontend request surface and backend handler pair.
- Shared DTOs, schemas, enums, package exports, generated clients.
- Request/response lifecycle.
- Error and validation shape across the boundary.
- Cache invalidation, polling, job completion, and navigation behavior.
- Contract drift risks.

## Library Or Package Evidence

- Public exports.
- Factories, adapters, domain helpers, validators.
- Consumers in apps or other packages.
- Compatibility expectations.
- Unit and contract tests.

## Flow Tracing

Trace the primary flow in this order when applicable:

1. entry point
2. load or request validation
3. orchestration component/controller/service
4. state or persistence read
5. user action or external event
6. mutation, transaction, or job
7. invalidation, emitted event, response, navigation, or side effect
8. error path

## Evidence Quality

- Cite files and symbols.
- Use line numbers only for narrow claims.
- Mark inference explicitly.
- Do not describe product intent that is not in code or supplied docs.
```

- [ ] **Step 3: Replace `gap-heuristics.md`**

Replace `skills/implementation-map/references/gap-heuristics.md` with:

```markdown
# Gap Heuristics

Surface gaps conservatively. The map helps refactoring and improvement decisions, but it is not a defect report unless the evidence is strong.

## High-Confidence Signals

- TODO or follow-up comments tied to shipped behavior.
- Untested hooks, reducers, services, workflow helpers, API helpers, validators, or job handlers in an otherwise tested area.
- Components that own route loading, mutation, filtering, dialogs, navigation, and presentation at once.
- Backend services that own validation, persistence, policy, orchestration, external calls, and response shaping at once.
- Duplicated request helpers, DTOs, schemas, validators, or mapping logic across layers.
- Raw fetch calls where repo conventions require a request client.
- Feature imports that bypass public barrels against repo conventions.
- App-to-app imports in monorepos where shared packages are the required bridge.
- Missing error states, disabled reasons, retry paths, or failure banners for guarded actions.
- Route/controller guards implemented inconsistently with repo conventions.
- Transactions or jobs with unclear retry, rollback, or idempotency behavior.
- Stale docs that contradict current code.
- Tests that cover happy paths but omit permission, validation, empty, failure, or concurrency paths.

## Medium-Confidence Signals

- Large orchestration files that may still be acceptable because tests are strong.
- Similar workflow logic across features without enough repetition to justify extraction yet.
- URL/search state that exists but is not exposed by the visible UI.
- Shared package candidates that depend on product direction.
- Missing diagrams or docs for complex flows.

## Wording Rules

- Call high-confidence issues `gaps` only when code evidence supports the claim.
- Call medium-confidence items `review candidates`.
- Avoid saying "must refactor" unless there is a clear defect, convention violation, or repeated maintenance risk.
- Include a suggested direction, not a full implementation plan.
- Tie every recommendation to behavior that must be preserved.
```

- [ ] **Step 4: Replace `artifact-decision-rules.md`**

Replace `skills/implementation-map/references/artifact-decision-rules.md` with:

````markdown
# Artifact Decision Rules

The Markdown implementation map is always the source of truth. Decide on companions only after the Markdown map is complete.

## Choose Markdown Only

Use neither companion when:

- the feature is small
- the flow fits in one short Markdown section
- there are few files and no meaningful boundary diagram
- a companion would add ceremony without improving understanding

## Choose `html-artifact`

Use `html-artifact` when developers need:

- faithful readable text
- exact file paths, symbols, tables, and links
- compact code snippets
- navigable sections
- side-by-side user flow and runtime flow
- architecture boundary cards
- refactoring opportunity cards

HTML snippets must be compact. Include enough code to explain a pattern, not full files.

Good snippet:

```ts
// Entry point: validates search and preloads server state.
loader: async ({ context }) => {
  await context.queryClient.ensureQueryData(activeCycleQueryOptions())
}
```

Bad snippet:

```text
<entire source file pasted into the artifact>
```

## Choose `image-artifact`

Use `image-artifact` when developers or stakeholders need:

- low-text architecture diagram
- API flow
- lifecycle flow
- frontend/backend boundary visual
- state ownership map
- persistence and side-effect map
- refactoring hotspot map

Keep image text short. Prefer labels, boxes, arrows, ownership groups, and callouts over paragraphs or code.

Suggested image kinds:

- `architecture-diagram` for module/service/package boundaries
- `api-flow` for request/response, event, queue, or job flows
- `summary-card` only for small visual summaries

## Choose Both

Use both when:

- the feature is complex or full-stack
- the map is intended for refactoring or improvement planning
- developers need exact details and a quick visual overview
- architecture boundaries or runtime flows are hard to understand from prose alone

## Decision Output

Every implementation map must include:

```markdown
## Artifact Decision

Decision: <html-artifact | image-artifact | both | neither>

Reason:
- <evidence-based reason>

Suggested companion:
- <command or follow-up action>
```

## Invocation Guidance

If HTML is selected, invoke `html-artifact` on the completed Markdown map. Prefer an explicit `--out` path when the map lives in an artifact workspace.

If image is selected, invoke `image-artifact` on the completed Markdown map. Prefer `--kind architecture-diagram` or `--kind api-flow` when the needed visual is clear.

Do not invoke either artifact skill before the Markdown map exists.
````

- [ ] **Step 5: Verify reference content**

Run:

```bash
rg -n "Implementation Map Template|Discovery Checklist|Gap Heuristics|Artifact Decision Rules" skills/implementation-map/references
rg -n "html-artifact|image-artifact|architecture-diagram|api-flow" skills/implementation-map/references/artifact-decision-rules.md
```

Expected: output shows all four reference titles and artifact decision terms.

- [ ] **Step 6: Commit the reference files**

Run:

```bash
git add skills/implementation-map/references
git commit -m "feat: add implementation-map references"
```

Expected: commit succeeds with only reference files staged.

---

### Task 4: Final Registration Validation And Cleanup

**Files:**
- Modify as needed: `README.md`
- Modify as needed: `bin/link-skills.sh`
- Modify as needed: `skills/implementation-map/*`

- [ ] **Step 1: Check for stale skill-name references in the new skill and registration**

Run:

```bash
rg -n "implementation-report|feature-implementation-report" skills/implementation-map README.md bin/link-skills.sh
```

Expected: no matches. If the command exits 1 with no output, that is the expected `rg` result.

- [ ] **Step 2: Check required files exist**

Run:

```bash
test -f skills/implementation-map/SKILL.md
test -f skills/implementation-map/references/map-template.md
test -f skills/implementation-map/references/discovery-checklist.md
test -f skills/implementation-map/references/gap-heuristics.md
test -f skills/implementation-map/references/artifact-decision-rules.md
```

Expected: all commands exit 0.

- [ ] **Step 3: Verify registration references**

Run:

```bash
rg -n "implementation-map" README.md bin/link-skills.sh skills/implementation-map
```

Expected: output includes `README.md`, `bin/link-skills.sh`, `skills/implementation-map/SKILL.md`, and reference files where relevant.

- [ ] **Step 4: Run the link script**

Run:

```bash
bin/link-skills.sh
```

Expected: command exits 0. Existing correctly linked skills print `ok`; the new `implementation-map` skill is linked or already ok in each target directory.

- [ ] **Step 5: Run whitespace validation**

Run:

```bash
git diff --check -- README.md bin/link-skills.sh skills/implementation-map
```

Expected: command exits 0 with no output.

- [ ] **Step 6: Review final diff scope**

Run:

```bash
git diff --stat -- README.md bin/link-skills.sh skills/implementation-map
git status --short
```

Expected: diff scope contains only intended implementation-map, README, and link-script files plus any unrelated pre-existing changes left unstaged and untouched.

- [ ] **Step 7: Commit final cleanup**

Run:

```bash
git add skills/implementation-map README.md bin/link-skills.sh
git commit -m "docs: register implementation-map skill"
```

Expected: commit succeeds if Task 1 did not already commit these exact registration changes. If there are no changes left to commit, record that all registration changes were already committed by prior tasks.
