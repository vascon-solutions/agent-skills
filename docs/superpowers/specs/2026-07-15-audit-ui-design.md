# Audit UI Skill Design

Date: 2026-07-15
Status: Proposed for user review
Target repository: `~/agent-skills`
Proposed skill name: `audit-ui`
Source mode: user brief + Direct Order acceptance-test prompt retrospective

## Objective

Create a global, framework-agnostic `audit-ui` skill for testing running web
interfaces through real browser interaction. The skill should support focused
feature checks, critical-page screenshot capture, multi-step user journeys,
role-based end-to-end workflows, exploratory UI/UX review, and rollout-readiness
audits without changing application source code.

The default implementation should be fast and token-friendly. It should prefer
`playwright-cli`, start only explicitly configured services, collect bounded
evidence, verify meaningful outcomes after reload, and write a durable Markdown
report under `~/agent-artifacts/ui-audits/`.

## Problem Statement

Feature audits currently require a long prompt that repeatedly explains how to:

- check and start local services
- select actors and traverse workflow stages
- avoid mocks or direct state manipulation
- capture useful screenshots without capturing every click
- distinguish environment failures from application defects
- inspect UI/UX while proving functional behavior
- preserve evidence outside the tested repository
- produce a consistent verdict and report

`playwright-cli` already owns browser mechanics. The missing capability is a
portable audit conductor that defines scope, safety, evidence, and completion.
The new skill must orchestrate existing browser tools rather than duplicate their
command documentation or become a general-purpose test framework.

## Naming Decision

Use `audit-ui`, not `audit-feature-rollout` or `audit-ui-rollout`.

`rollout` is one use case, but the same skill should support a single-page check,
a focused feature test, a screenshot request, a complete user journey, or formal
release sign-off. The short verb-led name also leaves a clear future sibling:
`audit-api`.

The skill description should make the runtime boundary explicit:

> Audit running web interfaces through browser interaction, functional journey
> testing, critical-page screenshots, UI/UX assessment, and evidence-backed
> reporting. Use for focused feature checks, screenshot capture, end-to-end
> flows, role-based workflows, exploratory QA, or rollout readiness. Not for
> source-only UI code review or implementing fixes.

## Core Decisions

- Scope: global and repository-agnostic.
- Mutation boundary: audit-only; never implement fixes.
- Input: natural-language prompt with an optional Markdown rollout brief.
- Service startup: only commands explicitly supplied by the user, brief, or
  authoritative repository documentation.
- Browser: `playwright-cli` first, with a controlled fallback when unavailable
  or incompatible.
- Evidence: adaptive screenshot budget, default maximum 12.
- UI/UX depth: targeted journey review, not a full heuristic audit by default.
- Output: durable Markdown artifact plus concise chat summary.
- Artifact root: `~/agent-artifacts/ui-audits/<feature>/<timestamp>/`.
- Verdicts: `PASS`, `PARTIAL`, `BLOCKED`, or `FAIL`.
- Failure behavior: retry once, diagnose briefly, then continue independent
  paths.
- Credentials: existing browser sessions first, then configured secret sources;
  never publish secrets.
- Generated tests: none by default; recommend regression cases in the report.
- UI proposals: evidence-linked written recommendations; mockups only when
  explicitly requested.
- Environment safety: state-changing tests only in local or explicitly approved
  test/staging environments.
- Cleanup: stop only services started by the audit unless asked to leave them
  running.
- Success criteria: explicit-first with bounded inference.
- Default journey coverage: one primary journey plus one risk-based variation.
- Subagents: not part of the default audit.

## Existing Skill Fit

### `playwright-cli`

Owns browser commands, sessions, snapshots, screenshots, storage state, console,
network inspection, tracing, and video. `audit-ui` should invoke it when
available and must not copy its command reference into `SKILL.md`.

### `web-design-guidelines`

