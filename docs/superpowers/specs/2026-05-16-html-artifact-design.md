# html-artifact Skill — Design Spec

**Date:** 2026-05-16
**Status:** Approved — ready for implementation
**Source:** Brainstorming session based on Thariq Shihipar's "The Unreasonable Effectiveness of HTML"

---

## Purpose

Create a new `html-artifact` skill that converts any Markdown document into a rich, self-contained HTML companion. The Markdown file remains the repo/git source of truth. The HTML file is for reading, sharing, and acting on.

The skill works standalone on any `.md` file and is optionally embedded as a post-output step in four priority skills: `task-doc`, `roadmap-todo`, `prepare-qa-handoff`, and `prepare-frontend-handoff`.

---

## Background

Thariq Shihipar (engineering lead, Claude Code at Anthropic) published "The Unreasonable Effectiveness of HTML" arguing that Markdown became the AI default during the token-scarce GPT-4 era but is structurally inferior for agent-produced artifacts at modern context window sizes. HTML enables: spatial layout, interactivity, visual hierarchy, collapsible sections, tabs, timelines, kanban boards, export buttons — none of which are possible in Markdown.

Key principle from the article: **single-file rule** — all CSS inline, all JS embedded, no external deps, system fonts only, images as SVG or base64. Files open directly in any browser with no build step.

Examples gallery: https://thariqs.github.io/html-effectiveness/

---

## Files to Create

```
skills/html-artifact/
├── SKILL.md
└── references/
    └── html-layouts.md
```

## Files to Modify

```
bin/link-skills.sh            — add html-artifact to SKILL_NAMES
README.md                     — add to directory tree, skills table, and usage scenarios
skills/task-doc/SKILL.md
skills/roadmap-todo/SKILL.md
skills/prepare-qa-handoff/SKILL.md
skills/prepare-frontend-handoff/SKILL.md
```

Each skill gets a post-output invitation step only (see Integration Contract below).

---

## Invocation Model

**Standalone:** User invokes `html-artifact` directly with any `.md` file path, a directory, or pasted Markdown content.

**Embedded (opt-in):** After each priority skill has fully completed its own output — document written AND existing report fields delivered — it appends this invitation:

> *"HTML companion available. Run `html-artifact` on this file to generate a browser-ready version. (yes / skip)"*

This step is positioned after the skill's formal output contract is already satisfied. It does not modify, replace, or extend the skill's existing "Produce exactly one of" or fixed report-field constraints.

---

## Integration Contract per Priority Skill

### `task-doc`

Current output contract (unchanged): "Produce exactly one of: a completed task document OR a brief refusal. Do not add commentary."

Addition: After the task document is written (or refused), append the HTML invitation as a separate follow-up line. It is not part of the task document and does not count as "commentary" — it is a post-completion affordance.

### `roadmap-todo`

Current output contract (unchanged): updated roadmap file or recommendation to create task docs.

Addition: After the file is written, append the HTML invitation.

### `prepare-qa-handoff`

Current output contract (unchanged): handoff file path or pasted Markdown, key behavioral clarifications, validation run, validation not run and why.

Addition: After all four report fields are delivered, append the HTML invitation as a fifth line.

### `prepare-frontend-handoff`

Current output contract (unchanged): handoff file path, backend/API and frontend surfaces checked, key model or contract shifts, validation run, validation not run and why.

Addition: After all report fields are delivered, append the HTML invitation as a final line.

---

## Input

- Path to any `.md` file
- Path to a directory containing `.md` files (see Detection — Directory Input below)
- Raw pasted Markdown content + optional doc-type hint
- Optional `--out <path>` argument to override the output destination

---

## Doc-Type Detection

Detection uses ordered rules only. First match wins. No scoring model.

