# Audit API Skill Design

Date: 2026-07-15
Status: Proposed for user review
Target repository: `~/agent-skills`
Proposed skill name: `audit-api`
Source mode: user brief + approved `audit-ui` sibling conventions + independent
spec review

## Objective

Create a global, framework-agnostic `audit-api` skill for evaluating running
HTTP APIs through direct protocol interaction. The skill should support focused
endpoint checks, authenticated multi-request journeys, role and permission
matrices, selected OpenAPI surface audits, negative cases, and rollout-readiness
assessment without changing application source code.

The default implementation should be fast and token-friendly. It should prefer
Hurl for stateful request chains, retain curl as a portable fallback, start only
explicitly configured services, collect bounded redacted evidence, verify
persisted outcomes, and write a durable Markdown report under
`~/agent-artifacts/api-audits/`.

## Problem Statement

API audits currently require repeated prompt instructions for how to:

- locate the authoritative OpenAPI or Swagger contract
- select only the endpoints relevant to a feature
- authenticate multiple actors without leaking credentials
- execute dependent requests and reuse returned identifiers
- distinguish expected negative responses from defects
- prove that mutations persisted instead of trusting a success response
- start missing local services without guessing commands
- avoid turning Swagger UI into a slow browser-driven API client
- preserve compact evidence without dumping sensitive response bodies
- produce consistent findings, severities, and verdicts

Hurl and curl already own HTTP execution. OpenAPI already describes endpoint
shape. The missing capability is a portable audit conductor that defines scope,
safety, coverage, evidence, and completion. The skill must orchestrate those
tools rather than recreate an HTTP client, schema fuzzer, or repository test
suite.

## Naming And Boundary

Use `audit-api` as the sibling of `audit-ui`.

The skill owns runtime API evaluation when checkpoints, findings, or a verdict
are required. A request only to make one HTTP call remains ordinary curl or
terminal work. A request to inspect Swagger UI as a web interface belongs to
`audit-ui`. A request to implement fixes, generate repository tests, perform a
penetration test, or run a load test requires a separate task and toolchain.

The skill description should make that boundary explicit:

> Audit running HTTP APIs through OpenAPI-guided endpoint checks, authenticated
> request journeys, negative cases, persistence verification, and
> evidence-backed reporting. Use for focused endpoint evaluation, role-based API
> workflows, selected contract surfaces, exploratory QA, or rollout readiness
> when checkpoints, findings, or a verdict are required. Not for one-off HTTP
> requests, Swagger UI testing, source-only review, security penetration tests,
> load tests, or implementing fixes.

## Core Decisions

- Scope: global and repository-agnostic.
- Mutation boundary: audit-only; never implement application fixes.
- Input: natural-language prompt with an optional Markdown audit brief.
- Contract source order: OpenAPI/Swagger, explicit endpoint brief, repository
  documentation, then bounded source inspection only to resolve ambiguity.
- Primary executor: Hurl 6.1 or newer for chained workflows, secret-aware
  captures, and assertions.
- Fallback executor: curl for probes, simple checks, and environments without
  Hurl.
- Tool installation: no automatic installation during an audit.
- Local workstation setup: install Hurl once during implementation because the
  user explicitly approved it.
- OpenAPI processing: detect Swagger/OpenAPI version, resolve effective operation
  metadata, use `jq` for JSON, and use only a recognized compatible `yq` for
  YAML; do not implement or vendor a YAML/OpenAPI parser.
- Evidence: compact request/result metadata plus bounded redacted excerpts.
- Output: durable Markdown artifact plus concise chat summary.
- Artifact root: `~/agent-artifacts/api-audits/<feature>/<timestamp>/`.
- Verdicts: `PASS`, `PARTIAL`, `BLOCKED`, or `FAIL`.
- Failure behavior: retry safe reads and explicitly idempotent calls once when
  transient; reconcile uncertain mutation outcomes before any replay and
  continue independent checks.
- Generated scenarios: task-scoped audit artifacts, not repository tests.
- Environment safety: state-changing calls only in local or explicitly approved
  test/staging environments; production is strictly read-only.
- Cleanup: stop only services started by the audit and delete ephemeral secret
  material.
- Success criteria: explicit-first with bounded inference.
- Default coverage: one primary success path plus one risk-based negative case.
- Subagents: not part of the default audit.

## Existing Tool And Skill Fit

### Hurl

Hurl owns multi-request HTTP sessions, captures, assertions, variables, secret
redaction, and test execution. `audit-api` should generate the smallest useful
task-scoped Hurl scenario and must not duplicate the full Hurl manual in
`SKILL.md`. Secret injection and dynamic-capture redaction require Hurl 6.1 or
newer.

