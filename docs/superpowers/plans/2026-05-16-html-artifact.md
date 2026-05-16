# html-artifact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `html-artifact` skill that converts any Markdown file into a self-contained, browser-ready HTML companion, stored in `~/agent-artifacts/`, with opt-in embedding in four existing skills.

**Architecture:** One new skill directory (`skills/html-artifact/`) with a lean `SKILL.md` and a `references/html-layouts.md` that holds the per-doc-type layout specs. Four existing skills receive a single post-output invitation step. The link script and README are updated to register the new skill.

**Tech Stack:** Markdown prose only — no runtime code. All "implementation" is writing SKILL.md and references/ files. Verification uses shell commands (grep, ls, symlink checks).

**Spec:** `docs/superpowers/specs/2026-05-16-html-artifact-design.md`

---

### Task 1: Create `skills/html-artifact/SKILL.md`

**Files:**
- Create: `skills/html-artifact/SKILL.md`

- [ ] **Step 1: Create the skill directory**

```bash
mkdir -p /Users/dee/agent-skills/skills/html-artifact
```

Expected: no output, directory exists.

- [ ] **Step 2: Write `SKILL.md` with full content**

Write the file at `skills/html-artifact/SKILL.md` with this exact content:

```markdown
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
- Path to a directory — apply detection rules to all `.md` files; pick highest-confidence match by rule priority, then most recently modified, then ask once
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

If two candidates tie, present both and ask once.

## Source Sanitization

Before generating HTML, apply these rules to the source:

| Source content | Action |
|---|---|
| Raw HTML blocks | Escape as text — do not render |
| Remote image URLs | Replace with placeholder inline SVG (grey box + alt text) |
| `<script>` tags | Strip entirely |
| Event handler attributes (`onclick`, `onload`, etc.) | Strip the attribute |
| `<iframe>` tags | Strip entirely |
| External `<link>` tags | Strip entirely |
| Malformed tables | Best-effort parse; skip invalid rows |
| Malformed fenced code blocks | Treat as plain text |
| Inline SVG from source | Strip — only skill-generated SVG allowed |

## Output Destination

Resolution order (first match wins):

1. `--out <path>` argument
2. Default: `~/agent-artifacts/<repo-name>/<doc-type-folder>/`

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

## Output

```
Written: ~/agent-artifacts/agent-skills/task-docs/my-task.html (task-doc → jump-link layout)
```

## Cautions

- Never modify the source Markdown file
- Never render source HTML, scripts, event handlers, or remote assets in output
- Never refuse an unrecognized doc type — use generic layout
- Never create external dependencies in the HTML output
```

- [ ] **Step 3: Verify frontmatter and line count**

```bash
head -5 /Users/dee/agent-skills/skills/html-artifact/SKILL.md
wc -l /Users/dee/agent-skills/skills/html-artifact/SKILL.md
```

Expected: first line is `---`, `name: html-artifact` present, line count between 80 and 130.

- [ ] **Step 4: Commit**

```bash
git -C /Users/dee/agent-skills add skills/html-artifact/SKILL.md
git -C /Users/dee/agent-skills commit -m "feat: add html-artifact SKILL.md"
```

---

### Task 2: Create `skills/html-artifact/references/html-layouts.md`

**Files:**
- Create: `skills/html-artifact/references/html-layouts.md`

- [ ] **Step 1: Create references directory**

```bash
mkdir -p /Users/dee/agent-skills/skills/html-artifact/references
```

- [ ] **Step 2: Write `html-layouts.md` with full content**

Write the file at `skills/html-artifact/references/html-layouts.md` with this exact content:

````markdown
# HTML Layout Specifications

Layout guidance for each doc type. Every layout satisfies the single-file rule: inline CSS only, inline JS only, system fonts, zero network dependencies.

## Common Shell

