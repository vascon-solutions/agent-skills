# API Evidence And Verdicts

## Evidence Levels

Prefer the smallest evidence that proves the checkpoint:

1. terminal state read after the initiating request
2. compact status plus selected headers/body fields
3. relationship verification in a list, detail, or downstream resource
4. bounded sanitized console/tool excerpt for an execution blocker

Record method, redacted display URL, actor, expected and actual status, selected
assertions, duration, identifiers, timestamp, and artifact path. A response body
alone is not durable proof when the flow promises persistence or asynchronous
work.

## Failure Classes

- `product`: runtime behavior violates the accepted workflow.
- `contract`: implementation and authoritative API contract disagree.
- `environment`: required service, seed data, or test dependency is unavailable.
- `access`: credentials or permissions prevent required coverage.
- `automation`: the available HTTP/parser tooling cannot express the check.
- `scope`: the brief omits authority or an expected outcome needed to proceed.

Do not hide product or contract failures behind environment or automation labels.

## Severity

- `critical`: broad security exposure, destructive integrity risk, or unusable core API.
- `high`: required journey cannot complete, authorization boundary fails, or state is corrupted.
- `medium`: important contract, validation, reliability, or recovery defect with a workaround.
- `low`: localized consistency, diagnostics, or developer-experience weakness.

Severity describes impact; confidence describes evidence strength. Report both
when evidence is indirect.

## Verdict Precedence

Apply the first matching rule:

1. `BLOCKED` — required coverage could not execute for access, environment,
   automation, or unresolved-scope reasons and no required behavior is disproved.
2. `FAIL` — any required checkpoint failed or a critical/high defect disproves
   readiness. Partial success cannot override it.
3. `PASS WITH CONCERNS` — every required checkpoint passed, but bounded medium or
   low risks, contract ambiguity, or explicitly optional coverage remains.
4. `PASS` — every required checkpoint passed with meaningful direct evidence,
   cleanup succeeded, and no material concern remains.

If a required checkpoint both fails and another is blocked, use `FAIL` and list
the blocked residual scope. Never average checkpoint outcomes into a verdict.

## Finding Shape

Each finding should contain title, severity, confidence, affected operation and
actor, expected behavior, observed behavior, evidence path, user/system impact,
and a specific recommendation. Keep functional defects, contract mismatches, and
improvement opportunities separate.