### curl

curl owns portable HTTP transfer and remains the zero-specialized-tool fallback.
It is also appropriate for readiness probes and single independent requests.
Fallback use must preserve the same credential, evidence, timeout, and verdict
rules as Hurl.

### OpenAPI and Swagger

OpenAPI is a contract and discovery source, not the executor. The skill should
prefer a machine-readable document or endpoint over reading rendered Swagger UI.
It should filter the contract to the requested tag, path, operation, or journey
instead of loading the entire document into conversation.

### `audit-ui`

`audit-ui` owns browser-visible flows, critical-page screenshots, and UI/UX
assessment. `audit-api` owns direct protocol behavior. Cross-layer confirmation
requires two explicit audits rather than silently broadening either skill.

### API standard and review skills

Stack standards such as `nestjs-api-standard` and implementation-review skills
own source-oriented architecture or code review. `audit-api` reports observed
runtime behavior and does not infer compliance from code alone.

### Schemathesis and other specialized tools

Property-based schema testing, fuzzing, Postman/Newman collections, security
scanners, and load tools are optional extensions only when explicitly requested
and already approved for the environment. They are not default dependencies or
silent fallbacks.

## Alternatives Considered

### Curl-only conductor

Curl is widely available and excellent for focused calls, but repeated shell
escaping, response parsing, identifier capture, and assertions become fragile
for stateful journeys. It remains the fallback rather than the primary journey
executor.

### Hurl-first conductor

Hurl expresses request chains, captures, and assertions compactly while staying
close to HTTP. It produces reproducible audit evidence without requiring a GUI
or general-purpose test framework. This is the selected approach, with curl
retained for portability.

### Schema-fuzz-first framework

Generating broad property-based cases from OpenAPI can discover edge cases, but
it is slower, noisier, dependent on schema quality, and poorly matched to
business-state journeys. It remains an explicit deep-audit extension.

### Combined UI/API audit skill

A combined skill would broaden triggering, load irrelevant instructions, and
encourage API verification through a browser. The skills should remain separate
and share conventions rather than runtime dependencies.

## Audit Modes

The skill should choose the smallest mode that satisfies the request and record
the choice in `audit-brief.md`.

### Focused mode

Use for one endpoint or a small named operation group.

- Exercise only named operations and prerequisites.
- Verify expected status, content type, relevant headers, and required fields.
- Add one risk-based negative case when it is safe and useful.
- Verify persistence after a mutation when a read surface exists.
- Do not inventory or execute unrelated contract operations.

### Journey mode

Use for a stateful API workflow.

- Execute the primary chain through its terminal state.
- Capture and reuse identifiers through Hurl captures.
- Verify role or actor transitions explicitly in scope.
- Confirm the terminal state with an independent follow-up read.
- Add one risk-based negative or invalid-transition case by default.

### Rollout mode

Use for acceptance, readiness, sign-off, release, or rollout assessment.

- Require an explicit path set, OpenAPI tag set, actor matrix, or acceptance
  brief.
- Execute every required scenario in that selected surface.
- Treat any required unverified behavior as non-pass.
- Include an explicit rollout-readiness recommendation.
- Never interpret rollout mode as permission to test the entire API implicitly.

## Coverage Contract

Default coverage should include, when relevant:

- expected status and content type
- required response fields and high-value schema constraints
- business-significant headers such as location, pagination, caching, or retry
- primary authenticated success behavior
- one risk-based negative case chosen from validation, authorization, not-found,
  conflict, or invalid transition behavior
- mutation persistence through a separate retrieval or relationship query
- explicit actor or permission boundaries named in scope
- bounded polling for asynchronous operations with a defined terminal state
- synthetic, uniquely named test data
- response duration as an observation, not a performance conclusion

Idempotency, concurrency, rate limiting, webhooks, eventual consistency, file
transfer, GraphQL, SOAP, or streaming behavior should be included only when the
feature or contract makes them relevant. The default audit is not exhaustive
schema validation, penetration testing, fuzzing, or load testing.

## Proposed Skill Structure

```text
skills/audit-api/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── scripts/
│   ├── probe-services.mjs
│   ├── probe-services.test.mjs
│   ├── init-api-audit-workspace.mjs
│   └── init-api-audit-workspace.test.mjs
├── references/
│   ├── evidence-and-verdicts.md
│   └── hurl-execution.md
└── assets/
    └── templates/
        ├── audit-brief.md
        └── report.md
```

Repository-only conformance support should also include:

