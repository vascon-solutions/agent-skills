---
name: task-doc-delivery-loop
description: Use when one or more approved task docs in the current repository should share one delivery goal and be carried through implementation, validation, and review to a pushed branch and draft PR by default.
---

# Task Doc Delivery Loop

## Purpose

Run one approved task doc or coherent ordered set as a bounded, single-repository delivery loop. Task docs remain the source of truth; this skill orchestrates implementation through closeout without duplicating dependent skills.

Default completion is one pushed branch with one draft PR and known check/comment state. Marking the PR ready for review, and any narrower endpoint (local-only, commit-only, or a pushed branch with no PR), each require explicit user wording. Never merge without explicit authorization.

The PR-bound default assumes a GitHub remote with working PR tooling. When the repository has no remote, a non-GitHub remote (GitLab, Bitbucket, or other), or no usable PR tooling, do not attempt an equivalent mutation on another platform: complete at verified local completion — implemented, validated, reviewed, and committed on the working branch — and report why the publish step was narrowed. Pushing or platform-specific publishing beyond that requires explicit user wording.

## Preconditions

Use only when every proposed task doc is approved by the current request, explicit approval after a review gate, or a clear repo status convention.

If any doc is missing, unapproved, stale, or blocked by unresolved decisions, ask once and stop. Use `task-doc-intake` (or `task-doc` directly for an already-bounded source) when no approved task doc exists.

Do not use for report-only review, task-doc creation/repair, or publishing existing commits without implementation.

## Delivery Set Rules

A delivery set uses one current repository, goal/ledger, checkout or worktree, branch, and at most one PR. A single task doc is a set of one.

Group docs only when they share one outcome and dependency order, branch and PR, release/approval boundary, and a reasonably reviewable diff.

Split docs into separate goals when they are unrelated, independently shippable, need different reviewers or release timing, or make one PR materially harder to validate. Pressure to reduce prompts, tokens, or PR count does not override these split rules.

If an included task requires implementation in another primary repository, stop and require a separate task doc and goal there. Repo-standard generated, vendored, or file-dependency snapshot refreshes remain in scope when the current repo owns the resulting change.

## Delivery Calibration

Choose and record calibration during intake:

| Dimension | Default | Calibration |
| --- | --- | --- |
| Effort | `medium` | `low` for docs/mechanical work; `high` for migrations, auth, permissions, security, finance, destructive data changes, unclear contracts, or broad refactors. Preserve explicit higher requests. |
| Validation | smallest disproof check + one required candidate gate | Use `focused`, `affected`, `full`, and/or `repo-required` only when risk or repo policy requires them; account for publish hooks that repeat checks. |
| Review | tight delegated review | Use high-effort delegation for high risk/explicit deep review, or local review by explicit low-risk choice or as fallback. `none` requires agent-classified low risk, an explicit no-review/non-PR request, and repo permission. PR delivery gets review. |
| Publish | pushed branch + draft PR | Ready-for-review is explicit. A narrower endpoint requires explicit wording unless GitHub remote or PR tooling is unavailable, which automatically narrows to verified local completion per Purpose. |

Bug fixes and critical contracts start with a failing reproduction. Admit a permanent test only for a named durable risk: a regression-prone behavior, critical contract, security or permission boundary, or repository-required invariant. Presentation, copy, CSS, and DOM details do not receive permanent tests solely to prove delivery; use the smallest appropriate inspection or temporary disproof check instead.

After docs, import, or formatting-only remediation, rerun targeted checks instead of an unchanged full suite unless risk changed. Retrospect on runs over about 30 minutes or with repeated validation/review cycles.

## Delivery Ledger

Store the ledger in goal tooling when available; otherwise keep a compact session checklist and state the fallback.

Track ordered `task_docs` (path, status, validation, checkpoint), repo, branch, phase, calibration, validation evidence, candidate OID, findings, PR state, and blockers.

## Dependency Routing

Load these skills lazily; do not restate them.

Local skills are the primary routes. External skills are optional enhancers; the core rule stated inline holds when they are not installed.

