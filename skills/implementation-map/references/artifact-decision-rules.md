# Artifact Decision Rules

The Markdown implementation map is the source of truth. Decide on companions only after the Markdown map is complete, then invoke the chosen artifact skill(s) and record the decision in the map's `Artifact Decision` section.

The four possible decisions are: `html-artifact`, `image-artifact`, `both`, or `neither`.

## Choose `neither`

Use neither companion when:

- the feature is small and the Markdown map is short
- the runtime flow is single-step or already obvious from the Start Here table
- there are few files and no meaningful boundary diagram
- a companion would add ceremony without improving understanding

This is the default for small but legitimate features that cleared the rejection gate.

## Choose `html-artifact`

Use HTML when the reader needs:

- faithful readable text
- exact file paths, symbols, tables, and links
- compact code snippets that explain a pattern
- navigable sections
- side-by-side user-flow and runtime-flow views
- architecture boundary cards
- refactoring opportunity cards

HTML companions may include compact code snippets. Never paste full source files.

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

Use image when the reader needs:

- low-text architecture diagram
- API or event flow
- lifecycle or sequence flow
- frontend/backend boundary visual
- state ownership map
- persistence and side-effect map
- refactoring hotspot map

Image companions stay low-text. Prefer labels, boxes, arrows, ownership groups, and callouts over paragraphs or code.

Suggested image kinds when invoking `image-artifact`:

- `architecture-diagram` — module, service, or package boundaries
- `api-flow` — request/response, event, queue, or job flows
- `summary-card` — only for compact visual summaries

## Choose `both`

Use both when:

- the feature is complex or full-stack
- the map is intended for refactoring or improvement planning
- developers need exact details and a quick visual overview
- architecture boundaries or runtime flows are hard to grasp from prose alone

## Decision Section Format

Every Markdown map must include this section:

```markdown
## Artifact Decision

Decision: `<html-artifact | image-artifact | both | neither>`

Reason:
- <evidence-based reason tied to the map's content>

Suggested companion:
- <exact follow-up invocation, or `None`>
```

## Invocation Guidance

Invoke companion skills only after the Markdown map exists and the decision is recorded.

When the decision includes HTML, invoke:

```text
html-artifact <map-path> --out <html-path>
```

If the map lives in a `~/agent-artifacts/<slug>/` workspace, write the HTML under `<slug>/html/implementation-map.html`. For repo-local maps, choose a sibling path or follow the repo's existing `docs/artifacts/` convention.

When the decision includes image, invoke:

```text
image-artifact <map-path> --workspace <workspace> [--kind architecture-diagram | api-flow | summary-card]
```

Pick `--kind` when the needed visual is clear from the map; omit it when the artifact skill should choose.

## Anti-Patterns

- Invoking a companion before the Markdown map is complete.
- Generating both companions for a small or single-flow map.
- Pasting full source files into HTML.
- Using image companions to render dense file inventories or code blocks.
- Skipping the `Artifact Decision` section when the decision is `neither`.
- Recording a decision but failing to invoke the chosen companion.
