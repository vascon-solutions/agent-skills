---
name: markdown-artifact
description: Use when rough ideas, notes, prompts, learning topics, UI/backend designs, feature concepts, architecture options, rollout plans, operational task plans, or interactive artifact source docs need a polished Markdown workspace.
---

# markdown-artifact

## Purpose

Turn ideas, rough prompts, notes, and optional codebase context into polished Markdown source documents.

This skill creates source artifacts. It does not implement code. It can optionally hand the generated Markdown to `html-artifact` for a browser-ready companion.

## Core Model

Default workspace:

```text
~/agent-artifacts/<artifact-slug>/
├── markdown/
├── html/
├── images/
├── assets/
└── metadata.md
```

The workspace is a folder, not a Git repo. Do not run `git init` unless the user explicitly asks and confirms.

No required `ideas/` root exists. Put artifact workspaces directly under `~/agent-artifacts/<slug>/`.

## When To Use

Use when the user wants a durable Markdown artifact for:

- product or business ideas
- feature proposals
- UI component or flow designs
- backend/API designs
- architecture options
- data model designs
- rollout or migration plans
- learning guides or tutorials
- operational task plans for a person or computer-use agent
- source docs for browser artifacts such as annotated diffs, design-token sheets, slide decks, prototypes, chart reports, and editing interfaces
- rough notes that need a polished source document

## When Not To Use

- Use `task-doc` for execution-ready implementation task documents.
- Use `roadmap-todo` for durable backlog or roadmap tracking.
- Use `prepare-qa-handoff` for QA sign-off notes.
- Use `prepare-frontend-handoff` for frontend developer handoffs.
- Use `html-artifact` when Markdown already exists and the user only wants HTML.
- Use `task-doc-intake` for repo implementation discovery that should end in a durable task doc; the external `brainstorming` and `writing-plans` skills are optional alternatives when installed and explicitly requested.
- Use normal implementation workflows when the user asks to build or change code directly.

For implementation-ready repo work, route to the task-doc chain rather than continuing as an artifact; ask once if the user's intent is ambiguous. Do not write to `docs/superpowers/` by default.

## Inputs

Accept any of:

- freeform idea or prompt text
- pasted notes or meeting notes
- path to a source document
- path to a repo or codebase area for context
- optional doc-type hint
- optional `--workspace <slug-or-path>`
- optional `--doc-type <type>`
- optional `--out <path>`

When the artifact depends on current third-party package behavior, inspect real source with `opensrc` before making package-behavior claims.

## Workspace Resolution

Treat `--workspace` as a path if it is absolute, starts with `~` or `.`, or contains `/`. Otherwise treat it as a slug under `~/agent-artifacts/`.

Resolution order:

1. `--out <path>` writes exactly that Markdown file.
2. `--workspace <path>` uses that directory as the artifact workspace.
3. `--workspace <slug>` uses `~/agent-artifacts/<slug>/`.
4. Existing artifact context if the user points to an existing `~/agent-artifacts/<slug>/`.
5. Derived slug from the artifact title.

If both `--out` and `--workspace` are provided, `--out` controls the Markdown file path and `--workspace` controls metadata and companion artifact folders. Do not rewrite `--out` into the workspace. If `--out` is outside the workspace, list the Markdown path in metadata exactly as written.

Slug rules:

- lowercase
- spaces and punctuation become hyphens
- collapse repeated hyphens
- trim leading and trailing hyphens
- fall back to `artifact-YYYY-MM-DD` if no useful title exists
- append a numeric suffix when a same-day fallback slug already exists

Default paths:

- Markdown: `~/agent-artifacts/<slug>/markdown/<doc-type>.md`
- HTML: `~/agent-artifacts/<slug>/html/<doc-type>.html`
- Metadata: `~/agent-artifacts/<slug>/metadata.md`

If the resolved workspace exists, inspect `metadata.md` and current files before writing. Reuse it only when the title, source context, or user request clearly matches. If it appears to belong to a different project, or contains unrelated files without metadata, ask whether to reuse it, choose a new slug, or provide another workspace.

If the target Markdown file exists, ask before overwriting. If the user wants a new variant, append a descriptive or numeric suffix.

## Document Types

Supported doc types:

- `idea-brief`
- `feature-proposal`
- `ui-component-design`
- `ui-flow-design`
- `backend-design`
- `architecture-options`
- `data-model-design`
- `rollout-plan`
- `approach-comparison`
- `annotated-review`
- `design-system-reference`
- `interactive-prototype`
- `diagram-explainer`
- `slide-deck-outline`
- `report-brief`
- `editing-interface-spec`
- `learning-guide`
- `tutorial`
- `task-plan`
- `generic`

Read [references/doc-types.md](references/doc-types.md) for detection guidance, audience handling, and section requirements.

The first explicit doc-type hint wins. Otherwise infer from the request. Ask one focused question only if the doc type materially changes the output. If the user does not answer or has no preference, use `generic` and label the doc-type assumption.

## Source Rules

Every generated document must include:

- title
- purpose
- audience
- source context
- assumptions
- doc-type-specific content
- open questions
- next recommended artifact or action

These universal fields are additive. They do not get replaced by doc-type requirements. Compose every artifact from the common opening sections, the relevant doc-type sections, and the common closing sections.

Do not invent certainty. Mark assumptions and recommendations explicitly.

## Clarification Before Writing

Do not run a full discovery interview by default — repo implementation discovery belongs to `task-doc-intake` (or the external `brainstorming` skill if installed and explicitly requested); this skill creates portable artifacts.

