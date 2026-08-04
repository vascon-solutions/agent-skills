# Monitor PR Review — Skill Design

**Status:** Approved design
**Date:** 2026-08-04
**Audience:** Codex skill maintainers and users running GitHub PR delivery workflows
**Primary outcome:** Let a user explicitly start one current-session loop that addresses GitHub PR review activity until the PR has been quiet for ten minutes.

## 1. Context

The existing `address-review-findings` skill evaluates and remediates one batch of code, PR, or spec-compliance findings. It is intentionally platform-neutral and does not own a long-running PR lifecycle.

The repeated operational need is broader:

1. inspect a GitHub PR for new review findings;
2. evaluate and remediate valid findings;
3. validate, commit, and push each coherent remediation batch;
4. reply to and resolve addressed review threads;
5. keep watching for additional review activity; and
6. stop after ten genuinely quiet minutes.

Adding this behavior to `address-review-findings` would mix one-batch remediation with GitHub-specific publishing, thread mutation, time-based monitoring, and lifecycle state. The behavior therefore belongs in a separate orchestration skill.

## 2. Decision

Create a new `monitor-pr-review` skill.

The new skill composes existing responsibilities instead of duplicating them:

- `address-review-findings` remains the authority for finding evaluation and remediation;
- `publish-branch` supplies the safe commit-and-push path;
- GitHub CLI/API operations supply thread-aware reads, replies, and resolution;
- `review-implementation` may perform one bounded, report-only review after material behavior changes; and
- `task-doc-delivery-loop` delegates ready-PR review monitoring to the new skill.

The monitor runs inline in the current session. It does not delegate its timer, mutations, branch ownership, or delivery ledger to a subagent.

## 3. Goals

- Make `Monitor PR review` and `Use $monitor-pr-review` sufficient invocations.
- Resolve the PR from the current branch when no PR identifier is supplied.
- Process all new human review activity across reviews, top-level PR comments, inline review threads, replies, and requested-change state.
- Keep every code change traceable to its originating review item.
- Commit and push each coherent remediation batch.
- Reply in the original inline thread and resolve it when its finding has been dispositioned.
- Reset the quiet window after every handled human review event or pushed remediation commit.
- Stop successfully only after ten quiet minutes and one race-safe final refresh.
- Let `task-doc-delivery-loop` invoke the monitor automatically after explicitly publishing or updating a ready PR.
- Preserve the delivery loop's draft-PR default and bounded draft inspection.

## 4. Non-Goals

- Do not change one-shot `address-review-findings` requests into monitoring requests.
- Do not monitor draft PRs automatically.
- Do not merge, close, reopen, force-push, rebase, or rewrite PR history.
- Do not take ownership of CI remediation; observe and report remote checks while leaving the delivery gate to `task-doc-delivery-loop` or a dedicated CI workflow.
- Do not create a daemon, background service, scheduled automation, or durable repository state file.
- Do not treat bot notices, usage limits, or system messages as code-review findings.
- Do not create empty commits for comment-only dispositions.

## 5. Trigger and Routing Contract

### Explicit monitor triggers

The new skill should trigger for wording such as:

```text
Monitor PR review.
Babysit the PR review.
Keep addressing PR review comments until the PR is quiet.
Use $monitor-pr-review.
```

Its metadata description should describe the triggering situation without summarizing the workflow. A suitable shape is:

```yaml
description: Use when an open GitHub pull request needs continued attention after review activity or pushed remediation changes.
```

### One-shot triggers

Wording such as the following remains owned by `address-review-findings`:

```text
Address review findings on the PR.
Fix the current PR review comments.
```

Monitoring is opt-in. The presence of a PR alone must not silently broaden a one-shot remediation request.

### Delivery-loop routing

`task-doc-delivery-loop` invokes `monitor-pr-review` only when the approved publish boundary is a ready PR. This includes creating a ready PR or explicitly transitioning/updating an existing PR as ready during that delivery.

Draft PR delivery retains the existing bounded inspection and does not start the ten-minute monitor. The delivery loop must not repeat its own PR-remediation steps after delegating to the monitor.

## 6. Components

### `skills/monitor-pr-review/SKILL.md`

Define:

- preflight and PR resolution;
- review-event normalization and classification;
- the remediation, validation, commit, push, reply, and resolution sequence;
- quiet-window state and reset rules;
- inline ownership and optional report-only review delegation;
- terminal, waiting, blocked, and externally terminated outcomes; and
- the final report contract.

