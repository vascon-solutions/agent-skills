# Audit UI Skill Design

Date: 2026-07-15
Status: Proposed for user review
Target repository: `~/agent-skills`
Proposed skill name: `audit-ui`
Source mode: user brief + Direct Order acceptance-test prompt retrospective +
independent spec review

## Objective

Create a global, framework-agnostic `audit-ui` skill for evaluating running web
interfaces through real browser interaction. The skill should support focused
feature checks with evidence, multi-step user journeys, role-based end-to-end
workflows, exploratory UI/UX review, and rollout-readiness audits without
changing application source code.

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

`rollout` is one use case, but the same skill should support a single-page
evaluation, a focused feature test, a complete user journey, or formal release
sign-off. The short verb-led name also leaves a clear future sibling:
`audit-api`. A request only to navigate or take a screenshot remains owned by the
browser skill; `audit-ui` requires checkpoints, evaluation, findings, or a
verdict.

The skill description should make the runtime boundary explicit:

> Audit running web interfaces through browser interaction, functional journey
> testing, critical-page evidence, UI/UX assessment, and evidence-backed
> reporting. Use for focused feature evaluation, end-to-end flows, role-based
> workflows, exploratory QA, or rollout readiness when checkpoints, findings, or
> a verdict are required. Not for one-off browser navigation or screenshot
> capture, source-only UI code review, or implementing fixes.

## Core Decisions

- Scope: global and repository-agnostic.
- Mutation boundary: audit-only; never implement fixes.
- Input: natural-language prompt with an optional Markdown audit brief.
- Service startup: only commands explicitly supplied by the user, brief, or
  authoritative repository documentation.
- Browser: `playwright-cli` first after a runtime capability check, with a
  controlled fallback when unavailable or incompatible; block when no browser
  capability exists.
- Evidence: adaptive screenshot budget, default maximum 12.
- UI/UX depth: targeted journey review, not a full heuristic audit by default.
- Output: durable Markdown artifact plus concise chat summary.
- Artifact root: `~/agent-artifacts/ui-audits/<feature>/<timestamp>/`.
- Verdicts: `PASS`, `PARTIAL`, `BLOCKED`, or `FAIL`.
- Failure behavior: retry once, diagnose briefly, then continue independent
  paths.
- Credentials: fresh task-scoped browser sessions by default, then explicitly
  approved task-scoped sessions or configured secret sources; never publish
  secrets.
- Generated tests: none by default; recommend regression cases in the report.
- UI proposals: evidence-linked written recommendations; mockups only when
  explicitly requested.
- Environment safety: state-changing tests only in local or explicitly approved
  test/staging environments; production is strictly read-only in v1.
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

Use a thin orchestration skill with two small deterministic Node helpers,
one-level references for detailed policy, and two copy-only Markdown templates.

## Audit Modes

The skill should calibrate depth from the request rather than treating every
check as release sign-off.

### Focused mode

Use for an evidence-backed evaluation of a page, component, or feature state.

- Test only the named surface and prerequisites needed to reach it.
- Capture the requested or materially useful screenshots.
- Record blockers and obvious functional or UX problems.
- Use the four-state verdict against the explicitly requested checkpoints.
- Do not add a risk-based variation unless requested or nearly free.

Do not invoke this mode for a one-off screenshot with no evaluation or report;
use the available browser skill directly.

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
├── agents/
│   └── openai.yaml
├── scripts/
│   ├── probe-services.mjs
│   ├── probe-services.test.mjs
│   ├── init-audit-workspace.mjs
│   └── init-audit-workspace.test.mjs
├── references/
│   └── evidence-and-verdicts.md
└── assets/
    └── templates/
        ├── audit-brief.md
        └── report.md