```text
tests/
├── audit-helper-conformance.test.mjs
├── audit-executors.test.mjs
└── fixtures/
    ├── api-audit-fixture.mjs
    └── contracts/
        ├── swagger-2.json
        ├── swagger-2.expected.json
        ├── openapi-3.json
        ├── openapi-3.expected.json
        ├── openapi-3.1.yaml
        ├── openapi-3.1.expected.json
        ├── unresolved-external-ref.json
        └── unresolved-external-ref.expected.json
```

The helper suite must be parameterized so one implementation can run against the
shared contract independently. `audit-api` must pass it. When `audit-ui` is also
present, run the same suite against that implementation and compare shared
behavior; absence of the sibling must not block `audit-api`. The disposable API
fixture must use only Node standard-library APIs and bind to a random loopback
port.

The contract fixtures and paired expected inventories are forward-test inputs
for agent behavior, not Node unit-test subjects. They make version, inheritance,
and unresolved-reference reasoning reviewable without adding an OpenAPI parser.

Repository integration also requires:

- add `audit-api` to `SKILL_NAMES` in `bin/link-skills.sh`
- add the skill to the README directory tree and Skills table
- add a concise README usage example for runtime API audits
- run the link script so all five supported tool locations receive the skill
- generate and validate `agents/openai.yaml` as optional Codex UI metadata
- add the repository-only shared helper and executor conformance fixtures

The skill is self-contained and must not require `audit-ui` to be installed.
Small helper duplication is preferable to a brittle cross-skill runtime
dependency. A parameterized repository test may compare both implementations
when present, but neither skill may depend on its sibling at runtime or for
standalone completion.

## Input Contract

Accept a natural-language request and optionally a Markdown audit brief.

Resolve instructions in this order:

1. explicit user instructions
2. supplied audit brief or acceptance criteria
3. machine-readable OpenAPI/Swagger contract
4. authoritative repository instructions and documentation
5. bounded source inspection only to resolve ambiguity

The resolved audit contract should include, when relevant:

- feature and audit mode
- environment classification and base URL
- readiness URLs and explicit startup commands with working directories
- OpenAPI source and selected tags, paths, or operations
- actor roles and secure credential sources
- primary journey and negative variation
- request data sources and uniqueness strategy
- expected checkpoints and terminal conditions
- allowed mutations and cleanup behavior
- timeouts and asynchronous polling bounds
- artifact-root override

Ask one focused question before execution only when environment safety, mutation
authority, authentication, selected endpoint surface, or terminal outcome is
materially ambiguous. Record minor assumptions rather than expanding the prompt
exchange.

## Environment Safety

- Classify the environment as local, test, staging, or production before calls.
- Permit mutations only in local or explicitly approved test/staging systems.
- Treat production as strictly read-only based on operation semantics, not HTTP
  method alone. A POST-based search may be read-only; a GET with side effects is
  not safe merely because it is GET.
- Refuse production mutation even when credentials permit it.
- Never reset databases, delete unrelated records, disable validation, weaken
  authentication, or invoke destructive administrative recovery.
- Run cleanup calls only when they are explicitly safe, scoped to records created
  by this audit, and authorized by the brief.
- Document created record identifiers when cleanup is not permitted or reliable.

## Artifact Contract

Default workspace:

```text
~/agent-artifacts/api-audits/<feature>/<timestamp>/
├── audit-brief.md
├── report.md
├── contracts/
├── scenarios/
├── evidence/
└── logs/
```

`audit-brief.md` is the compact resolved execution contract. `report.md` is the
durable result and must remain useful without the chat transcript.

`contracts/` should contain a filtered operation inventory or safe contract
copy only when useful. Do not persist a private full contract by default.

`scenarios/` contains task-scoped `.hurl` files with no secrets. These are audit
artifacts, not generated repository tests.

`evidence/` contains compact checkpoint metadata and bounded redacted excerpts.
Raw response bodies are temporary by default.

`logs/` contains sanitized tool summaries and diagnostics. Full verbose HTTP
traces are not default evidence.

## Runtime Workflow

### 1. Intake

- Read repository source-of-truth instructions and only relevant API docs.
- Determine focused, journey, or rollout mode.
- Confirm audit-only scope and environment safety.
- Resolve success criteria, selected operations, actors, and assumptions.

### 2. Workspace initialization

- Run `init-api-audit-workspace.mjs` with feature and mode.
- Complete `audit-brief.md` from the resolved contract.
- Record the tested repository baseline when one exists.
- Keep all artifacts outside the tested repository.

### 3. Service preflight

