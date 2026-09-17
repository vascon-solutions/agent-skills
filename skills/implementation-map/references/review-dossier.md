# Implementation Review Dossier

Use only when the requested deliverable is a deep implementation review artifact. A feature name containing "review" or a routine wiring question is not sufficient. A dossier does not imply HTML or images; follow the requested format.

Keep the core map evidence: identity and scope, start-here pointers, runtime flow and ownership, tests, and uncertainty. Organize the review around the user's workflow or the system lifecycle rather than repeating empty sections for every file.

## Profile Emphasis

- **Frontend.** Route loading, component composition, hooks/stores, API clients, cache behavior, navigation, and visible state/error handling.
- **Backend.** Controllers/handlers, policies/guards, validation/contracts, service orchestration, persistence, transactions, jobs/events, and recovery.
- **Full-stack.** One connected trace across UI, client, endpoint, service, persistence, and shared contracts; include cross-boundary errors and state changes.
- **Package.** Public exports, consumers, internal ownership, compatibility boundaries, and tests of the public contract.

For each meaningful route or flow, include a short snapshot, code trace, important boundary decisions, and relevant tests or uncertainty. Compact source excerpts need file and line references. Add component trees or sequence diagrams only where they improve understanding.

## Review Observations

Use labels such as Decision, Boundary, Refactor, Performance, Testing, or Risk when helpful for scanning. Do not manufacture a card for every label. Each observation needs concrete evidence, its consequence, and `high` or `review` confidence as defined in [gap heuristics](gap-heuristics.md).

Distinguish observed behavior from a proposed improvement. Structural complexity and test filenames alone do not prove a bug, poor performance, or missing coverage. Cite test assertions inspected and state whether execution evidence exists.

If several candidates compete, a compact comparison can show their evidence, impact, and uncertainty. Do not expand it into an implementation plan or claim formal acceptance review has passed.

## Browser Format

When HTML is requested, provide navigable route/flow sections, readable compact code excerpts with syntax coloring, and appropriate diagrams or tables. Avoid repeating all Markdown headings as empty cards. Generate HTML through `html-artifact` after the Markdown source is complete. Generated imagery requires a request for an image companion; it must remain derived from the evidence.
