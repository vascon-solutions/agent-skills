# R2 selective orchestration for task-doc delivery

## Objective

Make the existing delivery workflow choose useful support work and keep straightforward work with its owner. Deliver four canonical support roles and safe Claude Code and Codex adapters, preserving code quality, verification, and authorized completion.

This is one feature-grade delivery in `vascon-solutions/agent-skills`. The target branch is `main`. R2 acceptance proves working behavior, not comparative cost savings.

## Source Context

Source mode is the approved implementation spec and Dee's scope clarification. The scope is task-doc delivery, its review rounds, and explicitly authorized watching. Everyday orchestration, T3 integration, and team onboarding are excluded. T3 supplied research context only.

This document prepares delivery. The current request authorizes task authoring, independent task review, remediation, and a delivery prompt. Implementation begins when that prompt is executed. Its requested endpoint is a ready PR against `main`, with the existing loop's validation and review rules.

## Design Reference

Source Spec: `/Users/dee/agent-artifacts/cross-agent-subagent-roster/markdown/implementation-spec.md`, version 4.2, including the Codex adapter correction.

Source SHA-256 at task creation is `a32323fe1b81828acb3ac2d45420e762d7054e82065c84ebccffaa6e5911c055`.

The spec is authoritative for the R2 contracts. Use sections 7, 9, 10.1, 10.2, 11, and 13 together. Sections 3 and 16 preserve accepted decisions. Section 7.3 owns selective dispatch. Section 12 owns the later measurement boundary. Do not implement the whole spec through this task.

The current decision in `/Users/dee/agent-artifacts/cross-agent-subagent-roster/markdown/r2-orchestration-addendum.md` supplies rationale. Earlier everyday-work proposals in that document are superseded.

## Architecture Summary

The delivery owner remains the single implementation and publication owner. Canonical Markdown role definitions and a shared tier table render into supported native runtime files. One reference under the delivery-loop skill owns dispatch selection, while existing skills retain audit, review, and monitoring behavior. The R1 ledger and R3 review policy remain the existing state and evidence owners.

The renderer translates and installs definitions. It does not become an external execution driver, scheduler, or new agent transport.

## Code Evidence

Evidence below comes from `main` at `bf3cc58d7c10146ebb0f168d96b9cc0ffc36041a`, verified against remote `main` on 2026-09-30. Repository paths in this table refer to that revision, not the older current checkout. Use `git show <revision>:<path>` when comparing them.

| Behavior | Source |
| --- | --- |
| Delivery already uses one helper-managed ledger, imports current spec checks, and distinguishes audit fallback from required independent review. | `skills/task-doc-delivery-loop/SKILL.md`, Establish The Delivery and Review And Remediate |
| Review cycles, delegated reservations, and shape checks are already implemented. | `skills/task-doc-delivery-loop/references/review-policy.md` and `skills/task-doc-delivery-loop/scripts/delivery-ledger.mjs`, `appendChecks` role-runs branch |
| An inline role-run requires a fallback reason. Its successor cannot change that reason or dispatch identity. | `skills/task-doc-delivery-loop/scripts/delivery-ledger.mjs`, `itemProblems` and `subjectProblem`; `tests/delivery-ledger.test.mjs`, F7/N8 cases |
| Required independent review cannot complete through self-review, and a failing audit remains a failure. | `tests/delivery-ledger.test.mjs`, F7 independence and failed-audit cases |
| The skill linker links skill directories and preserves existing conflicting destinations. It has no canonical role renderer. | `bin/link-skills.sh`; main tree has no `agents/` or `bin/link-agents.sh` |
| Delivery-mode implementation review consumes evidence without running duplicate gates. | `skills/review-implementation/SKILL.md`, Context |
| Monitoring owns timing and mutation, and already has a bounded read helper. | `skills/monitor-pr-review/SKILL.md` and `skills/monitor-pr-review/scripts/fetch-pr-review-state.mjs` |
| Installer portability, audit policy, helper conformance, and ledger contracts have existing test owners. | `tests/skills-portability.test.mjs`, `tests/audit-policy.test.mjs`, `tests/audit-helper-conformance.test.mjs`, `tests/delivery-ledger.test.mjs` |

At authoring time, the current branch is `skills/review-delivery-guidance` with unrelated edits. It predates R1 and R3. Do not use its modified implementation files as the R2 baseline.

Read-only executable checks reported Codex CLI `0.146.0` and Claude Code `2.1.285`. Codex also reported a denied PATH-alias setup operation. These version checks do not prove discovery, authentication, model availability, or successful dispatch.