Ask at most one focused question, and only when missing information would materially change the artifact: audience (developer vs. stakeholder), doc-type ambiguity, single-option vs. comparison, or whether source code context is required. Otherwise proceed, label assumptions explicitly, and list open questions in the document.

If the input is too vague even with assumptions, ask one question or write a deliberately thin artifact with the gaps called out.

Switch to `task-doc-intake` when the request is actually repo implementation planning; use the external `brainstorming` skill only when it is installed and the user explicitly asks for it.

## Relationship To `docs/superpowers/`

When the external Superpowers pack is installed, `docs/superpowers/` is its execution control plane for the current repository:

```text
brainstorming -> docs/superpowers/specs/<date>-<topic>-design.md
writing-plans -> docs/superpowers/plans/<date>-<topic>.md
```

`markdown-artifact` creates portable, user-facing artifact workspaces under `~/agent-artifacts/<slug>/`.

Do not write to `docs/superpowers/` unless the user explicitly asks for a Superpowers implementation spec or plan.

## Relationship To Companions

### HTML

After writing Markdown, append:

> "HTML companion available. Run `html-artifact` on this Markdown file for a browser-ready version. (yes / skip)"

If the user says yes, invoke `html-artifact` with an explicit `--out` path:

```text
html-artifact ~/agent-artifacts/<slug>/markdown/<doc-type>.md --out ~/agent-artifacts/<slug>/html/<doc-type>.html
```

If Markdown was written through `--out`, substitute the resolved Markdown path as the source argument. If a workspace exists, still place HTML under that workspace's `html/` folder. If this is a one-off `--out` artifact with no workspace, choose an explicit sibling HTML path or ask once if the destination is unclear.

For browser-artifact source docs, include the matching `--artifact-kind` when known:

| Markdown doc type | Suggested `html-artifact --artifact-kind` |
|---|---|
| `approach-comparison` | `approach-comparison` |
| `annotated-review` | `diff-annotation` |
| `design-system-reference` | `design-system-tokens` |
| `interactive-prototype` | `clickable-flow` or `animation-sandbox` |
| `diagram-explainer` | `svg-figure-sheet` |
| `slide-deck-outline` | `slide-deck` |
| `report-brief` | `chart-report` |
| `editing-interface-spec` | `split-view-editor` or `draggable-kanban` |

Do not rely on `html-artifact`'s default destination when rendering a workspace artifact.

### Images

After writing Markdown, offer an image companion only when the document clearly benefits from a visual summary, diagram, option board, or variant board:

> "Image companion available. Run `image-artifact` on this Markdown file for visual summaries or variant boards. (yes / skip)"

If the user says yes, invoke `image-artifact` with an explicit source path and workspace:

```text
image-artifact ~/agent-artifacts/<slug>/markdown/<doc-type>.md --workspace ~/agent-artifacts/<slug>
```

If Markdown was written through `--out`, substitute the resolved Markdown path as the source argument. If a workspace exists, still place images under that workspace's `images/` folder. Do not offer this for every artifact by default.

### Local Workbench

After Markdown, HTML, or image companions exist in a workspace, offer local preview only when the user wants browser review, variant comparison, screenshots, or pre-publish inspection:

> "Local workbench available. Run `artifact-workbench` on this workspace for read-only browser preview. (yes / skip)"

If the user says yes, invoke:

```text
artifact-workbench ~/agent-artifacts/<slug>
```

## Workflow

1. Receive prompt, notes, path, or codebase context.
2. Decide whether a specialized skill should handle the request instead. If another installed skill owns the output, stop this flow and use or offer that skill unless the user explicitly wants a portable artifact.
3. Determine doc type.
4. Run Clarification Before Writing, asking at most one focused question only when needed.
5. Resolve workspace or explicit output path.
6. Gather only the context needed for the artifact.
7. Generate Markdown using [references/doc-types.md](references/doc-types.md).
8. Write the Markdown file and `metadata.md` when using a workspace.
9. Validate the file exists, has no unresolved placeholder content, and labels assumptions clearly.
10. Report the Markdown path and offer relevant companion artifact options.

## Metadata

Create or update `metadata.md` in each workspace:

```markdown
# <Artifact Title> Metadata

## Workspace

- Slug: `<slug>`
- Created: `YYYY-MM-DD`
- Last Updated: `YYYY-MM-DD`

## Artifacts

| Type | Markdown | HTML | Images |
|---|---|---|---|
| idea-brief | `markdown/idea-brief.md` | | |
```

Only list files that exist. Leave the HTML and Images cells empty until corresponding files exist. Update the table when new Markdown, HTML, or image artifacts are created.

## Validation

Before reporting complete, verify:

- output file exists at the resolved path
- metadata exists and lists the artifact when using a workspace
- no placeholder markers remain: `TBD`, `TODO`, `FIXME`, `??`
- no section contains only template instructions, empty filler, or unresolved placeholders
- assumptions are explicit
- `--out` was honored when provided
- specialized-skill boundaries were respected

## Output

Report:

```text
Written: <resolved-markdown-path> (<doc-type>)
Metadata: ~/agent-artifacts/<slug>/metadata.md
```

Then include any relevant companion invitation.

## Cautions

- Do not implement code.
- Do not turn every generated artifact into a task doc.
- Do not overwrite existing artifacts without confirmation.
- Do not force everything under an `ideas/` root.
- Do not initialize a Git repo unless explicitly requested and confirmed.
- Do not write to `docs/superpowers/` unless explicitly requested.
- Keep Markdown authoritative; HTML and images are derived outputs.
