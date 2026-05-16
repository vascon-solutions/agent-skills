# markdown-artifact Skill - Design Spec

**Date:** 2026-05-16
**Status:** Approved direction - ready for implementation planning
**Source:** Brainstorming session on extending artifact workflows beyond HTML rendering

---

## Purpose

Create a new `markdown-artifact` skill that turns ideas, rough prompts, notes, and optional codebase context into polished Markdown source documents.

The skill is the source-generation companion to `html-artifact`: `markdown-artifact` writes the Markdown source, and `html-artifact` can optionally render that source into a browser-ready HTML companion.

---

## Core Model

Each artifact gets its own repo-like workspace under `~/agent-artifacts/<slug>/`.

Default structure:

```text
~/agent-artifacts/<artifact-slug>/
├── markdown/
│   ├── idea-brief.md
│   ├── feature-proposal.md
│   ├── ui-component-design.md
│   └── backend-design.md
├── html/
│   └── ...
├── assets/
└── metadata.md
```

The workspace is a folder by default, not an initialized Git repository. If the user explicitly asks for a real Git repo, the skill should ask before running `git init` or leave that to a separate workflow.

No required `ideas/` root is used. The artifact slug sits directly under `~/agent-artifacts/` so the same structure works for ideas, product concepts, UI designs, backend designs, feature proposals, architecture docs, and client/project explorations.

---

## When To Use

Use `markdown-artifact` when the user wants to create a durable Markdown artifact from:

- a product or business idea
- a feature proposal
- alternative UI/component designs
- UI flows or screen-state designs
- backend/API design options
- architecture alternatives and tradeoffs
- data model sketches
- rollout or migration plans
- rough notes that need to become a polished source doc

Use it for early-stage and mid-stage thinking where the output is a shareable source document, not immediate implementation.

---

## When Not To Use

Do not use `markdown-artifact` when a more specific skill owns the outcome:

- Use `task-doc` for execution-ready implementation task documents.
- Use `roadmap-todo` for durable backlog or roadmap tracking.
- Use `prepare-qa-handoff` for QA sign-off notes.
- Use `prepare-frontend-handoff` for frontend developer handoffs.
- Use `html-artifact` when the Markdown already exists and the user only wants HTML output.
- Use normal implementation workflows when the user asks to build or change code directly.

If a `markdown-artifact` output becomes execution-ready implementation work, recommend creating a follow-up `task-doc` instead of bloating the artifact.

---

## Inputs

Accept any of:

- freeform idea or prompt text
- pasted notes or meeting notes
- path to a source document to transform into a polished Markdown artifact
- path to a repo or codebase area to inspect for context
- optional doc-type hint
- optional `--workspace <slug-or-path>` to choose the artifact workspace
- optional `--doc-type <type>` to force a document type
- optional `--out <path>` for a one-off Markdown output outside the default workspace

When the requested artifact depends on current third-party package behavior, follow repo instructions and inspect real source with `opensrc` before making package-behavior claims.

---

## Workspace Resolution

Resolution order:

1. `--out <path>` writes exactly that Markdown file and does not require a workspace.
2. `--workspace <path>` uses that directory as the artifact workspace.
3. `--workspace <slug>` uses `~/agent-artifacts/<slug>/`.
4. Existing artifact context, if the user points to an existing `~/agent-artifacts/<slug>/` folder.
5. Derived slug from the artifact title.

Slug rules:

- lowercase
- spaces and punctuation become hyphens
- collapse repeated hyphens
- trim leading and trailing hyphens
- fall back to `artifact-YYYY-MM-DD` if no useful title exists

Default files:

- Markdown output: `~/agent-artifacts/<slug>/markdown/<doc-type>.md`
- Optional HTML output: `~/agent-artifacts/<slug>/html/<doc-type>.html`
- Metadata: `~/agent-artifacts/<slug>/metadata.md`

If the target Markdown file already exists, ask before overwriting. If the user wants a new variant, append a descriptive or numeric suffix such as `ui-component-design-2.md` or `ui-component-design-compact-table.md`.

---

## Document Types

`markdown-artifact` supports these doc types. The first matching explicit hint wins; otherwise infer from the request.

