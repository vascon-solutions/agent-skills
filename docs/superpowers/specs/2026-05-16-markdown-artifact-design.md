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
├── images/
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
- learning guides or tutorials
- operational task plans for a person or computer-use agent
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
- Use the existing `brainstorming` and `writing-plans` workflow for repo implementation specs and execution plans.
- Use normal implementation workflows when the user asks to build or change code directly.

If a `markdown-artifact` output becomes execution-ready implementation work, recommend creating a follow-up `task-doc` instead of bloating the artifact.

---

## Relationship To `docs/superpowers/`

`docs/superpowers/` is the internal agent execution control plane for the current repository. It holds specs and plans created by the existing Superpowers workflow:

```text
brainstorming -> docs/superpowers/specs/<date>-<topic>-design.md
writing-plans -> docs/superpowers/plans/<date>-<topic>.md
```

`markdown-artifact` is different. It creates portable, user-facing artifact workspaces under:

```text
~/agent-artifacts/<artifact-slug>/
```

Use this boundary:

- If the user is designing or planning implementation work for the current repo, defer to `brainstorming` and then `writing-plans`.
- If the user wants an exploratory artifact, product concept, UI/backend design option, proposal, or shareable Markdown source doc, use `markdown-artifact`.
- Do not write to `docs/superpowers/` from `markdown-artifact` unless the user explicitly asks for a Superpowers implementation spec or plan.
- Do not create replacement versions of `brainstorming` or `writing-plans`; reference and defer to the existing skills.

If `brainstorming` or `writing-plans` is not installed in the current agent environment, degrade safely:

- State that the specialized Superpowers skill is unavailable.
- Do not write to `docs/superpowers/` by default.
- For implementation-ready repo work, either ask whether to continue with a plain Markdown artifact under `~/agent-artifacts/<slug>/` or advise installing the missing skill.
- For exploratory work, continue with `markdown-artifact` normally.
- Do not silently imitate the missing skill's full workflow; keep the output clearly labeled as an artifact, not an official Superpowers spec or implementation plan.

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
- optional `--out <path>` for an exact Markdown output path

When the requested artifact depends on current third-party package behavior, follow repo instructions and inspect real source with `opensrc` before making package-behavior claims.

---

## Workspace Resolution

Treat `--workspace` as a path if it is absolute, starts with `~` or `.`, or contains `/`. Otherwise treat it as a slug and resolve it under `~/agent-artifacts/`.

Resolution order:

1. `--out <path>` writes exactly that Markdown file.
2. `--workspace <path>` uses that directory as the artifact workspace.
3. `--workspace <slug>` uses `~/agent-artifacts/<slug>/`.
4. Existing artifact context, if the user points to an existing `~/agent-artifacts/<slug>/` folder.
5. Derived slug from the artifact title.

If both `--out` and `--workspace` are provided, `--out` controls the Markdown file path and `--workspace` controls metadata and companion artifact folders. Do not rewrite `--out` into the workspace. If `--out` is outside the workspace, list the Markdown path in metadata exactly as written.

Slug rules:

- lowercase
- spaces and punctuation become hyphens
- collapse repeated hyphens
- trim leading and trailing hyphens
- fall back to `artifact-YYYY-MM-DD` if no useful title exists
- append a numeric suffix such as `artifact-YYYY-MM-DD-2` when a same-day fallback slug already exists

Default files:

- Markdown output: `~/agent-artifacts/<slug>/markdown/<doc-type>.md`
- Optional HTML output: `~/agent-artifacts/<slug>/html/<doc-type>.html`
- Metadata: `~/agent-artifacts/<slug>/metadata.md`

If the resolved workspace already exists, inspect `metadata.md` and the current files before writing. Reuse it only when the artifact title, source context, or user request clearly matches the existing workspace. If the workspace appears to belong to a different project or has no metadata but contains unrelated files, ask whether to reuse it, choose a new slug, or provide a different workspace.

If the target Markdown file already exists, ask before overwriting. If the user wants a new variant, append a descriptive or numeric suffix such as `ui-component-design-2.md` or `ui-component-design-compact-table.md`.

---

## Document Types

`markdown-artifact` supports these doc types. The first matching explicit hint wins; otherwise infer from the request. Ask one focused question when classification materially changes the output. If the user does not answer or has no preference, use `generic` and label the doc-type assumption.

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
| `learning-guide` | `learning-guide.md` | A topic needs structured explanation, examples, exercises, or study flow |
| `tutorial` | `tutorial.md` | A user needs step-by-step instruction to complete a concrete outcome |
| `task-plan` | `task-plan.md` | A person or computer-use agent needs operational steps, checkpoints, and fallbacks |
| `generic` | `document.md` | Fallback for polished Markdown not covered above |

The skill may create multiple documents in the same workspace when the user asks for a bundle, such as an idea brief plus UI and backend designs.

---

## Template Requirements

Every generated document should include:

- title
- purpose
- audience
- source context
- assumptions
- main content sections appropriate to the doc type
- open questions
- next recommended artifact or action

These universal fields are additive. They do not get replaced by the per-type requirements below. Compose every artifact from the common opening sections, the relevant per-type sections, and the common closing sections.

