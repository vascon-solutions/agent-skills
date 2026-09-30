---
name: docker-app-verify
description: Coordinate a configured agent-devbox environment for real UI or API feature verification, retain audit evidence, and clean up owned resources. Use when runtime acceptance needs a supported Docker environment.
---

# Docker Application Verification

Use an available agent-devbox installation for repositories it supports. This skill owns environment lifecycle coordination; [audit-ui](../audit-ui/SKILL.md) and [audit-api](../audit-api/SKILL.md) own interactions, evidence and verdicts. Preserve the caller's acceptance scope, delivery endpoint and authorization.

## Resolve The Environment

Read repository instructions and the feature's acceptance criteria. Locate the runner from supplied context or an available `agent-devbox` command. For a supplied source installation, use its documented Node entrypoint. Confirm installed capabilities through help, discovery and the selected adapter's documentation. Do not assume a machine path, install the runner, provision images or create project configuration implicitly.

Discover the candidate checkout through the runner's protected project catalog or use an explicitly supplied protected config. Confirm the repository identity, selected UI/API/shared inputs and evidence destination. Do not select projects by directory name or guess dependencies. A missing mapping means the repository is unsupported. Ambiguous mappings or invalid configuration remain blockers until resolved.

If the runner is absent or the project is unsupported, retain the caller's documented execution path unless Docker verification was explicitly required. A configured run that fails readiness, admission or ownership checks remains a reported blocker; do not bypass it with an unmanaged executor or another registry.

Read [the lifecycle guide](references/lifecycle.md) before execution. Project components, personas, fixtures, routing, data initialization, logout evidence and remote limitations belong to the installed runner's adapter/configuration and authoritative project docs. Select only supported components needed to serve the candidate. Reuse a supplied environment when its source, ownership and capabilities match the task.

## Hand Off Feature Acceptance

Supply the handoff contract in the lifecycle guide. Include candidate source identities, required checkpoints, auditor-reachable URLs, executor coverage and restrictions, actors and protected credential references, allowed data changes, evidence directory and cleanup owners. Add feature scenarios to the generated brief. Readiness alone proves neither candidate source nor behavior.

Select `audit-ui` for visible flows and relevant usability; select `audit-api` for operation contracts, permissions and durable business behavior. Use both only when their checkpoints protect distinct requirements. Correlate shared record identifiers and run dependent steps sequentially. UI state changes must follow visible application flows.

Use the supplied Docker executor for checks it supports. Determine API operation, authentication, mutation, assertion and persistence support before executing a feature journey. A capability flag or schema probe alone does not establish this coverage. An alternative executor must be explicitly selected in the brief, documented as reachable, authorized and compatible with the runner's admission and ownership contract. Otherwise mark unsupported checks unverified; never reduce the acceptance scope to obtain `PASS`.

## Preserve Evidence And Close

Use one external evidence directory for the brief, reports, source/image receipts and cleanup outcomes. When both audit types run, keep separate reports and a combined checkpoint verdict. Preserve failed and blocked evidence.

Auditors close their own task sessions or exact audit leases. The lifecycle owner stops only environments it created, including queued or failed starts, and verifies completion through the installed runner's status and cleanup receipts. Borrowed persistent services remain running. Perform cleanup even after audit failure or interruption; report residue separately from behavioral results.

Follow the runner's account exclusivity and documented logout evidence. Uncertain authentication cleanup stays quarantined where the runner requires it. Do not reset sessions, change account aliases, lower resource guards or remove registry records to proceed. Recovery requires a verifiably dead exact owner.

Choosing a documented managed environment can include its authorized data initialization and teardown. It does not authorize resetting shared data, rebuilding fixtures, changing persistent base services, remote installation, source transfer or public exposure. Unsupported needs remain explicit gaps.
