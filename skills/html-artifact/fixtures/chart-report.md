# Weekly Status — Platform Team

## Report Goal

Give the leadership channel a one-page status with three headline metrics, a short narrative, and any risk items.

## Audience

Engineering leadership. Skim-first; deep-dive optional.

## Headline Summary

Throughput recovered after Wednesday's incident; error budget intact.

## Metrics Or Evidence

- Request volume: 4.8M (-3% vs last week)
- p99 latency: 220 ms (-12 ms)
- Error rate: 0.21% (well under SLO)

## Timeline Or Trend

- Mon: normal
- Tue: normal
- Wed: 90-minute incident in the queue worker, recovered same day
- Thu–Fri: normal, latency improvement landed

## Chart Opportunities

- Trend line for p99 latency across the week
- Bar chart of error rate by service

## Risks Blockers Or Incidents

One incident this week; postmortem due Monday.

## Source Caveats

Numbers from internal dashboards as of Friday 5pm. Reconcile against Monday's report if used in OKR review.

## HTML Artifact Notes

Render as `chart-report`. Inline SVG for the trend, summary block, source-caveat footer.

## Open Questions

- Should the incident block be promoted above metrics next time?

## Next Recommended Artifact Or Action

Incident postmortem (qa-handoff or task-doc, depending on actions identified).