Owns source-oriented UI guideline review. `audit-ui` owns runtime behavior and
journey evidence. A user asking only for code review should use the guideline
skill instead.

### `qa-triage-and-fix`

Owns issue-by-issue triage and remediation. `audit-ui` stops after reporting
findings. Fixing them requires a separate request and skill.

### `prepare-qa-handoff`

Owns neutral feature handoff documentation. An audit report may inform a later
handoff, but the two outputs should not be conflated.

### Browser-control fallbacks

An available in-app browser, Chrome controller, or comparable browser tool may
be used only when Playwright CLI is unavailable or cannot operate the target.
The report must identify the fallback and its effect on evidence quality.

## Alternatives Considered

### Instructions-only skill

Keep only `SKILL.md`. This is initially small but forces each model to recreate
service probing, artifact initialization, and report structure. It produces less
consistent audits and wastes tokens over repeated runs.

### Manifest-driven audit framework

Require YAML and build a runner around services, scenarios, and assertions.
This is deterministic but begins recreating a test runner, adds parser and schema
maintenance, and makes lightweight screenshot tasks unnecessarily heavy.

### Combined UI/API audit skill

Support browser and endpoint modes in one skill. This creates broad triggering,
loads irrelevant instructions, and encourages API testing through Swagger UI.
UI and API audits should remain sibling skills with shared conventions rather
than one mega-skill.

### Selected approach

Use a thin orchestration skill with two small deterministic Node helpers and two
progressively loaded Markdown templates.

## Audit Modes

The skill should calibrate depth from the request rather than treating every
check as release sign-off.

### Focused mode

Use for a page, component, feature state, or screenshot request.

- Test only the named surface and prerequisites needed to reach it.
- Capture the requested or materially useful screenshots.
- Record blockers and obvious functional or UX problems.
- Use the four-state verdict against the explicitly requested checkpoints.
- Do not add a risk-based variation unless requested or nearly free.

### Journey mode

Use for an end-to-end feature flow.

- Execute the primary journey through its terminal state.
- Verify the terminal state after reload.
- Add one risk-based variation by default.
- Inspect critical UI transitions and evidence.

### Rollout mode

Use when the user asks for readiness, acceptance, sign-off, release, or rollout
assessment.

- Apply the strict journey contract.
- Require all stated scenarios and terminal conditions.
- Include an explicit rollout-readiness recommendation.
- Treat unverified required behavior as non-pass.

If the request does not clearly imply a mode, choose the smallest mode that
satisfies it and record the choice in `audit-brief.md`.

## Proposed Skill Structure

```text
skills/audit-ui/
├── SKILL.md
├── scripts/
│   ├── probe-services.mjs
│   ├── probe-services.test.mjs
│   ├── init-audit-workspace.mjs
│   └── init-audit-workspace.test.mjs
└── references/
    ├── audit-brief-template.md
    └── report-template.md
```

Repository integration also requires:

- add `audit-ui` to `SKILL_NAMES` in `bin/link-skills.sh`
- add the skill to the README directory tree and Skills table
- add a concise README usage example for runtime UI audits
- run the link script so all five supported tool locations receive the skill

Do not add `agents/openai.yaml` in the first version. This repository targets
Codex, Claude Code, Cursor, agents.sh-compatible tools, and Gemini through the
same portable skill directory, and no existing skill uses platform-specific UI
metadata.

## Input Contract

Accept a normal-language request and optionally a Markdown audit brief.

Resolve instructions in this order:

1. explicit user instructions
2. supplied audit brief
3. authoritative repository instructions and documentation
4. visible application workflow state
5. bounded inference for minor gaps

The resolved audit contract should include, when relevant:

- feature and audit mode
- environment classification
- application and readiness URLs
- explicitly configured startup commands and working directories
- actor roles and secure credential source
- primary journey and risk-based variation
- expected checkpoints and terminal conditions
- permitted external-system simulation
- screenshot budget
- service cleanup behavior
- artifact-root override