```

Repository integration also requires:

- add `audit-ui` to `SKILL_NAMES` in `bin/link-skills.sh`
- add the skill to the README directory tree and Skills table
- add a concise README usage example for runtime UI audits
- run the link script so all five supported tool locations receive the skill
- generate and validate `agents/openai.yaml` as optional Codex UI metadata; it
  must not be a runtime dependency for other agents

Linkage makes the instructions available across Codex, Claude Code, Cursor,
agents.sh-compatible tools, and Gemini. It does not guarantee that every runtime
has Playwright CLI or another browser controller, so capability detection remains
mandatory.

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
- Treat production as strictly read-only in v1. A request to mutate production
  is outside this skill's supported scope.
- Reject destructive recovery such as database resets or bulk record deletion.

### 3. Workspace Initialization

- Run `init-audit-workspace.mjs` with the feature slug and audit mode.
- Write or complete `audit-brief.md` from the resolved contract.
- Record the tested repository's baseline status when one exists.
- Keep all evidence outside the tested repository. An artifact-root override
  may choose another external location but may not point inside the tested repo.

### 4. Service Preflight

- Probe configured readiness URLs concurrently with `probe-services.mjs`.
- Do not guess health URLs or startup commands.
- Start only unavailable services with commands supplied by the prompt, brief,
  or authoritative repo docs.
- Track which processes the audit started.
- Re-probe before opening the browser.

### 5. Browser Selection

- Check for Playwright CLI or the repository's already-installed CLI before
  selecting it; do not install browser tooling implicitly.
- If it is unavailable, select a compatible browser controller exposed by the
  runtime. Return `BLOCKED` when none exists.
- Run every Playwright CLI command with the audit workspace as its working
  directory so automatic `.playwright-cli/` output remains outside the tested
  repository.
- Use absolute paths under the audit workspace for screenshots, traces,
  downloads, and logs.
- Use a fresh, non-persistent named audit session by default. Reuse only a known
  task-scoped session with explicit user approval.
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
- Close the task-scoped browser session and remove ephemeral session data.
- Confirm the tested repository still matches its baseline status; report any
  audit-created residue as a cleanup failure.
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
- Prove checkpoints with the smallest credible combination of visible DOM state,
  URL/navigation state, persisted state after reload, created record identifiers,
  downloaded artifacts, and relevant network/console evidence. A screenshot is
  not required for every checkpoint.
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

Apply verdicts in this order:

1. `FAIL` when any exercised required behavior is proven incorrect.
2. `PASS` when all required checks are proven and none failed.
3. `BLOCKED` when no meaningful required coverage completed because access,
   environment, tooling, or prerequisites prevented execution.
4. `PARTIAL` when meaningful required coverage completed but one or more
   remaining required checks are unverified or blocked and no exercised required
   behavior failed.

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

Use this shared severity scale:

- `blocker`: required flow cannot complete, critical safety/security issue, or
  evidence invalidates the audit
- `major`: required behavior is wrong or high-impact repeated UX friction
- `moderate`: recoverable defect, inconsistency, or material but bounded friction
- `minor`: low-impact usability or visual polish issue

Each functional finding should include severity, actor/screen/step, expected and
actual behavior, concise reproduction, evidence links, and release impact.

Each UI/UX recommendation should include the user problem, affected screen and
actor, checkpoint reference, concrete proposed change, and expected impact. Link
a screenshot only when it materially demonstrates the issue.

The report may recommend regression cases and stable locator candidates. It must
not write test code unless the user separately asks for test generation.

## Credential And Privacy Rules

Credential resolution order:

1. fresh task-scoped browser session populated through the visible login flow
2. explicitly approved task-scoped session
3. explicitly configured environment or secrets file
4. user input when no secure source is available

Do not put secrets in command arguments when a safer environment or interactive
input mechanism exists. Do not save reusable browser auth state into the audit
workspace. Never include passwords, access tokens, session storage values,
sensitive cookies, or secret-file contents in reports. Treat traces and network
logs as sensitive local evidence even when they are not published. Avoid
screenshotting sensitive form values and do not inspect unrelated browser
profiles or storage data.

## Service Lifecycle

`audit-ui` may start services because startup is a normal prerequisite for local
or test UI auditing, but it must use only explicit commands.

The skill should:

- record readiness URL, command, working directory, and whether the process
  pre-existed
- start services only in controllable foreground execution sessions or process
  groups and record the returned handle
- never daemonize with `nohup`, use generic `pkill`, or kill whichever process
  happens to own a configured port
- wait for readiness rather than assuming command startup succeeded
- avoid duplicate servers on occupied ports
- stop only processes it started
- attempt cleanup after interruption when the runtime permits it
- ask the user to start the service or return `BLOCKED` when the runtime cannot
  provide an isolated, controllable process handle
- record cleanup failures without deleting evidence

## Helper Script Contracts

### `probe-services.mjs`

Invocation:

```bash
node scripts/probe-services.mjs \
  --service "app=http://127.0.0.1:3000/login" \
  --optional-service "docs=http://127.0.0.1:3040/api-docs" \
  --timeout-ms 5000
