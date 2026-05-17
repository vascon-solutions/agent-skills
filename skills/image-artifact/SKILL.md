---
name: image-artifact
description: Use when an existing Markdown source document needs a static visual companion such as a summary card, UI variant board, comparison board, decision board, concept poster, architecture diagram, or API flow image under an artifact workspace or explicit output path.
---

# image-artifact

## Purpose

Create static image companions from existing Markdown. Markdown stays the source of truth; images are derived outputs for sharing, stakeholder review, option comparison, or visual decision support.

This is a rendering companion, not a source generator. If the source Markdown does not exist or is too vague to render faithfully, use the appropriate Markdown-producing skill first.

For browser-readable or interactive companions, use `html-artifact` instead. Use both when the workspace needs a readable HTML artifact and a shareable static visual.

This skill is for low-text visual companionship: concept posters, illustrations, comparison boards, UI variant boards, architecture diagrams, mood visuals, and stakeholder visuals. When a user asks for an "image artifact for this spec/doc/source" and the source is text-heavy, default to a low-text illustrative companion and recommend `html-artifact` if the user needs exact wording.

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
- optional `--use-repo-design`

Do not invent source content. If required visual facts are missing, mark them as assumptions in the prompt plan or ask one focused question before generating.

## Bundled Script

Prefer the bundled helper for deterministic support tasks:

```bash
node <this-skill-dir>/scripts/image-artifact-helper.js prompt-pack <source.md> --workspace <workspace> [--kind <kind>] [--variants <n>] [--format png|svg]
node <this-skill-dir>/scripts/image-artifact-helper.js prompt-plan <source.md> --workspace <workspace> [--kind <kind>] [--variants <n>] [--format png|svg]
node <this-skill-dir>/scripts/image-artifact-helper.js metadata <workspace> --source <source.md> --output <image-or-prompt> --kind <kind> [--tool <name>]
node <this-skill-dir>/scripts/image-artifact-helper.js validate <image-file> [<image-file>...]
```

The script does not generate images. It handles prompt plans, prompt-pack fallback files, metadata updates, path resolution, and file-level image validation. It resolves repo Markdown sources to repo-aware `~/agent-artifacts/<repo-name>-<source-stem>/` workspaces by default. Use `--format svg` only when exact-text static-image work needs deterministic SVG filename guidance. Validation recognizes deterministic SVG files and reads dimensions from `width`/`height` or `viewBox`.

## Output Kinds

| Kind | Use when | Default filename |
|---|---|---|
| `summary-card` | Concise low-text visual summary; for dense text prefer html-artifact | `<source-stem>-summary.png` |
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
6. If source is inside a Git repo, write to `~/agent-artifacts/<repo-name>-<source-stem>/images/`.
7. Otherwise derive slug from source title/stem and write to `~/agent-artifacts/<slug>/images/`.

Treat `--workspace` as a path when the value contains `/`, starts with `.`, or starts with `~`. Treat it as a slug only when it contains no path separators. Use `--workspace ./artifacts/<source-stem>` or `--out ./artifacts/<source-stem>/images/<file>` only when the user explicitly wants repo-local outputs.

Create missing directories automatically. Default `~/agent-artifacts` outputs are artifact workspaces and may use metadata for provenance and publishing. Repo-local explicit outputs are lightweight image outputs; do not create `metadata.md` for simple one-image repo-local output unless the user asks for workspace metadata, publishability, or reproducibility.

If a target file exists, ask before overwriting unless the user provided `--force` or explicitly requested replacement. If the user says "recreate", "regenerate", "refresh", "replace", or "update", overwrite the existing image and update only required sidecars. When refreshing from changed Markdown without replacement language or `--force`, write a versioned file such as `-2`, `-v2`, or a dated suffix. For variants, append `-variant-a`, `-variant-b`, or descriptive slugs.

## Repo Design Context

Default to neutral visual direction. Only scan and apply repo design context when the user passes `--use-repo-design`.

Invoke the `repo-design-context` skill to resolve scan root, discovery precedence, confidence, and reporting. Pass the source Markdown path or captured title, optional output kind, explicit repo path if the user provided one, artifact target such as `image companion` or `architecture diagram`, and current working directory.

Use only high-confidence findings in the prompt plan:

- palette, typography, spacing, and UI tone as visual style hints
- real service, module, endpoint, entity, and DTO names in architecture/API diagrams
- existing diagram vocabulary when it matches the source Markdown

Medium or low confidence means neutral visual direction. No `--neutral` flag is needed because neutral is the default when `--use-repo-design` is absent or confidence is not high.

Repo context applies globally to the prompt plan by default. If variants intentionally target different products, themes, or architectures, record per-variant repo context inside each variant block; otherwise do not repeat the same context in every variant.

Do not present generated images as officially branded or exact architecture truth just because repo context was scanned.

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
- repo design context and confidence when `--use-repo-design` is provided

Do not write a prompt plan by default for a simple one-image artifact. Keep the final prompt or prompt summary in the response instead. Write `images/<source-stem>-prompt-plan.md` only when generation is complex, has multiple variants, image generation is unavailable, exact-text deterministic SVG is required, repo design context materially shapes the output, or the user asks for reproducibility.

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
- In Codex, use the `imagegen` skill / built-in image generation path by default for low-text polished visual artifacts such as architecture infographics, concept posters, stakeholder visuals, and mood visuals.
- Do not assume exact text rendering unless the active tool explicitly supports it.
- Keep generated-image text short; prefer labels, headings, icons, layout, and visual hierarchy over paragraphs.
- For text-heavy content, generate a visual summary or board and keep detailed text in Markdown or HTML.
- If a provider cannot reliably render required text, produce a `prompt-pack` or suggest `html-artifact`.
- When the user explicitly requires exact text, route names, commands, or tables inside a static image, recommend `html-artifact` first.
- If a single static image file is genuinely required for exact text, hand-write deterministic SVG with real SVG text rather than relying on a generative model. Use `--format svg` for helper-generated prompt plans or prompt packs.
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

