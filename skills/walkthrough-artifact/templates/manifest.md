# <Title> walkthrough: <environment> screenshots

## Environment

- Label: <printed on every page, e.g. "Staging environment test data">
- Allowed origins: <https://app.example.test>, <https://mail.example.test>
- Served builds: <UI commit and deploy time>, <API commit and deploy time>; confirmed by <deploy record, version endpoint or footer>, or "not fingerprinted"
- Viewport: <1440x900>
- Captured: <DD Month YYYY>
- Scope unit: <Row, Slice or Item>
- Accent: <#0f766e>

## Audit runs

- `<~/agent-artifacts/ui-audits/<slug>/<run>/>`: <journey>, builds <UI sha> and <API sha>, <adopted or fresh>
- `<later run>`: top-up capture of <what>, <date>

## Accounts

- <role> (<portal>): used for <items>. Released; evidence in `<run>/report.md` Cleanup.

## Demo records

1. <record id>: <what was created or changed, with the marker text>; final state <state>. Evidence in `<run>/report.md` Created Records.

## Images

- img/<item>-<nn>-<slug>.png: <actor> · <record> · <screen>. from: `screenshots/<raw file>.png`

## Status

| Item | Title | Tone | Label | Note |
| --- | --- | --- | --- | --- |
| <1> | <title> | <done, partial, info, neutral or blocked> | <label> | <note> |

## Not captured

- <what was not pictured and why>

## Findings

- <product question or defect seen while capturing, with the image or raw capture that shows it>

## Revisions

- <date>: <what changed>. Published: <URL or "not published">.