| Priority | Doc type | Signals |
|---|---|---|
| 1 | `task-doc` | filename matches `task-*`; OR contains both `## Decisions Required` and `## Likely Files` |
| 2 | `roadmap` | filename matches `roadmap*` or `todo*`; OR contains status columns with entries across planned/in-progress/done |
| 3 | `qa-handoff` | filename contains `qa` AND `handoff`; OR contains both a state/endpoint section and a role section |
| 4 | `frontend-handoff` | filename contains `frontend` AND `handoff`; OR contains both an API surface section and an implementation checklist |
| 5 | `repo-doc` | filename is `README*`, `AGENTS*`, `CLAUDE*`, `CONTRIBUTING*`, or `ARCHITECTURE*`; OR file lives directly in a `docs/` directory |
| 6 | `generic` | fallback — any `.md` file not matched above |

**Ambiguity:** if no rule matches and the file is ambiguous (e.g. a `docs/` file that also matches task-doc signals), present the top two candidates and ask once.

**Directory input:** when given a directory, apply detection rules to all `.md` files in it. Pick the highest-confidence match by rule priority (lowest number wins). If two files tie on rule priority, pick the most recently modified. If still tied, ask once.

---

## Layout Map

Each doc type maps to a purpose-built HTML layout. Full structure guidance lives in `references/html-layouts.md`.

### `task-doc`
Based on article examples #16 (Implementation plan) and #14 (How a feature works).
- TL;DR summary box at top
- Jump-link sidebar navigation
- Collapsible sections: Scope, Exclusions, Decisions Required, Likely Files, Architecture Summary
- Decision items with visual status badges (resolved / unresolved / blocked)
- Syntax-highlighted code blocks for code evidence

### `roadmap`
Based on article example #18 (Ticket triage board).
- Kanban-style status board: Planned / In Progress / Done / Blocked columns
- Color-coded entries per status
- Export / copy-to-clipboard button for current board state

### `qa-handoff`
Based on article examples #12 (Incident timeline) and #11 (Weekly status).
- TL;DR summary box at top
- State transition timeline as lead section
- Endpoint touchpoints as a styled table
- Role boundary callout blocks
- Copy checklist button

### `frontend-handoff`
Based on article examples #17 (PR writeup) and #14 (How a feature works).
- TL;DR summary box at top
- Tabbed layout: API Surface / Implementation Checklist / Retired Dependencies
- Before/after comparisons where applicable
- Export checklist button

### `repo-doc`
Based on article examples #14 (How a feature works) and #15 (Concept explainer).
- TL;DR summary box at top
- Sidebar navigation anchored to all top-level headings
- Collapsible subsections for long content
- Syntax-highlighted code blocks

### `generic`
Fallback for any unrecognized Markdown file.
- Clean single-column layout
- Styled headings, tables, and code blocks
- No interactive chrome
- No TL;DR box

---

## Single-File Rule

Enforced for every layout without exception:

- All CSS in `<style>` tags — no `<link rel="stylesheet">`
- All JS in `<script>` tags — no `src=` pointing outside the file
- System font stack only: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- Images as inline `<svg>` or base64 `data:` URIs — never remote URLs
- Zero network dependencies — file must render offline

---

## Source Sanitization

The source Markdown may contain content that would break the offline guarantee or execute unintended code. Apply these rules before generating HTML:

| Source content | Action |
|---|---|
| Raw HTML blocks in Markdown | Escape as text — do not render as HTML |
| Remote image URLs (`![](https://...)`) | Replace with a placeholder inline SVG (grey box + alt text) |
| `<script>` tags in source | Strip entirely |
| Event handler attributes (`onclick`, `onload`, etc.) | Strip the attribute |
| `<iframe>` tags | Strip entirely |
| External stylesheet `<link>` tags | Strip entirely |
| Malformed tables | Best-effort parse — render what is valid, skip invalid rows |
| Malformed fenced code blocks | Treat as plain text |
| Inline SVG generated by the skill itself | Allowed — only generated SVG, never passthrough of source SVG |

The goal: the output HTML is entirely under the skill's control. Nothing from the source executes.

---

## Output Destination

**Resolution order (first match wins):**

1. `--out <path>` argument passed at invocation
2. Default: `~/agent-artifacts/<repo-name>/<doc-type-folder>/`

