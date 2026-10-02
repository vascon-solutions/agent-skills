# Generic runtime feature audit integration

## Publication scope

The skill pack coordinates runtime feature acceptance without embedding project recipes. This change updates the environment lifecycle skill, UI/API audit routing, handoff templates and delivery integration. It does not implement a new agent-devbox executor or claim that every feature can run through the current runner.

## Settled responsibilities

- The delivery owner chooses required checkpoints from the task's acceptance criteria and consumes the resulting verdicts. Runtime acceptance does not replace required build/typecheck gates or critical regression protection.
- `docker-app-verify` resolves a supported candidate environment, provides the handoff and owns lifecycle coordination.
- `audit-ui` verifies visible user flows, recovery, persistence after reload and relevant usability through the selected browser.
- `audit-api` verifies operation contracts, validation, authorization, transitions and independent persistence or terminal-state reads through the selected API executor.
- The installed agent-devbox adapter and project configuration define components, dependencies, fixtures, accounts, routing, data initialization and cleanup. The skill pack contains no project-specific defaults.

Use both audit types only for distinct required checkpoints. Shared record IDs connect related evidence; dependent checks run sequentially. UI auditors do not call raw APIs or write directly to databases to advance a scenario.

## Environment selection

Reuse a matching supplied environment. Otherwise prefer available agent-devbox support for the candidate repository. If the runner is absent or the repository unsupported, preserve its documented standalone path unless Docker was explicitly required. Ambiguous mappings, invalid configuration or a configured run's readiness, admission or ownership failure remain blockers rather than permission to bypass the runner.

A supplied executor and external evidence directory override standalone tool preferences and workspace initialization. The audit must establish relevant candidate source identities; an unverified upstream cannot prove acceptance of changed API code. Complete one brief with required checkpoints, reachability, capabilities, actors, authorized data changes and ownership. See [the handoff contract](../../skills/docker-app-verify/references/lifecycle.md).

## Verdict and cleanup boundaries

A required checkpoint that the executor cannot cover remains unverified. Schema/readiness probes cannot substitute for authentication, permission, mutation or persistence checks. Preserve `FAIL`, `PASS`, `BLOCKED` and `PARTIAL` semantics across required checkpoints.

Use one external evidence directory. Combined audits keep separate UI/API reports and a combined checkpoint report. Auditors close their own sessions or exact leases. The lifecycle owner stops only created environments and verifies cleanup completion; borrowed persistent services remain running. Preserve source receipts, sanitized evidence and cleanup failures.

## API executor follow-up contract

Authenticated API feature execution remains a runner follow-up. Its implementation must satisfy these requirements before the skills can use it for full journeys:

- Resolve supported API-only repositories and relevant API/shared candidate sources without requiring an unrelated frontend build.
- Expose specific operation, authentication, mutation, assertion and persistence capabilities. A single API-audit boolean is insufficient.
- Execute bounded contract-selected requests with dependent captures, distinct actor checks, negative cases and separate reads or bounded polling for terminal state.
- Pass credentials through protected ephemeral inputs; redact authorization, cookies, tokens and raw private output from durable evidence.
- Preserve canonical admission, ownership tokens, account/session cleanup and the selected environment's data-isolation contract. Define API session/logout handling as explicitly as browser cleanup.
- Reconcile uncertain non-idempotent mutations before retrying. Refuse unsupported redirects, origins or operations rather than broadening access implicitly.
- Keep only compact checkpoint evidence, identifiers and assertions in the shared audit directory. Report unsupported checks without claiming feature success.

The current inspected runner's bounded schema/missing-route executor does not meet this full contract. This publication records the required extension without adding runtime authentication, arbitrary API writes, infrastructure provisioning or remote execution.
