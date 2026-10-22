# Delivery audit trigger, devbox fallback and delegated-review default

## Objective

Make `task-doc-delivery-loop` treat runtime acceptance written into an approved task doc as an audit the delivery must evidence. The delivery owner keeps the choice between dispatching the `auditor` and auditing inline, but either way the ledger records an audit result. Also close two gaps that a real delivery hit: what `docker-app-verify` does when agent-devbox supports a project but cannot serve the candidate, and what delegated-review limit applies when the repository sets none.

This is one improvement-grade delivery in `vascon-solutions/agent-skills`, targeting `main`.

## Source Context

Codebase findings from the `SH-01-01-q1` delivery in an ERP project (2026-10-06), reviewed with Dee in this session:

- The task doc required a "Rendered check" (create, edit and legacy Customer in the running app). The owner drove the browser itself, and the ledger recorded `audit_policy: {state: not_requested, reason: "no live audit requested"}`. No `audits` record exists. The only trace is limitation `runtime-native-path`.
- The owner set `delegated_limit: 1`, citing the ERP project's `AGENTS.md:30` ("Request independent review…"), which names no number. The size rule gave 3 cycles. After the single review returned 5 findings, the fixes were verified only locally.
- At the time, agent-devbox's ERP adapter supported only a persistent base pinned to one ref, so it could not serve the candidate. The owner fell back to the native stack, which was correct. But `docker-app-verify` only describes that fallback for an absent runner or an unsupported project.

Dee approved creating this task doc. Since then agent-devbox has shipped a disposable ERP candidate component (DEVENV-16, `039b464`; `up --ui WORKTREE --component candidate`) and a marketplace candidate (DEVENV-17, `42cee81`), so an ERP branch can now be served on devbox. The 2026-10-06 finding stands as the historical trigger; the fallback rule below still covers other persistent-only or unconfigured cases.

## Design Reference

