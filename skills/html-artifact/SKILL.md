---
name: html-artifact
description: Convert any Markdown file into a self-contained HTML companion artifact stored in ~/agent-artifacts/. Supports 6 doc-type layouts. Works standalone or as an opt-in post-output step from task-doc, roadmap-todo, prepare-qa-handoff, and prepare-frontend-handoff.
---

# html-artifact

## Purpose

Convert any Markdown document into a rich, self-contained HTML companion. The Markdown stays the repo/git source of truth. The HTML is for reading, sharing, and acting on in a browser.

## When To Use

- You want a browser-ready version of any `.md` file
- After task-doc, roadmap-todo, prepare-qa-handoff, or prepare-frontend-handoff writes its output (opt-in)
- Standalone on any Markdown file — repo docs, specs, notes, handoffs

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

## Doc-Type Detection

Apply ordered rules. First match wins.

1. **task-doc** — filename matches `task-*`; OR contains both `## Decisions Required` and `## Likely Files`
2. **roadmap** — filename matches `roadmap*` or `todo*`; OR contains status columns with planned/in-progress/done entries
3. **qa-handoff** — filename contains `qa` AND `handoff`; OR contains both a state/endpoint section and a role section
4. **frontend-handoff** — filename contains `frontend` AND `handoff`; OR contains both an API surface section and an implementation checklist
5. **repo-doc** — filename is `README*`, `AGENTS*`, `CLAUDE*`, `CONTRIBUTING*`, or `ARCHITECTURE*`; OR file lives in a `docs/` directory
6. **generic** — fallback for any `.md` not matched above

If a file matches signals from two different rules simultaneously, or two files in a directory tie on rule priority and modification time, present both candidates and ask once.

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

## Output Destination

Resolution order (first match wins):

1. `--out <path>` argument
2. Default: `~/agent-artifacts/<repo-name>/<doc-type-folder>/`

No CLAUDE.md or AGENTS.md configuration is supported. Only two options: `--out` argument or the default path.

Derive repo name from `git remote get-url origin` basename; fall back to current directory name.

Doc-type folders: `task-docs/`, `roadmaps/`, `qa-handoffs/`, `frontend-handoffs/`, `repo-docs/`, `generic/`

Create missing directories automatically. Handle filename collisions with numeric suffix (`my-doc-2.html`).

## Single-File Rule

Every output file must:

- Inline all CSS in `<style>` — no external stylesheets
- Inline all JS in `<script>` — no external scripts
- Use system fonts only: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- Encode images as inline SVG or base64 `data:` URIs — never remote URLs
- Make zero network requests

## Workflow

1. Receive input and note any `--out` arg
2. Resolve output path
3. Detect doc type using ordered rules above
4. Read and sanitize source
5. Select layout from [references/html-layouts.md](references/html-layouts.md)
6. Generate self-contained HTML — apply layout, enforce single-file rule
7. Write to resolved path; create directories; handle collisions
8. Report one line: output path, doc type, layout used

## Validation

Before reporting complete, verify:

- The output file exists at the resolved path
- Opening the file in a browser (or running `grep -c "http" <file>`) shows zero external URLs in `src=`, `href=`, or `url()` — the single-file rule holds
- The detected doc type matches what the source document actually is (not just a filename match)
- If `--out` was provided, the file landed there, not at the default path

## Output

```
Written: ~/agent-artifacts/agent-skills/task-docs/my-task.html (task-doc → jump-link layout)
Written: ~/agent-artifacts/agent-skills/generic/notes.html (generic → generic layout)
```

## Cautions

- **Sanitization bypass** — if the source Markdown contains raw HTML, it may look like valid content but must be escaped, not rendered. The most common mistake is passing Markdown through a lenient renderer that interprets embedded HTML.
- **Treating this as a generation skill** — this skill converts existing Markdown. If there is no source doc yet, the agent must stop and tell the user to run task-doc, roadmap-todo, or similar first.
- **Skipping the output path resolution** — if `--out` is not provided, the repo name must be derived from git remote, not hardcoded or guessed. A wrong repo name silently writes to the wrong folder.
- **Calling this from inside a priority skill before the skill's own output is complete** — the HTML invitation is a post-completion affordance. Do not invoke html-artifact until the calling skill has fully written its Markdown output and delivered its report.
