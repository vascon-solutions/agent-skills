---
name: task-doc-delivery-loop
description: Use when an approved task doc should be delivered end-to-end to PR readiness, PR feedback closeout, or explicitly local-only completion.
---

# Task Doc Delivery Loop

## Purpose

Run an approved task doc as a bounded delivery loop. The source of truth is the task doc; this skill conducts the work through implementation, review, remediation, validation, publishing, PR feedback, and closeout without duplicating the dependent skills.

Default completion is a pushed branch with an open draft PR and known PR check/comment state. Local-only completion or ready-for-review PRs require explicit user wording.

## Preconditions

Use only when there is an approved task doc.

Do not use when the user only wants to publish existing commits, run a report-only implementation review, or create/repair a task doc.

Approval signals:

- the current request says to implement, deliver, run, proceed with, publish, or complete the named task doc
- the same thread contains explicit approval after a task-doc review gate
- the task doc or repo has a clear status convention showing implementation approval

If approval is missing, ask once and stop; do not infer approval from the mere existence of a task doc. If there is no task doc, use `task-first-implementation` or `task-doc` instead.

## Delivery Ledger

Maintain a compact ledger. Store it in goal tooling when available; otherwise keep it as a checklist/status block.

Track:

- `task_doc`: path
- `repos`: primary and dependent repos
- `branch`: current or intended branch
- `phase`: intake, implementation, validation, delegated-review, remediation, publish, pr-review, final-review, complete, or blocked
- `validation`: commands and status
- `findings`: open findings and disposition
- `prs`: URLs and check/review state
- `blockers`: external or decision blockers

Close only when validation is accounted for, implementation findings are resolved or explicitly deferred, and either the branch is pushed with draft PRs open by default or the user explicitly requested local-only completion. For PR-bound work, inspect PR comments, resolve actionable comments, and verify final branch/PR state.

## Dependency Routing

Load dependent skills lazily. Do not paste or restate their full procedures.

| Need | Use |
| --- | --- |
| Missing task doc | `task-first-implementation` or `task-doc` |
| Unapproved existing task doc | Ask once and stop |
| User requests task-doc validation | `review-task-docs` |
| Separate step-by-step plan needed | `executing-plans` |
| Behavior change with test surface | `test-driven-development` |
| Failed or surprising validation | `systematic-debugging` |
| Implementation review | `review-implementation` |
| Fix review findings | `address-review-findings` |
| Commit, push, PR | `publish-branch` |
| PR review comments | GitHub review-comment tooling, then `gh`/platform fallback |
| Final claim | `verification-before-completion` |

Escalate to `executing-plans` only for migrations, auth/security/permission work, broad cross-module refactors, multi-repo contract changes with dependent sequencing, unclear implementation ordering, or task docs with several dependent delivery phases.

## Workflow

1. **Intake**
   Read the task doc, repo instructions, current git state, and dependent repo state. Extract a compact brief covering objective, included and excluded scope, behavior to preserve, likely files, validation plan, publish assumptions, and dependency assumptions. Pause on unresolved task-doc decisions, unsafe dirty worktrees, or protected/default branch risk.

2. **Ledger Start**
   Create or continue the delivery ledger. Record the task doc path, current phase, branch intent, validation plan, and publish assumptions.

3. **Implement**
   Implement only included task-doc scope. Preserve listed invariants. For multi-repo tasks, change the owning contract first, then dependents, and refresh snapshots with repo-standard commands.

4. **Validate**
   Run the task doc validation plan and any repo-required narrow checks. If validation fails or surprises you, use `systematic-debugging` before broad rewrites. Record skipped relevant checks with reasons.

5. **Delegated Review**
   Use a fresh subagent/review agent when supported. If unavailable, run a local report-only review and state the fallback.

6. **Remediate**
   Classify findings as valid, invalid, unclear, or out of scope. Fix valid findings, ask on unclear behavior/scope choices, reject invalid findings with evidence, and defer out-of-scope items.

7. **Publish**
   Use `publish-branch`. Stage only intended files. Push and open a draft PR by default. Open a ready PR only when explicitly requested and known checks are green or safely accounted for.

8. **PR Review**
   Inspect checks, reviews, issue comments, inline comments, and unresolved threads. Treat bot/system notices and usage-limit messages as external state, not code findings.

9. **PR Remediation**
   Fix actionable PR comments, push updates, and re-run focused validation. Use a final delegated/local review if PR-comment fixes materially change behavior.

10. **Closeout**
    Verify git status, latest commit, upstream state, PR URLs, validation, check state, and comment state. Close the ledger/goal only with current evidence.

## Loop Bounds

Default maximum:

- one implementation review
- one remediation pass
- one optional final implementation review after material remediation
- one PR-comment remediation cycle
- one optional final review after material PR-comment fixes

Continue beyond this only for new critical/blocking findings or explicit user instruction. If the same blocker repeats, record it as blocked instead of spinning.

Do not wait indefinitely for PR checks or reviewers. Use a reasonable wait, then report pending state or blocker status.

## Worktree Policy

Use the current checkout when it is clean and task-appropriate.

Prefer or require an isolated worktree when:

- the current checkout has unrelated dirty changes
- the current branch is protected/default/integration
- multiple agents may mutate files
- the task is risky multi-repo delivery
- the flow escalates into `executing-plans`

When isolation is used, verify pushed branch/PR state directly; do not rely only on the parent checkout.

## Subagent Review Prompt

```text
Review the implementation against:
{TASK_DOC_PATH}

Repo path(s): {REPO_PATHS}
Branch/diff scope: {BRANCH_OR_DIFF_SCOPE}

Report only. Do not modify files.

Check task-doc compliance, excluded-scope creep, preserved behavior, repo instructions, validation adequacy, package/dependency snapshot coherence, and actionable PR comments if present.

Output:
- verdict: pass, pass-with-fixes, or fail
- critical findings
- important findings
- minor findings
- missing validation
- recommended fixes

For each finding include file:line or PR comment URL, requirement/risk, why it matters, and the smallest credible fix.
```

## Final Report

Report task doc path, branch names, commit hashes, PR URLs, implementation summary, reviews and verdicts, findings fixed/rejected/deferred/blocked, validation run/skipped, PR checks/comments state, unrelated dirty files excluded from scope, and remaining risks.