None beyond the current skill text. The R2 task `docs/tasks/2026-09-30-r2-selective-delivery-orchestration.md` and its merged implementation (PR #20) own the role roster, orchestration order and ledger contracts. This task changes only the wording below and keeps those contracts.

## Architecture Summary

The change is mostly wording in the delivery-loop skill and `docker-app-verify`, plus one bootstrap default. A runtime acceptance checkpoint in an approved task doc becomes a requested audit: bootstrap records `audit_policy.required: true, state: pending`. The existing helper then refuses completion until a passing audit is cited. The orchestration order still decides between dispatching `auditor` and auditing inline. Neither path can skip the audit record anymore. Devbox fallback and the delegated-limit default are stated as rules in the existing references, with no new schema.

## Code Evidence

Evidence from `main` at `7c09101`.

| Behavior | Source |
| --- | --- |
| Auditor delegation is tied to a *requested* audit | `skills/task-doc-delivery-loop/SKILL.md:38` |
| Bootstrap guidance records `not_requested` for an unrequested audit, and generated defaults are "not evidence" | `skills/task-doc-delivery-loop/SKILL.md:26` |
| Routing table: "Required or requested audit with substantial browser or API observations → prefer `auditor`" | `skills/task-doc-delivery-loop/references/orchestration.md:22` |
| Direct work uses ordinary audit records and has no `role_runs` entry | `skills/task-doc-delivery-loop/references/orchestration.md:79` |
| Live-acceptance paragraph: reuse a supplied environment, otherwise use `docker-app-verify` when agent-devbox supports the repository; "An absent runner or unsupported project retains its established validation path" | `skills/task-doc-delivery-loop/SKILL.md:40` |
| `prepare-init` default audit policy is `{required: false, state: "not_requested"}` | `skills/task-doc-delivery-loop/scripts/delivery-ledger.mjs:1902` |
| A required audit blocks completion until `state: complete` and a cited passing audit exists; `update` cannot waive a required audit | `delivery-ledger.mjs:3402-3405`; `references/delivery-ledger.md:108` |
| `audit_policy.state` enum is `not_requested, pending, complete, blocked` | `references/delivery-ledger.schema.json:342` |
| `delegated_limit: null` means no separate delegate cap; a non-null limit needs a recorded policy decision; raising or nulling a prior limit needs a new recorded delegated-review policy decision | `delivery-ledger.mjs:1254`, `3119`, `3135`, `3155-3156`; `review-policy.md:56-57` |
| A required audit cannot be waived once set (`required: false` refused after `true`); every cited audit must be `PASS`; `state: blocked` refuses completion | `delivery-ledger.mjs:2280-2282`, `3398`, `3402-3405` |
| Existing tests already cover a required pending audit satisfied by an inline `PASS` (`role_run_id: null`), and completion refused without a cited `PASS` | `tests/delivery-ledger.test.mjs:2393-2412` (N4), `3139-3154` (F7) |
| A null limit with no delegate decision is already a tested default shape | `tests/delivery-ledger.test.mjs:3852-3856` (`r3Bound`) |
| The helper checks at least one cited `PASS` audit, not per-mode coverage | `delivery-ledger.mjs:3397-3404` |
| Review policy says a repo's one-delegate rule wins but gives no default when the repo is silent | `skills/task-doc-delivery-loop/references/review-policy.md:39-47` |
| A fresh delegated review after remediation is gated on "repo policy permits"; `address-review-findings` repeats the gate | `SKILL.md:48`; `skills/address-review-findings/SKILL.md:31` |
| Standalone audits repeat the "runner absent or project unsupported" fallback | `skills/audit-ui/SKILL.md:59`; `skills/audit-api/SKILL.md:62` |
| A pack test pins the exact `SKILL.md:38` inline-fallback sentence and the `SKILL.md:48` fresh-reviewer sentence | `tests/skills-portability.test.mjs:342-349` |
| No task-doc authoring skill defines "runtime acceptance" or "rendered check"; review-task-docs says only that a UI claim "may need rendered evidence" | `skills/task-doc/`, `skills/task-doc-intake/` (no match); `skills/review-task-docs/SKILL.md:16` |
| Repositories may narrow "the number of delegated reviews" | `references/authorization.md:25` |
| `docker-app-verify` fallback covers only "runner is absent or the project is unsupported" | `skills/docker-app-verify/SKILL.md:16`; `references/lifecycle.md:12` |
| Uncommitted working-tree edits (reviewed 2026-10-14) add a "Before starting" checklist to the lifecycle guide and point `SKILL.md:18` at it. Checklist item 1 already says a borrowed base behind a required ref cannot serve the task and that an isolated component must be chosen and the reason recorded. No other task owns these edits. | `git diff -- skills/docker-app-verify` on the working tree |
| Reuse requires source, ownership and capabilities to match | `skills/docker-app-verify/SKILL.md:18` |
| The ERP adapter keeps its persistent base (`persistentOnly: true`, built from `base.ref`, reuse keeps that revision, refresh/reset rejected, `base-verify` makes no product write) and, since DEVENV-16 (`039b464`), also a disposable `candidate` component: `adapterFor` merges the candidate adapter when `component === 'candidate'`, and `capabilities` reports `databaseProvisioning: 'disposable'`, `uiAudit: 'disposable-business-writes'` with no reuse | `agent-devbox/src/adapters.mjs` (the ERP adapter, its candidate adapter, `adapterFor`, `capabilities`); the ERP base and candidate docs under `agent-devbox/docs/` |
| Existing test that pins a delegated limit of 1 | `tests/delivery-ledger.test.mjs:4061` |

## Current Behavior To Preserve

- The owner keeps discretion: orchestration's order (reuse evidence → required independence → optional delegation for concrete benefit → direct work) still decides whether `auditor` runs. Installed roles still never imply a dispatch.
- A task doc *without* a runtime acceptance checkpoint, and with no user request, still records `not_requested`.
- A failing or blocked audit stays failing until a later `PASS` in the same mode. Role errors never clear it. Inline fallback cannot invent browser capability, environment, authentication or a candidate URL.
- Configured agent-devbox runs whose guard, readiness or admission fails remain blockers. They are not a reason to fall back.
- Executor limits on a candidate-serving devbox environment still leave the affected checks unverified. Falling back to another environment is allowed only under the new "cannot serve the candidate" rule.
- A repository delegate rule, when present, still wins over the size bound. `delegated_limit` monotonicity in the helper is unchanged.
- No ledger schema change and no new helper command.

## Prerequisites

Current `main`, including R2 (PR #20) and `docker-app-verify` (PR #19), plus the uncommitted `docker-app-verify` working-tree edits listed in the evidence table. This task owns and lands those edits; do not commit them separately or discard them. No sibling repository dependency. The agent-devbox ERP candidate component (DEVENV-16) is not a prerequisite: the rules here must still hold for adapters or components that cannot serve a candidate.

**Landing order for the four 2026-10-06 tasks:** this task first, then delivery-ledger-opt-in, then agent-script-contract-and-delivery-hygiene, then delivery-ledger-ergonomics. The opt-in task adds the lightweight (no-ledger) equivalent of the required-audit rule on top of this task's wording; this task writes the rule for ledger mode only.

## Scope

### Runtime acceptance counts as a requested audit

- In `SKILL.md` (sections 1 and 2) and `orchestration.md`, define a requested audit to include a runtime acceptance checkpoint in an approved task doc, as well as an explicit user or repository request. **Trigger:** an acceptance criterion or completion-verification row that requires observing UI, API or accessibility behavior in the running application. An explicit "none needed", an optional check, or an illustrative mention does not trigger it. When it is unclear whether a row triggers, ask before bootstrap. Do not default to required.
- At bootstrap, such a checkpoint sets `audit_policy` to `{required: true, state: pending, reason: <checkpoint reference>}`. The existing completion gate then requires a cited `PASS`. After recording the passing audit, the owner sets `state: complete` with `update`.
- **Consequence of `required: true`.** It cannot be undone through `update`. If the checkpoint cannot be observed, the audit is not a `PASS` and the delivery is released as blocked, listing the unverified checkpoints. Causes include no browser or API capability, no credentials, or no environment that serves the candidate; the audit then records `BLOCKED` or `PARTIAL`. Nothing clears the requirement inside this ledger: the helper refuses `required: false` once `true` (`delivery-ledger.mjs:2280-2282`), and amending the task doc (`source-add` or `source_refresh`) does not touch `audit_policy`. Removing the requirement takes a new authorized delivery on the amended task doc, with its own ledger bootstrapped from that doc; the old ledger stays released as blocked and is cited from the new one. State this next to the new bootstrap default.
- The owner may satisfy the audit inline (an `audits` record, no `role_runs`) or through `auditor`. Replace the clause at `orchestration.md:79` that limits a recorded direct-execution choice to "only when it explains coverage or a limitation" with: record it when it explains coverage or a limitation, and always for a direct audit of a required task-doc checkpoint, with its reason, in the checkpoint summary. Do not leave both conditions side by side.
- **Coverage.** The helper checks only that at least one `PASS` is cited. The owner enforces one applicable `PASS` per required mode (`ui`, `api`, `a11y`) and coverage of every task checkpoint. Implementation review checks this. State this where the bootstrap default is defined.

### Devbox cannot serve the candidate

- In `docker-app-verify` (SKILL and lifecycle) and `SKILL.md:40`, add the case where the runner is present and the project is configured, but no supported component can serve the candidate source. Treat it as unsupported *for this candidate*: record a limitation naming the reason and the adapter evidence, then use the established execution path, unless Docker verification was explicitly required.
- **Home of the rule.** In the lifecycle guide, the rule extends item 1 of the uncommitted "Before starting" checklist (it already covers a borrowed base behind a required ref): when no supported component can serve the candidate at all, that item resolves to the recorded limitation and the established path. The fallback sentence at `lifecycle.md:12` and `SKILL.md:16` gains the same case in one clause. State the rule once; the checklist item and the fallback sentence link rather than repeat.
- **Fix the inherited checklist item 1.** As written it prescribes `route --ui <candidate-worktree>` for every agent-devbox adapter, but the disposable candidate components refuse `route` (the agent-devbox marketplace candidate doc lists it among the refused commands; the ERP candidate is the same shape). The persistent ERP base refuses it too: the CLI allows only `base-up/down/status/verify` for a `persistentOnly` adapter (`agent-devbox/src/cli.mjs:58-59`). `route` exists only for managed-stack bases (`agent-devbox/README.md:176`). Reword item 1 to name no command: compare the task's required inputs with what the selected environment runs through that adapter's documented source-comparison mechanism, which is `route` for a managed-stack base, the `base-verify` source receipt for the persistent ERP base, and the served source digest the candidate components emit at `up`. Where the mechanism only reports after start, the pre-start check is limited to confirming from the adapter docs that the component builds from the candidate worktree, and the comparison runs immediately after readiness, before any audit handoff. A mismatch after start stays a blocker, as the existing lifecycle step 3 says.
- **Decide before starting.** The condition is established from discovery output and the selected adapter's documentation before any start. Examples: an adapter whose only component is a persistent base pinned to another ref, or a project configuration with no candidate build input. The ERP adapter is no longer such a case; its `candidate` component serves a feature worktree. If an environment that was expected to serve the candidate starts and its source receipts do not match, that stays a reported blocker. It is not this fallback.
- Apply the same environment-selection sentence to `skills/audit-ui/SKILL.md:59` and `skills/audit-api/SKILL.md:62`, so standalone audits get the same rule. This is a wording change to environment selection only; their method and verdict rules stay excluded.
- State that the auditor does not depend on devbox: the owner may serve the candidate on the established path and give the `auditor` that proven URL.
- Keep the existing distinction: a candidate-serving environment with a limited executor leaves checks unverified, and does not trigger a fallback.

### Delegated-review default

- In `review-policy.md` and the bootstrap guidance, state that with no repository delegate rule and no user instruction, `delegated_limit` is `null`. Delegated reviews are then bounded only by the size cycles. Generic wording such as "request independent review" is not a numeric limit. The owner records a decision that the repository sets none and cites it in `basis.delegated_decision`. The helper does not require a decision for a null limit, but the record keeps the choice visible.
- A non-null limit needs a cited repository rule or user wording that names a number.
- Update the sibling gates to match: `SKILL.md:48` ("Where repo policy permits another delegated review…") and `skills/address-review-findings/SKILL.md:31` both allow another delegated review whenever the effective cycle bound and delegate limit allow it, where a null limit means size cycles only. Keep `address-review-findings`' existing condition that a fresh reviewer is used only when the request or delivery owner requires it. Only the limit wording changes: a permitted review is not an expected one.

## Excluded

- agent-devbox changes. The ERP candidate component already exists there (DEVENV-16) and needs nothing from this task.
- ERP project instruction or policy edits.
- Ledger schema, helper command or role-definition changes. If pre-implementation verification shows the helper cannot express the new defaults, stop and report rather than widening scope.
- Mandatory auditor dispatch. The owner's discretion stays.
- Changes to `audit-ui`/`audit-api` method or verdict rules, or to reviewer behavior. The single environment-selection sentence in each audit skill is in scope.
- Changes to `task-doc` or `review-task-docs` authoring guidance for the trigger term (see Follow-ups).

## Pre-Implementation Verification

- Confirm the cited lines still say what the table above says on current `main`.
- Already established at authoring time (spec review, 2026-10-06), so recheck only for drift: a bootstrap `{required: true, state: "pending"}` passes `prepare-init`/`init` (`delivery-ledger.mjs:1931`, `2020`), and an inline `PASS` satisfies it (tests N4 and F7). `set-review-bound` checks `basis.delegated_decision` only for a non-null limit (`delivery-ledger.mjs:3135`).
- Update the pinned sentences in `tests/skills-portability.test.mjs:342-349` together with `SKILL.md:38` and `:48`. That is maintenance of an existing test, not a new one. `tests/delivery-ledger.test.mjs:4061` exercises an explicit limit of 1 and stays valid.

## Likely Files To Touch

- `skills/task-doc-delivery-loop/SKILL.md`
- `skills/task-doc-delivery-loop/references/orchestration.md`
- `skills/task-doc-delivery-loop/references/review-policy.md`
- `skills/task-doc-delivery-loop/references/delivery-ledger.md` (bootstrap audit-policy wording only)
- `skills/task-doc-delivery-loop/references/delivery-examples.md` (if its bootstrap example shows the old audit default for a runtime checkpoint)
- `skills/address-review-findings/SKILL.md` (line 31 delegate gate)
- `skills/docker-app-verify/SKILL.md`, `skills/docker-app-verify/references/lifecycle.md` (including the uncommitted "Before starting" checklist already in the working tree)
- `skills/audit-ui/SKILL.md`, `skills/audit-api/SKILL.md` (environment-selection sentence only)
- `tests/skills-portability.test.mjs` (pinned sentences)

## Decisions Required Before Implementation

None. Settled in session with Dee:

- The owner keeps discretion over dispatch. The audit *record* becomes mandatory when the task doc names runtime acceptance.
- When agent-devbox cannot serve the candidate, the delivery uses the established path with a recorded limitation.
- With no repository delegate rule, the limit is `null`, bounded by size cycles.

Recorded consequence, raised by the spec review: a required task-doc audit that cannot be satisfied blocks the delivery. Only a new authorized delivery on an amended task doc removes it; an amendment alone does not, because the helper never clears `required: true` in an existing ledger. This follows from the first decision and the unchanged helper. It is not a new decision, but implementation states it explicitly.

## Execution Rules

- Wording changes follow the repository's existing prose style and `unslop`. Don't duplicate rules across files: the delivery-loop SKILL states each rule once and links to the reference that owns its detail.
- Keep `docker-app-verify` generic: name the condition ("no supported component serves the candidate source"), not one project specifically.
- Run `node --test tests/*.test.mjs` before completion.

## Deliverables

- Updated delivery-loop SKILL and references defining task-doc runtime checkpoints as requested audits, with the bootstrap default and an inline-or-delegated audit record.
- Updated `docker-app-verify` fallback rule for a configured project that cannot serve the candidate, landed together with the pre-start checklist currently uncommitted in the working tree.
- Stated `null` default for `delegated_limit` when the repository and user are silent.

## Completion Verification

| Risk | Evidence | Owner |
| --- | --- | --- |
| A task-doc runtime checkpoint completes with no audit record | Existing helper gate (`delivery-ledger.mjs:3402`) with `required: true`, already covered by tests N4 and F7 | `tests/delivery-ledger.test.mjs` (unchanged) |
| Wording contradicts across skills | `rg -n "unsupported project\|project is unsupported\|repo policy permits\|repository delegate limit\|not_requested" skills/` returns only wording consistent with the new rules (delivery loop, address-review-findings, docker-app-verify, audit-ui, audit-api) | Reviewer |
| Devbox fallback bypasses blockers | Diff review: the condition is decided before start from discovery and adapter docs; a started environment's receipt mismatch stays a blocker; a limited executor still yields unverified checks; the explicit-Docker exception is kept | Reviewer |
| Owner sets `required` for an ambiguous row, or misses coverage | Diff review: the trigger definition, the ask-when-unclear rule, the per-mode coverage rule and the stated blocked consequence are present | Reviewer |
| Owner invents a delegate cap | `review-policy.md` states the null default, its recorded decision and what may set a number; `SKILL.md:48` and `address-review-findings` match | Reviewer |
| Pinned wording drifts from the skill | `tests/skills-portability.test.mjs` updated alongside `SKILL.md:38`/`:48` | owner |
| Regressions in pack tests | `node --test tests/*.test.mjs` passes | CI/owner |

Runtime acceptance: this task itself has no running-application acceptance. Behavioral acceptance comes from the next real delivery in a repository whose task doc has a rendered check. Its ledger should show `audit_policy.required: true` and a cited audit.

Test admission: no new permanent test. The completion gate, inline satisfaction and null-limit shape are already tested (N4, F7, `r3Bound`). The other risks are prose consistency, which review covers. Updating the pinned sentences in `skills-portability` maintains an existing test.

## Approval Gates

None beyond the delivery endpoint the user chooses.

## Completion Criteria

- The three rule changes are in place, consistent across files, and keep the behavior listed above.
- The pack test suite passes.
- An independent review of the diff (`review-doc-changes`) has no unresolved blocking findings.

## Follow-ups

- Optionally teach `task-doc` and `review-task-docs` to mark runtime acceptance rows explicitly, so the trigger becomes mechanical rather than interpreted.
- Acceptance step, runnable once this task lands: one delivery of an ERP project task with a rendered check on the devbox `candidate` component (`up --ui WORKTREE --component candidate`), confirming the dispatch and devbox path end to end. The agent-devbox side shipped in DEVENV-16.
