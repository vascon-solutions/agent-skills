# Examples

## Prompt Examples

Use prompts like these to trigger the skill cleanly:

- `Turn this PRD into a task doc.`
- `Create a durable task doc for this feature brief.`
- `Generate a task file for this roadmap item.`
- `Should this feature be one task or multiple sub tasks? Create the right task doc structure.`
- `Write this task doc to .agent/tasks/042-sample-feature.md.`
- `Output the task doc only. Do not write a file.`
- `Review whether this change deserves a task doc or should stay in normal plan mode.`

## Example 1: Good Fit

User request:

`Turn this feature brief into a task doc we can hand to another agent next week.`

Why it fits:

- the work is durable and handoff-oriented
- the source material exists
- the task doc adds value beyond a one-session plan

## Example 2: Roadmap-Derived

User request:

`Create the execution task file for roadmap item 12 without changing the roadmap.`

Why it fits:

- the source is authoritative and bounded
- the task doc is a stable execution artifact
- `transform-only` is the right generation style

Output behavior:

- if the user provides a path, write the task file there
- if the repo has an established task-doc location, follow that convention
- otherwise provide the task doc content directly

## Example 3: Output Only

User request:

`Turn this issue into a task doc, but output the markdown only. Do not create any files.`

Why it fits:

- the user wants a durable task artifact
- the output mode is explicit
- the skill should return the task doc content only

Output behavior:

- do not write any files
- return the completed task doc content directly

## Example 4: Write File

User request:

`Write this task doc to docs/tasks/auth-session-hardening.md.`

Why it fits:

- the output path is explicit
- the skill should create the task file in the requested location

Output behavior:

- write the file at the requested path
- do not invent another location

## Example 5: Reject and Use Plan Mode

User request:

`Fix the spacing in the dashboard header and align the icon.`

Why it should be rejected:

- the work is too small
- a durable task artifact adds no real value
- normal plan mode is enough