- Probe configured readiness URLs concurrently.
- Do not guess health URLs or startup commands.
- Start only unavailable services with commands supplied by the prompt, brief,
  or authoritative repository docs.
- Track each process started by the audit and re-probe before execution.

### 4. Contract discovery

- Prefer a machine-readable OpenAPI document or endpoint.
- Record its source and a content hash or stable version identifier.
- Detect and record whether the document is Swagger 2.0, OpenAPI 3.0, or OpenAPI
  3.1 before deriving requests.
- For Swagger 2.0, resolve effective `schemes`, `host`, `basePath`, path and
  operation parameters, `consumes`, `produces`, security, body/form inputs, and
  responses relevant to scope.
- For OpenAPI 3.x, resolve effective root/path/operation servers, inherited and
  overridden parameters and security, request-body content/schema, response
  content/schema, and relevant local references.
- Treat operation-level security and servers as overrides where the contract
  version defines them; do not flatten only operation-local fields.
- Record unresolved external, recursive, or multi-document references as
  unverified instead of inferring them.
- For JSON, use `jq` only after this version and inheritance model is understood,
  and filter the resolved inventory to the requested scope.
- For YAML, first identify the installed `yq` implementation and version, use
  only a verified command that converts the full document to valid JSON, then
  process that JSON. Do not assume all executables named `yq` share syntax.
- If YAML tooling is unavailable, perform a bounded manual inspection for named
  operations. For broad rollout inventory, ask for JSON or return `BLOCKED`
  rather than implementing a partial YAML parser.
- Do not assume that a contract server URL overrides an explicitly supplied base
  URL.
- Do not execute examples blindly; validate their safety and replace real data
  with synthetic values.

### 5. Executor selection

- Check for Hurl and record its version. Hurl is eligible for authenticated or
  secret-bearing scenarios only when it is version 6.1 or newer or passes a
  local secret-redaction capability probe.
- Prefer Hurl for dependent requests, captures, assertions, and role journeys.
- Use curl for readiness probes, small independent checks, or fallback when Hurl
  is unavailable.
- Do not install tools during the audit.
- Return `BLOCKED` only when neither executor can satisfy required coverage.
- Disclose fallback use and any resulting evidence limitation.

### 6. Scenario construction

- Generate the smallest scenario set that covers the resolved contract.
- Keep dependent steps in one Hurl file and independent scenarios separate.
- Use stable synthetic values and capture server-generated identifiers.
- Mark every captured access token, refresh token, cookie, CSRF value, signed
  URL, or reusable authentication value with Hurl's `redact` capture modifier.
- Assert business-significant results, not every incidental response field.
- Keep all scenarios in the artifact workspace.

### 7. Execution and verification

- Execute the primary success path.
- Execute the selected negative or permission case.
- Verify mutations through an independent retrieval or relationship query.
- Poll asynchronous state only within the configured bound.
- Record actual status, relevant fields, duration, and concise evidence.
- Keep "not tested" distinct from "tested and failed."

### 8. Failure handling

- Retry a potentially transient safe read or explicitly idempotent operation at
  most once.
- Never automatically replay a non-idempotent mutation after a timeout,
  connection loss, assertion failure, or ambiguous response.
- First reconcile an uncertain mutation through a safe read using its
  idempotency key, synthetic uniqueness key, correlation identifier, or returned
  relationship. Replay only when the operation has a verified idempotency key or
  the brief explicitly authorizes that exact retry.
- If mutation outcome cannot be reconciled safely, record it as unverified and
  apply the verdict model instead of guessing or replaying.
- Do not retry deterministic validation, authorization, conflict, or contract
  failures without changing an explicitly invalid input.
- For a uniqueness collision, generate one new synthetic value and retry once.
- Continue independent checks after recording a failed dependency.
- Avoid repeated calls against unchanged failing state.

### 9. Report and cleanup

- Apply the strict verdict precedence.
- Finish `report.md` and verify every evidence link exists.
- Delete ephemeral credential files and raw response bodies.
- Stop only services started by the audit unless asked to leave them running.
- Confirm the tested repository matches its baseline status.
- Preserve sanitized evidence for failed and blocked audits.
- Return a concise chat summary with the report path and highest-impact findings.

## Hurl Execution Contract

- Run Hurl from the audit workspace and reference scenario files by absolute or
  workspace-relative path.
- Require Hurl 6.1 or newer, or a successful local capability probe, before using
  injected secrets or redacted captures. Otherwise choose a safe curl fallback
  or return non-pass when required coverage cannot be protected.
- Use test mode for assertions; do not use ordinary response-output mode for an
  audit because response stdout is not a durable redaction boundary.