### `skills/monitor-pr-review/agents/openai.yaml`

Expose a concise display name, description, and default prompt. The default prompt should explicitly request monitoring of the current branch PR through ten quiet minutes.

### Read-only review-state helper

Add `skills/monitor-pr-review/scripts/fetch-pr-review-state.mjs` with an adjacent `node:test` suite.

The helper should use `gh api graphql`, handle pagination, and emit normalized JSON containing:

- repository and PR identity;
- PR URL, open/closed/merged state, draft state, head SHA, and review decision;
- reviews and requested-change state;
- top-level PR comments;
- inline review-thread IDs, resolution and outdated state, file/line anchors, and comments;
- comment IDs, authors, bodies, URLs, and creation timestamps; and
- a deterministic snapshot timestamp.

The helper is read-only. It must not reply, resolve, commit, push, or expose authentication material. Mutations remain explicit session actions so their intent and result stay visible.

### Pack integration

Update:

- `skills/task-doc-delivery-loop/SKILL.md` to route ready PR monitoring to the new skill;
- `bin/link-skills.sh` so the new skill is installed with the pack; and
- portability/integration tests so the skill list, ready/draft routing, and inline ownership cannot drift silently.

The delivery loop's metadata should continue to describe its draft-PR default. Ready-PR monitoring is an explicit calibrated branch, not a new default publish boundary.

## 7. Runtime State

Keep a compact in-session state record:

```yaml
pr_review_monitor:
  repository: owner/repo
  pr_number: 123
  pr_url: https://github.com/owner/repo/pull/123
  head_sha: abc123
  seen_event_ids: []
  pending_event_ids: []
  last_activity_at: 2026-08-04T12:00:00Z
  last_push_sha: abc123
  validation_state: passing
  unresolved_actionable_threads: []
  cycle_count: 0
  repeated_blocker_count: 0
```

When goal or delivery-ledger tooling is active, store this compact state there. Otherwise retain it in the current session. Do not add a repository file solely to persist monitoring state.

Event IDs, not timestamps alone, determine whether an event is new. Timestamps determine quiet-window duration. This avoids duplicate handling and prevents pagination or clock-boundary races from dropping an event.

## 8. Workflow

### 8.1 Preflight

1. Resolve an explicitly supplied PR URL or number; otherwise resolve the PR for the current branch.
2. Verify GitHub authentication, repository identity, PR write access, branch/upstream state, and the current PR head SHA.
3. Inspect the worktree for unrelated changes and determine whether remediation files can be staged safely.
4. Reject draft, closed, or merged PRs as non-monitorable states unless the PR changed state after monitoring began, in which case return an external-state result.
5. Set the initial activity checkpoint to invocation time. An explicit invocation always receives a fresh ten-minute observation window, even when the latest PR commit is older.

### 8.2 Snapshot and classification

Read a complete normalized PR snapshot. Cluster new events by thread, file, and behavior area, then route every event through the evaluation rules in `address-review-findings`.

Classify each event or tightly related cluster as:

- `valid` — a verified change or explanation is required;
- `invalid` — the request is technically unsupported or harmful;
- `unclear` — reviewer intent or product behavior cannot be determined safely;
- `out of scope` — the request is unrelated to the approved delivery boundary;
- `informational` — no action or response is required;
- `duplicate` — already represented by another handled event; or
- `already resolved` — no current work remains.

Bot/system notices are recorded separately and do not enter the finding workflow or reset the quiet window.

### 8.3 Remediation batch

For each independent valid cluster:

1. implement the smallest credible fix;
2. run focused validation appropriate to the changed behavior;
3. keep the diff traceable to its source threads;
4. combine related fixes into one coherent remediation batch; and
5. avoid unrelated cleanup or speculative work.

If validation fails because of the remediation, debug it before publishing. Do not commit or push a known-broken remediation batch.

### 8.4 Commit and push

Use `publish-branch` in commit-and-push mode for code-bearing remediation batches.

- Stage only files belonging to the handled findings.
- Use a scoped message that describes the remediation area; use a generic `fix: address PR review findings` only when no clearer coherent message exists.
- Respect repository hooks.
- Push normally to the existing PR branch.
- Never create an empty commit for a reply-only or rejected finding.
- Never include unrelated dirty files or force-push.

### 8.5 Reply and resolve