Ask one focused question before execution only when environment safety, mutation
authority, authentication, or the required terminal outcome is materially
ambiguous. Record minor assumptions instead of expanding the prompt exchange.

## Artifact Contract

Default workspace:

```text
~/agent-artifacts/ui-audits/<feature>/<timestamp>/
├── audit-brief.md
├── report.md
├── screenshots/
├── traces/
├── downloads/
└── logs/
```

`audit-brief.md` is the compact resolved execution contract. It prevents the
audit from depending on conversation history and avoids repeatedly rediscovering
the same parameters.

`report.md` is the durable result. It should remain useful when read without the
chat transcript.

## Runtime Workflow

### 1. Intake

- Read repository source-of-truth instructions and only the docs relevant to the
  requested feature.
- Determine focused, journey, or rollout mode.
- Confirm audit-only scope.
- Resolve explicit success criteria and bounded assumptions.

### 2. Safety Gate

- Classify the environment as local, test, staging, or production.
- Permit state-changing flows only in local or explicitly approved test/staging
  environments.
- Treat production as read-only unless the user separately provides explicit
  authorization and safeguards.
- Reject destructive recovery such as database resets or bulk record deletion.

### 3. Workspace Initialization

- Run `init-audit-workspace.mjs` with the feature slug and audit mode.
- Write or complete `audit-brief.md` from the resolved contract.
- Keep all evidence outside the tested repository unless the user overrides the
  destination.

### 4. Service Preflight

- Probe configured readiness URLs concurrently with `probe-services.mjs`.
- Do not guess health URLs or startup commands.
- Start only unavailable services with commands supplied by the prompt, brief,
  or authoritative repo docs.
- Track which processes the audit started.
- Re-probe before opening the browser.

### 5. Browser Selection

- Prefer Playwright CLI.
- Reuse named sessions when doing so reduces repeated authentication safely.
- Use a fallback browser only when needed and disclose the reason.
- Do not switch tools merely because a workflow step is difficult.

### 6. Execute Requested Coverage

- Use accessibility snapshots and stable refs or locators for interaction.
- Follow visible/backend-provided workflow actions rather than inferring actions
  from role labels.
- Use the visible UI for application state transitions.
- Do not use mocks, request interception, direct database changes, or raw API
  calls to manufacture an end-to-end pass.
- Permit a declared external boundary, such as modifying a downloaded workbook,
  only when the audit brief explicitly allows it.

### 7. Verify Outcomes

- Capture requested and critical states.
- Verify meaningful terminal states after reload.
- Check related list, detail, or relationship surfaces when consistency is part
  of the stated success criteria.
- Distinguish visible success feedback from durable persisted success.

### 8. Review UI/UX

On selected critical screens, assess:

- clarity of the next action
- status, ownership, task, and assignee visibility
- navigation and context preservation
- loading, empty, error, disabled, and returned states
- form validation placement and recovery guidance
- success feedback and next-step explanation
- information hierarchy, density, labels, and consistency
- keyboard focus, accessible names, semantic controls, and obvious contrast
  problems

Do not turn the default run into a complete heuristic or WCAG audit. Recommend
mockups or annotated screenshots only when the user separately asks for them.

### 9. Handle Failures

- Retry a failed action once after refreshing visible state.
- Check console and relevant network evidence before classifying a functional
  defect.
- Trace only reproducible or unexplained blockers.
- Continue independent paths after recording the failed dependency.
- Avoid repeated retries against unchanged state.

### 10. Report And Clean Up

- Assign the strict verdict.
- Finish `report.md` and verify every cited artifact exists.
- Stop only services started by the audit unless the brief says to leave them
  running.
- Preserve evidence for failed and blocked runs.
- Return a concise chat summary with the report path and highest-impact findings.

## Browser And Evidence Rules

- Default screenshot maximum: 12.
- Capture critical transitions, terminal states, and defects rather than every
  click.
