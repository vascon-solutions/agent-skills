# Artifact Routing Design

## Context

The Agent Skills pack has two companion-artifact skills that can be used after a Markdown source exists:

- `html-artifact`: creates self-contained browser-readable HTML companions.
- `image-artifact`: creates static visual companions from existing Markdown.

Recent use exposed an ambiguous default. When a user asks for an "image artifact" from a text-heavy source document, an agent may create a dense rendered summary card with lots of exact text. That output is technically an image, but it is usually the wrong medium: exact routes, commands, tables, and decisions are more reliable in HTML. Generated image tools are better for low-text illustrations, concept posters, visual mood, and stakeholder-friendly conceptual visuals.

This design updates the decision boundary between `html-artifact` and `image-artifact` for any Markdown source, not only specs.

## Decision

Update the artifact skills so agents route Markdown-derived artifacts by the kind of communication the user needs:

- Use `html-artifact` when the output must preserve faithful readable text.
- Use `image-artifact` when the output should be a low-text visual companion.
- When a user asks for an image artifact from a text-heavy source, interpret the image as an illustrative concept visual unless they explicitly ask for exact text in the image.
- When exact wording is required in visual form, recommend HTML first. Use deterministic SVG only when the user explicitly needs a single static image file.

This applies to all Markdown sources, including specs, task docs, roadmap docs, QA handoffs, frontend handoffs, architecture notes, implementation plans, meeting notes, PR summaries, learning guides, and feature proposals.

## Target Skills

Update these existing skills:

- `skills/html-artifact/SKILL.md`
- `skills/image-artifact/SKILL.md`

Do not create a new skill. The routing rule belongs in the two skills that own the companion formats.

## Routing Rules

### Use `html-artifact` For Faithful Reading

`html-artifact` should be the preferred companion when the source or requested output includes:

- paragraphs or detailed prose
- tables
- route lists
- command lists
- links
- acceptance criteria
- implementation steps
- exact decisions
- exact labels
- detailed comparison criteria
- anything the reader must quote, copy, inspect, or verify precisely

The HTML output should remain the readable companion. It can include visual hierarchy, diagrams, tables, and inline SVG, but its main job is preserving the source document's meaning and wording.

### Use `image-artifact` For Low-Text Visuals

`image-artifact` should be the preferred companion when the user wants:

- concept poster
- illustration
- mood visual
- stakeholder-friendly visual
- UI atmosphere
- metaphorical summary
- lightweight visual board
- visual option comparison where exact text is minimal

The image should keep generated text short. Prefer composition, layout, icons, UI silhouettes, badges, color, and hierarchy over paragraphs.

### Ambiguous Image-Artifact Requests

When the user says "create an image artifact for this spec/doc/source" and the source is text-heavy:

1. Treat the requested image as a low-text illustrative companion by default.
2. Keep exact wording in the Markdown source or recommend an HTML companion for faithful reading.
3. Mention that HTML is the better medium for detailed text if the user appears to need exact wording.
4. Do not produce a dense text-heavy generated image unless the user explicitly asks for it.

### Exact Text In A Static Image

If the user explicitly asks for exact text, labels, route names, commands, or tables inside a static image:

1. Recommend `html-artifact` first when a browser-readable artifact is acceptable.
2. If the user still needs a single static image file, hand-write deterministic SVG with real SVG text rather than relying on a generative image model.
3. Validate dimensions and visually inspect the result when possible.

## Generative Image Tool Preference

Keep the skill portable across agent environments. The universal rule: use the best available image-generation capability in the current environment for low-text illustrative artifacts. Do not name or require any specific vendor, model, API, or product.

## Expected Skill Changes

These edits are compact in-place additions inside the two artifact skills. Do not create a new skill or shared reference file.

### `html-artifact`

Add a single new top-level section (`##` heading) between `## When To Use` and `## When Not To Use`, titled `When To Use vs. image-artifact`. Content:

- The routing rule from "Use `html-artifact` For Faithful Reading" above (paragraphs, tables, route lists, command lists, links, acceptance criteria, implementation steps, decisions, exact labels, anything the reader must quote/copy/inspect).
- Example prompts:
  - "Turn this spec into a readable artifact."
  - "Create an artifact for this task doc."
  - "Make a browser companion for this roadmap."
  - "I need the routes, commands, tables, and decisions to remain exact."
- A closing line that points to `image-artifact` for low-text concept visuals (poster, illustration, mood image, UI atmosphere).

No other changes to this file.

### `image-artifact`

Five small touches:

1. **`## Purpose` / preamble.** After the existing `For browser-readable or interactive companions, use html-artifact instead` line, add one paragraph stating this skill is for low-text visual companionship (concept posters, illustrations, comparison boards, UI variant boards, architecture diagrams, mood and stakeholder visuals), and that an ambiguous "image artifact for this spec/doc/source" request from a text-heavy source defaults to a low-text illustrative companion and recommends `html-artifact` if the user needs exact wording.
2. **`## Output Kinds` table.** Change the `summary-card` row description to: `Concise low-text visual summary; for dense text prefer html-artifact`. This is a wording change only. Default filename, inference rules, and routing for an explicit `--kind summary-card` request are unchanged.
3. **`## Generation Contract` bullets.** Append: (a) when the user explicitly requires exact text/route names/commands/tables inside a static image, recommend `html-artifact` first; (b) if a single static image file is genuinely required for exact text, hand-write deterministic SVG with real SVG text rather than relying on a generative model.
4. **New `### Ambiguous Image-Artifact Requests` subsection at the end of `## Generation Contract`.** Encodes the four-step handler from "Ambiguous Image-Artifact Requests" above.
5. **Helper and validation support for SVG.** Update the bundled helper docs and script only as needed so prompt plans/prompt packs can suggest `.svg` filenames for exact-text static-image work, and file-level validation recognizes deterministic SVG files and reads dimensions from `width`/`height` or `viewBox`.

No changes to `Inputs`, `Variants`, `Output Destination`, `Repo Design Context`, `Metadata`, or `Cautions`.

## Examples

### Text-Heavy Source

User request:

```text
Create an image artifact for this implementation spec.
```

Expected behavior:

- Create a low-text illustrative concept image, such as a poster or visual summary with minimal labels.
- Say that HTML is recommended for exact-reading details.
- Do not create a dense image packed with paragraphs, routes, and commands.

### Exact Reading Need

User request:

```text
Create an artifact for this spec that preserves all routes and validation commands.
```

Expected behavior:

- Use `html-artifact`.
- Do not use a generative image as the primary artifact.

### Static Image With Exact Labels

User request:

```text
Create a static image diagram that includes these exact route names.
```

Expected behavior:

- Hand-write deterministic SVG with real SVG text.
- Validate and visually inspect the image.
- Keep Markdown or HTML as the source of truth when possible.

## Validation

After implementation, validate by reviewing the changed skill text against these scenarios:

- A text-heavy Markdown source should route to HTML unless the user clearly wants a low-text visual.
- An "image artifact for this spec/doc/source" request should create or recommend a low-text concept visual, not a dense rendered text card.
- A request for exact routes or commands should not rely on generative image text.
- The skills should remain tool-agnostic. No vendor, model, API, or product name appears in either SKILL.md.

No runtime code changes are required unless existing helper scripts encode conflicting assumptions.