- Use `--jobs 1` for dependent or stateful scenarios. Parallelize only files
  proven independent.
- Apply bounded connect and total timeouts from the brief, with conservative
  defaults when none are supplied.
- Store nonsecret variables in a task-scoped variables file when useful.
- Supply secrets through `HURL_SECRET_<name>` environment variables or a
  permission-restricted temporary secrets file outside durable evidence.
- Do not place secrets in `--secret` command arguments, scenario files, URLs,
  reports, or preserved logs.
- Append `redact` to every capture of a dynamic token, cookie, CSRF value,
  signed URL, or reusable authentication value. Do not assert, print, interpolate
  into evidence, or otherwise expose the captured value except where needed in a
  subsequent request.
- Do not use verbose or very-verbose output by default.
- Do not use long error output when a response may contain credentials or other
  sensitive values.
- Do not generate Hurl JSON or HTML reports by default because they may persist
  complete responses.
- Do not use global Hurl retry in a journey containing mutations. Use per-entry
  bounded retry only for safe reads, explicitly idempotent calls, or polling.
- Permit mutation retry only under the reconciliation and idempotency rules in
  the runtime failure contract.
- Do not disable TLS verification except for an explicitly approved local/test
  certificate constraint; never do so for production.
- Treat Hurl output as sensitive until it has been reviewed and sanitized.
- If Hurl cannot express a required protocol behavior, disclose the limitation
  and use an approved specialized tool rather than manufacturing a pass.

During implementation on the current macOS workstation, install Hurl with the
official Homebrew command and verify `hurl --version`. This is workstation setup,
not an automatic runtime behavior or repository dependency.

## Curl Fallback Contract

- Put `--disable` first so user curl configuration cannot silently change audit
  behavior.
- Restrict initial and redirected protocols to HTTP and HTTPS and reject URL
  userinfo.
- Use silent-but-error-visible output, explicit connect and total timeouts, and
  structured write-out metadata.
- Do not follow redirects for endpoint assertions by default. Assert the 3xx and
  `Location` value as the contract result.
- When redirect traversal is required, issue each hop explicitly after validating
  its scheme, origin, `Location`, and expected method behavior. Do not use curl's
  automatic redirect traversal for audited endpoint behavior; it cannot enforce
  a general same-origin allowlist before each hop and may silently change POST to
  GET for 301, 302, or 303.
- Do not use a failure mode that treats expected 4xx negative cases as transport
  failures before their bodies and statuses can be evaluated.
- Put sensitive headers or URLs in a permission-restricted temporary curl config
  or equivalent non-argument channel; delete it during cleanup.
- Keep synthetic request bodies in the workspace and secret values outside them.
- Capture response headers and bodies to temporary files, inspect only what is
  needed, then retain bounded redacted evidence.
- Never print a command containing credentials into chat or logs.
- Do not use global curl retry for a sequence containing mutations. Apply the
  same safe-read, idempotency, reconciliation, and polling rules as Hurl.
- Do not use insecure TLS mode except under the same explicit local/test rule as
  Hurl.
- Curl fallback must not reduce required assertions merely to obtain a pass.

## Evidence Rules

- Preserve a checkpoint matrix rather than full exchanges.
- Record method, redacted display URL, actor, expected result, actual status,
  duration, and evidence reference.
- Replace URL credentials and query values that may contain secrets.
- Preserve only response fields material to the assertion or finding.
- Avoid full headers; redact authorization, cookies, set-cookie, API keys,
  signed URLs, and correlation data that exposes internal systems.
- Treat dynamic captures as secret at capture time; later report sanitization is
  not a substitute for preventing them from entering logs or tool output.
- Treat contracts, raw bodies, tool reports, and trace output as sensitive local
  material.
- Do not retain refresh tokens, access tokens, passwords, cookies, secret-file
  contents, or reusable authentication state.
- Use synthetic data where possible and avoid unrelated personal data.
- Do not capture screenshots unless Swagger UI itself is the audit target; use
  `audit-ui` for that case.

## Failure Classification

Classify each interruption as one of:

- `environment`: service, dependency, database, configuration, or DNS unavailable
- `authentication`: missing, expired, rejected, or unusable credentials
- `authorization`: actor can access a forbidden operation or cannot access an
  expected one
- `test-data`: prerequisite missing, uniqueness collision, or consumed state
- `contract`: status, content type, field shape, or documented behavior differs
- `validation`: invalid input is accepted or produces incorrect error behavior
- `functional`: required business behavior or state transition is incorrect
- `data-integrity`: persisted, related, or returned data is inconsistent
- `automation`: Hurl, curl, parsing, or protocol tooling cannot express the check
- `external`: third-party or asynchronous dependency prevents progression