After the supporting commit is pushed:

- reply to each inline finding in its original thread with the disposition, commit reference when applicable, and validation evidence;
- reply to invalid or out-of-scope findings with concise technical evidence;
- resolve addressed inline threads after their reply succeeds;
- leave ambiguous threads unresolved;
- for unclear reviewer intent that does not require a product decision, reply with one focused clarification question;
- for product or architectural ambiguity, ask the user and pause that cluster; and
- handle top-level comments with a traceable top-level response because GitHub does not provide resolvable threads for them.

If a reply succeeds but resolution fails, retain the thread as unresolved and retry safely on the next snapshot. Do not duplicate the reply.

### 8.6 Quiet monitoring

After the current queue is drained:

1. set `last_activity_at` to the later of the final handled human review event and final pushed remediation commit;
2. wait using the runtime's monitoring/wait mechanism, or poll at approximately one-minute intervals with no blocking wait longer than sixty seconds;
3. fetch a complete snapshot after each wait;
4. process every unseen human review event;
5. reset the activity checkpoint after every handled human event or pushed remediation commit; and
6. continue until ten minutes have elapsed from the latest checkpoint.

Human review activity resets the window even when it results only in an evidenced rejection, informational disposition, approval, or clarification reply. Bot/system events do not.

At the ten-minute boundary, perform one final complete refresh. If any unseen human review event appears, process it and reset the window. Successful completion requires the final refresh to confirm:

- no unseen review activity;
- no actionable unresolved thread;
- no unresolved local remediation diff;
- the latest remediation commit is pushed; and
- focused validation for the latest code-bearing batch passed.

## 9. Current-Session and Subagent Policy

The invoking session owns the entire monitor lifecycle:

- PR and branch identity;
- review-event ledger;
- timer and polling;
- file edits and validation;
- commits and pushes;
- replies and resolutions; and
- user interaction and terminal reporting.

Do not delegate the monitor to a subagent and do not run multiple mutation-capable agents against the same checkout.

After material behavior-changing remediation, the current session may use one bounded subagent for a report-only `review-implementation` pass. The subagent receives the relevant task/spec, diff scope, and validation context, must not mutate files or GitHub, and does not own or pause the quiet timer. The current session evaluates any resulting findings before making further changes.

## 10. Safety and Error Handling

### Stop before mutation

Stop with a concrete blocker when:

- GitHub authentication or write access is missing;
- the PR cannot be resolved unambiguously;
- unrelated dirty changes cannot be separated safely;
- the current branch does not match the PR head branch;
- the PR is already draft, closed, or merged at preflight; or
- required repository instructions prohibit the intended action.

### Pause or continue selectively

- Continue with independent clusters when one cluster is ambiguous or conflicting.
- Ask the reviewer in-thread when only reviewer intent is missing.
- Ask the user when a product, architecture, security, permission, migration, or other behavior-changing decision is missing.
- Do not mark an ambiguous thread resolved.

### Repeated blockers

If the same technical finding returns after three ineffective remediation cycles with no credible progress, stop and report the repeated blocker. Ten quiet minutes is the normal stop rule, but it is not permission to spin indefinitely on an unchanged failure.

### External PR state changes

If the PR becomes draft, closed, or merged while monitoring, stop immediately and report the new state. Do not attempt to reverse the external transition.

### CI and approval state

Observe and report CI checks, review decision, and required human approval state. These states do not become code findings automatically. When invoked by `task-doc-delivery-loop`, return them to the parent ledger; the parent remains responsible for deciding whether the delivery gate is satisfied.

A quiet window with a still-unresolved clarification is a waiting or blocked result, not successful completion.

## 11. Terminal Results

Return one of:

| Result | Meaning |
| --- | --- |
| `quiet_complete` | Ten quiet minutes passed; final refresh found no actionable unresolved review work. |
| `waiting_for_reviewer` | A clarification or required reviewer decision remains unresolved after the observation window. |
| `waiting_for_user` | A material product or architectural decision is required. |
| `blocked` | Authentication, validation, permissions, unsafe worktree state, or a repeated technical blocker prevents progress. |
| `externally_terminated` | The PR became draft, closed, or merged while monitoring. |

The final report includes:

- PR URL, branch, and final head SHA;
- monitor start, final checkpoint, and observed quiet duration;
- findings fixed, rejected, deferred, duplicated, or awaiting clarification;
- commits created and pushed;
- replies and resolutions performed;
- validation commands and outcomes;
- CI, review-decision, and required-approval state;
- unrelated files preserved; and
- remaining blockers or risks.

## 12. Delivery-Loop Integration

When `task-doc-delivery-loop` publishes to an explicitly ready PR boundary:

1. finish its normal implementation review and pre-publish remediation;
2. publish or update the ready PR;
3. invoke `monitor-pr-review` inline;
4. accept the monitor's review-event ledger and terminal result;
5. retain ownership of CI and required-approval gates; and
6. close the delivery goal only when the monitor is `quiet_complete` and every other delivery gate is satisfied.

The monitor's explicit ten-minute review loop replaces the delivery loop's default one-cycle PR-comment bound for that ready PR. The three-cycle repeated-blocker safeguard still applies. Draft PR delivery keeps the existing one-cycle bound and bounded status inspection.

## 13. Verification Strategy

Skill authoring follows RED-GREEN-REFACTOR.

### Trigger separation

- Baseline and forward-test `Address review findings on the PR`; it must remain one-shot.
- Test `Monitor PR review`, `Babysit the PR review`, and explicit `$monitor-pr-review`; they must select the monitor.
- Test ready and draft delivery-loop prompts; only the explicitly ready route delegates to the monitor.

### State-machine scenarios

- A valid finding produces a scoped fix, passing focused validation, commit, push, original-thread reply, resolution, and checkpoint reset.
- An invalid finding produces an evidenced reply and resolution without an empty commit.
- A human comment observed at minute nine resets the full window.
- An event appearing during the final refresh prevents premature completion.
- A duplicate event is not replied to or resolved twice.
- A reply-success/resolution-failure sequence retries only resolution.
- Bot notices do not reset the timer.
- An approval or informational human review event does reset the timer.

### Failure scenarios

- Authentication loss, missing PR scope, branch mismatch, mixed dirty scope, validation failure, and repeated feedback return the correct non-success result.
- Product ambiguity pauses for the user and leaves the thread unresolved.
- Reviewer ambiguity posts one clarification and returns `waiting_for_reviewer` after the observation window if unanswered.
- Draft, closed, or merged state prevents or terminates monitoring correctly.

### Helper tests

Use `node:test` fixtures to cover:

- GraphQL pagination for reviews, comments, threads, and thread replies;
- normalization and deterministic ordering;
- event-ID deduplication;
- outdated and resolved thread representation;
- missing/nullable anchors;
- malformed JSON and partial API responses; and
- `gh` authentication, permission, and rate-limit failures without secret leakage.

### Repository checks

- Run the helper's unit tests.
- Run `tests/skills-portability.test.mjs` and any repo-wide required test command.
- Run the skill validator against the new folder.
- Verify `agents/openai.yaml` matches the final skill behavior.
- Inspect the final diff for accidental changes to draft-PR defaults or one-shot routing.

## 14. Acceptance Criteria

The design is implemented when:

- the new skill is discoverable through natural monitor/babysit wording and explicit invocation;
- one-shot PR finding requests still route to `address-review-findings`;
- ready PRs from `task-doc-delivery-loop` enter the monitor automatically while drafts do not;
- the current session owns all monitoring and mutations;
- thread-aware snapshots are complete, paginated, normalized, and read-only;
- valid remediation batches are validated, committed, pushed, replied to, and resolved safely;
- comment-only dispositions never create empty commits;
- every handled human review event or pushed remediation commit resets the quiet checkpoint;
- the final refresh closes the race at the ten-minute boundary;
- unresolved ambiguity, unsafe state, and repeated blockers cannot report success;
- CI and required approval remain delivery-loop gates rather than implicit monitor findings; and
- tests cover routing, timer resets, deduplication, mutation ordering, failure states, and delivery-loop integration.

## 15. Expected File Changes

- `skills/monitor-pr-review/SKILL.md`
- `skills/monitor-pr-review/agents/openai.yaml`
- `skills/monitor-pr-review/scripts/fetch-pr-review-state.mjs`
- `skills/monitor-pr-review/scripts/fetch-pr-review-state.test.mjs`
- `skills/task-doc-delivery-loop/SKILL.md`
- `bin/link-skills.sh`
- `tests/skills-portability.test.mjs`

No change to `address-review-findings` is required unless forward testing exposes a concrete one-shot routing ambiguity.