- Use descriptive scenario/checkpoint filenames.
- Keep full accessibility-tree output out of chat and reports.
- Prefer shallow or element-scoped snapshots where practical.
- Inspect only screenshots needed for UI/UX judgment.
- Check console and network state at major transitions and failures.
- Record traces only when failure evidence needs them.
- Do not record video unless a problem cannot otherwise be explained.
- Use synthetic test data where possible.
- Redact secrets and unnecessary personal data before publishing evidence.

## Failure Classification

Classify each interruption as one of:

- `environment`: service, dependency, database, or configuration unavailable
- `authentication`: missing credentials, rejected session, or insufficient actor
  access
- `test-data`: prerequisite missing, uniqueness conflict, or consumed workflow
- `functional`: required application behavior is incorrect
- `ux`: behavior works but materially confuses, delays, or misleads users
- `automation`: browser tooling cannot reliably operate an otherwise valid
  control
- `external`: third-party or asynchronous dependency prevents progression

Do not downgrade failed required behavior into a UX suggestion. Keep "not
tested" distinct from "tested and failed."

## Verdict Model

- `PASS`: every checkpoint required by the selected mode is proven with durable
  evidence.
- `PARTIAL`: meaningful requested coverage completed, but one or more required
  scenarios did not.
- `BLOCKED`: access, environment, or prerequisites prevented meaningful
  completion.
- `FAIL`: the exercised feature violated required behavior.

For focused mode, the verdict applies only to the named checks. For rollout
mode, any required unverified scenario prevents `PASS`.

## Report Contract

The report should contain:

1. overall verdict and, when requested, rollout-readiness recommendation
2. scope, audit mode, environment, and assumptions
3. browser tool, services, and startup actions
4. actor/scenario matrix when relevant
5. checkpoint table with expected and actual outcomes
6. created test-record identifiers when relevant
7. functional findings ordered by severity
8. UI/UX findings ordered by user impact
9. console, network, trace, and environment evidence
10. unverified or blocked areas
11. cleanup outcome

Each functional finding should include severity, actor/screen/step, expected and
actual behavior, concise reproduction, evidence links, and release impact.

Each UI/UX recommendation should include the user problem, affected screen and
actor, screenshot evidence, concrete proposed change, and expected impact.

The report may recommend regression cases and stable locator candidates. It must
not write test code unless the user separately asks for test generation.

## Credential And Privacy Rules

Credential resolution order:

1. existing authenticated browser session when appropriate
2. explicitly configured environment or secrets file
3. user input when no secure source is available

Never include passwords, access tokens, session storage values, sensitive
cookies, or secret-file contents in reports. Avoid screenshotting sensitive form
values. Do not inspect unrelated browser profile or storage data.

## Service Lifecycle

`audit-ui` may start services because startup is a normal prerequisite for local
or test UI auditing, but it must use only explicit commands.

The skill should:

- record readiness URL, command, working directory, and whether the process
  pre-existed
- keep long-running processes in manageable execution sessions
- wait for readiness rather than assuming command startup succeeded
- avoid duplicate servers on occupied ports
- stop only processes it started
- record cleanup failures without deleting evidence

## Helper Script Contracts

### `probe-services.mjs`

Responsibilities:

- accept one or more explicit `name=url` service definitions
- probe them concurrently with a bounded timeout
- follow ordinary HTTP redirects
- emit compact JSON with service name, URL, reachable state, status code when
  available, duration, and safe error category
- return nonzero when any required service is unavailable
- never start, restart, or kill a process
- never print credentials embedded in URLs

The implementation should use only Node standard-library APIs.

### `init-audit-workspace.mjs`

Responsibilities:

- accept feature name, audit mode, optional artifact root, and optional timestamp
- normalize a safe lowercase feature slug
- create a collision-safe timestamped directory
- create `screenshots`, `traces`, `downloads`, and `logs`
- copy the brief and report templates into `audit-brief.md` and `report.md`
- print the resolved workspace path in a machine-readable form
- refuse path traversal or accidental overwrite

