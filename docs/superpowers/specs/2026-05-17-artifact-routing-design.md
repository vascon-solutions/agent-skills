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
- When exact wording is required in visual form, recommend HTML first. Use deterministic SVG or HTML-rendered image output only when the user explicitly needs a static image file.

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

### Ambiguous "Image Artifact" Requests

When the user says "create an image artifact for this spec/doc/source" and the source is text-heavy:

1. Treat the requested image as a low-text illustrative companion by default.
2. Keep exact wording in the Markdown source or recommend an HTML companion for faithful reading.
3. Mention that HTML is the better medium for detailed text if the user appears to need exact wording.
4. Do not produce a dense text-heavy generated image unless the user explicitly asks for it.

### Exact Text In A Static Image

If the user explicitly asks for exact text, labels, route names, commands, or tables inside a static image:

1. Recommend `html-artifact` first when a browser-readable artifact is acceptable.
2. If the user still needs a static image, create deterministic SVG or HTML-rendered image output rather than relying on a generative image model.
3. Validate dimensions and visually inspect the result when possible.

## Generative Image Tool Preference

Keep the skill portable across agent environments:

- Universal rule: use the best available generative image tool for low-text illustrative artifacts.
- Codex-specific note: when ChatGPT image generation is available in Codex, prefer it for concept posters, illustrations, UI mood visuals, and low-text stakeholder visuals.

Do not make the global skill depend on a single vendor or product name. The skill should still work in environments where another image-generation capability is available.

## Expected Skill Changes

### `html-artifact`

Add a decision-boundary section near "When To Use" that says `html-artifact` is preferred over image artifacts for text-heavy Markdown sources and exact-reading use cases.

Add examples such as:

- "Turn this spec into a readable artifact."
- "Create an artifact for this task doc."
- "Make a browser companion for this roadmap."
- "I need the routes, commands, tables, and decisions to remain exact."

Add a cross-reference that says if the user wants a low-text concept visual, use `image-artifact`.

### `image-artifact`

Tighten the purpose and generation contract:

- Static images are for visual companionship, not faithful rendering of dense source text.
- For text-heavy Markdown, default to a low-text concept illustration if the user asked for an image.
- Recommend `html-artifact` when the user needs exact readable text.
- Prefer the available generative image tool for low-text illustrative outputs; in Codex, prefer ChatGPT image generation when available.
- Use deterministic SVG or HTML-rendered output only when exact static-image text is explicitly required.

Update output-kind guidance so `summary-card` does not imply dense text rendering. A `summary-card` should still be concise and visual; dense summaries belong in HTML.

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

- Use deterministic SVG or HTML-rendered image output.
- Validate and visually inspect the image.
- Keep Markdown or HTML as the source of truth when possible.

## Validation

After implementation, validate by reviewing the changed skill text against these scenarios:

- A text-heavy Markdown source should route to HTML unless the user clearly wants a low-text visual.
- An "image artifact for this spec/doc/source" request should create or recommend a low-text concept visual, not a dense rendered text card.
- A request for exact routes or commands should not rely on generative image text.
- The skills should remain tool-agnostic, with only a Codex-specific preference note for ChatGPT image generation when available.

No runtime code changes are required unless existing helper scripts encode conflicting assumptions.
