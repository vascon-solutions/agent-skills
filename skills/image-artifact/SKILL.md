---
name: image-artifact
description: Use when an existing Markdown source document needs a static visual companion such as a summary card, UI variant board, comparison board, decision board, concept poster, architecture diagram, or API flow image under an artifact workspace or explicit output path.
---

# image-artifact

## Purpose

Create static image companions from existing Markdown. Markdown stays the source of truth; images are derived outputs for sharing, stakeholder review, option comparison, or visual decision support.

This is a rendering companion, not a source generator. If the source Markdown does not exist or is too vague to render faithfully, use the appropriate Markdown-producing skill first.

For browser-readable or interactive companions, use `html-artifact` instead. Use both when the workspace needs a readable HTML artifact and a shareable static visual.

## Inputs

Accept any of:

- path to a Markdown file
- path to an artifact workspace containing `markdown/`
- raw pasted Markdown plus optional title or doc-type hint
- optional `--kind <kind>`
- optional `--out <path>`
- optional `--workspace <slug-or-path>`
- optional `--variants <n>`
- optional `--force`

Do not invent source content. If required visual facts are missing, mark them as assumptions in the prompt plan or ask one focused question before generating.

## Output Kinds

| Kind | Use when | Default filename |
|---|---|---|
| `summary-card` | Concise shareable visual summary | `<source-stem>-summary.png` |
| `comparison-board` | Options, variants, or tradeoffs | `<source-stem>-comparison-board.png` |
| `ui-variant-board` | UI component or flow variants | `<source-stem>-variant-board.png` |
| `architecture-diagram` | Systems, services, APIs, or data flow | `<source-stem>-architecture.png` |
| `api-flow` | Endpoints, actors, states, or request flow | `<source-stem>-api-flow.png` |
| `concept-poster` | Product, business, or campaign concept | `<source-stem>-poster.png` |
| `decision-board` | Choosing between alternatives | `<source-stem>-decision-board.png` |
| `prompt-pack` | Image generation is unavailable or prompts only are requested | `<source-stem>-image-prompts.md` |

If `--kind` is absent, infer from source signals:

- workspace metadata doc type, when available, before prose-only inference
- UI/component/flow docs with multiple variants, states, screens, options, or approaches -> `ui-variant-board`
- UI/component/flow docs describing one component or one flow without variants -> `summary-card`
- architecture/backend/API/data-model docs -> `architecture-diagram` or `api-flow`
- option/tradeoff docs -> `comparison-board`
- idea/concept docs -> `summary-card` or `concept-poster`
- generic docs -> `summary-card`

Ask one focused question only if the kind materially changes the output.

## Variants

`--variants <n>` controls the number of variants for multi-output board kinds.

- Use source-defined variants, options, states, screens, or approaches first.
- If `--variants <n>` is provided, generate at most `n` variants from the source-defined set.
- If a variant board is requested with no count and no clear source-defined count, default to 3 variants.
- Do not generate more than 6 variants unless the user explicitly requests more.
- Do not invent arbitrary variants. If the requested count exceeds what the Markdown supports, mark the gap as an assumption in the prompt plan or ask one focused question.

## Output Destination

Resolve output paths in this order:

1. `--out <file>` writes exactly there.
2. `--out <directory>` writes images into that directory.
3. `--workspace <path>` writes to `<workspace>/images/`.
4. `--workspace <slug>` writes to `~/agent-artifacts/<slug>/images/`.
5. If source is inside `~/agent-artifacts/<slug>/markdown/`, write to sibling `~/agent-artifacts/<slug>/images/`.
6. Otherwise derive slug from source title/stem and write to `~/agent-artifacts/<slug>/images/`.

Treat `--workspace` as a path when the value contains `/`, starts with `.`, or starts with `~`. Treat it as a slug only when it contains no path separators.

Create missing directories automatically. If a target file exists, ask before overwriting unless the user provided `--force` or explicitly requested replacement. When refreshing from changed Markdown without `--force`, write a versioned file such as `-2`, `-v2`, or a dated suffix. For variants, append `-variant-a`, `-variant-b`, or descriptive slugs.

## Prompt Plan

Before generating images, derive a short prompt plan from the Markdown:

- source file
- output kind
- target audience
- key message
- visual style
- required elements
- optional elements
- text to avoid or keep minimal
- assumptions
- variant source and count when generating multiple variants

Write the prompt plan to `images/<source-stem>-prompt-plan.md` when generation is complex, has multiple variants, or image generation is unavailable.

For variant outputs, define each variant explicitly:

```markdown
## Variant A - Dense Operational Dashboard

- Purpose:
- Visual emphasis:
- Layout:
- Tradeoff:
```

## Generation Contract

Use the best available image-generation capability in the current environment.

- Do not require a specific provider, model, API, or product.
- Do not assume exact text rendering unless the active tool explicitly supports it.
- Keep generated-image text short; prefer labels, headings, icons, layout, and visual hierarchy over paragraphs.
- For text-heavy content, generate a visual summary or board and keep detailed text in Markdown or HTML.
- If a provider cannot reliably render required text, produce a `prompt-pack` or suggest `html-artifact`.
- Respect the active tool's safety, copyright, and content limits.

If image generation is unavailable, or the user requests `--kind prompt-pack`, write `images/<source-stem>-image-prompts.md` instead of claiming image output.

Prompt packs must include:

- source path or captured source title
- requested output kind
- target audience
- assumptions
- suggested output filenames
- one prompt per requested image or variant
- notes about text that should stay short or be rendered outside the image

## Metadata

Create or update `metadata.md` when using an artifact workspace.

If the existing metadata has the `markdown-artifact` table shape, update that table:

```markdown
| Type | Markdown | HTML | Images |
|---|---|---|---|
| idea-brief | `markdown/idea-brief.md` | | `images/idea-brief-summary.png` |
```

- Match the row by Markdown source path when possible.
- Add a row if no row exists for the source Markdown.
- Put one image path in `Images` for single outputs.
- Put comma-separated image paths in `Images` for variants.
- Do not add a `Tool` column to this table shape.

If no artifact table exists or the workspace is image-only, use:

```markdown
| Type | Source | Output | Tool |
|---|---|---|---|
| summary-card | `markdown/idea-brief.md` | `images/idea-brief-summary.png` | `unknown` |
```

Use the active tool name when known. Use `unknown` when it is not known. If metadata has another table shape, preserve its columns and add the minimum information needed; do not silently reorder or redesign it.

Record the tool actually invoked, such as the active image tool or model name returned by the environment. Do not guess a vendor name from the visual style or from general platform knowledge.

## Workflow

1. Receive Markdown, workspace, pasted source, or explicit source.
2. Verify source exists or capture pasted source.
3. Determine output kind from `--kind` or source signals.
4. Resolve workspace and output destination.
5. Read Markdown and extract the visual brief.
6. Build a prompt plan with assumptions and variant definitions when needed.
7. Handle existing target files: confirm replacement, honor `--force`, or choose a versioned filename.
8. If generation is unavailable, write a `prompt-pack` Markdown file and stop.
9. Generate the image artifact or artifacts with the available tool.
10. Save outputs under `images/` or the explicit `--out`.
11. Update `metadata.md` when using a workspace.
12. Verify outputs.
13. Report concise paths.

## Validation

Before reporting complete, verify:

- source Markdown exists or pasted source was captured
- output path is inside the intended workspace or explicit `--out`
- generated image file exists, or a prompt pack was written because generation was unavailable
- no unrelated source Markdown was modified
- `metadata.md` includes the image artifact when using a workspace
- each variant file has a clear name and maps to the prompt plan

When possible, visually inspect generated images or produce a thumbnail/contact-sheet check.

If visual inspection is impossible, perform file-level fallback validation:

- file size is greater than 0 bytes
- MIME type or file signature identifies the output as an image
- dimensions are readable through an available image utility, metadata reader, or provider response

State when only file-level validation was possible. Do not claim exact visual fidelity unless the generated artifact was visually inspected.

## Output

Report:

```text
Written: ~/agent-artifacts/<slug>/images/<name>.png (<kind>)
Source: ~/agent-artifacts/<slug>/markdown/<source>.md
Metadata: ~/agent-artifacts/<slug>/metadata.md
```

If generation is unavailable:

```text
Written: ~/agent-artifacts/<slug>/images/<source-stem>-image-prompts.md (prompt-pack)
Image generation unavailable in this environment.
```

## Cautions

- Do not modify source Markdown unless explicitly asked.
- Do not use this to generate primary Markdown source.
- Do not require a specific image-generation vendor, model, or API.
- Do not claim exact UI fidelity unless the generated artifact was visually inspected.
- Do not use images as the source of truth.
- Do not overwrite image artifacts without confirmation or `--force`.
- Do not create Git repos in artifact workspaces unless explicitly requested and confirmed.
- Do not write to `docs/superpowers/` unless the user explicitly asks for a Superpowers spec or plan.
