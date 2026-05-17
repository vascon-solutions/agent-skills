# image-artifact Skill - Design Spec

**Date:** 2026-05-16
**Status:** Approved direction - ready for implementation planning
**Source:** Brainstorming session on adding tool-agnostic image companions to artifact workspaces

**Updated by:** `docs/superpowers/specs/2026-05-17-artifact-routing-design.md`. Repo Markdown sources now default to repo-aware `~/agent-artifacts/<repo-name>-<source-stem>/images/`, repo-local output is opt-in, simple one-image outputs do not create prompt-plan sidecars by default, and Codex uses the `imagegen` skill / built-in image generation path for polished low-text visuals when available.

---

## Purpose

Create a new `image-artifact` skill that turns existing Markdown source documents into generated image artifacts.

The skill is a rendering companion, not a source generator. `markdown-artifact` creates or curates the Markdown source. `image-artifact` reads that Markdown and produces visual outputs such as summary cards, option boards, diagrams, variant comparisons, or pitch-style images.

The image-generation provider must be tool-agnostic. Use whatever image-generation capability is available in the current agent environment and appropriate for the user request. Do not require a specific vendor, model, API, or product in the skill contract.

---

## Core Model

`image-artifact` works inside the same artifact workspace model:

```text
~/agent-artifacts/<artifact-slug>/
├── markdown/
│   ├── idea-brief.md
│   ├── ui-component-design.md
│   └── backend-design.md
├── html/
├── images/
│   ├── idea-brief-summary.png
│   ├── ui-component-design-variant-a.png
│   ├── ui-component-design-variant-b.png
│   └── ui-component-design-comparison-board.png
├── assets/
└── metadata.md
```

Markdown remains the source of truth. Image files are derived artifacts.

`image-artifact` may also run on a standalone Markdown file outside an artifact workspace. If the Markdown file is inside a Git repo, default output is repo-aware under `~/agent-artifacts`:

```text
~/agent-artifacts/<repo-name>-<source-stem>/images/
```

If the Markdown file is not inside a Git repo, default output is:

```text
~/agent-artifacts/<derived-slug>/images/
```

---

## When To Use

Use `image-artifact` when an existing Markdown source document would benefit from a visual output:

- a one-page visual summary
- UI design variant boards
- concept comparison boards
- pitch-card or poster-style summaries
- architecture or API flow infographics
- decision boards for choosing between alternatives
- visual summaries for stakeholders who will not read the full Markdown
- image assets for sharing in chat, slides, issue trackers, or planning docs

Good source documents include Markdown from `markdown-artifact`, repo docs, design specs, backend designs, feature proposals, architecture options, and rollout plans.

---

## When Not To Use

Do not use `image-artifact` when:

- the user needs Markdown generated from scratch; use `markdown-artifact`
- the user needs browser-readable or interactive output; use `html-artifact`
- the user needs repo implementation specs or plans; defer to `brainstorming` and `writing-plans`
- the source is too vague to support a faithful visual output; ask for or create a Markdown source first
- the request requires editing the source Markdown; update the source through the owning skill first
- the available image-generation tools cannot satisfy the requested fidelity or policy constraints

If image generation is unavailable in the current environment, say so and offer to create an image prompt pack in `images/` instead.

---

## Inputs

Accept any of:

- path to a Markdown file
- path to an artifact workspace containing `markdown/`
- raw pasted Markdown plus optional title or doc-type hint
- optional `--kind <kind>` to select output kind
- optional `--out <path>` to write a specific image file or image directory
- optional `--workspace <slug-or-path>` to choose an artifact workspace
- optional `--variants <n>` for variant boards
- optional `--force` to replace an existing generated output without asking

The skill must not invent source content that is not present or reasonably inferable from the Markdown. If the visual depends on missing facts, mark them as assumptions in the prompt plan or ask one focused question before generating.

---

## Output Kinds

`image-artifact` supports these output kinds:

| Kind | Use when | Default filename |
|---|---|---|
| `summary-card` | The source needs a concise shareable visual summary | `<source-stem>-summary.png` |
| `comparison-board` | The source contains options, variants, or tradeoffs | `<source-stem>-comparison-board.png` |
| `ui-variant-board` | The source describes UI component or flow variants | `<source-stem>-variant-board.png` |
| `architecture-diagram` | The source describes systems, APIs, services, or data flow | `<source-stem>-architecture.png` |
| `api-flow` | The source describes endpoints, actors, states, or request flow | `<source-stem>-api-flow.png` |
| `concept-poster` | The source is a product, business, or campaign concept | `<source-stem>-poster.png` |
| `decision-board` | The user needs to pick between alternatives | `<source-stem>-decision-board.png` |
| `prompt-pack` | Image generation is unavailable or the user wants prompts only | `<source-stem>-image-prompts.md` |

