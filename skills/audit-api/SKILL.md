---
name: audit-api
description: Use when a running HTTP API needs an evidence-backed audit of a focused endpoint, dependent request journey, role boundary, OpenAPI/Swagger surface, or rollout readiness; not for one-off curl calls, browsing Swagger UI, source-only API review, or implementing fixes.
---

# Audit API

## Purpose

Audit a running API through real requests and durable verification. Stay
audit-only: report behavior, contract gaps, and improvements, but never modify
application source or create repository test files unless separately requested.

## Calibrate The Audit

Choose the smallest sufficient mode:

| Mode | Coverage |
| --- | --- |
| `focused` | Named operation, checkpoint, or defect reproduction |
| `journey` | Primary dependent flow, one negative case, and persistence |
| `rollout` | Required operation/role matrix plus readiness recommendation |

A single independent request belongs to curl, not this skill. A visual Swagger
UI check belongs to a browser tool.

## Resolve The Contract

Resolve scope in this order:

1. explicit user instructions
2. supplied audit brief or acceptance criteria
3. OpenAPI/Swagger contract
4. authoritative repository docs and code
5. observed runtime behavior

Record feature, mode, environment, base URLs, startup commands and working
directories, contract source/hash/version, selected operations, actors and
secure credential source, allowed mutations, idempotency, polling, terminal
outcomes, evidence budget, cleanup, and assumptions. Ask one question only when
safety, mutation authority, authentication, the selected endpoint surface, or
the required outcome is materially unclear.

## Enforce Safety

- Production is semantic read-only: reject operations that can mutate even if
  they use GET, and do not infer safety from the HTTP method alone.
- Mutate only local or explicitly approved test/staging environments.
- Never reset databases, bulk-delete, weaken auth, or manufacture state directly.
- Record the tested repository baseline and keep all artifacts outside it.
- Start only missing services whose exact commands come from the user, brief, or
  authoritative repo docs. Record readiness, working directory, pre-existing
  state, and the controllable foreground process handle.
- Never daemonize, use generic `pkill`, or kill a port owner. Wait and re-probe;
  ask the user or return `BLOCKED` when no controllable handle exists.
- Stop only audit-started processes, attempt interruption cleanup, and record
  cleanup failure without deleting evidence.

## Initialize And Probe

Resolve helper paths relative to this skill directory, then run:

```bash
node scripts/init-api-audit-workspace.mjs --feature "<feature>" \
  --mode <mode> --tested-repo "<repo>"
node scripts/probe-services.mjs --service "api=<readiness-url>"
```

Probe URLs reject embedded credentials, fragments, and query parameters by default. Opt in
only a known query-bearing service with repeatable
`--allow-nonsecret-query <service-name>`.
Complete `audit-brief.md` once and keep every generated file in the workspace.

## Discover The Effective Contract

- Prefer a supplied local contract, then a documented runtime contract URL,
  then repository configuration. Do not crawl for undocumented endpoints.
- Detect Swagger 2.0 versus OpenAPI 3.x before interpreting it.
- Build a bounded inventory of selected method/path, operation ID, parameters,
  request/response content, success/errors, security, and lifecycle links.
- Apply root, path-item, and operation inheritance plus operation overrides.
- Record unresolved local or external references and mark affected checks
  unverified; never fetch an external reference implicitly.
- Use `jq` for JSON. Use `yq` only if it is a recognized compatible build;
  otherwise inspect bounded YAML directly or convert with an existing repo tool.

## Select The Executor

Prefer Hurl 6.1+ for authentication, captures, dependent requests, and
assertions. Use curl for readiness, independent checks, or safe fallback. If
Hurl is absent, do not install it implicitly. Read
[references/hurl-execution.md](references/hurl-execution.md) before generating
or executing scenarios.

## Execute Coverage

- Start with readiness/authentication, then the primary success path.
- In focused and journey modes add one safe, useful risk-based negative case
  (validation, authorization, not-found, conflict, or transition); record why it
  is excluded when none is safe or relevant.
- In rollout mode cover only the brief's required operation and role matrix.
- Assert status plus the smallest meaningful body/header fields.
- Capture identifiers and verify created state with a separate read or related
  list. For async work, poll a documented status resource to a bounded terminal
  state; a 202 response alone is not success.
- Keep dependent steps sequential. Parallelize only independent scenarios.
- Treat undocumented behavior as an observation, not a contract promise.

## Handle Failures Safely

- Retry a failed safe read once after classifying transport versus application
  failure. Do not use global retry for a journey containing mutations.
- Never blindly retry an uncertain non-idempotent mutation.
- Reconcile via idempotency key, returned identifier, documented lookup, or
  visible state before deciding whether another mutation is authorized.
- Continue independent scenarios after recording a failure; do not convert a
  required failure into an improvement suggestion.

## Preserve Evidence And Decide

Read [references/evidence-and-verdicts.md](references/evidence-and-verdicts.md)
when classifying results, severity, or verdict. Store compact redacted evidence:
method, display URL, actor, expected/actual status, bounded fields, identifiers,
timing, and artifact link. Never retain authorization values, cookies, API keys,
reusable tokens, or full unreviewed response dumps.

## Report And Clean Up

- Complete `report.md` and verify every evidence link exists.
- Include contract inventory, checkpoint outcomes, record IDs, functional and
  contract findings, reliability/security/developer-experience improvements,
  blocked areas, regression recommendations, and cleanup.
- Remove ephemeral credentials and raw temporary output; preserve sanitized
  evidence for failed or blocked audits.
- Stop only audit-started services unless asked to leave them running.
- Confirm the tested repository matches its baseline and report any residue.
- Return a concise verdict, highest-impact findings, and report path.

## Common Mistakes

- Do not claim `PASS` from status codes without meaningful field or persistence checks.
- Do not send secrets in URLs, argv, shell history, or durable Hurl files.
- Do not auto-follow redirects across origins or carry credentials to a new origin.
- Do not broaden a focused audit into schema fuzzing or full security testing.
