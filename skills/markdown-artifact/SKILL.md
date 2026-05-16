---
name: markdown-artifact
description: Use when rough ideas, notes, prompts, learning topics, UI/backend designs, feature concepts, architecture options, rollout plans, or operational task plans need a polished Markdown artifact workspace.
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
- rough notes that need a polished source document

## When Not To Use

- Use `task-doc` for execution-ready implementation task documents.
- Use `roadmap-todo` for durable backlog or roadmap tracking.
- Use `prepare-qa-handoff` for QA sign-off notes.
- Use `prepare-frontend-handoff` for frontend developer handoffs.
- Use `html-artifact` when Markdown already exists and the user only wants HTML.
- Use existing `brainstorming` and `writing-plans` for repo implementation specs and execution plans.
- Use normal implementation workflows when the user asks to build or change code directly.

If `brainstorming` or `writing-plans` is unavailable, state that clearly. For implementation-ready repo work, ask whether to continue as a plain artifact under `~/agent-artifacts/<slug>/` or advise installing the missing skill. Do not silently imitate the missing skill's full workflow or write to `docs/superpowers/` by default.

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

Resolution order:

1. `--out <path>` writes exactly that Markdown file and does not require a workspace.
2. `--workspace <path>` uses that directory as the artifact workspace.
3. `--workspace <slug>` uses `~/agent-artifacts/<slug>/`.
4. Existing artifact context if the user points to an existing `~/agent-artifacts/<slug>/`.
5. Derived slug from the artifact title.

Slug rules:

- lowercase
- spaces and punctuation become hyphens
- collapse repeated hyphens
- trim leading and trailing hyphens
- fall back to `artifact-YYYY-MM-DD` if no useful title exists

Default paths:

- Markdown: `~/agent-artifacts/<slug>/markdown/<doc-type>.md`
- HTML: `~/agent-artifacts/<slug>/html/<doc-type>.html`
- Metadata: `~/agent-artifacts/<slug>/metadata.md`

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
- `learning-guide`
- `tutorial`
- `task-plan`
- `generic`

Read [references/doc-types.md](references/doc-types.md) for detection guidance, audience handling, and section requirements.

The first explicit doc-type hint wins. Otherwise infer from the request. Ask one focused question only if the doc type materially changes the output.

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

Do not invent certainty. Mark assumptions and recommendations explicitly.

## Relationship To `docs/superpowers/`

`docs/superpowers/` is the internal agent execution control plane for the current repository:

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

Do not rely on `html-artifact`'s default destination when rendering a workspace artifact.

### Images

`image-artifact` is a future companion. Mention it only when the generated Markdown clearly benefits from a visual summary, diagram, or option board:

> "Image companion available. Run `image-artifact` on this Markdown file for visual summaries or variant boards. (yes / skip)"

Do not generate images from this skill.

## Workflow

1. Receive prompt, notes, path, or codebase context.
2. Decide whether a specialized skill should handle the request instead.
3. Determine doc type, asking one focused question only if needed.
4. Resolve workspace or explicit output path.
5. Gather only the context needed for the artifact.
6. Generate Markdown using [references/doc-types.md](references/doc-types.md).
7. Write the Markdown file and `metadata.md` when using a workspace.
8. Validate the file exists, has no placeholder sections, and labels assumptions clearly.
9. Report the Markdown path and offer relevant companion artifact options.

## Metadata

Create or update `metadata.md` in each workspace:

```markdown
# <Artifact Title> Metadata

## Workspace

- Slug: `<slug>`
- Created: `YYYY-MM-DD`
- Last Updated: `YYYY-MM-DD`

## Artifacts

| Type | Markdown | HTML |
|---|---|---|
| idea-brief | `markdown/idea-brief.md` | |
```

Only list files that exist. Leave the HTML cell empty until the HTML file exists. Update the table when new Markdown, HTML, or image artifacts are created.

## Validation

Before reporting complete, verify:

- output file exists at the resolved path
- metadata exists and lists the artifact when using a workspace
- no placeholder markers remain: `TBD`, `TODO`, `FIXME`, `??`
- assumptions are explicit
- `--out` was honored when provided
- specialized-skill boundaries were respected

## Output

Report:

```text
Written: ~/agent-artifacts/<slug>/markdown/<doc-type>.md (<doc-type>)
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