If no kind is provided, infer from the Markdown:

- UI/component/flow docs with multiple variants, states, screens, options, or approaches -> `ui-variant-board`
- UI/component/flow docs describing one component or one flow without variants -> `summary-card`
- architecture/backend/API/data-model docs -> `architecture-diagram` or `api-flow`
- option/tradeoff docs -> `comparison-board`
- idea/concept docs -> `summary-card` or `concept-poster`
- generic docs -> `summary-card`

Ask one focused question only if the inferred kind would materially change the result.

### Variant Count

`--variants <n>` controls the number of generated variants for `ui-variant-board`, `comparison-board`, and other multi-output board kinds.

- If the Markdown already defines variants, options, states, screens, or approaches, use those source-defined variants first.
- If `--variants <n>` is provided, generate at most `n` variants from the source-defined set.
- If the user requests a variant board but provides no count and the Markdown does not define a clear count, default to 3 variants.
- Do not generate more than 6 variants unless the user explicitly requests a higher count.
- Do not invent arbitrary variants. If the requested count exceeds what the Markdown supports, mark the gap as an assumption in the prompt plan or ask one focused question.

---

## Tool-Agnostic Generation Contract

The skill should use the best available image-generation tool in the current environment.

Provider-independent rules:

- Do not name or require a specific provider in the skill instructions.
- Do not assume the tool supports exact text rendering unless the active tool explicitly does.
- Keep generated-image text short; prefer labels, headings, and visual hierarchy over paragraphs.
- For text-heavy content, generate a visual summary or board and keep detailed text in Markdown/HTML.
- If a provider cannot reliably render required text, produce an image prompt pack or an HTML companion instead.
- Respect the active tool's safety, copyright, and content limits.
- Record the tool or provider used in `metadata.md` when known and when the metadata table shape supports it.

---

## Prompt Planning

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

For variant outputs, define each variant explicitly:

```markdown
## Variant A - Dense Operational Dashboard

- Purpose:
- Visual emphasis:
- Layout:
- Tradeoff:

## Variant B - Guided Workflow

- Purpose:
- Visual emphasis:
- Layout:
- Tradeoff:
```

The prompt plan may be written to `images/<source-stem>-prompt-plan.md` when the generation is complex, has multiple variants, or image generation is unavailable.

---

## Output Destination

Resolution order:

1. `--out <file>` writes the generated image exactly there.
2. `--out <directory>` writes images into that directory.
3. `--workspace <path>` writes to `<workspace>/images/`.
4. `--workspace <slug>` writes to `~/agent-artifacts/<slug>/images/`.
5. If source is inside `~/agent-artifacts/<slug>/markdown/`, write to sibling `~/agent-artifacts/<slug>/images/`.
6. If source is inside a Git repo, write to `~/agent-artifacts/<repo-name>-<source-stem>/images/`.
7. Otherwise derive slug from source title/stem and write to `~/agent-artifacts/<slug>/images/`.

Treat `--workspace` as a path when the value contains `/`, starts with `.`, or starts with `~`. Treat it as a slug only when it contains no path separators.

Create missing directories automatically. If a target file exists, ask before overwriting unless the user provided `--force` or explicitly requested replacement. When refreshing from changed Markdown without `--force`, write a new versioned file such as `-2`, `-v2`, or a descriptive dated suffix. For new variants, append a suffix such as `-variant-a`, `-variant-b`, or a descriptive slug.

---

## Metadata

Create or update `metadata.md` for default `~/agent-artifacts` workspaces, publishing workflows, or explicit metadata requests. Do not create metadata for simple explicit repo-local outputs unless the user asks for workspace metadata, publishability, or reproducibility.

If `metadata.md` already has the `markdown-artifact` table shape, update that table instead of creating a second artifact table:

```markdown
## Artifacts

| Type | Markdown | HTML | Images |
|---|---|---|---|
| idea-brief | `markdown/idea-brief.md` | | `images/idea-brief-summary.png` |
```

