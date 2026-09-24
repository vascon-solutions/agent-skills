# Board brief — <board title>

Keep this file at `~/agent-artifacts/<topic>/markdown/<board>-brief.md`. The verifier reads the bullet list and the two tables; keep their labels.

- Board id: `<board>` (the working file is `html/<board>.html`; never changes once cited)
- Product: <product name>
- Repo path: `~/Code/<org>/<repo>`
- Surface: `features/<area>/`
- Source of truth: `.agent/tasks/<task>.md` (or the spec, PRD, or notes the board draws from)
- Read against: `<branch> @ <short-sha>`
- Purpose: proposed-change (one or more of: proposed-change, unsettled-choice, state-coverage, defect-report)
- Theme source: `packages/ui/src/styles.css @ <short-sha>` (or "none found")
- Open questions: <none, or one per line>
- Predecessors: <none, or `commercial.html v6`, `round-2.html v5`>

## Sections

Ids are assigned here and never change. Headings may be reworded on the board.

| Section id | Heading | Purpose |
|---|---|---|
| `memo` | TB Memo on Board session creation | proposed-change |
| `sheet` | Vendor attendance sheet at Bid Opening | proposed-change |

## Scenarios

One row per representative scenario a reader or a task doc will cite. The hash must assign every dimension of that section exactly once and satisfy the section's dependencies; the verifier resolves each row against the board.

| Section | Scenario | Expected visible result |
|---|---|---|
| `memo` | `#memo?surface=composer&state=empty&view=both` | Before: single file input. After: memo accordion with drop zone, nothing staged. |
| `memo` | `#memo?surface=record&state=legacy&view=after` | After: session record without a memo row; no Before pane. |

## Theme evidence

- Tokens: `markdown/<board>-tokens.md`
- Component proportions read from: `packages/ui/src/components/ui/button.tsx` (h-9, px-2.5, rounded-md), `input.tsx` (h-9), `badge.tsx` (h-5, rounded-4xl)

## Notes

Anything the author needs that is not a section or a scenario: viewers to cover, states the source names, copy that must be exact.
