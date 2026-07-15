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

- `environment`: service, dependency, database, configuration, or DNS unavailable.
- `authentication`: credentials are missing, expired, rejected, or unusable.
- `authorization`: expected access is denied or forbidden access succeeds.
- `test-data`: a prerequisite is missing, conflicting, or already consumed.
- `contract`: status, content type, shape, or documented behavior differs.
- `validation`: invalid input is accepted or error behavior is wrong.
- `functional`: required business behavior or transition is incorrect.
- `data-integrity`: persisted, related, or returned data is inconsistent.
- `automation`: available tooling cannot safely express the check.
- `external`: a third-party or asynchronous dependency prevents progression.

Do not hide runtime defects behind contract, environment, or automation labels.

## Severity

- `blocker`: required journey cannot complete, critical authorization/data
  integrity or safety fails, or audit evidence is invalid.
- `major`: required endpoint behavior is wrong or a high-impact role boundary fails.
- `moderate`: recoverable contract, validation, consistency, or workflow defect.
- `minor`: low-impact documentation inconsistency or bounded API ergonomics issue.

Severity describes impact; confidence describes evidence strength. Report both
when evidence is indirect.

## Verdict Precedence

Apply the first matching rule:

1. `FAIL` — any exercised required behavior is proven incorrect.
2. `PASS` — all required checks are proven and none failed.
3. `BLOCKED` — no meaningful required coverage completed because access,
   environment, tooling, contract, or prerequisites prevented execution.
4. `PARTIAL` — meaningful required coverage completed, but one or more remaining
   required checks are unverified or blocked and no exercised requirement failed.

Focused verdicts apply only to named checks. Rollout mode cannot pass with an
unverified required scenario. Never average checkpoint outcomes into a verdict.

## Finding Shape

Each finding should contain title, severity, confidence, affected operation and
actor, expected behavior, observed behavior, evidence path, user/system impact,
and a specific recommendation. Keep functional defects, contract mismatches, and
improvement opportunities separate.