- Match the row by the Markdown source path when possible.
- If no row exists for the source Markdown, add one.
- Put one image path in the `Images` cell for single outputs.
- Put comma-separated image paths in the `Images` cell for multiple variants.
- Do not add a `Tool` column to this existing table shape.

If no artifact table exists, or the workspace is image-only, add image artifacts with this table shape:

```markdown
## Artifacts

| Type | Source | Output | Tool |
|---|---|---|---|
| summary-card | `markdown/idea-brief.md` | `images/idea-brief-summary.png` | `unknown` |
| comparison-board | `markdown/ui-component-design.md` | `images/ui-component-design-comparison-board.png` | `unknown` |
```

Use the active image-generation tool name when known. Use `unknown` when the tool is unavailable or cannot be identified.

If the source metadata file already uses a different table shape, preserve its columns and add the minimum information needed to record the image output. Do not silently change or reorder existing columns.

---

## Workflow

1. Receive a Markdown path, workspace path, pasted Markdown, or explicit source.
2. Verify source exists or capture pasted source.
3. Determine output kind from `--kind` or source signals.
4. Resolve workspace and output destination.
5. Read the Markdown source and extract the visual brief.
6. Build a prompt plan with assumptions and variant definitions when needed.
7. If a target file exists, confirm replacement, honor `--force`, or choose a versioned filename.
8. If image generation is unavailable, write a `prompt-pack` Markdown file and stop.
9. Generate the image artifact or artifacts with the available tool.
10. Save outputs under `images/`.
11. Update `metadata.md` only for default `~/agent-artifacts` workspaces, publishing workflows, or explicit metadata requests.
12. Verify output files exist and pass the available visual or file-level checks.
13. Report paths and source Markdown used.

---

## Validation

Before reporting complete, verify:

- source Markdown exists or pasted source was captured
- output path is inside the intended workspace or explicit `--out`
- generated image file exists
- no unrelated source Markdown was modified
- `metadata.md` includes the image artifact when using a full artifact workspace, publishing workflow, or explicit metadata request
- for variants, each generated file has a clear name and maps to the prompt plan
- if image generation was unavailable, a prompt pack was written instead of claiming image output

When possible, visually inspect generated images or produce a quick thumbnail/contact-sheet check.

If visual inspection is not possible in the environment, perform a file-level fallback check before reporting complete:

- file size is greater than 0 bytes
- MIME type or file signature identifies the output as an image
- dimensions are readable through an available image utility, metadata reader, or provider response

State when only file-level validation was possible. Do not claim exact visual fidelity unless the generated artifact was visually inspected.

---

## Relationship To `markdown-artifact`

`image-artifact` depends on Markdown source. It should not generate primary source documents itself.

When `image-artifact` is implemented, update `markdown-artifact` so that after writing source Markdown it may offer:

> "Image companion available. Run `image-artifact` on this Markdown file for visual summaries or variant boards. (yes / skip)"

Only offer this when the document clearly benefits from a visual summary, diagram, or option board. Do not offer it for every artifact by default.

---

## Relationship To `html-artifact`

`html-artifact` produces browser-readable HTML companions. `image-artifact` produces static image companions.

Use this boundary:

- use `html-artifact` for reading, navigation, interactivity, copy buttons, tabs, timelines, and long-form content
- use `image-artifact` for shareable visual summaries, boards, diagrams, posters, and decision aids
- use both when a workspace needs a readable artifact and a stakeholder-friendly visual summary

---

## Output

Report concise paths:

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

---

## Constraints

- Do not modify source Markdown unless explicitly asked.
- Do not require a specific image-generation vendor, model, or API.
- Do not claim exact UI fidelity unless the generated artifact was visually inspected.
- Do not use images as the source of truth; Markdown remains authoritative.
- Do not overwrite image artifacts without confirmation.
- Do not create actual Git repos unless explicitly requested and confirmed.
- Do not write to `docs/superpowers/` unless the user explicitly asks for a Superpowers spec or plan.

---

## Success Criteria

- A user can generate image companions from existing Markdown.
- Repo Markdown image output lands in `~/agent-artifacts/<repo-name>-<source-stem>/images/` by default.
- The skill works with any available image-generation tool.
- If image generation is unavailable, the skill produces a useful prompt pack instead.
- Metadata tracks generated image outputs when using a full artifact workspace, publishing workflow, or explicit metadata request.
- `markdown-artifact` is updated after implementation to optionally offer `image-artifact` for visual docs.
