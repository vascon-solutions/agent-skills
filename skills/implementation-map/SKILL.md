---
name: implementation-map
description: Use when an existing or in-progress feature, module, package capability, backend workflow, or full-stack vertical needs a code-grounded implementation map that orients reviewers, maintainers, or future agents to flow, architecture, and refactoring candidates.
---

# Implementation Map

## Purpose

Produce a code-grounded Markdown map of how a feature is actually wired: entry points, runtime flow, architecture boundaries, tests, and visible refactoring candidates.

This skill describes existing code. It does not plan future work, design changes, or implement anything.

## When To Use

Use when a feature spans multiple files, packages, routes, services, state layers, jobs, or API boundaries and the reader needs the implementation graph before changing or reviewing code.

Useful for:

- post-implementation acceptance review of a feature slice
- onboarding a new agent or developer to a feature before continuing work
- preparing review notes before a PR or follow-up task doc
- identifying coupling, missing tests, duplicated logic, or extraction candidates
- preserving implementation context after a long-running session

## When Not To Use

Reject and recommend a lighter response when the target is:

- a one-file change
- a small bug fix
- pure copy, styling, or config edits
- a feature with no meaningful lifecycle, API, state, persistence, architecture boundary, or test surface

Also do not use this skill for:

- forward-looking task definition — use `task-doc`
- frontend developer migration guidance — use `prepare-frontend-handoff`
- QA sign-off notes — use `prepare-qa-handoff`
- repo-wide documentation audits — use `repo-docs-audit`
- rough ideas or designs that need a polished Markdown workspace — use `markdown-artifact`

The line: `task-doc` describes *future* work; `implementation-map` describes *existing* code.

## Constraints

- **Do not implement product changes.** The Markdown map is the source of truth. Companion artifacts may be generated only after the map is complete and the recorded artifact decision calls for them.
- **Reject small work.** If the rejection gate above applies, refuse with one sentence and recommend the lighter alternative. Do not produce an undersized map to satisfy the request.
- **Evidence required.** Every architecture, flow, behavior, or gap claim must point to a file (and symbol when useful). Inference must be labeled as inference, not fact.
- **No full source dumps.** Code snippets in the map or its companions must be compact and illustrative. Never paste whole files.
- **Read repo instructions first.** Open `AGENTS.md`, `CLAUDE.md`, README, and architecture docs before claiming any convention violation. Gap analysis without this step is speculation.
- **No chat-context dependence.** A reader with no prior conversation must be able to use the map.
- **No `.agent/` folder creation.** Do not silently create `.agent/queues`, `.agent/tasks`, or similar unless the user explicitly asks.
- **No secrets.** Exclude tokens, credentials, raw private payloads.

## Required Inputs

You need one of:

- feature name (`needs assessment`)
- route path (`/needs-assessment`)
- file path or feature folder
- backend module, controller, service, job, or package path
- task doc, PR summary, or implementation brief that names a feature

If the input is too vague to locate entry points, ask one focused question before proceeding.

## Stack Profile Detection

Detect one profile and activate matching evidence sections. Do not split into separate skills.

- `frontend` — routes/pages/loaders, components, hooks, client state, request clients, cache invalidation, UI tests
- `backend` — routes/controllers/resolvers, services/use cases, repositories/models, DTOs/schemas, guards/policies, transactions, jobs, integration tests
- `full-stack` — frontend entry points, backend endpoints, contracts, shared types, request/response lifecycle, cross-boundary failures
- `library/package` — public exports, factories, domain helpers, consumers, test contract, compatibility boundaries
- `mixed/unknown` — orient the reader and mark uncertain boundaries as inference

## Map Structure

Use [references/map-template.md](references/map-template.md). The template separates **mandatory** sections from **conditional** sections.

Mandatory sections (always present, even if short):

1. Title and metadata
2. 30-second summary
3. Stack profile and scope
4. Start here — first files to open, in order
5. Runtime flow
6. Ownership boundaries
7. Tests to read and test gaps
8. File inventory
9. Artifact decision — `html-artifact`, `image-artifact`, both, or neither, with reason

Conditional sections (include only when evidence supports them):

- User or business flow mapped to code
- Implementation architecture
- State, data, persistence, and side effects
- API, request, contract, or messaging layer
- Error handling, guards, and permissions
- Current behavior to preserve
- Coupling, complexity, and refactoring opportunities
- Visuals — Mermaid, ASCII, or table-driven flow steps
- Review notes

Omit conditional sections cleanly rather than padding them with `None found` for every absent topic. Use `None found` only inside a mandatory section when the answer is genuinely empty (e.g., no tests).

