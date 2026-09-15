# Monitor State And Timing

Keep a compact ledger in the session or an already-existing goal:

```yaml
pr_review_monitor:
  repository: owner/repo
  pr_number: 123
  pr_url: https://github.com/owner/repo/pull/123
  head_sha: candidate
  mode: remediation # observation_only for a read-only watch
  pr_is_draft: false
  seen_event_ids: []
  pending_event_ids: []
  last_activity_at: timestamp
  quiet_window_minutes: 10
  last_push_sha: candidate
  validation_state: passing
  unresolved_actionable_threads: []
  cycle_count: 0
  repeated_blocker_count: 0
```

Use event IDs for deduplication. Queue unresolved actionable items at the initial snapshot and unseen substantive events afterward. In observation-only mode, queue items for reporting, not remediation: do not fix, post, or require write access. Direct invocation starts a fresh quiet window even for an old head. After each disposition or push, measure from the later relevant timestamp. Substantive human/automated reviews, including approvals, reset the window; bot usage notices and status chatter do not.

Use the available supported external-state wait/automation facility. Without one, use bounded foreground polling about once per minute while observing the process at intervals no longer than sixty seconds. Respect runtime scheduling instructions and user interruptions. Do not pretend monitoring continues after a turn ends without a supported scheduled continuation.

At the final complete snapshot, process unseen substantive events and reset the window if needed. Return:

- `quiet_complete`: no unseen events or outstanding actionable local work; remediation pushed and applicable checks passed. In observation-only mode, the window is quiet and observed findings have been reported; fixes, pushes, validation, and thread resolution are inapplicable. Report unresolved findings without treating them as a requirement to mutate. This does not prove future reviews or unrelated required CI/approvals are complete.
- `waiting_for_reviewer`: a required reviewer decision or clarification remains after the window.
- `waiting_for_user`: a material user decision is needed.
- `blocked`: access, unsafe mutation state, or a repeated unresolved technical failure prevents progress. Follow the runtime's threshold before setting any goal status blocked.
- `externally_terminated`: the PR closed or merged; verify that state before reporting it.

Track rejected/deferred threads as dispositioned, not silently fixed. Their remaining unresolved state is a reviewer dependency only when a decision is actually required. A spent budget or elapsed quiet duration alone cannot satisfy completion.