| Need                                   | Use                                                                                                 |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Missing/unapproved task doc            | Ask once; then `task-doc-intake` or `task-doc`                                                       |
| Separate plan for high-risk sequencing | Sequence dependent phases explicitly in the ledger (`executing-plans` if installed)                 |
| Named durable-risk behavior            | Start with a failing reproduction and add the smallest permanent test (`test-driven-development` if installed) |
| Failed or surprising validation        | Isolate the root cause before fixing, not symptoms (`systematic-debugging` if installed)            |
| Implementation review                  | `review-implementation`                                                                             |
| Finding remediation                    | `address-review-findings`                                                                            |
| Push, PR                               | `publish-branch` in immutable candidate mode; a draft PR is the default endpoint, ready-for-review is explicit |
| Current PR findings                    | `address-review-findings` for one current batch; `monitor-pr-review` only when monitoring was separately and explicitly requested |
| Final claim                            | Confirm with command evidence before claiming done (`verification-before-completion` if installed)  |

Escalate to explicit dependent-phase sequencing (or `executing-plans` if installed) only for migrations, auth/security/permission work, broad refactors, unclear ordering, or delivery sets with several dependent phases.

## Workflow: Four Checkpoints

### Checkpoint 1: Bootstrap

Read each task doc once, repository instructions, and Git state. Verify approval, repository and remote identity, actual target base, prerequisites, grouping, dirty scope, protected-branch risk, and calibration. Create or continue one matching ledger; do not create a duplicate goal.

Begin the declared install immediately when it is required and safe to run concurrently with document reading. Record the ordered brief, branch intent, validation ladder, required local lanes, publish assumptions, and any declared dependency output that the current repository consumes. Do not guess a target base or silently substitute a convenient provider branch.

### Checkpoint 2: Focused Implementation

Implement included scope in dependency order and run the smallest check capable of disproving the change. Bug fixes and critical contracts start with a failing reproduction. Add or adjust permanent tests only for a named durable risk; do not add permanent tests for presentation, copy, CSS, or DOM details.

Before consumer checks, dependency synchronization rebuilds or consumes the declared dependency output and records its source and output identity. Dependency synchronization does not merge, cherry-pick, or import the provider task branch into the consumer PR unless that integration is explicitly authorized.

Capture raw command output in a retained log. Exit code zero plus the lane's required completion evidence is authoritative. After completion, filter retained output for diagnostics and read the retained log before any rerun. Do not rerun an unchanged successful lane, and do not rerun merely because live output was truncated, delayed, or difficult to scan.

Complete the calibrated pre-candidate validation lanes. Stage only intended files and create one clean immutable candidate commit; record its OID. Run the required candidate gate once against that exact clean candidate OID and record its evidence. Treat the first green result as authoritative. Any later file or Git mutation creates a replacement candidate and invalidates evidence tied to the former OID.

### Checkpoint 3: Report-Only Review

Unless calibrated to `none`, use `review-implementation` in report-only mode against every task doc and the complete immutable-candidate diff. The reviewer consumes the recorded validation evidence and diff; it does not create a second validation plan. For delegation, wait at most five minutes total by default, checking progress at least once per minute; on timeout, interrupt the reviewer when supported, perform the review locally, and record the fallback. Set and record a longer maximum before dispatch only for explicit deep review or high-risk work.

Classify each returned finding as `valid`, `invalid`, `unclear`, `out_of_scope`, `informational`, `duplicate`, or `already_resolved`. Fix `valid` findings, ask on behavior-changing `unclear` findings, reject `invalid` findings with evidence, and defer `out_of_scope` findings. After valid remediation, rerun only affected pre-candidate lanes, stage the intended changes, and create a replacement immutable candidate. This invalidates evidence tied to the prior OID; rerun the required candidate gate against the replacement OID and record its evidence. Repeat implementation review only when remediation materially changes behavior; otherwise the current findings batch is final.

### Checkpoint 4: Publish and CI

