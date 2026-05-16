# html-artifact Skill — Design Spec

**Date:** 2026-05-16
**Status:** Approved — ready for implementation
**Source:** Brainstorming session based on Thariq Shihipar's "The Unreasonable Effectiveness of HTML"

---

## Purpose

Create a new `html-artifact` skill that converts any Markdown document into a rich, self-contained HTML companion. The Markdown file remains the repo/git source of truth. The HTML file is for reading, sharing, and acting on.

The skill works standalone on any `.md` file and is optionally embedded at the end of four priority skills: `task-doc`, `roadmap-todo`, `prepare-qa-handoff`, and `prepare-frontend-handoff`.

---

## Background

Thariq Shihipar (engineering lead, Claude Code at Anthropic) published "The Unreasonable Effectiveness of HTML" arguing that Markdown became the AI default during the token-scarce GPT-4 era but is structurally inferior for agent-produced artifacts at modern context window sizes. HTML enables: spatial layout, interactivity, visual hierarchy, collapsible sections, tabs, timelines, kanban boards, export buttons — none of which are possible in Markdown.

Key principle from the article: **single-file rule** — all CSS inline, all JS embedded, no external deps, system fonts only, images as SVG or base64. Files open directly in any browser with no build step.

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
skills/task-doc/SKILL.md
skills/roadmap-todo/SKILL.md
skills/prepare-qa-handoff/SKILL.md
skills/prepare-frontend-handoff/SKILL.md
```

Each gets one opt-in step appended to its output section.

---

## Invocation Model

**Standalone:** User invokes `html-artifact` directly with any `.md` file path, a directory (skill picks the most relevant `.md`), or pasted Markdown content.

**Embedded (opt-in):** After the four priority skills write their Markdown output, they ask:
> *"Generate an HTML companion? (yes / no)"*

If yes, they invoke `html-artifact` on the output path. No other changes to those skills.

---

## Input

- Path to any `.md` file
- Path to a directory containing `.md` files
- Raw pasted Markdown content + optional doc-type hint
- Optional `--out <path>` argument to override output destination

---

## Doc-Type Detection

Detection runs in order. First match wins.

| Doc type | Signals |
|---|---|
| `task-doc` | filename matches `task-*`; contains `## Decisions Required` or `## Likely Files` |
| `roadmap` | filename matches `roadmap*` or `todo*`; contains status columns or milestone entries |
| `qa-handoff` | filename contains `qa` and `handoff`; contains state/endpoint sections |
| `frontend-handoff` | filename contains `frontend` and `handoff`; contains API surface or checklist sections |
| `repo-doc` | filename is `README*`, `AGENTS*`, `CLAUDE*`, `CONTRIBUTING*`, `ARCHITECTURE*`; or file lives in a `docs/` directory |
| `generic` | fallback — any `.md` file not matched above |

If detection is ambiguous (two types score equally), ask the user once before proceeding: present the top two candidate types and ask which one to use.

---

## Layout Map

Each doc type maps to a purpose-built HTML layout. Full structure guidance lives in `references/html-layouts.md`.

### `task-doc`
Based on article examples #16 (Implementation plan) and #14 (How a feature works).
- TL;DR summary box at top
- Jump-link sidebar navigation
- Collapsible sections for: Scope, Exclusions, Decisions Required, Likely Files, Architecture Summary
- Decision items rendered with visual status badges (resolved / unresolved / blocked)
- Code evidence as syntax-highlighted blocks

### `roadmap`
Based on article example #18 (Ticket triage board).
- Kanban-style status board with columns: Planned / In Progress / Done / Blocked
- Color-coded entries per status
- Export / copy-to-clipboard button for current board state

### `qa-handoff`
Based on article examples #12 (Incident timeline) and #11 (Weekly status).
- TL;DR summary box at top
- State transition timeline as the lead section
- Endpoint touchpoints as a styled table
- Role boundaries as callout blocks
- Copy checklist button

### `frontend-handoff`
Based on article examples #17 (PR writeup) and #14 (How a feature works).
- TL;DR summary box at top
- Tabbed layout: API Surface / Implementation Checklist / Retired Dependencies
- Before/after comparisons where applicable
- Export checklist button

### `repo-doc`
Based on article example #14 (How a feature works) and #15 (Concept explainer).
- TL;DR summary box at top
- Sidebar navigation anchored to all top-level headings
- Collapsible subsections for long content
- Syntax-highlighted code blocks

### `generic`
Fallback for any unrecognized Markdown file.
- Clean single-column layout
- Styled headings, tables, and code blocks
- No interactive chrome
- No TL;DR box (content unknown)

---

## Single-File Rule

Enforced for every layout without exception:

- All CSS in `<style>` tags — no `<link rel="stylesheet">`
- All JS in `<script>` tags — no `src=` pointing outside the file
- System font stack only: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- Images as inline `<svg>` or base64 `data:` URIs — never remote URLs
- Zero network dependencies — file must render offline

---

## Output Destination

**Resolution order (first match wins):**

1. `--out <path>` argument passed at invocation
2. `HTML_ARTIFACTS_PATH` set in the repo's `CLAUDE.md` or `AGENTS.md`
3. Default: `~/agent-artifacts/<repo-name>/<doc-type>/`

**Folder structure inside the output destination:**

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

Doc-type folder names:

| Doc type | Folder |
|---|---|
| `task-doc` | `task-docs/` |
| `roadmap` | `roadmaps/` |
| `qa-handoff` | `qa-handoffs/` |
| `frontend-handoff` | `frontend-handoffs/` |
| `repo-doc` | `repo-docs/` |
| `generic` | `generic/` |

**Collision handling:** if a file with the same basename already exists in the folder, append a short disambiguator: `my-task-2.html`.

The skill creates any missing directories automatically.

---

## Skill Workflow (SKILL.md)

1. **Receive input** — path, directory, or pasted content
2. **Resolve output path** — check arg → CLAUDE.md → default
3. **Detect doc type** — match signals against detection table; ask once if ambiguous
4. **Read source** — parse sections, headings, tables, status items, decisions
5. **Select layout** — load spec from `references/html-layouts.md`
6. **Generate HTML** — produce single self-contained file; apply layout; enforce single-file rule
7. **Write output** — create directories if needed; write to resolved path
8. **Report** — one line: output path, doc type detected, layout used

---

## Changes to Priority Skills

Each of the four skills gets this appended to its **Output** section:

```markdown
After writing the Markdown output, ask the user:
> "Generate an HTML companion? (yes / no)"

If yes, invoke `html-artifact` on the output path.
This is the only change to this skill's workflow. All other constraints and outputs are unchanged.
```

---

## Constraints

- Never modify the source Markdown doc
- Never push, publish, or deploy the HTML file
- Never refuse to run because the doc type is unrecognized — use `generic` layout
- Never add external dependencies to the HTML output
- The skill produces a file, not an implementation — do not start coding the described content

---

## Out of Scope

- Watching for Markdown changes and auto-refreshing HTML
- Hosting or serving the HTML file
- Converting HTML back to Markdown
- Generating Markdown from scratch (use `task-doc`, `roadmap-todo`, etc. first)
- Git tracking of `.artifacts/` (recommend `.gitignore`)

---

## Success Criteria

- Running `html-artifact` on any `.md` file produces a valid, self-contained `.html` file
- The file opens in a browser with no network requests
- The correct layout is applied for each of the 6 doc types
- Output lands in the correct doc-type subfolder under the configured artifacts path
- Invoking from `task-doc`, `roadmap-todo`, `prepare-qa-handoff`, or `prepare-frontend-handoff` with "yes" produces the same result as standalone invocation
