# markdown-artifact Document Types

Use this reference when generating Markdown source artifacts.

## Audience Handling

Audience is a variable, not a doc type. Shape tone, depth, vocabulary, examples, and level of detail around the intended reader.

Common audiences:

- technical team
- non-technical stakeholders
- client or buyer
- learner or student
- operator or support team
- executive reviewer
- solo founder or product owner
- distributed team

If audience is unclear and materially changes the artifact, ask one focused question. Otherwise infer a reasonable audience from the request and label it under `Assumptions`.

## Common Sections

Every document should include:

- `# <Title>`
- `## Purpose`
- `## Audience`
- `## Source Context`
- `## Assumptions`
- doc-type-specific sections
- `## Open Questions`
- `## Next Recommended Artifact Or Action`

These common sections are additive. Per-type required sections do not replace them; place the doc-type sections between the common opening context and common closing questions/actions.

Use `None` only when a section truly has no content. Prefer concise, explicit assumptions over invented certainty.

## Doc Type Map

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
| `approach-comparison` | `approach-comparison.md` | Multiple code, design, or architecture approaches need side-by-side comparison |
| `annotated-review` | `annotated-review.md` | A PR, diff, or code review needs severity-tagged annotations |
| `design-system-reference` | `design-system-reference.md` | Design tokens, component usage, or brand rules need a copyable browser reference |
| `interactive-prototype` | `interactive-prototype.md` | A clickable flow, animation sandbox, or state walkthrough needs source content |
| `diagram-explainer` | `diagram-explainer.md` | SVG figures, ring diagrams, flowcharts, or visual explainers need structured source |
| `slide-deck-outline` | `slide-deck-outline.md` | A presentation deck needs slide-by-slide narrative source |
| `report-brief` | `report-brief.md` | Status, metrics, incident, or research reports need chart-ready source content |
| `editing-interface-spec` | `editing-interface-spec.md` | A prompt tuner, feature-flag editor, draggable board, or source/preview tool needs source requirements |
| `learning-guide` | `learning-guide.md` | A topic needs structured explanation, examples, exercises, or study flow |
| `tutorial` | `tutorial.md` | A user needs step-by-step instruction to complete a concrete outcome |
| `task-plan` | `task-plan.md` | A person or computer-use agent needs operational steps, checkpoints, and fallbacks |
| `generic` | `document.md` | Fallback for polished Markdown not covered above |

## Templates

### idea-brief

Use for product, business, or concept ideas.

Required sections:

- `## Problem`
- `## Audience`
- `## Proposed Solution`
- `## Why Now`
- `## Success Signals`
- `## Risks And Unknowns`
- `## Open Questions`
- `## Next Recommended Artifact Or Action`

### feature-proposal

Use for feature concepts that are not yet execution-ready task docs.

Required sections:

- `## Objective`
- `## Users And Workflows`
- `## Included Scope`
- `## Excluded Scope`
- `## UX Or API Behavior`
- `## Risks And Tradeoffs`
- `## Validation Approach`
- `## Task-Doc Readiness`
- `## Open Questions`
- `## Next Recommended Artifact Or Action`

If this becomes implementation-ready, recommend `task-doc`.

### ui-component-design

Use for component variants, state models, and design choices.

Required sections:

- `## Component Purpose`
- `## Audience`
- `## Variants`
- `## Anatomy`
- `## States`
- `## Props Or Configuration`
- `## Accessibility`
- `## Responsive Behavior`
- `## Design Options`
- `## Recommendation`
- `## Implementation Notes`
- `## Open Questions`
- `## Next Recommended Artifact Or Action`

Implementation notes should orient future work without becoming a task plan.

### ui-flow-design

Use for screen flows, route state, and UX edge cases.

Required sections:

- `## Flow Objective`
- `## Actors`
- `## Screens Or Steps`
- `## Route And State Model`
- `## Empty Loading Error And Permission States`
- `## Copy And Content Notes`
- `## Design Options`
- `## Recommendation`
- `## Open Questions`
- `## Next Recommended Artifact Or Action`

### backend-design

Use for APIs, services, queues, storage, or integrations.

Required sections:

- `## Objective`
- `## API Surface Or Service Boundary`
- `## Data Ownership`
- `## State Transitions`
- `## Validation And Error Behavior`
- `## Background Jobs Or Integrations`
- `## Observability`
- `## Risks And Failure Modes`
- `## Migration Or Rollout Notes`
- `## Open Questions`
- `## Next Recommended Artifact Or Action`

### architecture-options

Use when several technical approaches need comparison.

Required sections:

- `## Decision Context`
- `## Constraints`
- `## Options`
- `## Tradeoff Matrix`
- `## Recommendation`
- `## Consequences`
- `## Open Decisions`
- `## Next Recommended Artifact Or Action`

### data-model-design

Use for entities, relationships, lifecycle, and persistence constraints.

Required sections:

- `## Entities`
- `## Relationships`
- `## Lifecycle`
- `## Constraints And Indexes`
- `## Retention Or Audit Needs`
- `## Migration Concerns`
- `## Query And Reporting Implications`
- `## Open Questions`
- `## Next Recommended Artifact Or Action`

### rollout-plan

Use for delivery sequencing and risk controls.

Required sections:

- `## Rollout Objective`
- `## Phases`
- `## Prerequisites`
- `## Validation Gates`
- `## Monitoring`
- `## Rollback`
- `## Communication Notes`
- `## Owners Or Decision Points`
- `## Open Questions`
- `## Next Recommended Artifact Or Action`

### approach-comparison

Use for side-by-side code approaches, implementation alternatives, architecture options, or design directions.

Required sections:

- `## Comparison Goal`
- `## Evaluation Criteria`
- `## Approach A`
- `## Approach B`
- `## Approach C`
- `## Tradeoff Matrix`
- `## Recommendation`
- `## HTML Artifact Notes`
- `## Open Questions`
- `## Next Recommended Artifact Or Action`

HTML artifact notes should name `approach-comparison` when a browser companion is useful.

### annotated-review

Use for PR review writeups, annotated diffs, severity-tagged review findings, or code understanding notes.

Required sections:

- `## Review Context`
- `## Files Or Diff Scope`
- `## Summary Verdict`
- `## Annotated Findings`
- `## Severity Legend`
- `## Suggested Reviewer Path`
- `## Follow-Up Checks`
- `## HTML Artifact Notes`
- `## Open Questions`
- `## Next Recommended Artifact Or Action`

Include diff snippets only when the user provides them or repo context is inspected. Do not invent changed lines.

### design-system-reference

Use for design tokens, component usage, brand rules, copyable values, and living style references.

Required sections:

- `## Reference Goal`
- `## Token Sources`
- `## Color Tokens`
- `## Typography Tokens`
- `## Spacing Radius And Shadows`
- `## Component Usage Notes`
- `## Copyable Values`
- `## HTML Artifact Notes`
- `## Open Questions`
- `## Next Recommended Artifact Or Action`

Mark token values as assumptions unless they come from source files, user-provided values, or verified repo design context.

### interactive-prototype

Use for clickable flows, animation sandboxes, multi-screen prototypes, or interaction state walkthroughs.

Required sections:

- `## Prototype Goal`
- `## Users And Scenario`
- `## Screens States Or Steps`
- `## Interaction Rules`
- `## Controls And Tunable Values`
- `## Content And Copy`
- `## Edge States`
- `## HTML Artifact Notes`
- `## Open Questions`
- `## Next Recommended Artifact Or Action`

HTML artifact notes should choose `clickable-flow` for screen/state walkthroughs or `animation-sandbox` for tunable motion.

### diagram-explainer

Use for SVG figure sheets, ring diagrams, flowcharts, visual explainers, or annotated system diagrams.

Required sections:

- `## Explanation Goal`
- `## Figure Inventory`
- `## Entities Or Parts`
- `## Relationships Or Flow`
- `## Labels And Annotations`
- `## Controls Or Variants`
- `## Source Data Or Assumptions`
- `## HTML Artifact Notes`
- `## Open Questions`
- `## Next Recommended Artifact Or Action`

HTML artifact notes should name `svg-figure-sheet` when the figure should be interactive or tweakable.

### slide-deck-outline

Use for presentation decks, narrative walkthroughs, investor-style summaries, or training decks.

Required sections:

- `## Deck Goal`
- `## Audience`
- `## Narrative Arc`
- `## Slide Outline`
- `## Key Visuals`
- `## Speaker Notes`
- `## Appendix Or Backup Slides`
- `## HTML Artifact Notes`
- `## Open Questions`
- `## Next Recommended Artifact Or Action`

Each slide outline item should include title, purpose, main message, and visual direction.

### report-brief

Use for weekly status, incident reports, research summaries, metrics reports, and chart-ready dashboards.

Required sections:

- `## Report Goal`
- `## Audience`
- `## Headline Summary`
- `## Metrics Or Evidence`
- `## Timeline Or Trend`
- `## Chart Opportunities`
- `## Risks Blockers Or Incidents`
- `## Source Caveats`
- `## HTML Artifact Notes`
- `## Open Questions`
- `## Next Recommended Artifact Or Action`

HTML artifact notes should name `chart-report` when inline SVG charts or report cards would help.

### editing-interface-spec

Use for prompt tuners, feature flag editors, draggable triage boards, grouped toggles, or source/preview workbenches.

Required sections:

- `## Interface Goal`
- `## Primary User`
- `## Editable Inputs`
- `## Preview Or Output`
- `## Validation And Warnings`
- `## Controls And State`
- `## Save Export Or Copy Behavior`
- `## HTML Artifact Notes`
- `## Open Questions`
- `## Next Recommended Artifact Or Action`

HTML artifact notes should choose `split-view-editor` for source/preview tools or `draggable-kanban` for board interfaces.

### learning-guide

Use for structured explanation and study material.

Required sections:

- `## Learning Objectives`
- `## Audience And Assumed Level`
- `## Prerequisites`
- `## Concept Map`
- `## Explanation`
- `## Examples`
- `## Exercises Or Practice Prompts`
- `## Knowledge Checks`
- `## Common Misunderstandings`
- `## Next Learning Steps`

### tutorial

Use for step-by-step instruction toward a concrete outcome.

Required sections:

- `## Outcome`
- `## Audience And Assumed Level`
- `## Prerequisites And Materials`
- `## Steps`
- `## Expected Results`
- `## Screenshots Or Image Opportunities`
- `## Troubleshooting`
- `## Completion Check`
- `## Next Steps`

### task-plan

Use for operational steps for a human, computer-use agent, or both. This is not a Superpowers implementation plan unless the user explicitly asks for one.

Required sections:

- `## Task Objective`
- `## Actor`
- `## Prerequisites And Required Access`
- `## Step-By-Step Sequence`
- `## Checkpoints And Expected Observations`
- `## Decision Points`
- `## Fallback Or Escalation Steps`
- `## Safety Constraints`
- `## Final Output Or Completion Signal`

### generic

Use when no other doc type fits.

Required sections:

- `## Purpose`
- `## Audience`
- `## Source Context`
- `## Main Content`
- `## Assumptions`
- `## Open Questions`
- `## Next Recommended Artifact Or Action`
