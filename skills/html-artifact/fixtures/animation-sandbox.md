# Loader Animation Sandbox

## Prototype Goal

Let designers feel the difference between three loader timings without spinning up the app.

## Users And Scenario

Designers and product engineers tuning the global loader in a single shared browser file.

## Screens States Or Steps

One screen, three preset buttons, one tunable preview.

## Interaction Rules

- Range input changes duration in milliseconds.
- Easing select changes the CSS easing function.
- Presets snap both controls to known values.

## Controls And Tunable Values

- duration: 100–2000 ms
- easing: linear, ease-in, ease-out, cubic-bezier preset
- distance: 20–200 px

## Content And Copy

Minimal labels. Preview should dominate; controls are secondary.

## Edge States

- duration at minimum should still feel like motion, not a snap
- duration at maximum should not feel broken; cap visually if needed

## HTML Artifact Notes

Render as `animation-sandbox`. Range inputs + preset buttons, target marked `data-preview`, `updateAnimation()` reads inputs.

## Open Questions

- Should we surface `prefers-reduced-motion` behavior?

## Next Recommended Artifact Or Action

Pick the final preset and update the global loader token.
