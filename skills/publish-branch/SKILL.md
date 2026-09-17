---
name: publish-branch
description: Commit, push, or create/update a GitHub PR for the requested work. Preserve the requested endpoint and exclude unrelated changes.
---

# Publish Branch

Run the publish path inline by default. Preserve intended scope, existing authorization, and validated content. This is publication, not a new implementation review or test-planning workflow.

## Resolve The Action

- `commit`: stage intended changes and commit, no push.
- `commit and push` or `push this branch`: publish the branch, no PR unless requested.
- `publish` or `create/open a PR`: push as needed and create a draft PR by default.
- Ready-for-review, merge, and narrower endpoints require explicit wording; reuse a choice already made rather than presenting integration options again.
- Include existing branch commits in a normal push. If the user asks to publish only selected work, verify the full branch diff does not include unrelated commits; do not rewrite published history to make it fit.

Verify target repository, branch, upstream, intended diff, and any existing PR. Derive the PR base from explicit direction, the approved task/ledger, and applicable repo conventions. Never assume the remote default or `main` is the delivery target. Resolve conflicting evidence before publication. Pass the verified base explicitly at PR creation and read it back afterward; do not silently retarget an existing PR.

## Scope And Preconditions

Preserve unrelated changes. If intended files/hunks are clearly separable, stage only those and proceed. Ask only when ownership or overlapping changes cannot be safely separated. Do not default to `git add -A` for a mixed worktree.

Do not push directly to default/protected/integration branches without explicit authorization for that branch. Never infer permission to merge, force-push, rewrite shared history, bypass hooks, or discard work. Do not compete with another mutator in the same publish path; use safe isolation or report the dependency.

Consume applicable [validation evidence](../task-doc-delivery-loop/references/validation.md). Run missing required checks or invalidated checks, not a second unchanged suite simply because publication began. Known change-related failures or required gate failures block a ready PR until resolved; record unrelated failures and obey repo policy. Do not claim a draft or pending-check PR is merge-ready.

## Commit And Candidate Identity

For normal publication, stage the intended scope, inspect the staged diff, commit with repo hooks, and inspect any hook changes. Revalidate affected content when hooks changed tested inputs. Confirm the commit contains the intended work before pushing.

**Exact-candidate mode:** when given a validated commit OID, verify HEAD and intended branch match that OID. Do not format, generate, stage, commit, or amend it as part of pushing. Unrelated untracked artifacts may remain excluded; tracked/index changes require resolving candidate identity before proceeding. Run non-mutating required hooks; if a hook changes tracked content, index, or HEAD, stop publication of that candidate and return to validation. Verify the remote ref and PR head equal the expected candidate after pushing.

## Tools And Delegation

Use the available GitHub integration or `gh`. Reuse working authentication evidence; check it when absent or when a call fails. If ordinary `gh` authentication fails, try the environment's established interactive-shell setup. Use an existing SSH bootstrap helper when needed, not guessed credentials or configuration changes. Authentication failure does not justify deleting commits or resetting the branch.

Delegate only when explicitly requested or authorized and materially useful. For that case read [worker handoff](references/worker-handoff.md); one worker owns mutations. Inline work does not require worker reports or duplicated preflights.

Before writing a PR body, comment, or reply, read [GitHub transport](references/github-transport.md). Write PR bodies and commit messages to the [unslop surface shapes](../unslop/references/surfaces.md): problem, change, validation, limitations, inside the budget, with no conversational history, abandoned plans, or tooling attribution. Run the unslop scanner on the body file before posting and fix or justify its hits.

## Closeout

Verify local status, intended commit, remote head when pushed, and PR URL/base/head/draft state when applicable. Take one snapshot of CI/review state; pending checks are external dependencies, not permission to start monitoring. Honor an explicitly requested green-CI gate separately. Do not automatically delete the worktree or branch after creating a PR.

Report what was committed/pushed, PR and target, verification evidence, excluded changes, and remaining blockers. If commit succeeds but push or PR creation fails, preserve that partial result and report the exact remaining step. Never clean up partial publication through destructive resets.
