# Delivery Authorization

The shared rules for how far a delivery, review round or monitor may go. `task-doc-delivery-loop`, `address-review-findings`, `publish-branch` and `monitor-pr-review` apply this table instead of restating it. With a [delivery ledger](delivery-ledger.md), record each authority as a quoted grant; the helper applies only a grant's declared effect and never infers authority from notes, PR comments or role output.

| Authority | Default | Needs explicit user wording | Ledger record |
| --- | --- | --- | --- |
| Endpoint | a pushed branch and draft PR (`draft_pr`) | a ready PR (`ready_pr`); a narrower endpoint (`local`, `commit`, `push`); any change of endpoint mid-delivery | `authorization.endpoint`; an `endpoint` grant to change it |
| Publication limits | stop at the authorized endpoint | none | a `limitations` entry; a missing remote or GitHub never widens or silently narrows the endpoint |
| Review findings | none | addressing a batch of PR findings, which covers the fixes, replies and eligible resolutions for that one batch | a `review_round` grant, consumed by one claim |
| Review waiver | PR delivery requires applicable review evidence | an explicit waiver permitted by repository policy | a `review_waiver` grant; it never clears failed reviews, pending findings or a required independence gate |
| Monitoring | `none` | `observe` (read and report only) or `remediate` (fix and publish within the delivery's scope) | `authorization.monitoring`; a `monitor_observe` or `monitor_remediate` grant per watch |
| Merge | never | an explicit merge request | `authorization.merge` through a `merge` grant; recording it performs nothing |
| Takeover | never | the user's statement that the other session has stopped | a `takeover` grant plus `--force --reason` |
| Recovery | reconcile an already-authorized interrupted operation | anything beyond that operation | a `reconcile` grant |

- A ready PR does not authorize monitoring. Neither does an open PR, a generic CI watch, a suggested `next` step, or a request that says not to monitor.
- Resuming a delivery or naming its ledger authorizes reading, verification and the work already covered by recorded grants. It does not authorize a new PR reply, fix, monitor or merge.
- One findings request or watch grant starts one batch or one watch. A later batch, a restarted watch after a user stop, or reopening a completed delivery needs a new request.
- When no remote, a non-GitHub remote, or missing PR tooling prevents the authorized endpoint, do the work up to verified local completion and report the limitation. Complete at the narrower endpoint only when the user's instruction permits it. Otherwise release the phase as blocked, or hand it off, with that limitation.
- Required CI for the endpoint is part of delivery; waiting on later review or CI state is not. Pending external checks are reported as pending, never as merge-ready.
- Explicit user limits (no posting, local only, no fixes) persist across phases and sessions.

## What A Repository May Override

Repository instructions may narrow, within the user's authority: validation scope and required lanes, the number of delegated reviews, model and effort defaults, and the default endpoint. They cannot create authority to merge, monitor, post or resolve threads, force-push, bypass hooks, or edit unrelated scope. Record the repository rules you applied in `authorization.repo_overrides`.