Existing pilot files are `/Users/dee/.codex/agents/ui-auditor.toml` and `/Users/dee/.claude/agents/ui-auditor.md`. Their ownership and content must be inspected before migration.

## Current Behavior To Preserve

- Keep one implementation owner, at most two independent read-only support jobs, and no recursive delegation. Serialize audits sharing an application, persona, or fixtures.
- Preserve candidate identity, evidence reuse, authorization, publication verification, and the existing ledger schema. Nested skills share the owner's claim.
- Keep required independent review independent. Preserve R3 cycle bounds, reservations, and repository delegate limits.
- Audit failure is a product result, not a reason to mark a crashed role successful. Missing capabilities remain explicit limitations.
- Keep explicit model and effort choices authoritative and resolve them independently. Unknown observed settings remain unknown.
- Preserve standalone and no-ledger skill behavior already supported by the pack. This task adds no global everyday-work routing.
- Keep the existing pilot for each runtime until its replacement passes that runtime's required probes. Preserve unowned files and user modifications.

## Prerequisites

Start from current remote `main`, retaining its merged R1 and R3 implementations. Verify the target and baseline again at execution time. Use a safe checkout selected by the delivery loop, with isolation when needed for unrelated changes.

The task source is currently an uncommitted document in `/Users/dee/agent-skills/docs/tasks/`. If delivery uses another checkout, read this exact source and carry only this task document into the matching task path there. Do not copy unrelated dirty changes. The source spec and review report remain readable external inputs on this host.

Live R2 probes require authenticated Claude Code and Codex clients, access to the requested models, and a safe fixture environment. Inspect available discovery and dispatch controls before choosing adapters. Do not infer these capabilities from executable versions alone.

R1's prescribed live handoffs and full R3 acceptance are still incomplete in the recorded evidence. Carry these gaps forward without claiming acceptance. They are not additional R2 deliverables or a reason to reimplement R1 or R3. A concrete defect that prevents R2 use is a dependency blocker to diagnose and resolve within established scope or report specifically.

There are no declared sibling repository or generated consumer dependencies. Recheck before implementation. Use the active delivery checkout's maintained skill revisions and sibling references, not stale copied instructions from the older checkout.

## Scope

### Canonical roles and model policy

Create the four roles from spec section 10's layout and frontmatter contract. Preserve the modes and owning skills in section 7.2. Keep `auditor`, `reviewer`, `scout`, and `watcher` as support roles only.

Preserve the provisional tier table in section 9 and probe actual availability. Keep the mode-specific tier selection, independent model and effort overrides, and bounded escalation. Runtime probes must distinguish requested settings from observed settings.

Codex generated role files must omit model and effort pins. The owner supplies resolved settings through supported dispatch controls. Claude follows section 9.1's per-invocation and session-local override rules. Unsupported settings invoke the recorded fallback or blocked result, never silent substitution.

### Renderer and runtime compatibility

Implement `bin/link-agents.sh` as a thin entry point to a versioned renderer. Use real YAML and TOML parsing where needed. Declare any parser dependency and a reproducible setup path. Preserve the existing skill installer and avoid implicit role installation through routine skill linking.

Apply the complete section 10.2 contract for dry-run, explicit apply, redirected home, provenance, idempotence, conflicts, backups, concurrent edits, rollback, and interrupted installation. Redirect every generated destination under the test home. Never escape to the real home during renderer tests.

Prefer standalone Codex custom-agent files after target-version load and spawn probes succeed. Include the required name, description, and developer instructions. Keep shared configuration unchanged when standalone discovery needs no registration write. Retain the explicitly selected, qualified registration adapter for compatibility, including the recorded 0.146.0 baseline. Never install both forms for the same role.

Render Claude tool allowlists and explicitly exclude nested delegation. Record tool, filesystem, GitHub, and delegation enforcement separately. Instructional limits must not be presented as enforced controls.

Keep Gemini implementation and probes in R4. The shared canonical schema may retain existing Gemini placeholders, but no Gemini acceptance or installation belongs to this task.

### Selective dispatch and existing skill integration

Implement section 7.3 once in `skills/task-doc-delivery-loop/references/orchestration.md`. The delivery owner and authorized monitoring owner refer to it. The decision order is evidence reuse, required independence, useful optional delegation, then direct execution when support adds insufficient value.

Integrate selected dispatches into the existing delivery, review, audit, and bounded watching paths named in section 11. Load only the mode's owning skill. Do not copy the whole orchestration policy into every skill or replace domain-specific behavior.

