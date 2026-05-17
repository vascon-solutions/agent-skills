# Incident Response Triage

## Interface Goal

Triage open incident-response items into Planned / In Progress / Done / Blocked in a single shareable board, then export back to Markdown for the team channel.

## Primary User

Incident commander running Tuesday triage.

## Editable Inputs

- card position across columns (drag and drop)
- card severity badge (HIGH / MED / LOW) — display only in v1

## Preview Or Output

Live board state, plus a "Copy as Markdown" button that emits a four-section list grouped by column.

## Validation And Warnings

- Cards dragged into Done while still marked HIGH severity should be acknowledged before export.

## Controls And State

- HTML5 drag-and-drop with `dragstart`, `dragover`, and `drop`.
- Column counts update after every move.

## Save Export Or Copy Behavior

`copyBoard()` walks the columns top-to-bottom, emits `## Column` headers and `- card text` lines, and writes to clipboard.

## HTML Artifact Notes

Render as `draggable-kanban`. Four columns marked `data-col`, cards with `draggable="true"`, column counts in the header.

## Open Questions

- Should the board persist across page reloads?

## Next Recommended Artifact Or Action

Roadmap entry for the new HIGH-severity items.
