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

| Dimension  | Default                            | Calibration                                                                                                                                                                                                                                               |
| ---------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Effort     | `medium`                           | `low` for docs/mechanical work; `high` for migrations, auth, permissions, security, finance, destructive data changes, unclear contracts, or broad refactors. Preserve explicit higher requests.                                                          |
| Validation | `focused` per task + one group run | Use `affected`, `full`, and/or `repo-required` when risk or repo policy requires them; account for publish hooks that repeat checks.                                                                                                                      |
| Review     | tight delegated review             | Use high-effort delegation for high risk/explicit deep review, or local review by explicit low-risk choice or as fallback. `none` requires agent-classified low risk, an explicit no-review/non-PR request, and repo permission. PR delivery gets review. |
| Publish    | pushed branch + draft PR           | Ready-for-review is explicit. A narrower endpoint requires explicit wording unless GitHub remote or PR tooling is unavailable, which automatically narrows to verified local completion per Purpose.                                                     |

After docs, import, or formatting-only remediation, rerun targeted checks instead of an unchanged full suite unless risk changed. Retrospect on runs over about 30 minutes or with repeated validation/review cycles.

## Delivery Ledger

Store the ledger in goal tooling when available; otherwise keep a compact session checklist and state the fallback.

Track ordered `task_docs` (path, status, validation, checkpoint), repo, branch, phase, calibration, validation evidence, findings, PR state, and blockers.

## Dependency Routing

Load these skills lazily; do not restate them.

Local skills are the primary routes. External skills are optional enhancers; the core rule stated inline holds when they are not installed.

| Need                                   | Use                                                                                                 |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Missing/unapproved task doc            | Ask once; then `task-doc-intake` or `task-doc`                                                       |
| Separate plan for high-risk sequencing | Sequence dependent phases explicitly in the ledger (`executing-plans` if installed)                 |
| Behavior change with test surface      | Write or adjust tests before the change (`test-driven-development` if installed)                     |
| Failed or surprising validation        | Isolate the root cause before fixing, not symptoms (`systematic-debugging` if installed)            |
| Implementation review                  | `review-implementation`                                                                             |
| Finding remediation                    | `address-review-findings`                                                                            |
| Commit, push, PR                       | `publish-branch`; a draft PR is the default endpoint, ready-for-review is explicit                  |
| PR comments                            | GitHub review-comment tooling, then `gh`/platform fallback                                           |
| Final claim                            | Confirm with command evidence before claiming done (`verification-before-completion` if installed)  |

Escalate to explicit dependent-phase sequencing (or `executing-plans` if installed) only for migrations, auth/security/permission work, broad refactors, unclear ordering, or delivery sets with several dependent phases.

## Workflow

1. **Intake**
   Read each task doc once, repo instructions, and git state. Verify approval, prerequisites, grouping, base branch, dirty scope, protected-branch risk, and calibration. Extract one ordered brief: objective, scope/exclusions, preserved behavior, likely files, validation, and publish assumptions.

2. **Ledger Start**
   Create or continue one matching ledger; do not create a duplicate goal. Record ordered docs, branch intent, calibration, validation plan, and publish assumptions.

3. **Ordered Implementation**
   Implement included scope in dependency order, using tests first for behavior changes. Finish focused validation and record a commit or ledger checkpoint before advancing. Do not add excluded follow-ups.

4. **Group Validation**
   Run one deduplicated group plan plus repo-required checks. Debug related failures systematically; record unrelated/environmental failures.

5. **Implementation Review**
   Unless calibrated to `none`, use the selected local or delegated report-only review against every task doc and the complete diff. For delegation, wait at most five minutes total by default, checking progress at least once per minute; on timeout, interrupt the reviewer when supported, perform the review locally, and record the fallback. Set and record a longer maximum before dispatch only for explicit deep review or high-risk work. Add a task-boundary review only for an explicit gate or high-risk boundary.

6. **Remediation**
   Classify findings as valid, invalid, unclear, or out of scope. Fix valid, ask on behavior-changing ambiguity, reject invalid with evidence, and defer out-of-scope findings. Rerun affected checks and review again only after material remediation.

7. **Publish**
   Use `publish-branch` to reach the calibrated endpoint — by default a pushed branch with a draft PR. Stage only intended files, respect hooks, and never open or update a PR with known failing checks; remediate or report the blocker. Mark the PR ready for review only when the user asked and validation and review are accounted for. Stop at a narrower local endpoint (no PR, no push, or commit-only) when the user explicitly requested it — or automatically, with the reason reported, when the repository has no GitHub remote or usable PR tooling (see Purpose).

8. **PR Review**
   Inspect checks, reviews, comments, and unresolved threads. Treat bot notices and usage limits as external state. Pending required checks/reviewer decisions keep the ledger open; after the configured wait, report and pause.

9. **PR Remediation**
   Evaluate actionable comments, fix valid findings, push, rerun focused validation, and inspect updated PR state. Use one final review if fixes materially change behavior.

10. **Closeout**
    Verify git status, validation, task checkpoints, and applicable commit, upstream, PR, check, review, comment, and thread state. Close only when every task is accounted for, findings are dispositioned, required checks/reviewer decisions are settled, and applicable PR state is known. A spent budget or wait window is not completion.

## Loop Bounds

Except in review mode `none`, default to one group review, one remediation pass, and one optional final review after material fixes. For PR modes, allow one PR-comment remediation cycle and one optional final review after material PR fixes.

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

Report only. Do not modify files.

Check that the docs form one coherent delivery set, requirements are implemented in
order, excluded scope and preserved behavior remain intact, contracts have not drifted,
repo instructions are followed, validation is adequate without needless duplication,
and actionable PR comments are addressed.

Return: verdict; critical, important, and minor findings; missing validation; recommended
fixes. For each finding include file:line or PR URL, requirement/risk, impact, and the
smallest credible fix.
```

## Final Report

Report ordered task-doc paths and checkpoints, calibration, branch and commits, implementation summary, review verdicts, findings fixed/rejected/deferred/blocked, validation run/skipped, excluded dirty files, notable time sinks, remaining risks, and PR URL/check/comment state when applicable.