Record duration anomalies as observations unless an explicit threshold makes
them required failures. Do not label a runtime defect as merely a contract
documentation problem without evidence.

## Verdict Model

Apply verdicts in this order:

1. `FAIL` when any exercised required behavior is proven incorrect.
2. `PASS` when all required checks are proven and none failed.
3. `BLOCKED` when no meaningful required coverage completed because access,
   environment, tooling, contract, or prerequisites prevented execution.
4. `PARTIAL` when meaningful required coverage completed but one or more
   remaining required checks are unverified or blocked and no exercised required
   behavior failed.

For focused mode, the verdict applies only to named checks. For rollout mode,
any required unverified scenario prevents `PASS`.

## Severity Model

- `blocker`: required journey cannot complete, critical authorization or data
  integrity failure, unsafe behavior, or invalid audit evidence
- `major`: required endpoint behavior is wrong or a high-impact role boundary
  fails
- `moderate`: recoverable contract, validation, consistency, or workflow defect
- `minor`: low-impact documentation inconsistency or bounded API ergonomics issue

Do not downgrade security-sensitive authorization or data-integrity defects
because a client can work around them.

## Report Contract

The report should contain:

1. overall verdict and rollout-readiness recommendation when requested
2. scope, mode, environment, base URL, and assumptions
3. contract source, version or hash, and selected operation inventory
4. executor, versions, services, and startup actions
5. actor/endpoint/checkpoint matrix
6. expected and actual status, fields, headers, and timing
7. created test-record identifiers and cleanup status
8. findings ordered by severity and category
9. compact redacted evidence links
10. unverified or blocked areas
11. recommended regression scenarios
12. service, credential, artifact, and repository cleanup outcome

Each finding should include severity, actor, method/path, step, expected behavior,
actual behavior, concise reproduction, evidence, and release impact.

The report may recommend Hurl scenarios, contract corrections, repository tests,
or stable test data. It must not modify application code, contracts, collections,
or test suites unless the user separately requests implementation.

## Service Lifecycle

`audit-api` may start services because startup is a normal prerequisite for
local or test API auditing, but it must use only explicit commands.

The skill should:

- record readiness URL, command, working directory, and whether the process
  pre-existed
- start services only in controllable foreground sessions or process groups and
  record the returned handle
- never daemonize with `nohup`, use generic `pkill`, or kill whichever process
  happens to own a configured port
- wait for readiness instead of assuming startup succeeded
- avoid duplicate servers on occupied ports
- stop only processes it started
- attempt cleanup after interruption when the runtime permits it
- ask the user to start the service or return `BLOCKED` when no controllable
  process handle is available
- record cleanup failures without deleting evidence

## Helper Script Contracts

### `probe-services.mjs`

Invocation:

```bash
node scripts/probe-services.mjs \
  --service "api=http://127.0.0.1:3040/health" \
  --optional-service "openapi=http://127.0.0.1:3040/api-json" \
  --timeout-ms 5000
```

Contract:

- Require at least one `--service` or `--optional-service` in `name=url` form.
- Treat `--service` as required and `--optional-service` as informational.
- Require unique nonblank names and absolute `http:` or `https:` URLs.
- Accept repeatable `--allow-nonsecret-query <name>` only for a defined service
  name. Reject duplicates and unknown names.
- Reject URL username/password components. Reject query-bearing URLs by default;
  accept one only when its service name is explicitly listed by
  `--allow-nonsecret-query`, which asserts that every query value is safe to
  expose through process arguments. Use authenticated Hurl/curl readiness checks
  through their secret channels when authentication is required.
- Default `--timeout-ms` to 5000; accept 250-30000 milliseconds.
- Probe all services concurrently with `GET`, follow at most three same-origin
  HTTP/HTTPS redirects, and consume no more response data than needed to
  establish reachability. Treat unsafe, cross-origin, or excessive redirects as
  `error: "http"`.
- After the redirect policy succeeds, treat the final HTTP 200-399 response as
  reachable and HTTP 400-599 as `error: "http"`. A redirect-policy violation is
  unavailable regardless of the received 3xx status.
- Emit exactly one compact JSON object to stdout on a valid invocation. Send
  usage and input diagnostics to stderr only.
- Replace every query parameter value with `[REDACTED]` in `displayUrl`; the
  original URL must never be echoed to stdout or stderr.
- Never start, restart, or kill a process.

Output shape:

```json
{
  "ok": true,
  "services": [
    {
      "name": "api",
      "displayUrl": "http://127.0.0.1:3040/health",
      "required": true,
      "reachable": true,
      "status": 200,
      "durationMs": 18,
      "error": null
    }
  ]
}
```

`ok` is `true` exactly when every required service is reachable; optional
service failures do not change it.
`error` is one of `timeout`, `dns`, `connection`, `tls`, `http`, or `unknown`,
and is `null` when reachable.

Exit codes:

- `0`: every required service is reachable
- `1`: one or more required services is unavailable
- `2`: invalid arguments or service definitions
- `3`: unexpected probe/runtime failure that prevents a valid result

Use only Node standard-library APIs.

### `init-api-audit-workspace.mjs`

Invocation:

```bash
node scripts/init-api-audit-workspace.mjs \
  --feature "Spin endpoints" \
  --mode journey \
  --artifact-root "$HOME/agent-artifacts/api-audits" \
  --tested-repo "/path/to/tested-repository"
```

Contract:

- Require `--feature` and `--mode`; mode is `focused`, `journey`, or `rollout`.
- Treat `--artifact-root` as the parent containing
  `<feature-slug>/<timestamp>/`; default to `~/agent-artifacts/api-audits`.
- Accept optional `--tested-repo`; require it when the target has a local
  repository so path safety and final baseline checks can be enforced.
- Accept optional `--timestamp` only in UTC `YYYYMMDDTHHMMSSZ` form; otherwise
  generate the current UTC timestamp.
- Normalize the feature to lowercase hyphen-case, collapse separators, trim
  punctuation, and fall back to `api-audit` when no useful characters remain.
- Create a collision-safe directory by appending `-2`, `-3`, and so on; never
  overwrite an existing file.
- Before writing, resolve the canonical tested-repo path and the canonical
  nearest existing ancestor of the proposed workspace, then reconstruct the
  proposed canonical workspace path. Refuse any case where the final workspace
  and tested repo are equal or either is a descendant of the other. Apply this
  check through symlinked artifact roots and tested-repo paths; checking only the
  parent artifact root is insufficient.
- Create `contracts`, `scenarios`, `evidence`, and `logs`.
- Copy the brief and report templates to the workspace root.
- Resolve templates relative to the installed skill directory.
- Emit exactly one compact JSON object to stdout on success. Send input or
  filesystem diagnostics to stderr only.

Output shape:

