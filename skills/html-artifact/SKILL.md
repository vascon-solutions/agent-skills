---
name: html-artifact
description: "Use when existing Markdown needs a self-contained browser artifact: readable HTML companion, interactive prototype, slide deck, design-system sheet, annotated diff, chart report, draggable board, or split-view editor."
---

# html-artifact

## Purpose

Convert any Markdown document into a rich, self-contained HTML companion. The Markdown stays the repo/git source of truth. The HTML is for reading, sharing, and acting on in a browser.

## When To Use

- You want a browser-ready version of any `.md` file
- You want an interactive single-file artifact whose source content lives in Markdown
- You need article-style artifacts such as annotated diffs, design token sheets, slide decks, animation sandboxes, clickable flows, SVG figure sheets, chart reports, draggable Kanban boards, or split-view editors
- After task-doc, roadmap-todo, prepare-qa-handoff, or prepare-frontend-handoff writes its output (opt-in)
- Standalone on any Markdown file — repo docs, specs, notes, handoffs

## When To Use vs. image-artifact

Use `html-artifact` instead of `image-artifact` when the source or requested output must preserve faithful readable text: paragraphs, detailed prose, tables, route lists, command lists, links, acceptance criteria, implementation steps, exact decisions, exact labels, detailed comparison criteria, or anything the reader must quote, copy, inspect, or verify precisely.

Example prompts:

- "Turn this spec into a readable artifact."
- "Create an artifact for this task doc."
- "Make a browser companion for this roadmap."
- "I need the routes, commands, tables, and decisions to remain exact."

Use `image-artifact` when the user wants a low-text concept visual such as a poster, illustration, mood image, or UI atmosphere.

## When Not To Use

- To generate Markdown from scratch — use task-doc, roadmap-todo, or prepare-qa-handoff
- To host or serve the HTML file
- When the destination expects Markdown (Slack, GitHub, README)

## Input

Accept any of:

- Path to any `.md` file
- Path to a directory — apply detection rules to all `.md` files; pick highest-confidence match by rule priority (lowest number), then most recently modified. If still tied or ambiguous, ask: "Found multiple candidates: [file-a.md] (task-doc) and [file-b.md] (roadmap). Which one should I convert?"
- Raw pasted Markdown + optional doc-type hint
- Optional `--out <path>` to override output destination
- Optional `--artifact-kind <kind>` for hand-built interactive or visual patterns
- Optional `--use-repo-design` to apply high-confidence local design tokens

## Bundled Script

Prefer the bundled renderer for deterministic conversion of straightforward Markdown:

```bash
node <this-skill-dir>/scripts/render-html-artifact.js <source.md> --out <output.html> [--doc-type <type>]
node <this-skill-dir>/scripts/verify-layout-artifact.js <doc-type-or-artifact-kind> <output.html>
```

Optional local preview after HTML exists:

```bash
node <artifact-workbench-skill-dir>/scripts/serve-artifact-workbench.js <workspace-or-html-file> [--open]
```

What the script does:

- Renders a single sidebar-nav + TL;DR layout regardless of doc-type. `--doc-type` only picks the default output folder and a meta line.
- Handles headings, paragraphs, ordered/unordered lists, fenced code blocks, GFM tables, inline code, bold, links, and remote-image-line replacement with a placeholder SVG.
- Enforces the single-file rule by rejecting `<script src=remote>`, `<link href=remote>`, `<iframe>`, `<img src=remote>`, and CSS `url(remote)` in the rendered output. URLs inside `<pre>`/`<code>` blocks and link text are allowed.

What the script does *not* do:

- Per-doc-type layouts from [references/html-layouts.md](references/html-layouts.md) — fall back to hand-built HTML when a specific layout is required.
- Artifact kinds — the script does not accept `--artifact-kind`. Artifact kinds are hand-built; pass `--artifact-kind` only to `verify-layout-artifact.js` after writing the hand-built HTML.
- Repo design tokens — the script accepts no design args. When `--use-repo-design` is in effect and `repo-design-context` returns high-confidence tokens, build the HTML by hand (or edit the script's `<style>` block post-render).
- Blockquotes, horizontal rules, nested lists, reference-style links, setext headings, inline images, or strikethrough. Hand-build the HTML if the source uses these.

The render script is the fast path. Hand-built HTML is the correct path when the source or destination needs anything in the second list. Use `fixtures/<layout-type>.md` as source examples and the matching `fixtures/html/<layout-type>.html` as the structural reference. Three fixtures are realistic exemplars worth cribbing from — `slide-deck.html`, `split-view-editor.html`, and `draggable-kanban.html` — with working CSS, inline JS, and sample content. The rest are verifier-shape minimums marked with a comment at the top of the file; treat those as "what the verifier accepts," not as the target output. After hand-building, run `verify-layout-artifact.js <layout-type> <output.html>`.

## Artifact Kinds Beyond Doc Types

Use `--artifact-kind <kind>` when the user wants a specific browser artifact shape rather than a document-shaped companion. Artifact kinds are hand-built from [references/html-layouts.md](references/html-layouts.md); the render script does not generate them.

Supported artifact kinds:

- `approach-comparison` — side-by-side implementation or architecture approaches
- `diff-annotation` — annotated PR diff with severity callouts
- `design-system-tokens` — copyable colors, spacing, typography, radius, and component tokens
- `slide-deck` — arrow-key presentation deck
- `animation-sandbox` — tunable CSS/JS animation demo
- `clickable-flow` — multi-screen prototype or state walkthrough
- `svg-figure-sheet` — tweakable inline SVG figures or diagrams
- `chart-report` — status or metrics report with inline SVG charts
- `draggable-kanban` — draggable ticket triage or prioritization board
- `split-view-editor` — prompt tuner, feature flag editor, or source/preview workbench

If `--artifact-kind` is present, it overrides doc-type layout selection. Still detect doc type for metadata and output folder when useful, but select the artifact pattern for the HTML structure.

## Doc-Type Detection

Apply ordered rules. First match wins.

1. **task-doc** — filename matches `task-*`; OR contains both `## Decisions Required` and `## Likely Files`
2. **roadmap** — filename matches `roadmap*` or `todo*`; OR contains status columns with planned/in-progress/done entries
3. **qa-handoff** — filename contains `qa` AND `handoff`; OR contains both a state/endpoint section and a role section
4. **frontend-handoff** — filename contains `frontend` AND `handoff`; OR contains both an API surface section and an implementation checklist
5. **repo-doc** — filename is `README*`, `AGENTS*`, `CLAUDE*`, `CONTRIBUTING*`, or `ARCHITECTURE*`; OR file lives in a `docs/` directory
6. **generic** — fallback for any `.md` not matched above

If a file matches signals from two different rules simultaneously, or two files in a directory tie on rule priority and modification time, present both candidates and ask once.

## Repo Design Context

Default to neutral styling. Only scan and apply repo design context when the user passes `--use-repo-design`.

Invoke the `repo-design-context` skill to resolve scan root, discovery precedence, confidence, and reporting. Pass the source Markdown path or captured title, optional doc-type hint, explicit repo path if the user provided one, artifact target `html companion`, and current working directory. Apply only high-confidence, local, self-contained tokens to the generated `<style>` block: colors, radius, spacing, shadows, and typography scale.

Keep system fonts unless a font is local and can be embedded without network access. Inline local logo assets only when they are clearly project-owned and can be encoded as data URIs.

Medium or low confidence means neutral styling. No `--neutral` flag is needed because neutral is the default when `--use-repo-design` is absent or confidence is not high. A wrong branded artifact is worse than a neutral artifact.

## Source Sanitization

Before generating HTML, apply these rules to the source:

| Source content | Action |
|---|---|
| Raw HTML blocks | Escape as text — do not render |
| Remote image URLs | Replace with placeholder inline SVG (grey box + alt text) |
| `<script>` tags | Strip entirely |
| Event handler attributes (`onclick`, `onload`, etc.) | Strip the attribute |
| `<iframe>` tags | Strip entirely |
| External stylesheet `<link>` tags | Strip entirely |
| Malformed tables | Best-effort parse; skip invalid rows |
| Malformed fenced code blocks | Treat as plain text |
| Inline SVG from source | Strip — only skill-generated SVG allowed |

With `--use-repo-design`, a local repo logo may be encoded and inlined by this skill only after `repo-design-context` reports high confidence. Source Markdown inline SVG is still stripped.

## Output Destination

Resolution order (first match wins):

1. `--out <path>` argument
2. Default: `~/agent-artifacts/<repo-name>/<doc-type-folder>/`

No CLAUDE.md or AGENTS.md configuration is supported. Only two options: `--out` argument or the default path.

Derive repo name from `git remote get-url origin` basename; fall back to current directory name.

Doc-type folders: `task-docs/`, `roadmaps/`, `qa-handoffs/`, `frontend-handoffs/`, `repo-docs/`, `generic/`

When `--artifact-kind` is set, write to `~/agent-artifacts/<repo-name>/artifacts/<kind>/` instead of a doc-type folder. The detected doc type is still recorded in metadata, but the artifact-kind drives the folder so kind-driven outputs are easy to find.

Create missing directories automatically. Handle filename collisions with numeric suffix (`my-doc-2.html`).

## Single-File Rule

Every output file must:

- Inline all CSS in `<style>` — no external stylesheets
- Inline all JS in `<script>` — no external scripts
- Use system fonts only: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- Encode images as inline SVG or base64 `data:` URIs — never remote URLs
- Make zero network requests

`--use-repo-design` must not weaken this rule. Any discovered token or asset that would require a network request must be ignored.

## Workflow

1. Receive input and note any `--out` arg
2. Resolve output path
3. Detect doc type using ordered rules above
4. Read and sanitize source
5. If `--use-repo-design` is provided, scan repo design context and decide whether confidence is high enough to apply
6. Select layout from [references/html-layouts.md](references/html-layouts.md). If `--artifact-kind` is present, select that artifact pattern and hand-build the HTML. Otherwise, if the source uses only the Markdown features the script supports and the chosen layout matches the script's single sidebar+TL;DR shape, use the script. Otherwise hand-build the HTML.
7. Generate self-contained HTML — single-file rule applies either way. High-confidence repo design tokens require hand-built HTML (the script accepts no design args).
8. Write to resolved path; create directories; handle collisions
9. For hand-built article-style layouts, run `scripts/verify-layout-artifact.js <doc-type-or-artifact-kind> <output.html>`.
10. Report output path, doc type, layout used (script or hand-built), and repo design context when scanned

## Validation

Before reporting complete, verify:

- The output file exists at the resolved path
- Opening the file in a browser (or running `grep -c "http" <file>`) shows zero external URLs in `src=`, `href=`, or `url()` — the single-file rule holds
- Hand-built article-style layouts pass `scripts/verify-layout-artifact.js <doc-type-or-artifact-kind> <output.html>`
- The detected doc type matches what the source document actually is (not just a filename match)
- If `--out` was provided, the file landed there, not at the default path
- If `--use-repo-design` was provided, report discovered signals, applied tokens, and confidence
- Local `artifact-workbench` preview is optional and never replaces self-contained HTML validation. If a workbench warning reports relative, absolute, or remote asset references, fix the HTML or document why it is not an `html-artifact` output.

## Output

```
Written: ~/agent-artifacts/agent-skills/task-docs/my-task.html (task-doc → jump-link layout)
Written: ~/agent-artifacts/agent-skills/generic/notes.html (generic → generic layout)
Written: ~/agent-artifacts/agent-skills/artifacts/diff-annotation/pr-review.html (diff-annotation hand-built layout)
Repo design context: found Tailwind config and CSS variables; applied colors/radius; confidence high
Repo design context: found Tailwind and MUI candidates; applied neutral default; confidence medium
Repo design context: found multiple themes; applied neutral default; confidence low
```

## Cautions

- **Sanitization bypass** — if the source Markdown contains raw HTML, it may look like valid content but must be escaped, not rendered. The most common mistake is passing Markdown through a lenient renderer that interprets embedded HTML.
- **Treating this as a generation skill** — this skill converts existing Markdown. If there is no source doc yet, the agent must stop and tell the user to run task-doc, roadmap-todo, or similar first.
- **Skipping the output path resolution** — if `--out` is not provided, the repo name must be derived from git remote, not hardcoded or guessed. A wrong repo name silently writes to the wrong folder.
- **Calling this from inside a priority skill before the skill's own output is complete** — the HTML invitation is a post-completion affordance. Do not invoke html-artifact until the calling skill has fully written its Markdown output and delivered its report.
- **Over-confident repo design matching** — do not apply project branding from ambiguous signals. Prefer neutral output unless repo design confidence is high.