All layouts share this HTML shell:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{document title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 15px; line-height: 1.6; color: #1a1a1a; background: #f8f8f8; }
    a { color: #0066cc; }
    pre { background: #1e1e1e; color: #d4d4d4; padding: 1rem; border-radius: 6px; overflow-x: auto; font-size: 13px; }
    code { font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #f0f0f0; font-weight: 600; }
    details > summary { cursor: pointer; font-weight: 600; padding: 8px 0; list-style: none; }
    details > summary::before { content: '▶ '; font-size: 11px; }
    details[open] > summary::before { content: '▼ '; }
  </style>
</head>
<body>
  {layout content}
</body>
</html>
```

## TL;DR Box

Used by: task-doc, qa-handoff, frontend-handoff, repo-doc.

Extract from: first paragraph under `## Summary` or `## Overview`; fall back to the first non-heading paragraph in the document.

```html
<div style="background:#e8f4fd;border-left:4px solid #0066cc;padding:1rem 1.25rem;margin-bottom:1.5rem;border-radius:0 6px 6px 0;">
  <strong style="display:block;margin-bottom:4px;color:#0066cc;">TL;DR</strong>
  <p>{summary text}</p>
</div>
```

---

## Layout: task-doc

Based on article examples #16 (Implementation plan) and #14 (How a feature works).

Elements: TL;DR box, fixed sidebar with jump links, collapsible sections, decision badges.

### Page Structure

```html
<div style="display:flex;min-height:100vh;">
  <nav style="width:240px;flex-shrink:0;background:#fff;border-right:1px solid #e0e0e0;padding:1.5rem 1rem;position:sticky;top:0;height:100vh;overflow-y:auto;">
    <strong style="font-size:12px;text-transform:uppercase;color:#888;letter-spacing:.06em;">Contents</strong>
    <ul style="list-style:none;margin-top:.75rem;font-size:13px;display:flex;flex-direction:column;gap:.35rem;">
      <!-- one <li><a href="#{slug}">{heading}</a></li> per ## heading -->
    </ul>
  </nav>
  <main style="flex:1;padding:2rem;max-width:860px;">
    <!-- TL;DR box here -->
    <!-- sections here -->
  </main>
</div>
```

Generate heading `id` slugs: lowercase, spaces → hyphens, remove special characters.

### Collapsible Sections

Wrap each `##` section in `<details>`. Open by default: Scope, Decisions Required. Closed by default: Exclusions, Likely Files To Touch, Architecture Summary, Code Evidence.

```html
<details open>
  <summary id="{slug}">{Section Heading}</summary>
  <div style="padding:.75rem 0 1rem 1.25rem;">{section content}</div>
</details>
```

### Decision Badges

For items under `## Decisions Required`, assign badge color from content:
- Contains "unresolved" or no resolution marker → `#dc2626` (red)
- Contains "blocked" → `#d97706` (amber)
- Contains "resolved" or a named decision → `#16a34a` (green)

```html
<div style="display:flex;align-items:flex-start;gap:.75rem;padding:.6rem 0;border-bottom:1px solid #f0f0f0;">
  <span style="flex-shrink:0;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;background:{color};color:#fff;">{Unresolved|Blocked|Resolved}</span>
  <div style="font-size:14px;">{decision text}</div>
</div>
```

---

## Layout: roadmap

Based on article example #18 (Ticket triage board).

Elements: Kanban board with four status columns, color-coded cards, copy-as-markdown export button.

### Status Detection

Parse each roadmap entry for status keywords:
- planned / todo / upcoming → **Planned**
- in-progress / active / current / doing → **In Progress**
- done / complete / shipped / closed → **Done**
- blocked / stalled / on-hold → **Blocked**

Default: Planned.

### Board Structure

```html
<div style="padding:1.5rem;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
    <h1 style="font-size:1.4rem;">{document title}</h1>
    <button onclick="copyBoard()" style="padding:6px 14px;background:#0066cc;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;">Copy as Markdown</button>
  </div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;align-items:start;">
    <!-- one column per status -->
  </div>
</div>
```

### Column

```html
<div>
  <div style="font-weight:700;padding:.5rem .75rem;border-radius:6px 6px 0 0;background:{header-bg};color:{header-fg};">{Status Label}</div>
  <div style="background:#fff;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 6px 6px;padding:.5rem;display:flex;flex-direction:column;gap:.5rem;" data-col="{Status Label}">
    <!-- cards -->
  </div>
</div>
```

Column header colors:
- Planned: bg `#e0e7ff`, fg `#3730a3`
- In Progress: bg `#fef3c7`, fg `#92400e`
- Done: bg `#dcfce7`, fg `#166534`
- Blocked: bg `#fee2e2`, fg `#991b1b`

### Card

```html
<div style="background:#f9f9f9;border:1px solid #e8e8e8;border-radius:4px;padding:.5rem .75rem;font-size:14px;" data-card>{entry title and description}</div>
```

### Export Script

```html
<script>
function copyBoard() {
  const cols = document.querySelectorAll('[data-col]');
  let md = '';
  cols.forEach(col => {
    md += '## ' + col.dataset.col + '\n';
    col.querySelectorAll('[data-card]').forEach(c => { md += '- ' + c.textContent.trim() + '\n'; });
    md += '\n';
  });
  navigator.clipboard.writeText(md.trim());
}
</script>
```

---

## Layout: qa-handoff

Based on article examples #12 (Incident timeline) and #11 (Weekly status).

Elements: TL;DR box, state transition timeline, endpoint table with method badges, role callout blocks, copy checklist button.

### State Timeline

Source: `## State`, `## States`, or `## Lifecycle` section. Each state is one timeline node.

```html
<div style="position:relative;padding-left:2rem;margin:1.25rem 0;">
  <div style="position:absolute;left:.55rem;top:.3rem;bottom:0;width:2px;background:#e0e0e0;"></div>
  <!-- for each state: -->
  <div style="position:relative;margin-bottom:1.25rem;">
    <div style="position:absolute;left:-1.55rem;top:.3rem;width:12px;height:12px;border-radius:50%;background:#0066cc;border:2px solid #fff;box-shadow:0 0 0 2px #0066cc;"></div>
    <strong style="font-size:14px;">{state name}</strong>
    <p style="font-size:13px;color:#555;margin-top:2px;">{state description}</p>
  </div>
</div>
```

### Endpoint Table

Source: `## Endpoints` or `## API` section.

HTTP method badge colors: GET `#16a34a`, POST `#0066cc`, PUT `#d97706`, DELETE `#dc2626`, PATCH `#7c3aed`.

```html
<span style="display:inline-block;padding:1px 7px;border-radius:4px;font-size:11px;font-weight:700;color:#fff;background:{color};">{METHOD}</span>
```

### Role Callout

Source: `## Roles` or `## Access` section.

```html
<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:.75rem 1rem;margin:.5rem 0;font-size:14px;">
  <strong>{role name}:</strong> {access description}
</div>
```

### Copy Checklist Button and Script

Collect all `- [ ]` checklist items from the document. Assign `data-check` to their rendered elements.

```html
<button onclick="copyChecklist()" style="padding:6px 14px;background:#16a34a;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;margin:1rem 0;">Copy Checklist</button>
<script>
function copyChecklist() {
  const items = document.querySelectorAll('[data-check]');
  navigator.clipboard.writeText([...items].map(i => '- [ ] ' + i.textContent.trim()).join('\n'));
}
</script>
```

---

## Layout: frontend-handoff

Based on article examples #17 (PR writeup for reviewers) and #14 (How a feature works).

Elements: TL;DR box, tab navigation (API Surface / Implementation Checklist / Retired Dependencies), export checklist button in the checklist tab.

### Tab Mapping

- Headings `## API Surface`, `## Endpoints`, `## Routes`, `## API` → API Surface tab
- Headings `## Implementation Checklist`, `## Checklist`, `## Steps`, `## Tasks` → Implementation Checklist tab
- Headings `## Retired`, `## Deprecated`, `## Removed`, `## Breaking Changes` → Retired Dependencies tab
- Unmatched headings → append to API Surface tab

### Tab Shell

```html
<div style="padding:1.5rem;max-width:900px;margin:0 auto;">
  <!-- TL;DR box -->
  <div style="border-bottom:2px solid #e0e0e0;display:flex;gap:0;margin-bottom:1.5rem;">
    <button onclick="showTab('api')" id="tab-api" style="padding:.6rem 1.25rem;border:none;background:none;cursor:pointer;font-size:14px;font-weight:600;border-bottom:2px solid #0066cc;color:#0066cc;margin-bottom:-2px;">API Surface</button>
    <button onclick="showTab('checklist')" id="tab-checklist" style="padding:.6rem 1.25rem;border:none;background:none;cursor:pointer;font-size:14px;color:#666;border-bottom:2px solid transparent;margin-bottom:-2px;">Implementation Checklist</button>
    <button onclick="showTab('retired')" id="tab-retired" style="padding:.6rem 1.25rem;border:none;background:none;cursor:pointer;font-size:14px;color:#666;border-bottom:2px solid transparent;margin-bottom:-2px;">Retired Dependencies</button>
  </div>
  <div id="pane-api">{API Surface content}</div>
  <div id="pane-checklist" style="display:none;">
    {checklist content}
    <button onclick="copyChecklist()" style="padding:6px 14px;background:#16a34a;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;margin-top:1rem;">Export Checklist</button>
  </div>
  <div id="pane-retired" style="display:none;">{retired deps content}</div>
</div>
<script>
function showTab(name) {
  ['api','checklist','retired'].forEach(t => {
    document.getElementById('pane-'+t).style.display = t===name ? 'block' : 'none';
    const btn = document.getElementById('tab-'+t);
    btn.style.borderBottomColor = t===name ? '#0066cc' : 'transparent';
    btn.style.color = t===name ? '#0066cc' : '#666';
    btn.style.fontWeight = t===name ? '600' : '400';
  });
}
function copyChecklist() {
  const items = document.querySelectorAll('[data-check]');
  navigator.clipboard.writeText([...items].map(i => '- [ ] ' + i.textContent.trim()).join('\n'));
}
</script>
```

---

## Layout: repo-doc

Based on article examples #14 (How a feature works) and #15 (Concept explainer).

Elements: TL;DR box, sticky sidebar navigation anchored to all `##` headings, collapsible `###` subsections, syntax-highlighted code blocks.

### Page Structure

Same two-column shell as task-doc. Sidebar lists all `##` headings as anchor links. Generate `id` slugs: lowercase, spaces → hyphens, strip special characters.

```html
<div style="display:flex;min-height:100vh;">
  <nav style="width:220px;flex-shrink:0;background:#fff;border-right:1px solid #e0e0e0;padding:1.5rem 1rem;position:sticky;top:0;height:100vh;overflow-y:auto;">
    <strong style="font-size:12px;text-transform:uppercase;color:#888;letter-spacing:.06em;">On this page</strong>
    <ul style="list-style:none;margin-top:.75rem;font-size:13px;display:flex;flex-direction:column;gap:.35rem;">
      <!-- <li><a href="#{slug}" style="color:#444;text-decoration:none;">{heading}</a></li> -->
    </ul>
  </nav>
  <main style="flex:1;padding:2rem;max-width:800px;">
    <!-- TL;DR box -->
    <!-- sections: ## headings as <h2 id="{slug}">, ### headings wrapped in <details> -->
  </main>
</div>
```

Wrap `###` subsections in `<details>` (closed by default). `##` sections are always visible.

---

## Layout: generic

Fallback for any unrecognized Markdown file. No interactive elements, no TL;DR box.

```html
<div style="max-width:780px;margin:0 auto;padding:2rem;">
  <h1 style="font-size:1.6rem;margin-bottom:1.5rem;border-bottom:1px solid #e0e0e0;padding-bottom:.75rem;">{document title}</h1>
  {rendered content}
</div>
```

Markdown rendering rules:
- `# h1` → `<h1>`, `## h2` → `<h2 style="font-size:1.25rem;margin:1.5rem 0 .5rem">`, `### h3` → `<h3 style="font-size:1.05rem;margin:1.25rem 0 .4rem">`
- `- item` / `* item` → `<ul><li>`
- `1. item` → `<ol><li>`
- ` ```lang ... ``` ` → `<pre><code>`
- `| col |` tables → `<table>`
- `**bold**` → `<strong>`, `*italic*` → `<em>`
- `[text](url)` → `<a href="url">`
- Paragraphs separated by blank lines → `<p>`
````

- [ ] **Step 3: Verify the file references all 6 doc types**

```bash
grep -c "^## Layout:" /Users/dee/agent-skills/skills/html-artifact/references/html-layouts.md
```

Expected: `5` (task-doc, roadmap, qa-handoff, frontend-handoff, repo-doc; generic uses a different heading).

```bash
grep "generic\|task-doc\|roadmap\|qa-handoff\|frontend-handoff\|repo-doc" /Users/dee/agent-skills/skills/html-artifact/references/html-layouts.md | wc -l
```

Expected: 6 or more matches.

- [ ] **Step 4: Commit**

```bash
git -C /Users/dee/agent-skills add skills/html-artifact/references/html-layouts.md
git -C /Users/dee/agent-skills commit -m "feat: add html-artifact layout specifications"
```

---

### Task 3: Register `html-artifact` in `bin/link-skills.sh`

**Files:**
- Modify: `bin/link-skills.sh`

- [ ] **Step 1: Add `html-artifact` to `SKILL_NAMES`**

In `bin/link-skills.sh`, find the `SKILL_NAMES` variable. Add `html-artifact` as a new line after `task-doc`:

```
task-doc
html-artifact
```

The full `SKILL_NAMES` block becomes:

```sh
SKILL_NAMES="
prepare-frontend-handoff
prepare-qa-handoff
qa-triage-and-fix
publish-branch
repo-docs-audit
rewrite-docs-from-code
repair-agent-files
review-doc-changes
review-task-docs
repo-skill-scan
roadmap-todo
scaffold-repo-skill
task-doc
html-artifact
"
```

- [ ] **Step 2: Verify the entry is present**

```bash
grep "html-artifact" /Users/dee/agent-skills/bin/link-skills.sh
```

Expected: `html-artifact`

- [ ] **Step 3: Commit**

```bash
git -C /Users/dee/agent-skills add bin/link-skills.sh
git -C /Users/dee/agent-skills commit -m "feat: register html-artifact in link-skills.sh"
```

---

### Task 4: Update `README.md`

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add `html-artifact/` to the directory tree**

In the directory tree block, add `├── html-artifact/` after `├── scaffold-repo-skill/`:

```
    ├── scaffold-repo-skill/
    ├── html-artifact/
    └── task-doc/
```

- [ ] **Step 2: Add a row to the Skills table**

Add this row to the skills table after the `task-doc` row:

```markdown
| `html-artifact`            | Convert any Markdown file into a self-contained, browser-ready HTML companion stored in `~/agent-artifacts/`. Supports task docs, roadmaps, QA handoffs, frontend handoffs, repo docs, and generic files |
```

- [ ] **Step 3: Add a usage scenario**

Add this new section under `### Reviewing and tracking feature work`:

```markdown
### Generating HTML artifact companions

1. `html-artifact` — convert any `.md` file into a self-contained browser-ready HTML file stored in `~/agent-artifacts/`. Works standalone or as an opt-in step after `task-doc`, `roadmap-todo`, `prepare-qa-handoff`, or `prepare-frontend-handoff`.
```

- [ ] **Step 4: Verify the README mentions html-artifact in all three places**

```bash
grep -c "html-artifact" /Users/dee/agent-skills/README.md
```

Expected: 3 or more.

- [ ] **Step 5: Commit**

```bash
git -C /Users/dee/agent-skills add README.md
git -C /Users/dee/agent-skills commit -m "docs: add html-artifact to README"
```

---

### Task 5: Add opt-in step to `skills/task-doc/SKILL.md`

**Files:**
- Modify: `skills/task-doc/SKILL.md`

- [ ] **Step 1: Add the HTML companion section after the Output section**

In `skills/task-doc/SKILL.md`, locate the line:

```
Do not implement. Do not start coding.
```

Add the following block immediately after it (before `## Cautions`):

```markdown

## HTML Companion

After the task document is written (or a refusal is issued), append this as a separate follow-up line — not part of the task document itself:

> "HTML companion available. Run `html-artifact` on this file for a browser-ready version. (yes / skip)"

If the user says yes, invoke `html-artifact` on the output path. This is a post-completion affordance. It does not modify the task document, does not count as commentary, and does not affect the "Produce exactly one of" output contract above.
```

- [ ] **Step 2: Verify the original output contract is intact**

```bash
grep "Produce exactly one of" /Users/dee/agent-skills/skills/task-doc/SKILL.md
```

Expected: one match — the original constraint line is still present.

- [ ] **Step 3: Verify the new section is present**

```bash
grep "HTML Companion" /Users/dee/agent-skills/skills/task-doc/SKILL.md
```

Expected: one match.

- [ ] **Step 4: Commit**

```bash
git -C /Users/dee/agent-skills add skills/task-doc/SKILL.md
git -C /Users/dee/agent-skills commit -m "feat: add html-artifact opt-in to task-doc"
```

---

### Task 6: Add opt-in step to `skills/roadmap-todo/SKILL.md`

**Files:**
- Modify: `skills/roadmap-todo/SKILL.md`

- [ ] **Step 1: Add the HTML companion section after the Output section**

In `skills/roadmap-todo/SKILL.md`, locate the Output section which ends with:

```
- a recommendation that specific items should become task docs
```

Add the following block immediately after (before `## Cautions`):

```markdown

## HTML Companion

After writing the roadmap file, append this as a follow-up line:

> "HTML companion available. Run `html-artifact` on this file for a browser-ready kanban board. (yes / skip)"

If the user says yes, invoke `html-artifact` on the output path.
```

- [ ] **Step 2: Verify**

```bash
grep "HTML Companion" /Users/dee/agent-skills/skills/roadmap-todo/SKILL.md
```

Expected: one match.

- [ ] **Step 3: Commit**

```bash
git -C /Users/dee/agent-skills add skills/roadmap-todo/SKILL.md
git -C /Users/dee/agent-skills commit -m "feat: add html-artifact opt-in to roadmap-todo"
```

---

### Task 7: Add opt-in step to `skills/prepare-qa-handoff/SKILL.md`

**Files:**
- Modify: `skills/prepare-qa-handoff/SKILL.md`

- [ ] **Step 1: Add the HTML companion as a fifth report field**

In `skills/prepare-qa-handoff/SKILL.md`, locate the Output section:

```
When done, report:

- Handoff file path or pasted Markdown.
- Key behavioral clarifications made.
- Validation run.
- Validation not run and why.
```

Add a fifth bullet:

```markdown
- HTML companion available — run `html-artifact` on the handoff file for a browser-ready version with state timeline and endpoint tables. (yes / skip)
```

- [ ] **Step 2: Verify all five report fields are present**

```bash
grep -A 10 "When done, report" /Users/dee/agent-skills/skills/prepare-qa-handoff/SKILL.md
```

Expected: 5 bullet points, last one mentioning `html-artifact`.

- [ ] **Step 3: Commit**

```bash
git -C /Users/dee/agent-skills add skills/prepare-qa-handoff/SKILL.md
git -C /Users/dee/agent-skills commit -m "feat: add html-artifact opt-in to prepare-qa-handoff"
```

---

### Task 8: Add opt-in step to `skills/prepare-frontend-handoff/SKILL.md`

**Files:**
- Modify: `skills/prepare-frontend-handoff/SKILL.md`

- [ ] **Step 1: Add the HTML companion as a final report field**

In `skills/prepare-frontend-handoff/SKILL.md`, locate the Output section:

```
When done, report:

- Handoff file path or pasted Markdown.
- Backend/API and frontend surfaces checked.
- Key model or contract shifts.
- Validation run.
- Validation not run and why.
```

Add a sixth bullet:

```markdown
- HTML companion available — run `html-artifact` on the handoff file for a tabbed browser-ready version with API surface, checklist, and retired dependencies. (yes / skip)
```

- [ ] **Step 2: Verify**

```bash
grep -A 12 "When done, report" /Users/dee/agent-skills/skills/prepare-frontend-handoff/SKILL.md
```

Expected: 6 bullet points, last one mentioning `html-artifact`.

- [ ] **Step 3: Commit**

```bash
git -C /Users/dee/agent-skills add skills/prepare-frontend-handoff/SKILL.md
git -C /Users/dee/agent-skills commit -m "feat: add html-artifact opt-in to prepare-frontend-handoff"
```

---

### Task 9: Run link script and verify discoverability

**Files:**
- No file changes — verification only.

- [ ] **Step 1: Run the link script**

```bash
/Users/dee/agent-skills/bin/link-skills.sh
```

Expected output includes:
```
  link  html-artifact
```
or
```
  ok    html-artifact
```

- [ ] **Step 2: Verify symlink exists in `~/.claude/skills/`**

```bash
ls -la ~/.claude/skills/html-artifact
```

Expected: a symlink pointing to `/Users/dee/agent-skills/skills/html-artifact`.

- [ ] **Step 3: Verify SKILL.md is accessible through the symlink**

```bash
head -3 ~/.claude/skills/html-artifact/SKILL.md
```

Expected:
```
---
name: html-artifact
description: Convert any Markdown file into a self-contained HTML companion artifact ...
```

- [ ] **Step 4: Verify all four other target directories**

```bash
ls ~/.codex/skills/html-artifact ~/.cursor/skills/html-artifact ~/.agents/skills/html-artifact 2>&1
```

Expected: each path exists (symlink or directory). Any "No such file or directory" means the link script skipped that target — check if the parent directory exists.

- [ ] **Step 5: Final commit for the plan file itself**

```bash
git -C /Users/dee/agent-skills add docs/superpowers/plans/2026-05-16-html-artifact.md
git -C /Users/dee/agent-skills commit -m "docs: add html-artifact implementation plan"
```
