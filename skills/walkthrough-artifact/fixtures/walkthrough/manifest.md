# Field ops job assignment walkthrough: staging screenshots

## Environment

- Label: Staging environment test data
- Allowed origins: https://fieldops.example.test, https://mail.example.test
- Served builds: UI 1a2b3c4 (deployed 1 October 2026 09:00), API 5d6e7f8 (deployed 1 October 2026 08:30); confirmed by the deploy record
- Viewport: 480x300
- Captured: 1 October 2026
- Scope unit: Item
- Accent: #0f766e

## Audit runs

- `../audit-run/`: journey, builds 1a2b3c4 and 5d6e7f8, fresh

## Accounts

- Dispatcher (https://fieldops.example.test): used for item 1. Released; evidence in `../audit-run/report.md` Cleanup.

## Demo records

1. JOB-0007: assigned to the field technician with the note "Walkthrough demo"; final state unassigned again. Evidence in `../audit-run/report.md` Created Records.

## Images

- img/1-01-job-list.png: Dispatcher · Jobs list · two open jobs. from: `screenshots/1-01-job-list.png`
- img/1-02-job-assigned.png: Dispatcher · JOB-0007 · after assigning. from: `screenshots/1-02-job-assigned.png`

## Status

| Item | Title | Tone | Label | Note |
| --- | --- | --- | --- | --- |
| 1 | Job assignment | done | Live on staging | This walkthrough |
| 2 | Parts ordering | info | API only | |

## Not captured

- Reassigning a job that is already in progress: no such job on staging.

## Findings

- None.

## Revisions

- 1 October 2026: first version. Published: not published.