```

Contract:

- Require at least one `--service` or `--optional-service` in `name=url` form.
- Treat `--service` as required and `--optional-service` as informational.
- Require unique nonblank names and absolute `http:` or `https:` URLs.
- Default `--timeout-ms` to 5000; accept 250-30000 milliseconds.
- Probe all services concurrently with `GET`, follow ordinary redirects, and
  consume no more response data than needed to establish reachability.
- Treat HTTP 200-399 as reachable and HTTP 400-599 as `error: "http"`.
- Emit exactly one compact JSON object to stdout on a valid invocation. Send
  usage/input diagnostics to stderr only.
- Never start, restart, or kill a process.

Output shape:

```json
{
  "ok": false,
  "services": [
    {
      "name": "app",
      "displayUrl": "http://127.0.0.1:3000/login",
      "required": true,
      "reachable": false,
      "status": null,
      "durationMs": 5001,
      "error": "timeout"
    }
  ]
}
```

`ok` is `true` exactly when every required service is reachable; optional
service failures do not change it.
`displayUrl` must remove URL username/password components and replace every query
parameter value with `[REDACTED]`; the original URL must never be echoed.
`error` is one of `timeout`, `dns`, `connection`, `tls`, `http`, or `unknown`,
and is `null` when reachable.

Exit codes:

- `0`: every required service is reachable
- `1`: one or more required services is unavailable
- `2`: invalid arguments or service definitions
- `3`: unexpected probe/runtime failure that prevents a valid result

Use only Node standard-library APIs.

### `init-audit-workspace.mjs`

Invocation:

```bash
node scripts/init-audit-workspace.mjs \
  --feature "Direct Order" \
  --mode journey \
  --artifact-root "$HOME/agent-artifacts/ui-audits" \
  --tested-repo "/path/to/tested-repository"