The implementation should use only Node standard-library APIs and resolve
templates relative to the installed skill directory.

## Token-Friendly Rules

- Keep `SKILL.md` procedural and approximately 150-200 lines where practical.
- Put template details in `references/` and load them only when used.
- Read feature docs once and record the compact resolved contract.
- Do not paste Playwright CLI documentation into the skill.
- Do not paste full snapshots, console logs, or network histories into chat.
- Prefer concurrent service probes and focused browser checks.
- Keep progress updates to phase, current actor/scenario, and blockers.
- Inspect only critical screenshots.
- Generate traces only after a failure reproduces.
- Do not use subagents or multi-agent modes by default.

## Non-Goals

The skill does not:

- implement or fix application code
- generate automated tests by default
- replace Playwright CLI or a repository's browser test suite
- perform source-only UI code review
- perform a complete accessibility audit by default
- mutate production by default
- guess startup commands, credentials, workflow actions, or success criteria
- clear databases or delete user data to recover a test
- audit API endpoints directly
- test endpoints by driving Swagger UI unless Swagger UI itself is the target

## Future `audit-api` Sibling

API endpoint testing should be a separate `audit-api` skill with similar safety,
artifact, verdict, credential, and report conventions.

Its likely tool strategy is:

- read OpenAPI/Swagger documents for endpoint discovery
- execute requests directly with `curl` or another configured HTTP client
- verify authentication, RBAC, status codes, schemas, headers, validation,
  pagination, filtering, idempotency, and side effects
- use browser automation only when the API documentation UI or browser-only
  authentication behavior is itself under test

Do not implement `audit-api` as part of the first `audit-ui` task.

## Validation Plan

### Skill structure

- Validate frontmatter and naming with the skill-creator quick validator.
- Confirm the body contains no repository-specific paths, actors, ports, enums,
  or domain rules.
- Confirm the description covers focused checks, screenshots, journeys, QA, and
  rollout triggers while excluding source-only review and fixes.

### Helper scripts

- Run Node tests for healthy, unhealthy, redirect, timeout, and malformed service
  definitions.
- Verify URL credentials are redacted from output.
- Run Node tests for slug normalization, timestamps, collision handling, template
  copying, traversal refusal, and temporary-HOME/artifact-root isolation.
- Smoke-test both helpers against a temporary local HTTP server and temporary
  artifact root.

### Repository integration

- Run `sh -n bin/link-skills.sh`.
- Run `bin/link-skills.sh` and confirm `audit-ui` links into all five supported
  skill directories.
- Verify the README directory tree, Skills table, and usage guidance.
- Confirm no unrelated current-branch changes are included in the skill commit.

### Runtime smoke test

- Run one small read-only focused audit after installation.
- Verify Playwright CLI routing, screenshot budget, report initialization,
  evidence links, verdict, and service cleanup behavior.
- Use the first real complex feature audit as a forward test and revise the skill
  only when observed friction justifies it.

## Repository And Branch Decision

Implement in `/Users/dee/agent-skills` on the existing
`feat/task-doc-delivery-calibration` branch, as explicitly authorized by the
user. Keep the design and eventual `audit-ui` commits scoped so they remain
distinguishable from the branch's earlier task-doc delivery work.

## Completion Criteria

The first implementation is complete when:

- `audit-ui` is present with the approved structure and framework-agnostic body
- both helper scripts and tests pass
- the brief and report templates contain no unresolved placeholders beyond
  intentional template tokens
- README and link-script wiring are complete
- the skill is linked into all supported global locations
- validation and a focused read-only smoke audit pass
- no application repository was changed
- the user has reviewed and accepted the skill behavior

## Open Questions

None. API auditing is intentionally deferred to the separate `audit-api` design.
