# Faster Shipping

## Deck Goal

Persuade engineering leads that the next ship-speed win is bounding PR size, not more build/test optimization.

## Audience

Engineering leads. Familiar with the build/test metrics from Q1.

## Narrative Arc

1. Set up the problem: time-to-ship is flat despite build/test wins.
2. Show the bottleneck has moved to review wait.
3. Diagnose why: PRs are too large.
4. Propose the change.

## Slide Outline

### Slide 1 — Title

Title: "Ship Faster." Subtitle: "Four levers we've already pulled — and the one that still matters."

### Slide 2 — The bottleneck moved

Three numbers: build 12→3 min, test 18→6 min, review wait 2.5d→2.5d.

### Slide 3 — Why review wait won't fall

Median PR is 380 lines. Below 100 lines, median review wait is 4 hours.

### Slide 4 — The change

Cap PR size at 200 lines, warn at 100, pair anything larger, re-measure in 6 weeks.

## Key Visuals

- Slide 2 — three large stat blocks
- Slide 3 — scatter or simple two-bar comparison
- Slide 4 — bulleted next steps

## Speaker Notes

- Slide 2: pause to let the flat review-wait number land.
- Slide 4: be explicit that the 200-line cap is soft; the warn at 100 is the real intervention.

## Appendix Or Backup Slides

- PR-size histogram for last quarter
- Failed-merge breakdown by PR size

## HTML Artifact Notes

Render as `slide-deck`. Arrow-key and space navigation, slide counter, progress dots.

## Open Questions

- Do we need separate caps for different repos?

## Next Recommended Artifact Or Action

Rollout-plan doc for the 200-line cap if leads agree.
