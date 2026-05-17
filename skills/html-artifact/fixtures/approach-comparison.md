# Cache Invalidation Strategy

## Comparison Goal

Pick a cache invalidation strategy for the API gateway before we scale to a second region.

## Evaluation Criteria

- p99 latency impact
- operational complexity
- blast radius on miscalculation

## Approach A

TTL-based expiry. Single config value, predictable.

## Approach B

Event-driven invalidation. Listens to write events on a bus and purges affected keys.

## Approach C

Hybrid: short TTL plus selective bust on known-hot paths.

## Tradeoff Matrix

| Criterion | A | B | C |
|---|---|---|---|
| Latency | 1 ms | 1 ms | 1 ms |
| Complexity | low | high | medium |
| Freshness | medium | high | high |
| Blast radius | low | high | medium |

## Recommendation

Approach C for v1. Revisit B when the bus is already in production for other reasons.

## HTML Artifact Notes

Render as `approach-comparison`. Three columns, tradeoff matrix, recommendation footer.

## Open Questions

- Acceptable staleness window for the catalog API?

## Next Recommended Artifact Or Action

Task doc for the chosen approach.