### Ambiguous Image-Artifact Requests

When the user says "create an image artifact for this spec/doc/source" and the source is text-heavy:

1. Treat the requested image as a low-text illustrative companion by default.
2. Keep exact wording in the Markdown source or recommend an HTML companion for faithful reading.
3. Mention that HTML is the better medium for detailed text if the user appears to need exact wording.
4. Do not produce a dense text-heavy generated image unless the user explicitly asks for it.

## Metadata

Create or update `metadata.md` for default `~/agent-artifacts` workspaces, publishing workflows, or explicit metadata requests. Do not create metadata for simple explicit repo-local outputs unless the user asks for workspace metadata, publishability, or reproducibility.

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

When `--use-repo-design` is provided, record repo-design state near the artifact row without changing an existing table shape:

```markdown
Repo design context: found <signals>; applied <tokens/vocabulary or neutral default>; confidence <high|medium|low>
```

Do not add a `Repo Design` column to existing `Type | Markdown | HTML | Images` tables. Keep that table shape stable and add the repo-design note as nearby prose.

If using the image-only `Type | Source | Output | Tool` table and creating it from scratch, add a `Repo Design` column:

```markdown
| Type | Source | Output | Tool | Repo Design |
|---|---|---|---|---|
| architecture-diagram | `markdown/backend-design.md` | `images/backend-design-architecture.png` | `unknown` | `found API services; applied service names; confidence high` |
```

## Workflow

1. Receive Markdown, workspace, pasted source, or explicit source.
2. Verify source exists or capture pasted source.
3. Determine output kind from `--kind` or source signals.
4. Resolve workspace and output destination.
5. Read Markdown and extract the visual brief.
6. If `--use-repo-design` is provided, scan repo design context and decide whether confidence is high enough to apply.
7. Build a prompt in memory. Write a prompt plan only when the Prompt Plan section requires one; use `scripts/image-artifact-helper.js prompt-plan` when a sidecar plan is needed.
8. Handle existing target files: confirm replacement, honor `--force`, or choose a versioned filename.
9. If generation is unavailable, write a `prompt-pack` Markdown file with `scripts/image-artifact-helper.js prompt-pack` when possible and stop.
10. Generate the image artifact or artifacts with the available tool.
11. Save outputs under `images/` or the explicit `--out`.
12. Update `metadata.md` only when using a full artifact workspace, publishing workflow, or explicit metadata request; use `scripts/image-artifact-helper.js metadata` when possible.
13. Verify outputs; use `scripts/image-artifact-helper.js validate` for file-level image checks when visual inspection is unavailable.
14. Report concise paths and repo design context when scanned.

## Validation

Before reporting complete, verify:

- source Markdown exists or pasted source was captured
- output path is inside the intended workspace or explicit `--out`
- generated image file exists, or a prompt pack was written because generation was unavailable
- no unrelated source Markdown was modified
- `metadata.md` includes the image artifact when a full artifact workspace or explicit metadata request is used
- each variant file has a clear name and maps to its source-defined variant or prompt plan
- no prompt-plan was created for simple one-image output unless required
- no metadata sidecar was created for simple repo-local one-image output unless required
- if `--use-repo-design` was provided, prompt plan and final report list discovered signals, applied context, and confidence

When possible, visually inspect generated images or produce a thumbnail/contact-sheet check.

If visual inspection is impossible, perform file-level fallback validation:

- file size is greater than 0 bytes
- MIME type or file signature identifies the output as an image
- dimensions are readable through an available image utility, metadata reader, provider response, or SVG `width`/`height` or `viewBox`

State when only file-level validation was possible. Do not claim exact visual fidelity unless the generated artifact was visually inspected.

## Output

Report:

```text
Written: ~/agent-artifacts/<slug>/images/<name>.png (<kind>)
Written: ~/agent-artifacts/<slug>/images/<name>.svg (<kind>, deterministic SVG)
Written: ~/agent-artifacts/<repo-name>-<source-stem>/images/<name>.png (<kind>)
Written: ./artifacts/<source-stem>/images/<name>.png (<kind>, explicit repo-local output)
Source: ./docs/<source>.md
Source: ~/agent-artifacts/<slug>/markdown/<source>.md
Metadata: ~/agent-artifacts/<slug>/metadata.md
Repo design context: found Tailwind config and API service names; applied palette/service vocabulary; confidence high
Repo design context: found likely app theme and duplicate service names; applied neutral default; confidence medium
Repo design context: found multiple themes; applied neutral default; confidence low
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
- Do not default to deterministic SVG for polished low-text visuals when image generation is available.
- Do not create prompt-plan sidecars for simple one-image output unless required.
- Do not create metadata sidecars for simple repo-local one-image output unless required.
- Do not overwrite image artifacts without confirmation or `--force`.
- Do not create Git repos in artifact workspaces unless explicitly requested and confirmed.
- Do not write to `docs/superpowers/` unless the user explicitly asks for a Superpowers spec or plan.
- Do not apply repo design context from ambiguous signals. Prefer neutral output unless confidence is high.
