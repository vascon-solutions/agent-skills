---
name: monitor-pr-review
description: Use when explicitly asked for ongoing PR review monitoring or babysitting, to keep watching or remediate until quiet.
---

# Monitor PR Review

Own one explicitly requested PR review/remediation loop in the current session. Default to ten minutes of quiet. `quiet_complete` means the observed window was quiet, not that review is permanently finished.

Use `address-review-findings` for one current batch. Require affirmative user intent targeting ongoing PR review; a ready PR, an open PR, generic CI watching, or 'do not monitor' does not authorize this workflow. When explicitly invoked, accept an open draft PR too. A read-only watch request stays read-only; do not infer permission to fix or post from it.

## Authorization And Ownership

An explicit request to run this review/remediation skill authorizes scoped fixes, focused validation, commits/pushes, replies, and verified thread resolutions on the named PR. It does not authorize merging, closing/reopening, force-pushing, rewriting history, bypassing hooks, or unrelated CI fixes. Preserve any narrower user instruction.

Run inline. Do not delegate the timer, ledger, GitHub mutations, or branch ownership. A bounded delivery-review-mode reviewer may assess material changes when authorized; it does not run duplicate validation or mutate anything.

## Establish State

Verify PR identity, open state, head branch/commit, working checkout, write access when needed, and intended scope. Preserve separable unrelated edits; resolve overlapping ownership or concurrent mutators before changing files. Closed or merged PRs end monitoring. Keep existing working authentication rather than rerunning setup every cycle.

Locate the read-only helper relative to this skill:

```sh
node <skill-dir>/scripts/fetch-pr-review-state.mjs --repo OWNER/REPO --pr NUMBER
```

It returns paginated metadata, conversation comments, reviews, inline threads, and replies. Start with a complete snapshot, track event IDs and outstanding dispositions, and choose the explicit quiet duration or the default. Read [monitor state and timing](references/state-and-timing.md) for the ledger and terminal conditions. Keep session state; do not create goal tooling unless explicitly requested.

## Process Batches

Cluster new items by behavior/thread and apply `address-review-findings` evaluation rules. The monitor owns repeated batches; the remediation skill's one-batch endpoint does not terminate an authorized monitor.

Continue independent clusters while one is blocked. Investigate unclear technical facts; ask for material user decisions, or post a focused reviewer question when authorized. Preserve established scope and reject unsupported findings with evidence. Repeated ineffective fixes require reassessment; report a repeated blocker rather than spinning or automatically widening scope.

Use [validation guidance](../task-doc-delivery-loop/references/validation.md) for focused checks and evidence reuse. Use [debugging](../task-doc-delivery-loop/references/debugging.md) for failures. A new event does not invalidate unchanged passing tests.

## Publish, Reply, Resolve

For valid code fixes, use `publish-branch` with the candidate/evidence, stage only related files, respect hooks, and verify the remote commit. Never create empty commits for reply-only work.

Read [GitHub transport](../publish-branch/references/github-transport.md) before posting. Send one reply per handled item in its original thread. Only after the reply succeeds and the valid fix or duplicate/already-resolved disposition is remotely verified, resolve its GraphQL thread ID. Leave invalid, unclear, out-of-scope, and informational threads unresolved unless the user directs otherwise.

If reply succeeds but resolution fails, record `reply_sent: true`, refresh remote state, retry only resolution when appropriate, and never duplicate the reply. An uncertain mutation response requires a read-back before any creation retry.

## Quiet Window And Closeout

Measure quiet from the later of the last handled substantive review event and pushed remediation commit. At the end take a final complete snapshot; any unseen substantive review event resets the window. Non-review bot chatter and usage notices do not. Waiting must follow the runtime's scheduling/waiting facilities; do not leave an unmanaged background loop after the turn ends.

Return the terminal result and ledger to the delivery owner once, without starting another remediation cycle there. Report PR/head, monitor start time, final activity checkpoint, quiet duration, dispositions, pushed fixes, validation gaps, reply/resolution state, and remaining dependencies. A ready PR becoming draft does not end an explicitly active monitor, but must be reported to the owner.