## Discovery Workflow

1. Confirm the target feature. If the rejection gate applies, refuse and recommend the lighter alternative.
2. Read repo instructions: `AGENTS.md`, `CLAUDE.md`, README, architecture docs.
3. Determine the stack profile.
4. Locate entry points using [references/discovery-checklist.md](references/discovery-checklist.md).
5. Collect evidence by profile: components, hooks, stores, API helpers, controllers, services, repositories, DTOs, schemas, guards, jobs, tests, shared package imports, task docs.
6. Group files by workflow, not by folder alone.
7. Trace primary lifecycle flows: route load, render composition, request handling, service execution, repository/external dependency, user action, mutation, transaction/event/queue/job, cache invalidation or navigation, error handling.
8. Identify gaps using [references/gap-heuristics.md](references/gap-heuristics.md). Tie every gap to a convention from repo instructions or a concrete code pattern.
9. Write the Markdown map using [references/map-template.md](references/map-template.md).
10. Validate against the checks below.
11. Decide companion artifacts using [references/artifact-decision-rules.md](references/artifact-decision-rules.md). Record the decision in the map's `Artifact Decision` section.
12. Invoke `html-artifact`, `image-artifact`, both, or neither according to the recorded decision. Companion generation happens only after the Markdown map is complete.

## Output Location

Decide the destination before writing.

- If the user named a path, write there.
- If the user asked for a portable artifact, write under `~/agent-artifacts/<repo-name>-<feature-slug>/markdown/implementation-map.md` and follow `markdown-artifact` workspace conventions.
- If the user asked for a durable repo doc and an existing `docs/` or `docs/artifacts/` convention is present, follow it.
- If no destination is clear, ask one focused question before writing.

Do not silently create new repo folders. Do not write to `docs/superpowers/` unless explicitly requested.

## Companion Artifacts

After the Markdown map is written, decide whether `html-artifact`, `image-artifact`, both, or neither will materially improve understanding. Use [references/artifact-decision-rules.md](references/artifact-decision-rules.md) to make the call, then record it in the map's `Artifact Decision` section and invoke the chosen artifact skill(s).

Decision summary:

- `html-artifact` — readable text with file paths, tables, links, compact snippets, navigable sections.
- `image-artifact` — low-text architecture diagram, API flow, lifecycle diagram, refactoring hotspot map.
- `both` — complex or full-stack maps where readers benefit from readable detail *and* a quick visual.
- `neither` — small features or single-flow maps where Markdown is already sufficient.

Companion generation happens only after the Markdown map is complete. HTML companions may include compact illustrative snippets, never full source files. Image companions stay low-text.

## Evidence Rules

- Use file paths in tables. Name symbols when useful.
- Include line numbers only when a claim depends on a narrow implementation detail.
- Distinguish code evidence from inference. Inference must be labeled.
- Refactoring candidates require a concrete signal: file responsibility density, duplicated logic, cross-boundary imports, missing tests, stale docs, TODOs, or inconsistent guard/error handling.
- Repo-convention violations require first having read the repo's instruction files.
- Do not claim coverage, behavior, or intent unless code or supplied docs support it.

## Validation

Before reporting complete, verify:

- the rejection gate was checked
- all 9 mandatory sections exist, including `Artifact Decision`
- every architectural, flow, behavior, or gap claim cites a file
- inference is labeled
- no full source files were pasted
- no `TBD`, `TODO`, `FIXME`, `??` placeholders remain
- the map is usable without chat context
- the output path was honored or asked for when ambiguous
- repo instruction files were read before any convention-violation claim
- the recorded artifact decision was acted on — companions invoked when the decision was not `neither`

## Output

Report:

```text
Written: <resolved-map-path>
Stack profile: <profile>
Entry points: <count>
Mandatory sections: 9/9
Conditional sections included: <list>
Artifact decision: <html-artifact | image-artifact | both | neither>
Companion paths: <paths, or None>
```

## Cautions

- Producing an oversized map for a small feature instead of refusing.
- Inventing architecture intent, coverage claims, or convention violations.
- Pasting full source files into the map or its HTML companion.
- Invoking a companion artifact before the Markdown map is complete.
- Generating both companions for a small or single-flow map.
- Omitting the `Artifact Decision` section, even when the decision is `neither`.
- Writing to `docs/superpowers/` or `.agent/` folders without explicit request.
- Crossing into `task-doc` territory by recommending future implementation steps.
- Treating the map as a substitute for code review.