Hand the candidate OID and gate evidence to `publish-branch` in immutable candidate mode to reach the calibrated endpoint. Accept the first green candidate result: publish the exact immutable candidate OID without amendment, formatting, generation, or other mutation. The publication phase is push-only with respect to candidate contents. Respect hooks, and never open or update a PR with known failing required checks; remediate or report the blocker.

Remote CI is supplementary when it omits a repository-required local lane. A green remote result cannot waive the matching required local lane. Before any CI remediation, collect the complete failure evidence for the selected failed job and define the complete scope of that job's fix; do not act from a partial log or isolated symptom. Inspect one current CI/findings batch. Remediate it at most once when the fix remains within the approved delivery scope; if remediation requires broader authority, report it and stop. Take one final complete PR/CI snapshot and stop. One current findings or CI batch does not become a loop.

Mark the PR ready for review only when the user asked and validation and review are accounted for. A ready PR does not itself authorize `monitor-pr-review`; monitoring requires a separate explicit monitor, watch, or babysit request targeting PR review. The same explicit monitoring boundary applies to draft PRs. Treat non-review bot notices and usage limits as external state.

Stop at a narrower local endpoint (no PR, no push, or commit-only) when the user explicitly requested it — or automatically, with the reason reported, when the repository has no GitHub remote or usable PR tooling (see Purpose).

## Closeout

Verify Git status, validation, task checkpoints, and applicable candidate, upstream, PR, check, review, comment, and thread state. If monitoring was explicitly requested, handle `quiet_complete` by continuing normal gates; report and pause on `waiting_for_reviewer`; ask and pause on `waiting_for_user`; record `blocked` under the runtime blocking policy; and verify closed/merged state before dispositioning `externally_terminated`. Close only when every task is accounted for, findings are dispositioned, required checks/reviewer decisions are settled, and applicable PR state is known. A spent budget or quiet window is not completion.

## Loop Bounds

Except in review mode `none`, default to one group review, one remediation pass, and one optional final review after material behavior fixes. Publication allows one current PR/CI findings batch, one authorized remediation pass, and one final snapshot. Monitoring is outside the delivery loop unless separately requested; when explicitly requested, `monitor-pr-review` owns its configured quiet window and repeated-blocker safeguard.

Continue only for new critical/blocking findings or explicit user instruction. Record a repeated blocker instead of spinning.

## Worktree Policy

Use the current checkout when clean, task-appropriate, and allowed by repo instructions. Prefer or require isolation for unrelated dirty changes, protected/default/integration branches without direct-work authorization, concurrent mutators, or flows escalated to explicit dependent-phase sequencing (`executing-plans` if installed). Follow explicit user checkout instructions when they are safe and authorized.

When isolated, verify pushed branch and PR state directly rather than relying on the parent checkout.

## Subagent Review Prompt

```text
Review this ordered delivery set:
{TASK_DOC_PATHS}

Repo: {REPO_PATH}
Branch/diff: {BRANCH_OR_DIFF_SCOPE}
Calibration: {CALIBRATION}

Report only. Consume the supplied diff and validation evidence. Do not modify files or Git, run tests, type-checks, builds, linters, formatters, generators, or installs, start servers or browsers, access GitHub, or delegate.

Check that the docs form one coherent delivery set, requirements are implemented in
order, excluded scope and preserved behavior remain intact, contracts have not drifted,
repo instructions are followed, and validation is adequate without needless duplication.

Return: verdict; critical, important, and minor findings; missing validation; recommended
fixes. For each finding include file:line or PR URL, requirement/risk, impact, and the
smallest credible fix.
```

## Final Report

Report ordered task-doc paths and checkpoints, calibration, branch, candidate OID and commits, implementation summary, review verdicts, findings fixed/rejected/deferred/blocked, validation run/skipped, excluded dirty files, notable time sinks, remaining risks, and PR URL/check/comment state when applicable. When `monitor-pr-review` ran, include its configured quiet duration, last activity, terminal result, reply/resolution state, and remaining reviewer or user dependency.
