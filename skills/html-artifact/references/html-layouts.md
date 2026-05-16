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

For items under `## Decisions Required`, assign badge color from content keywords:
- Contains "unresolved" or no resolution marker → `#dc2626` (red), label "Unresolved"
- Contains "blocked" → `#d97706` (amber), label "Blocked"
- Contains "resolved" or a named decision → `#16a34a` (green), label "Resolved"

```html
<div style="display:flex;align-items:flex-start;gap:.75rem;padding:.6rem 0;border-bottom:1px solid #f0f0f0;">
  <span style="flex-shrink:0;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;background:{color};color:#fff;">{label}</span>
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

### Copy Checklist Button

Collect all `- [ ]` checklist items from the document. Assign `data-check` attribute to their rendered `<li>` or `<div>` elements.

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

Two-column layout: sticky sidebar (220px) + scrollable content. Sidebar lists all `##` headings as anchor links.

Generate `id` slugs: lowercase, spaces → hyphens, strip special characters.

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
    <!-- ## headings as <h2 id="{slug}"> -->
    <!-- ### headings wrapped in <details> (closed by default) -->
  </main>
</div>
```

`##` sections are always visible. `###` subsections are wrapped in `<details>` (closed by default).

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