Use section 7's complete brief and result envelope. Preserve code and content identity, audit setup and cleanup, partial coverage, all actionable findings, timeout handling, live-child termination, and the single permitted judgment escalation.

Record actual dispatches and genuine fallback through the existing role-run contract. Use ordinary validation, audit, review, and checkpoint evidence for direct work. Do not invent `role_unavailable` when the owner chose direct execution, or write an inline role-run with a null fallback reason. No new ledger schema is needed for selection bookkeeping.

An implementation review dispatch must respect the frozen candidate, finalized bound, and outstanding reservations required by the existing helper. Record its review result with the correct delegated source and cycle identity. A completed child is not permission to bypass the reservation's consumption rule.

### Pilot replacement and evidence

Qualify the replacement auditor separately in each required runtime. Show the migration diff and preserve a backup before changing owned pilot registrations. Retain a pilot where replacement probes fail. Do not overwrite an unowned conflict or leave ambiguous active aliases.

Save redacted runtime probe reports outside the repository under `/Users/dee/agent-artifacts/cross-agent-subagent-roster/`. Identify the candidate, canonical definition hashes, renderer version, client version, selected adapter, overrides, observed settings, enforcement, and limitations. A fixture or generated file alone is not a successful native runtime probe.

## Excluded

- Everyday orchestration, a general-purpose non-delivery brief, global hooks, or a second delivery workflow.
- Parallel implementers, publisher agents, recursive delegation, an external driver, a scheduler, or a dashboard.
- Reimplementation of R1 or R3, broad ledger refactoring, new checkpoint state, or unrelated dirty skill changes.
- Gemini rendering and probes, R5 measurement execution, team onboarding, T3 integration, or claims of savings.
- Routine personal memory edits, client upgrades, credential changes, or unrelated installation cleanup.
- Permanent tests of prose wording or one new test for every acceptance bullet.

## Pre-Implementation Verification

1. Read the current source spec, this task, and its independent review dispositions. Confirm source revisions and resolve drift before using accepted review evidence.
2. Verify repository identity, remote `main`, dirty scope, and safe checkout selection. Do not reuse an unrelated branch or PR.
3. Inspect the existing ledger, review policy, role-run validation, and reservation accounting on the execution baseline.
4. Inspect runtime versions, role discovery, pilot ownership, model access, and isolated probe options. Prefer temporary definitions and disposable fixtures without exposing credentials.
5. Prove the selected adapter can load and spawn before depending on it. Determine actual override and enforcement support without real GitHub mutation probes.
6. Identify the smallest parser and test boundary that supports the renderer. Do not install a new orchestration framework.

## Likely Files To Touch

| Area | Likely targets |
| --- | --- |
| Canonical source | `agents/*.md`, `agents/tiers.yaml`, and only needed instruction-pointer templates |
| Renderer | `bin/link-agents.sh` and its necessary implementation or dependency metadata |
| Owner policy | `skills/task-doc-delivery-loop/SKILL.md` and `references/orchestration.md` |
| Mode integration | `skills/audit-ui/SKILL.md`, `skills/audit-api/SKILL.md`, `skills/review-implementation/SKILL.md`, `skills/monitor-pr-review/SKILL.md`, and necessary mode references |
| Supporting guidance | `README.md` and existing delivery examples when needed for usable invocation and evidence mapping |
| Durable regression coverage | `tests/agents-render.test.mjs`, existing ledger, audit, and portability owners only where a changed contract requires coverage |
| Task handoff | This task document and its accepted review reference |

These paths guide inspection, not compulsory edits. Keep helper code and schema unchanged unless a verified integration defect makes a bounded correction necessary.

## Decisions Required Before Implementation

No product decision remains open. Runtime adapter selection is a technical decision settled by the spec's probe order. Use standalone Codex discovery where proven, or the explicitly selected qualified compatibility adapter. Report a blocker if neither can satisfy the required contract.

Preserve the provisional model map. Missing account access does not authorize substituting another model for an explicit request. Continue independent renderer or instruction work while a runtime prerequisite is unavailable, but do not claim complete R2 acceptance.

## Execution Rules

Use the maintained task-doc delivery loop for implementation, validation, review, remediation, and publication. Preserve its review bounds and reuse valid evidence. The current task-doc review is reusable only for the reviewed content and source identities.

Use temporary-home fixtures for destructive installer checks and mocked external writes for forbidden-action tests. Live probes may use supported isolated configuration with existing authentication. Keep credentials out of task documents, reports, command arguments, and published evidence.

