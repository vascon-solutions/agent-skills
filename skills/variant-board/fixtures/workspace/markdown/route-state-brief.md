# Board brief — Approval commands by route and state

- Board id: `route-state`
- Product: Northwind Field Ops
- Repo path: `~/Code/northwind/field-ops-ui`
- Surface: `features/approvals/`
- Source of truth: `.agent/tasks/ui-approval-commands.md`
- Read against: `main @ a1b2c3d`
- Purpose: unsettled-choice, state-coverage
- Theme source: `packages/theme/src/styles.css @ a1b2c3d`
- Open questions: none
- Predecessors: none

## Sections

| Section id | Heading | Purpose |
|---|---|---|
| `commands` | Where the approval commands go | unsettled-choice, state-coverage |

## Scenarios

| Section | Scenario | Expected visible result |
|---|---|---|
| `commands` | `#commands?variant=a&route=external&state=authority-review&viewer=approver` | Sections layout; Authority review current; "Record decision" enabled. |
| `commands` | `#commands?variant=a&route=depot&state=depot-approved&viewer=reader` | "Close" shown disabled for the reader. |
| `commands` | `#commands?variant=today&route=depot&state=draft&viewer=planner` | Today: Actions dropdown; route not shown. |
