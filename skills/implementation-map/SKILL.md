---
name: implementation-map
description: Create requested implementation maps or deep review dossiers of existing features, modules, or cross-file flows. Not for routine code explanations unless explicitly invoked.
---

# Implementation Map

Explain existing implementation: entry points, runtime flow, ownership, tests, and evidence-backed maintenance candidates. Do not implement changes or turn the map into a future delivery plan. Formal acceptance review belongs to `review-implementation`; future work definition belongs to `task-doc`.

## Choose The Deliverable

Infer the deliverable from what the user wants to receive, the target, and its complexity. Words inside a feature name are not mode switches: "map the PR review queue" names a feature, not a request for a review dossier.

- **Focused explanation.** Answer a narrow question in chat with the relevant files, flow, and caveats. A one-file target or small fix is not grounds for refusing. Do not create a map file merely to satisfy a template; honor an explicit file request with a compact document.
- **Durable map.** Write a Markdown reference when the user asks for one or the ongoing authorized workflow calls for it. Use [map template](references/map-template.md) as a flexible content guide, combining or omitting sections that add no value.
- **Review dossier.** When the user requests a deep implementation review artifact, use [dossier guidance](references/review-dossier.md). Adapt it to frontend, backend, full-stack, or package boundaries; do not automatically expand an ordinary wiring question into a dossier.

Choose companions from the requested output format using [artifact rules](references/artifact-decision-rules.md). Complexity alone does not authorize extra HTML or generated imagery. Markdown is the default for a durable map. A request for a visual flow can be satisfied by an embedded Mermaid diagram when appropriate.

If the target is unclear, inspect supplied paths, routes, modules, tasks, or PR context before asking a focused question. Do not ask for a mode when the requested deliverable is evident.

## Discover And Trace

1. Read applicable repo instructions, including nested rules, and relevant README, architecture, domain, or task context. Absence of an instruction file is not a blocker; do not invent a convention.
2. Identify the profile: frontend, backend, full-stack, library/package, or mixed. Use the matching portions of [discovery checklist](references/discovery-checklist.md).
3. Locate entry points and follow the meaningful lifecycle: loading, composition, request/response, state changes, persistence, jobs/events, external calls, cache invalidation, and errors as applicable.
4. Group evidence by workflow and responsibility, not folder alone. Identify shared contracts and ownership at boundaries.
5. Inspect relevant test assertions and search for indirect/integration coverage before claiming a gap. Use [gap heuristics](references/gap-heuristics.md) for concrete candidates. Naming a test file does not establish what it checks.
6. Stop when the requested flow and important boundaries are explained, remaining uncertainty is explicit, and further reading adds little. Do not exhaust the repository to complete a template.

## Evidence

- Cite files and useful symbols for implementation claims. Add line numbers for narrow details and compact source excerpts; do not dump full source files.
- Label inference and distinguish implemented behavior from requirements or rationale supplied by authoritative docs. Record conflicts rather than claiming the code satisfies an unmet rule.
- Use `high` confidence for direct evidence with a clear signal and `review` for uncertain candidates. A signal alone does not establish a defect; explain its consequence before using defect language.
- Record tests inspected, behavior their assertions cover, and tests actually executed separately. Do not imply runtime verification, passing tests, or measured coverage from source inspection alone.
- Preserve cited `TODO` or `FIXME` comments as evidence when relevant. Remove unfinished author placeholders, not quoted source material.
- Keep the result usable without chat history and exclude secrets and raw private payloads.

The code remains the implementation authority. A Markdown map is the source for its derived companions, not a replacement for code or formal review.

## Location And Artifacts

For a file deliverable, honor the user path first. When the user or authorized workflow requests repository documentation, follow the repo's convention, falling back to `docs/` with a descriptive lowercase filename. Otherwise, including an unqualified request to write a map, default to `~/agent-artifacts/<repo-name>-<feature-slug>/markdown/implementation-map.md`. Use `markdown-artifact` workspace conventions there. An existing `docs/` directory alone does not imply a request for repository output. Ask only if the target repository or another material intent remains ambiguous.

A focused chat answer needs no output path. Do not create task queues or delivery documents as a side effect of mapping code.

When companions are requested, complete the Markdown source, record the requested formats and destinations, then invoke `html-artifact`, `image-artifact`, or both as requested. Report any unavailable generation separately; a missing companion does not invalidate a completed source map. Never publish a companion without publication authorization.

## Verify And Report

Check that the requested flow is answered, file references resolve, claims have evidence, inference and test-execution limits are explicit, and no unfinished author placeholders remain. For companions, verify that formats, paths, and contents match the request and the completed Markdown source.

For chat, deliver the explanation directly. For saved output, link the files and summarize the scope, material discoveries, and verification limits. Report requested companions created or blocked. Do not use section counts or file counts as a substitute for explaining what the reader can learn.
