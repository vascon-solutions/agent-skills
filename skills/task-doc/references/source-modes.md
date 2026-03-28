# Source Modes

## `roadmap`

Use when the task already exists as a bounded roadmap entry.

Default behavior:

- preserve source intent
- prefer `transform-only`
- do not silently expand scope

## `issue`

Use when the task comes from a tracker item, bug ticket, or feature request.

Default behavior:

- preserve acceptance criteria if present
- infer exclusions when adjacent work is likely to leak in
- use `synthesized` only when the issue is underspecified

## `prd`

Use when the source is a feature spec or product requirement document.

Default behavior:

- reduce broad product language into one bounded execution task
- do not restate the entire PRD
- split follow-up work into `Follow-ups` rather than inflating the task

## `brief`

Use when the source is a user request, meeting notes, or other freeform direction.

Default behavior:

- convert loose intent into a bounded task
- label assumptions clearly
- use strong exclusions to stop drift

## `codebase-derived`

Use when the task is inferred from repo state rather than supplied as a formal source.

Examples:

- repeated TODO clusters
- obvious missing integration step
- repeated manual workflow
- migration or cleanup discovered during implementation

Default behavior:

- explain the source context clearly
- avoid overstating certainty
- use `synthesized`

## Transform-Only vs Synthesized

Use `transform-only` when:

- the source is already specific
- deliverables are explicit
- the task boundaries are already defined

Use `synthesized` when:

- the source is partial or fragmented
- multiple inputs must be combined
- assumptions are required to make the task executable

When in doubt, choose the narrower task.

