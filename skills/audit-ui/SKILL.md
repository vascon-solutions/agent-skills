---
name: audit-ui
description: Use when a running web interface needs evidence-backed evaluation of a focused feature, end-to-end journey, role workflow, exploratory QA finding, or rollout readiness; not for one-off navigation or screenshots, source-only UI review, or implementing fixes.
---

# Audit UI

## Purpose

Audit a running interface through real browser interaction and produce a durable,
evidence-backed verdict. Stay audit-only: report defects and UI/UX improvements,
but never modify application source or manufacture state outside the visible flow.

## Calibrate The Audit

Choose the smallest mode that satisfies the request:

| Mode | Coverage |
| --- | --- |
| `focused` | Named page, component, feature state, or checkpoints only |
| `journey` | Primary end-to-end flow, reload verification, and one risk variation |
| `rollout` | Every required scenario plus a readiness recommendation |

A request only to navigate or take one screenshot belongs to the browser tool,
not this skill.

## Resolve The Contract

Read repository instructions and only relevant feature docs. Resolve in order:

1. explicit user instructions
2. supplied audit brief, including a delivery role brief derived from the ledger
3. authoritative repository docs
4. visible application state
5. bounded inference for minor gaps

Record feature, mode, environment, URLs, explicit startup commands and working
directories, actors and secure credential source, scenarios, terminal outcomes,
evidence budget, cleanup, and assumptions. Ask one question only when safety,
mutation authority, authentication, or the required outcome remains ambiguous.

## Enforce Safety

- Permit state changes only in local or explicitly approved test/staging systems.
- Treat production as strictly read-only.
- Never reset a database, bulk-delete data, weaken auth, or bypass the visible UI.
- Record the tested repository's baseline status and keep artifacts outside it.
- Start only missing services whose commands come from the user, brief, or
  authoritative repo docs. Never guess a command.
- Record readiness URL, command, working directory, pre-existing state, and any
  audit-started process handle. Use controllable foreground sessions only.
- Never use `nohup`, generic `pkill`, or kill a port owner. Wait and re-probe
  after startup; ask the user or return `BLOCKED` if no controllable handle exists.
- Stop only audit-started processes, including interruption cleanup when the
  runtime permits it, and record cleanup failure without deleting evidence.

## Resolve The Execution Environment

Reuse a supplied environment when its URLs, candidate source identities and ownership match the requested audit. If none was supplied and an available agent-devbox installation supports the repository, use [docker-app-verify](../docker-app-verify/SKILL.md) to resolve only the required components and then resume this audit. When called from that lifecycle owner, do not invoke it again. If the runner is absent or the project is unsupported, retain the documented standalone path unless Docker verification was explicitly required. Do not bypass a configured run's admission, readiness or ownership failure.

The provider owns its application lifecycle; this auditor owns its interactions, session/lease closure and verdict. Do not start duplicate services or stop borrowed services. Adopt a supplied external evidence directory and complete its brief once, skipping workspace initialization below. Apply these rules to supplied environments from any provider, not only agent-devbox.

Use the supplied browser controller and fresh task session or exact audit lease. This takes precedence over the browser preference below. Keep required Docker evidence in that executor; a host screenshot does not replace it. Follow the provider's credential-entry, logout and session-cleanup contract. Never call raw APIs to advance a UI scenario.

Verify which relevant UI/API/shared revisions or source digests the served environment represents. Mark candidate acceptance unverified where source identity is missing or mismatched. Preserve required feature checkpoints even when an executor cannot cover them; use the existing verdict rules for blocked or partial coverage.

## Initialize Evidence

When no external evidence directory was supplied, resolve helper paths relative
to this skill directory and run:

```bash
node scripts/init-audit-workspace.mjs --feature "<feature>" --mode <mode> \
  --tested-repo "<repo>"
node scripts/probe-services.mjs --service "app=<readiness-url>"
```

