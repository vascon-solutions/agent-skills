# Request Lifecycle Figures

## Explanation Goal

Show how a single API request flows through gateway → service → datastore, with an annotated retry path.

## Figure Inventory

- Figure 1: happy path
- Figure 2: retry path with backoff

## Entities Or Parts

- client
- gateway
- service
- datastore
- retry queue

## Relationships Or Flow

Client → gateway (HTTP). Gateway → service (gRPC). Service → datastore (SQL). On failure, service enqueues to retry queue, which calls back into service.

## Labels And Annotations

- Label each arrow with the protocol.
- Mark retry edges in a warning color.
- Annotate the retry queue with the max-retry constant.

## Controls Or Variants

A toggle to highlight only the retry path; otherwise both figures are static.

## Source Data Or Assumptions

Numbers and protocols come from `docs/architecture/lifecycle.md`. Retry behavior assumed from current code; mark as assumption if not verified.

## HTML Artifact Notes

Render as `svg-figure-sheet`. Inline `<svg>` for both figures, an input to toggle retry-highlight, `updateFigure()` to apply.

## Open Questions

- Should we show timeouts alongside retries?

## Next Recommended Artifact Or Action

Architecture doc reference once the diagrams are agreed.