| Doc type | File | Use when |
|---|---|---|
| `idea-brief` | `idea-brief.md` | Product, business, or concept ideas need a crisp brief |
| `feature-proposal` | `feature-proposal.md` | A feature needs scope, users, flows, risks, and tradeoffs |
| `ui-component-design` | `ui-component-design.md` | A component needs variants, states, props, accessibility, and design alternatives |
| `ui-flow-design` | `ui-flow-design.md` | A user flow needs screens, navigation, states, and UX edge cases |
| `backend-design` | `backend-design.md` | APIs, services, queues, storage, failure modes, or integrations need a design |
| `architecture-options` | `architecture-options.md` | Multiple technical approaches need comparison and recommendation |
| `data-model-design` | `data-model-design.md` | Entities, relationships, lifecycle, migrations, or retention need a design |
| `rollout-plan` | `rollout-plan.md` | Delivery sequencing, validation, rollout, rollback, or risk controls need a plan |
| `generic` | `document.md` | Fallback for polished Markdown not covered above |

The skill may create multiple documents in the same workspace when the user asks for a bundle, such as an idea brief plus UI and backend designs.

---

## Template Requirements

Every generated document should include:

- title
- purpose
- source context
- assumptions
- main content sections appropriate to the doc type
- open questions
- next recommended artifact or action

Do not invent certainty. Mark assumptions and recommendations explicitly.

### `idea-brief`

Include:

- problem
- audience
- proposed solution
- why now
- success signals
- risks and unknowns
- next artifacts to create

### `feature-proposal`

Include:

- objective
- users and workflows
- included scope
- excluded scope
- UX or API behavior
- risks and tradeoffs
- validation approach
- task-doc readiness note

### `ui-component-design`

Include:

- component purpose
- variants
- anatomy
- states
- props or configuration model
- accessibility requirements
- responsive behavior
- design options with recommendation
- implementation notes that do not become a task plan

### `ui-flow-design`

Include:

- flow objective
- actors
- screens or steps
- route/state model
- empty, loading, error, and permission states
- copy/content notes
- design options with recommendation

### `backend-design`

Include:

- objective
- API surface or service boundary
- data ownership
- state transitions
- validation and error behavior
- background jobs or integrations
- observability
- risks and failure modes
- migration or rollout notes

### `architecture-options`

Include:

- decision context
- constraints
- options
- tradeoff matrix
- recommendation
- consequences
- open decisions

### `data-model-design`

Include:

- entities
- relationships
- lifecycle
- constraints and indexes
- retention or audit needs
- migration concerns
- query/reporting implications

### `rollout-plan`

Include:

- rollout objective
- phases
- prerequisites
- validation gates
- monitoring
- rollback
- communication notes
- owners or decision points if known

---

## Relationship To `html-artifact`

After writing Markdown, append an opt-in line:

> "HTML companion available. Run `html-artifact` on this Markdown file for a browser-ready version. (yes / skip)"

If the user says yes, invoke `html-artifact` on the generated Markdown file and direct its output into the same workspace's `html/` folder.

The Markdown remains the source of truth. HTML is derived output.

---

## Workflow

1. Receive the prompt, notes, path, or codebase context.
2. Determine whether a specialized skill should handle the request instead.
3. Determine doc type or ask one focused question if classification changes the output materially.
4. Resolve the artifact workspace or explicit output path.
5. Gather only the context needed for the artifact.
6. Generate Markdown using the doc-type template.
7. Write the Markdown file and `metadata.md` if using a workspace.
8. Validate the file exists, has no placeholder sections, and labels assumptions clearly.
9. Report the Markdown path and offer the optional `html-artifact` companion.

---

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
| idea-brief | `markdown/idea-brief.md` | `html/idea-brief.html` |
```

Only list files that exist. Update the table when new Markdown or HTML artifacts are created.

---

## Output

Report one concise line:

```text
Written: ~/agent-artifacts/<slug>/markdown/<doc-type>.md (<doc-type>)
```

If metadata was updated, include:

```text
Metadata: ~/agent-artifacts/<slug>/metadata.md
```

Then include the optional HTML companion invitation.

---

## Constraints

- Do not implement code.
- Do not turn every generated artifact into a task doc.
- Do not overwrite existing artifacts without confirmation.
- Do not force everything under an `ideas/` root.
- Do not initialize a Git repo unless the user explicitly requests it and confirms.
- Keep the Markdown source authoritative; HTML is optional derived output.
- Prefer explicit assumptions over invented detail.

---

## Success Criteria

- A user can create a polished Markdown artifact from rough input.
- Each artifact has its own stable workspace under `~/agent-artifacts/<slug>/`.
- Multiple document types can coexist in the same workspace.
- `--out` and `--workspace` behave predictably.
- Existing specialized skills are not bypassed for their owned outputs.
- Generated Markdown can be rendered by `html-artifact` into the same workspace's `html/` folder.
