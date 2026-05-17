# Prompt Tuner

## Interface Goal

Let prompt authors edit a system prompt template with `{{variable}}` placeholders and see the resolved text in real time, then copy the rendered prompt.

## Primary User

Prompt authors iterating on a review-bot system prompt.

## Editable Inputs

- Template text (multi-line)
- Variable values: `role`, `project`, `audience`, `limit`

## Preview Or Output

Right pane shows the template with variables substituted. Unresolved variables are left as `{{name}}` and listed in a warning line.

## Validation And Warnings

- Empty variable value counts as unresolved.
- Surface unresolved variable names in a single warning line under the preview.

## Controls And State

- `<textarea>` for the template, `<input>` per variable.
- `updatePreview()` runs on every input event.
- Copy button copies the rendered preview.

## Save Export Or Copy Behavior

Clipboard-only. No persistence in v1.

## HTML Artifact Notes

Render as `split-view-editor`. Two-pane layout, source on left, preview on right marked `data-preview`.

## Open Questions

- Do we want preset variable bundles for common reviewer personas?

## Next Recommended Artifact Or Action

Once the variable set stabilizes, promote to a stored preset library.