Do not invent certainty. Mark assumptions and recommendations explicitly.

## Audience Handling

Audience is a variable, not a doc type. Do not hardcode title-specific document types such as a named executive brief. Instead, shape tone, depth, vocabulary, examples, and level of detail around the intended reader.

Common audiences:

- technical team
- non-technical stakeholders
- client or buyer
- learner or student
- operator or support team
- executive reviewer
- solo founder or product owner
- distributed team

If the audience is unclear and it materially changes the artifact, ask one focused question. Otherwise infer a reasonable audience from the request and label it under `Assumptions`.

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

### `learning-guide`

Include:

- learning objectives
- intended audience and assumed level
- prerequisites
- concept map
- explanation sections
- examples
- exercises or practice prompts
- knowledge checks
- common misunderstandings
- next learning steps

### `tutorial`

Include:

- outcome
- intended audience and assumed level
- prerequisites and materials
- step-by-step instructions
- expected result for each major step
- screenshots or image-artifact opportunities when useful
- troubleshooting
- completion check
- next steps

### `task-plan`

Include:

- task objective
- actor: human, computer-use agent, or both
- prerequisites and required access
- step-by-step sequence
- checkpoints and expected observations
- decision points
- fallback or escalation steps
- safety constraints
- final output or completion signal

### `generic`

Include:

- purpose
- audience
- source context
- main content
- assumptions
- open questions
- next recommended artifact or action

---

## Relationship To `html-artifact`

After writing Markdown, append an opt-in line:

> "HTML companion available. Run `html-artifact` on this Markdown file for a browser-ready version. (yes / skip)"

If the user says yes, invoke `html-artifact` on the generated Markdown file and direct its output into the same workspace's `html/` folder.

Use an explicit `--out` argument. Do not rely on `html-artifact`'s default destination, because its standalone default may resolve to a repo/doc-type folder instead of the current artifact workspace.

Example:

```text
html-artifact ~/agent-artifacts/<slug>/markdown/<doc-type>.md --out ~/agent-artifacts/<slug>/html/<doc-type>.html
```

If Markdown was written through `--out`, substitute the resolved Markdown path as the source argument. If a workspace exists, still place HTML under that workspace's `html/` folder. If this is a one-off `--out` artifact with no workspace, choose an explicit sibling HTML path or ask once if the destination is unclear.

The Markdown remains the source of truth. HTML is derived output.

---

## Relationship To Future Image Artifacts

`image-artifact` is a future companion skill, not part of `markdown-artifact`.

Design spec: `docs/superpowers/specs/2026-05-16-image-artifact-design.md`

It should convert an existing Markdown source document into generated image outputs under the same workspace:

```text
~/agent-artifacts/<artifact-slug>/
├── markdown/
│   └── ui-component-design.md
├── html/
├── images/
│   ├── ui-component-design-summary.png
│   ├── variant-a.png
│   ├── variant-b.png
│   └── comparison-board.png
└── metadata.md
```

The image generation provider should be tool-agnostic. Use whatever image-generation capability is available in the agent environment and appropriate for the request. Do not require a specific vendor or model in the skill contract.

Good use cases for a future `image-artifact`:

- one-page visual summaries from concept docs
- UI design variant boards
- architecture or API flow infographics
- concept comparison boards
- pitch-card or poster-style summaries
- visual decision aids for choosing between variants

`markdown-artifact` may optionally mention that an image companion can be generated when the source doc clearly benefits from a visual summary or variant board, but it should not generate images itself.

When `image-artifact` is implemented, update `markdown-artifact` so it can offer:

> "Image companion available. Run `image-artifact` on this Markdown file for visual summaries or variant boards. (yes / skip)"

Only offer this for docs that clearly benefit from a visual summary, diagram, or option board. Do not offer it for every Markdown artifact by default.

---

## Workflow

1. Receive the prompt, notes, path, or codebase context.
2. Determine whether a specialized skill should handle the request instead. If another installed skill owns the output, stop the `markdown-artifact` flow and use or offer that skill unless the user explicitly wants a portable artifact.
3. Determine doc type or ask one focused question if classification changes the output materially.
4. Resolve the artifact workspace or explicit output path.
5. Gather only the context needed for the artifact.
6. Generate Markdown using the doc-type template.
7. Write the Markdown file and `metadata.md` if using a workspace.
8. Validate the file exists, has no unresolved placeholder content, and labels assumptions clearly.
9. Report the Markdown path and offer relevant companion options.

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

| Type | Markdown | HTML | Images |
|---|---|---|---|
| idea-brief | `markdown/idea-brief.md` | | |
```

Only list files that exist. Leave the HTML and Images cells empty until corresponding files exist. Update the table when new Markdown, HTML, or image artifacts are created.

Placeholder validation is concrete: no section may contain only template instructions, `TBD`, `TODO`, `FIXME`, `??`, or empty filler. If the information is unknown, say so as an assumption, an open question, or `None identified`.

---

## Output

Report one concise line using the exact resolved Markdown path:

```text
Written: <resolved-markdown-path> (<doc-type>)
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
- Do not write to `docs/superpowers/` unless the user explicitly asks for a Superpowers spec or plan.
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
