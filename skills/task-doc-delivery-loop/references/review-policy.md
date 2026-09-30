# Review Policy (R3)

At bootstrap, record a provisional estimate as a source decision. Finalize it
immediately before the first frozen-candidate implementation assessment. Use
`measure`, then owner-only `set-review-bound --bound-file PATH` with the complete
`ReviewBound` payload in the ledger schema. Repeat before assessing every
replacement candidate. The helper never commits to obtain an OID.

The `basis` is `{files, packages, workspace_decision, delegated_decision}`.
`files` must match the helper's measurement against the recorded `diff_base_oid`.
`packages` lists affected leaf workspace package/app roots once, based on actual
workspace configuration, never invented folder boundaries. The referenced
`workspace_decision` in `sources.decisions` states the inspected configuration,
boundaries, affected paths and evidence. A non-package or root-only repository
uses `["."]`; `[]` is normalized to one root package. Use `null` when boundaries
cannot be established and explain why in that decision. These are owner-attested
workspace facts: the helper verifies their recorded source and structure, not the
semantic correctness of arbitrary workspace formats. Review must verify them.

Check large first: 40+ files or more than one affected package/app gives 3 cycles;
11–39 files in one gives 2; at most 10 files in at most one normalized package
gives 1. Unknown boundaries give `size_unknown` and 2. `size` names the current
classification; `max_rounds` retains the larger prior finalized base allowance if
the candidate later shrinks, never dropping below already used work.

A cycle is one frozen-candidate implementation assessment plus its associated
single remediation batch, if any. Its records share `cycle_id` and
`cycle_kind: implementation_review`. A post-PR batch acquires a new cycle only
when it causes a code fix (`post_pr_fix`); its disposition successor may acquire
that ID without changing the frozen batch. A fresh assessment of a replacement
candidate consumes another cycle. Spec/doc checks, audits, duplicate reports,
reply-only batches and local remediation verification have null cycle fields.
Retain all observations in `reviews`/`role_runs`, even when no cycle is used.
Record delegated implementation dispatches in `role_runs` before dispatch and
update them through successors; an escalation is another dispatch. Failed or
cancelled dispatches with no result consume no delegate allowance. Small may
use permitted inline review; independence remains a separate requirement.

`rounds_used` is derived from distinct current review cycles; `delegated_used`
from current delegated implementation dispatches. Duplicate retries and status
successors add nothing. `delegated_limit` is independently enforced, with its
policy cited by `basis.delegated_decision`. A repo's one-delegate rule wins even
when the size bound permits three cycles. Before dispatch or remediation, check
both limits. A delegated dispatch, including a failed run restarted by a
successor, reserves a cycle until a `delegated` review cycle records its result,
not merely until the run is marked complete. At exhaustion stop ungranted work
and report blockers.

`extension_rounds` starts at 0. `overrides` contains exact copies of recorded
review/remediation grants, each with positive `additional_cycles`; their sum is
the extension. A specific request to fix one further findings batch gives one
additional cycle if needed: quote that request in a `review_round` grant, record
it with `authorize` (or the fresh phase's atomic `claim`), then set the bound.
Do not ask again. A broader request must name its additional-cycle count. Neither
critical findings nor monitoring silently grant unlimited cycles. A remediation
extension does not raise `delegated_limit`; raising that needs explicit authority
for more delegated review and a separately recorded policy decision. It never
changes endpoint authority. Keep prior grants when refreshing the bound.

Legacy R1 records with a null bound remain readable. Install a bound before a
new frozen implementation assessment or a fixing batch, under the same claim.
Without one, the helper refuses any frozen-candidate cycle and any committed
fix, with or without a `cycle_id`. A PR batch takes only a `post_pr_fix` cycle, and only when
it causes a fix.
Local-only deliveries use the same policy in their owner ledger decisions and
report an unmeasured limitation; they never commit just to finalize this helper's
frozen-OID bound. The owner enforces dispatch timing and natural-language scope;
helper mutations enforce installed bounds atomically, not external agent actions.

Before pushing remediation, complete the [shape sweep](../../review-implementation/references/risk-classes.md).
A done sweep is for the pushed candidate, names the search and result, and
may report zero siblings. It covers every fix in the candidate's history that no
verified push contains yet, including fixes carried into follow-up commits and
content-identified fixes whose manifests match the candidate. A push that carries
fixes needs the bound installed.
Pending or earlier-candidate sweeps do not pass, and the helper rechecks sweeps
when the push is verified. Recovery of an interrupted push records the observed
remote outcome without that recheck; complete any reopened sweep before the next
push.
Proposed vocabulary stays in the delivery ledger until accepted in separately
authorized skill-pack work.