```

Contract:

- Require `--feature` and `--mode`; mode is `focused`, `journey`, or `rollout`.
- Treat `--artifact-root` as the parent that will contain
  `<feature-slug>/<timestamp>/`; default to
  `~/agent-artifacts/ui-audits`.
- Accept optional `--tested-repo`; require it when the target has a local
  repository so path safety and final baseline checks can be enforced.
- Accept optional `--timestamp` only in UTC `YYYYMMDDTHHMMSSZ` form for
  deterministic tests; otherwise generate the current UTC timestamp.
- Normalize the feature to lowercase hyphen-case, collapse separators, trim
  punctuation, and fall back to `ui-audit` when no useful characters remain.
- Create a collision-safe directory by appending `-2`, `-3`, and so on; never
  overwrite an existing file.
- Before writing, resolve the canonical tested-repo path and the canonical
  nearest existing ancestor of the proposed workspace, then reconstruct the
  proposed canonical workspace path. Refuse any case where the final workspace
  and tested repo are equal or either is a descendant of the other. Apply this
  check through symlinked artifact roots and tested-repo paths; checking only the
  parent artifact root is insufficient.
- Create `screenshots`, `traces`, `downloads`, and `logs`.
- Copy `assets/templates/audit-brief.md` and `assets/templates/report.md` to the
  workspace root.
- Resolve templates relative to the installed skill directory.
- Emit exactly one compact JSON object to stdout on success. Send input or
  filesystem diagnostics to stderr only:

```json
{
  "workspace": "/home/user/agent-artifacts/ui-audits/direct-order/20260715T120000Z",
  "featureSlug": "direct-order",
  "mode": "journey",
  "timestamp": "20260715T120000Z"
}
```

Exit codes:

- `0`: workspace initialized
- `2`: invalid arguments, mode, timestamp, or unsafe path
- `3`: template, filesystem, or unexpected initialization failure

Use only Node standard-library APIs.

## Token-Friendly Rules

- Keep `SKILL.md` procedural and approximately 100-150 lines.
- Put detailed evidence, verdict, and severity policy in a one-level reference.
- Keep copy-only output templates in `assets/templates/`; do not load their full
  contents merely to invoke the skill.
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
- mutate production in v1
- guess startup commands, credentials, workflow actions, or success criteria
- clear databases or delete user data to recover a test
- audit API endpoints directly
- test endpoints by driving Swagger UI unless Swagger UI itself is the target

## Future `audit-api` Sibling

API endpoint testing should be a separate `audit-api` skill with similar safety,
artifact, verdict, credential, and report conventions. Its tool and endpoint
contracts require a separate design. Do not implement `audit-api` as part of the
first `audit-ui` task.

## Validation Plan

### Skill structure

- Validate frontmatter and naming with the skill-creator quick validator.
- Confirm the body contains no repository-specific paths, actors, ports, enums,
  or domain rules.
- Confirm the description covers focused checks, screenshots, journeys, QA, and
  rollout triggers while excluding one-off browser operations, source-only
  review, and fixes.
- Generate and validate `agents/openai.yaml`; confirm the skill does not depend
  on that file at runtime.

### Helper scripts

- Run Node tests for healthy, unhealthy, redirect, timeout, and malformed service
  definitions.
- Verify required/optional behavior, JSON output, exit codes, and URL credential
  and query-value redaction.
- Run Node tests for slug normalization, timestamps, collision handling, template
  copying, mode validation, unsafe tested-repo roots, ancestor-root/slug
  collisions, symlinked overlap, traversal refusal, JSON output, exit codes, and
  temporary-HOME/artifact-root isolation.
- Smoke-test both helpers against a temporary local HTTP server and temporary
  artifact root.

### Repository integration

- Run `sh -n bin/link-skills.sh`.
- Run `bin/link-skills.sh` and confirm `audit-ui` links into all five supported
  skill directories.
- Verify the README directory tree, Skills table, and usage guidance.
- Confirm no unrelated current-branch changes are included in the skill commit.
- Treat linking as instruction availability only; verify runtime browser
  capability independently during the smoke audit.

### Runtime smoke test

- Run one small read-only focused audit after installation.
- Verify browser-capability routing, Playwright CLI working directory, tested-repo
  baseline preservation, isolated session cleanup, screenshot budget, report
  initialization, evidence links, verdict precedence, and service cleanup.
- Use the first real complex feature audit as a forward test and revise the skill
  only when observed friction justifies it.

## Completion Criteria

The first implementation is complete when:

- `audit-ui` is present with the approved structure and framework-agnostic body
- `agents/openai.yaml` is valid optional metadata and not a runtime dependency
- both helper scripts and tests pass
- the brief and report templates contain no unresolved placeholders beyond
  intentional template tokens
- README and link-script wiring are complete
- the skill is linked into all supported global locations
- validation and a focused read-only smoke audit pass
- the smoke-tested application repository matches its baseline status after the
  audit
- the user has reviewed and accepted the skill behavior

## Open Questions

None. API auditing is intentionally deferred to the separate `audit-api` design.