```json
{
  "workspace": "/home/user/agent-artifacts/api-audits/spin-endpoints/20260715T120000Z",
  "featureSlug": "spin-endpoints",
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
- Put detailed evidence, verdict, and Hurl safety policy in one-level references.
- Keep copy-only output templates in `assets/templates/`.
- Read feature docs and contract metadata once, then record the resolved brief.
- Filter OpenAPI before bringing content into conversation.
- Do not paste Hurl, curl, OpenAPI, or Swagger manuals into the skill.
- Do not paste full contracts, response bodies, headers, or logs into chat.
- Prefer Hurl captures and assertions over repeated model-side parsing.
- Parallelize only independent service probes and scenarios.
- Keep progress updates to phase, scenario, actor, and blockers.
- Generate deep reports or specialized traces only after a failure justifies them.
- Do not use subagents or multi-agent modes by default.

## Non-Goals

The skill does not:

- implement or fix application code
- modify OpenAPI documents or generated clients
- commit Hurl, Postman, Newman, or repository test files by default
- replace an existing API integration or end-to-end suite
- test APIs by driving Swagger UI
- perform source-only architecture review
- perform penetration, exhaustive fuzz, or load testing by default
- infer permission to mutate production
- guess credentials, startup commands, endpoint scope, or destructive cleanup
- parse arbitrary YAML without an existing capable tool
- claim performance compliance from a small functional audit
- audit browser UI or user experience

## Validation Plan

### Skill authoring discipline

- Run baseline pressure scenarios without the skill before implementing its
  instructions.
- Capture failures around production mutation, secret leakage, whole-contract
  overreach, deterministic retry loops, and treating a 2xx response as proof of
  persistence.
- Forward-test the same scenarios with the skill and close observed loopholes.

### Skill structure

- Validate frontmatter and naming with the skill-creator quick validator.
- Confirm the body contains no repository-specific paths, ports, actors, enums,
  credentials, or domain rules.
- Confirm triggering covers focused endpoints, API journeys, contract surfaces,
  role matrices, QA, and rollout readiness while excluding one-off curl, Swagger
  UI, source review, fixes, security scans, and load tests.
- Generate and validate `agents/openai.yaml`; confirm it is optional metadata.

### Helper scripts

- Run Node tests for healthy, unhealthy, redirect, timeout, malformed, required,
  and optional service probes.
- Verify JSON output, the exact `ok` invariant, exit codes, URL-userinfo
  rejection, default query rejection, explicit nonsecret-query opt-in, query
  redaction, original-URL no-echo behavior, redirect-policy precedence, and
  bounded same-origin redirects.
- Run workspace tests for slug normalization, timestamps, collisions, template
  copying, mode validation, unsafe overlaps, ancestor-root collisions, symlinks,
  traversal refusal, JSON output, and temporary-HOME isolation.
- Smoke-test helpers against a temporary HTTP server and artifact root.
- Run the parameterized repository-level helper conformance suite against
  `audit-api`. When `audit-ui` is present, run the same named cases against it;
  do not make sibling presence an API-skill completion prerequisite.

### Deterministic API fixture

- Build a disposable Node-standard-library server that binds to a random
  loopback port and is started and stopped by tests in a temporary directory.
- Provide controlled endpoints for dynamic login tokens, create and retrieve,
  expected validation failure, bounded asynchronous polling, redirects, and one
  transient read failure.
- Give mutations an observable uniqueness or idempotency key so tests can prove
  that an ambiguous response is reconciled before replay.
- Never use an arbitrary existing application or externally hosted API as the
  executor validation gate.

### Contract discovery forward tests

- Give fresh agents Swagger 2.0, OpenAPI 3.0, and OpenAPI 3.1 fixtures with
  root/path/operation inheritance and compare their bounded inventories with the
  paired expected JSON artifacts.
- Verify each result identifies effective server/base path, parameters,
  security, request media/schema, and expected response metadata for the
  selected operations.
- Verify an operation override replaces the applicable root or path value only
  where the contract version permits it.
- Verify external or multi-document references become explicitly unverified
  rather than silently omitted or guessed.
- Test the detected `yq` implementation and conversion command before YAML use;
  unsupported or invalid conversion must not fall through to partial parsing.
- Treat these as skill forward tests, not Node unit tests; the design deliberately
  adds no custom OpenAPI extractor.

### Hurl and curl execution

- Install Hurl with the official macOS/Homebrew instruction and verify its
  version is 6.1 or newer and run a dynamic-capture redaction capability probe.
- Run a Hurl focused read-only check against the disposable fixture.
- Run a Hurl stateful create-to-retrieve journey with a negative case against
  the fixture.
- Run the same bounded surface with Hurl deliberately unavailable to verify curl
  fallback.
- Verify static and dynamically captured secrets never appear in stdout, stderr,
  constructed argv, scenarios, reports, or durable files.
- Verify expected 4xx responses can be asserted without being misclassified as
  transport failures.
- Verify dependent scenarios run sequentially and independent scenarios may run
  concurrently.
- Verify curl starts with `--disable`, rejects URL userinfo, restricts protocols,
  and does not follow redirects unless the scenario explicitly validates them.
- Verify global retry is absent from mutation journeys and per-entry polling
  retry cannot replay the mutation.

### Safety and verdict smoke tests

- Verify a production mutation request is refused before execution.
- Verify a local/test mutation is followed by an independent persistence check.
- Verify `FAIL`, `PASS`, `BLOCKED`, and `PARTIAL` precedence with controlled
  scenarios.
- Verify a transient safe read retries once, deterministic failures do not loop,
  and an ambiguous mutation is reconciled instead of automatically replayed.
- Verify cleanup deletes ephemeral credential files and stops only audit-started
  services.
- Verify the tested repository matches its baseline after every smoke audit.

### Repository integration

- Run `sh -n bin/link-skills.sh`.
- Run `bin/link-skills.sh` and confirm `audit-api` links into all five supported
  skill directories.
- Verify README tree, Skills table, and usage guidance.
- Confirm the skill commit contains no unrelated current-branch changes.

## Completion Criteria

The first implementation is complete when:

- `audit-api` exists with the approved framework-agnostic structure
- Hurl is installed and verified on the current workstation
- curl fallback remains functional and documented
- `agents/openai.yaml` is valid optional metadata
- helper scripts and tests pass
- repository-level helper and executor conformance fixtures pass for `audit-api`
- templates contain no unresolved placeholders beyond intentional tokens
- README and link-script wiring are complete
- all five global skill links are present
- focused, journey, fallback, production-safety, and secret-hygiene smoke tests
  pass
- audited repositories remain unchanged after smoke tests
- the user has reviewed and accepted the skill behavior

## Open Questions

None. Specialized schema fuzzing, security testing, load testing, generated
repository tests, and combined UI/API orchestration remain explicit future work.
