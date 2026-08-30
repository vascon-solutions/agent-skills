---
name: monitor-pr-review
description: Use when an open GitHub pull request needs ongoing monitoring or babysitting for new review comments, including requests to keep watching, loop, or wait until quiet.
---

# Monitor PR Review

## Purpose

Own one GitHub PR review/remediation loop in the current session until a configurable quiet window passes. Default to ten minutes. `quiet_complete` means the observation window was quiet, not that review is permanently finished.

This is the ongoing route. Use `address-review-findings` for one current findings batch without continued monitoring.

Select this skill only when the user uses explicit monitor, watch, babysit, keep-watching, continue-in-a-loop, or until-quiet wording that targets PR review. Continuation intent takes precedence over an opening one-shot phrase only when the PR-review target is explicit. An open PR, ready-for-review state, completed one-shot findings batch, or generic CI watch request does not authorize this mutation-capable workflow.

## Authorization Boundary

Invoking this skill authorizes the current PR branch workflow to:

- evaluate review items through `address-review-findings`
- make scoped fixes and run focused validation
- commit and push coherent remediation batches through `publish-branch`
- reply to addressed PR comments and resolve addressed inline threads
- keep reading PR state until the quiet window ends

It does not authorize merging, closing, reopening, rebasing, force-pushing, rewriting history, bypassing hooks, changing unrelated files, or fixing CI failures unrelated to review findings.

Run the monitor inline. Do not delegate its timer, ledger, edits, GitHub mutations, or branch ownership to a subagent. A single bounded, report-only `review-implementation` subagent is optional after material behavior changes; it must not edit or mutate GitHub.

## Preflight

1. Resolve an explicit PR URL/number, otherwise the current branch PR.
2. Verify `gh auth status`, repository identity, PR write access, current branch/upstream, and PR head SHA.
3. Inspect `git status --short`. Preserve unrelated files and stop when intended changes cannot be staged separately.
4. Require an open PR and a local branch matching its head branch. Closed or merged PRs are terminal.
5. When explicitly invoked, accept any open PR, including a draft PR. `task-doc-delivery-loop` selects this skill only when monitoring was separately and explicitly requested; ready-for-review status alone is not authorization.
6. Parse an explicit positive quiet duration; otherwise set `quiet_window_minutes: 10`. Ask when duration wording is ambiguous.

Direct invocation authorizes a fresh full quiet window from invocation time even when the current head commit is older.

## Read Complete Review State

Locate the helper relative to this `SKILL.md`, then run:

```sh
node <skill-dir>/scripts/fetch-pr-review-state.mjs --repo OWNER/REPO --pr NUMBER
```

Omit `--repo` and `--pr` to resolve the current branch PR. The helper is read-only and returns normalized, paginated PR metadata, conversation comments, reviews, inline threads, and every thread reply.

Keep this compact state in goal/ledger tooling when available, otherwise in session:

```yaml
pr_review_monitor:
  repository: owner/repo
  pr_number: 123
  pr_url: https://github.com/owner/repo/pull/123
  head_sha: abc123
  seen_event_ids: []
  pending_event_ids: []
  last_activity_at: 2026-08-04T12:00:00Z
  quiet_window_minutes: 10
  last_push_sha: abc123
  pr_is_draft: false
  validation_state: passing
  unresolved_actionable_threads: []
  cycle_count: 0
  repeated_blocker_count: 0
```

Use GraphQL event IDs for deduplication and timestamps only for the quiet duration. On the first snapshot, queue all unresolved actionable items. On later snapshots, queue unseen substantive review events.

Automated review findings are substantive review activity. Usage-limit messages, status chatter, and other non-review bot/system notices are external state: record them, but do not reset the window.

## Process a Review Batch

1. Cluster new items by thread, file, and behavior.
2. Apply `address-review-findings` evaluation rules and classify each cluster as `valid`, `invalid`, `unclear`, `out_of_scope`, `informational`, `duplicate`, or `already_resolved`.
3. Continue independent clusters when one cluster is blocked.
4. For valid clusters, implement the smallest credible fix and run focused validation.
5. For `invalid`, `out_of_scope`, or `informational` clusters, prepare a concise evidence-backed reply without a code change and leave the thread unresolved.
6. For unclear reviewer intent, reply with one focused question and leave the thread unresolved. Ask the user instead when product, architecture, security, permission, migration, or other behavior-changing judgment is required.
7. If the same technical finding returns after three ineffective cycles, stop as `blocked` instead of spinning.

