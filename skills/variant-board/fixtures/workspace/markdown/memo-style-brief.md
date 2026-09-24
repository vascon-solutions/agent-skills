# Board brief — Dispatch notes and job ownership

- Board id: `memo-style`
- Product: Northwind Field Ops
- Repo path: `~/Code/northwind/field-ops-ui`
- Surface: `features/jobs/`
- Source of truth: `.agent/tasks/ui-dispatch-notes.md`
- Read against: `main @ a1b2c3d`
- Purpose: proposed-change
- Theme source: `packages/theme/src/styles.css @ a1b2c3d`
- Open questions: none
- Predecessors: none

## Sections

| Section id | Heading | Purpose |
|---|---|---|
| `notes` | Dispatch note on job creation | proposed-change |
| `owner` | Job detail reads the owning unit | proposed-change |

## Scenarios

| Section | Scenario | Expected visible result |
|---|---|---|
| `notes` | `#notes?surface=composer&state=empty&view=both` | Before: bare file input. After: dispatch-note accordion, nothing staged. |
| `notes` | `#notes?surface=composer&state=failed&view=after` | After only: accordion with the rejected-upload alert. |
| `notes` | `#notes?surface=record&state=legacy&view=both` | Record without a note on both sides; After says "No dispatch note". |
| `owner` | `#owner?state=region&view=after` | After: header reads "Owned by North region". |

## Theme evidence

- Tokens: `markdown/memo-style-tokens.md`
- Proportions read from `packages/theme/src/components/button.tsx` (h-9, px-2.5, rounded-md)