Successful probe qualification permits the scoped, owned pilot migration described above. Stop only conflicting installation work when file ownership or concurrent changes prevent a safe apply. Do not add routine approval gates for already authorized work.

## Deliverables

- Four canonical roles, a shared tier map, and the safe native renderer.
- One selective-dispatch reference integrated into the existing delivery paths.
- Correct role briefs, compact results, enforcement reporting, fallback, and model resolution.
- Runtime-qualified adapters and per-runtime pilot migration evidence, or explicit incomplete acceptance where blocked.
- Focused durable regression coverage and a complete R2 evidence index.

## Completion Verification

Use one evidence index mapping every R2 requirement from spec sections 7, 9.1, 10.1, 10.2, 11, and 13 to a passing check or explicit gap.

| Risk | Existing or smallest effective owner | Verification and evidence |
| --- | --- | --- |
| Installation overwrites user files, escapes the redirected home, or loses configuration during recovery. | New `tests/agents-render.test.mjs` owns the new renderer boundary. Existing portability tests own unchanged skill-link behavior. | Exercise the complete section 10.2 fixture matrix, including dry-run, repeated apply, modified outputs, concurrent edits, rollback, and cross-format name conflicts. Use `node --test tests/agents-render.test.mjs`. |
| Rendered roles lose mode semantics, pin settings, or claim unsupported enforcement. | Renderer semantic checks plus native role probes. | Parse outputs and compare independent expected fields. Exercise all four roles in both required CLIs, including model-only and effort-only overrides and boundary limitations. |
| Dispatch loses evidence identity, bypasses reservations, or fabricates an inline fallback. | Existing `tests/delivery-ledger.test.mjs` owns persistence and review accounting. | Reuse existing F7/N8 and R3 coverage. Extend the smallest existing case only for a changed integration contract. Demonstrate direct work through ordinary evidence and delegated work through the existing role-run and review records. |
| Runtime errors or partial audit results become false success. | Runtime envelope and routing scenarios, with existing audit policy and helper coverage. | Exercise missing role, unsupported model, forbidden independence fallback, timeout with a live child, malformed result, partial coverage, failed audit, and allowed or disallowed escalation. Preserve cleanup and all actionable findings. |
| The owner delegates trivial work or repeats useful support work. | Bounded instruction scenarios, not prose snapshots. | Run all six section 13 selective-dispatch scenarios in both required runtimes. Reuse role probes and disposable fixtures. Record observed choices, evidence reuse, required review, and unchanged authority. |
| Pilot migration removes the only working auditor. | Renderer conflict and backup tests plus native replacement probes. | Pass each runtime's replacement probes before retiring its owned pilot. Record retained pilots and unresolved conflicts honestly. |
| Cross-skill integration breaks existing contracts. | Existing affected audit, portability, and ledger owners. | Run focused checks during development, then the required final `node --test tests/*.test.mjs` once for the candidate. Reuse unchanged evidence after non-invalidating edits. Run `sh -n bin/link-agents.sh` and relevant changed-script syntax checks. |

Permanent tests are justified for installer ownership, recovery, semantic rendering, and any changed evidence contract because failures can corrupt configuration or accept invalid delivery evidence. Native discovery and judgment need runtime evidence. Do not duplicate existing ledger tests or add string-presence tests to prove agent behavior. Apply the maintained test-audit criteria before adding coverage.

Use existing audit executors and disposable local services for live audit scenarios. Do not create extra published PRs or complete unrelated deliveries solely for scenario acceptance. Keep all required native probes distinct from mocks and from this document review.

## Approval Gates

The delivery prompt supplies approval to implement this bounded task and create a ready PR against `main`. The existing rollout and authorization rules remain in force. Report missing runtime access or unresolved file ownership precisely. An unavailable required probe blocks the relevant acceptance claim, not unrelated work.

## Completion Criteria

R2 is complete when the canonical roles, selected adapters, selective dispatch, integration, and required probes satisfy the evidence index. Existing safeguards and R3 bounds must still hold. Missing required runtime evidence means implementation may be published with a disclosed limitation, but R2 acceptance remains incomplete.

A ready PR must satisfy the delivery loop's readiness requirements. Do not describe an unverified runtime gate as passing or silently weaken the requested endpoint. Preserve the prescribed blocked or handoff behavior when the endpoint cannot be reached.

## Follow-ups

R1 live handoff acceptance, any remaining R3 acceptance reconciliation, R4 Gemini support, R5 comparative measurement, and eventual team adoption remain separate work.