## Publish, Reply, Resolve

For a code-bearing batch:

1. Use `publish-branch` in commit-and-push mode.
2. Stage only files traceable to the handled clusters.
3. Use a scoped commit message and respect repository hooks.
4. Confirm the commit is pushed before claiming its findings are fixed.

Never create an empty commit for reply-only, `invalid`, `informational`, or `out_of_scope` dispositions.

Prepare Markdown replies in an owner-only file. For an inline thread, encode the body in a JSON request file and send it through the root comment database ID without shell interpolation:

```sh
gh api --method POST \
  "repos/OWNER/REPO/pulls/PR/comments/ROOT_DATABASE_ID/replies" \
  --input /absolute/path/to/reply.json
```

After the reply succeeds, resolve its GraphQL thread ID:

```sh
gh api graphql \
  -f query='mutation($thread:ID!){resolveReviewThread(input:{threadId:$thread}){thread{id isResolved}}}' \
  -F thread="THREAD_GRAPHQL_ID"
```

For a top-level conversation comment, use `gh pr comment --repo OWNER/REPO PR --body-file /absolute/path/to/comment.md`; it has no resolvable review thread. Never embed Markdown backticks or command substitutions in an interpolated shell string.

After each Markdown mutation, perform one remote read-back and compare the stored content with the intended file. On a read-back mismatch, edit the existing remote object in place and read it back once more; never create a second body, comment, or reply. If a safe in-place edit is unavailable or fails, stop and report the mismatch. If reply succeeds but resolution fails, record `reply_sent: true`, retry only resolution after the next snapshot, and never duplicate the reply. Leave ambiguous threads unresolved.

## Quiet Window

After draining the queue:

1. Set `last_activity_at` to the later of the last handled substantive review event and last pushed remediation commit.
2. Prefer the runtime's external-state wait or monitor primitive. Do not spend assistant turns announcing unchanged polls.
3. Without such a primitive, run one bounded foreground polling process that calls the helper approximately once per minute; observe that process through the runtime's execution-session wait facility at intervals no longer than sixty seconds.
4. On changed state, process every unseen substantive review event and reset the full quiet window after the final disposition or push.
5. At the configured boundary, run one final complete snapshot. Any unseen substantive event resets the window.

Return `quiet_complete` only when the final refresh confirms:

- no unseen substantive review activity
- no actionable unresolved thread
- no unresolved local remediation diff
- the latest remediation commit is pushed
- focused validation for the latest code batch passed

An approval, informational review, or substantive automated review resets the window. Non-review bot/system chatter does not.

## Terminal Results

| Result | Use when |
| --- | --- |
| `quiet_complete` | The configured window was quiet and no actionable unresolved review work remains; this is not proof that review is permanently finished. |
| `waiting_for_reviewer` | A clarification or required reviewer decision remains after the observation window. |
| `waiting_for_user` | A material user decision is required. |
| `blocked` | Authentication, validation, permissions, unsafe worktree state, or a repeated technical blocker prevents progress. |
| `externally_terminated` | The PR became closed or merged while monitoring. |

When called by `task-doc-delivery-loop`, return the ledger and result. The parent:

- continues closeout after `quiet_complete`, subject to CI and required-approval gates
- reports and pauses on `waiting_for_reviewer`
- asks and pauses on `waiting_for_user`
- records `blocked` under the runtime's blocking policy
- verifies closed/merged state before dispositioning `externally_terminated`

If a ready PR becomes draft during monitoring, record and report it but keep the explicitly active monitor running; the delivery parent decides whether its ready-PR gate is still satisfied.

## Final Report

Report PR URL, branch and head SHA, monitor start time, final activity checkpoint, configured quiet duration, observed quiet duration, findings by disposition, commits pushed, replies and resolutions, validation evidence, CI/review/approval state, preserved unrelated files, and remaining blockers or risks.