No CLAUDE.md or AGENTS.md configuration. Two options only: explicit arg or the default path.

**Repo name** is derived from the `git remote get-url origin` basename, falling back to the directory name if no git remote exists.

**Doc-type folder names:**

| Doc type | Folder |
|---|---|
| `task-doc` | `task-docs/` |
| `roadmap` | `roadmaps/` |
| `qa-handoff` | `qa-handoffs/` |
| `frontend-handoff` | `frontend-handoffs/` |
| `repo-doc` | `repo-docs/` |
| `generic` | `generic/` |

**Full example structure:**

```
~/agent-artifacts/
  agent-skills/
    task-docs/
      my-task.html
    roadmaps/
      ROADMAP.html
    qa-handoffs/
      feature-x-qa.html
    frontend-handoffs/
      feature-x-frontend.html
    repo-docs/
      README.html
      AGENTS.html
    generic/
      some-other-doc.html
  my-other-project/
    task-docs/
      ...
```

**Collision handling:** if a file with the same basename already exists, append a numeric suffix: `my-task-2.html`. The skill creates any missing directories automatically.

---

## Skill Workflow (SKILL.md)

1. **Receive input** — path, directory, or pasted content; note any `--out` arg
2. **Resolve output path** — use `--out` if provided, otherwise derive from git remote + doc-type folder
3. **Detect doc type** — apply ordered rules; handle ambiguity and directory input per Detection rules above
4. **Read and sanitize source** — parse sections, headings, tables, status items, decisions; apply sanitization rules
5. **Select layout** — load spec from `references/html-layouts.md` for the detected type
6. **Generate HTML** — produce single self-contained file; apply layout; enforce single-file rule
7. **Write output** — create directories if needed; handle filename collision
8. **Report** — one line: output path written, doc type detected, layout used

---

## Constraints

- Never modify the source Markdown doc
- Never push, publish, or deploy the HTML file
- Never refuse to run because the doc type is unrecognized — use `generic` layout
- Never pass through source HTML, scripts, event handlers, iframes, or remote assets
- The skill produces a file only — do not implement any content described in the document

---

## Out of Scope

- Watching for Markdown changes and auto-refreshing HTML
- Hosting or serving the HTML file
- Converting HTML back to Markdown
- Generating Markdown from scratch (use `task-doc`, `roadmap-todo`, etc. first)
- Git tracking of `~/agent-artifacts/` (user's responsibility)

---

## Follow-up: `markdown-artifact` Skill

**Design separately after `html-artifact` ships.**

`markdown-artifact` is the companion skill that generates Markdown documents from scratch — any topic, idea, spec, brief, or task plan, scoped to a repo or not. Where `html-artifact` renders existing docs, `markdown-artifact` produces the source.

**Intended use cases:**
- Brainstorming a new app or product idea
- CTO concept briefs for a team
- Documentation on any topic (not repo-bound)
- Computer use task plans
- Specs and proposals for distributed/side-gig teams

**Key design decisions to resolve in that brainstorm:**
- Doc-type detection (app spec vs concept brief vs how-to vs task plan)
- Audience awareness (technical team vs stakeholders vs distributed collaborators)
- Output destination: `~/agent-artifacts/markdown-docs/<type>/` or similar
- Whether `markdown-artifact` automatically calls `html-artifact` at the end, or leaves that as a separate opt-in
- Relationship to existing repo-scoped skills (`task-doc`, `roadmap-todo`) — when does the user reach for `markdown-artifact` vs those

---

## Success Criteria

- Running `html-artifact` on any `.md` file produces a valid, self-contained `.html` file
- The file opens in a browser with no network requests and no console errors
- The correct layout is applied for each of the 6 doc types
- Output lands in the correct doc-type subfolder under `~/agent-artifacts/<repo>/`
- `--out` overrides the default destination correctly
- Invoking via the opt-in step from any priority skill produces the same result as standalone
- `html-artifact` is listed in `bin/link-skills.sh` and discoverable after running the link script
- Source HTML, scripts, event handlers, and remote assets are never present in the output
