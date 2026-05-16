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