Probe URLs reject embedded credentials, fragments, and query parameters by default. Opt in
only a known query-bearing service with repeatable
`--allow-nonsecret-query <service-name>`; authenticate through the browser flow.
Complete the selected `audit-brief.md` once. Use the supplied or initialized
external workspace for every browser command, screenshot, trace, download and log.
Verify readiness through the provider's documented probe or receipt, from the
executor's network location. Do not probe container-only URLs from the host.

## Select Browser Capability

When no browser executor was supplied, select one in this order:

1. Prefer an available `playwright-cli` or repository-installed equivalent.
2. Otherwise use an exposed in-app browser, Chrome controller, or comparable
   browser tool.
3. Return `BLOCKED` when no capable controller exists; do not install implicitly.

Run Playwright CLI with the audit workspace as its working directory so automatic
`.playwright-cli/` output cannot dirty the tested repo. Use a fresh non-persistent
task-scoped session. Reuse an existing session only with explicit approval.

## Execute Coverage

Map the feature's acceptance criteria to observable checkpoints before acting. Complete visible journeys here; request API coverage only for distinct required operation or permission contracts. When both audits run, correlate record IDs, keep separate reports in the same evidence directory and run dependent steps sequentially. Do not infer API acceptance from UI success.

- Use accessibility snapshots and stable refs or locators.
- Follow actions offered by the application; do not infer permissions from role
  names or call raw APIs to advance state.
- Complete the primary path before its risk variation.
- Retry a failed action once only after refreshing visible state.
- On failure, inspect relevant console and network evidence, then continue
  independent paths. Trace only a reproducible or unexplained blocker.
- Verify meaningful terminal state after reload. Check related list/detail views
  when consistency is required.
- Keep visible success feedback distinct from durable success.

## Capture Critical Evidence

Default to at most 12 screenshots. Capture critical transitions, terminal states,
and defects—not every click. Prefer shallow or element-scoped snapshots and keep
full accessibility trees, console histories, and network dumps out of chat.

Read [references/evidence-and-verdicts.md](references/evidence-and-verdicts.md)
when classifying evidence, findings, severity, or verdict.

## Review UI/UX

On critical screens, assess next-action clarity; status, ownership, and assignee
visibility; navigation context; loading/empty/error/disabled states; validation
and recovery; success feedback; hierarchy and density; labels and consistency;
keyboard focus, accessible names, semantic controls, and obvious contrast issues.

Keep this targeted to the journey. Recommend evidence-linked written changes.
Create mockups or annotated screenshots only when separately requested.

## Report And Clean Up

- Finish the agreed report (`report.md`, or `ui-report.md` for a combined audit);
  verify every cited artifact exists.
- Include checkpoint outcomes, record IDs, functional findings, UI/UX
  recommendations, blocked areas, and cleanup.
- Recommend regression cases or locator candidates without writing test code.
- Close the task session, remove ephemeral auth state, and stop only audit-started
  standalone services unless asked to leave them running. For a supplied
  environment, close this audit's session/lease and return cleanup evidence to
  its lifecycle owner; leave borrowed application services running.
- Confirm the tested repository matches its baseline. Report residue as cleanup
  failure and preserve evidence for failed or blocked audits.
- Return a concise chat summary with verdict, highest-impact findings, and the
  report path.
- When a delivery role brief started the audit, reply with the
  [role result envelope](../task-doc-delivery-loop/references/orchestration.md#result-envelope)
  instead of a chat summary: verdict, every actionable finding with its evidence
  path, unverified scenarios, cleanup state, and every heavy command you ran
  (build, install, test suite or service start) with its evidence path. The
  heavy-command count is the length of that list.

## Common Mistakes

- Do not turn a required failure into a UX suggestion.
- Do not claim `PASS` from a toast without reload or relationship verification.
- Do not switch browser tools merely because one step is difficult.
- Do not capture secrets, reusable auth state, or unrelated personal data.
- Do not expand a focused audit into a full accessibility or heuristic review.
