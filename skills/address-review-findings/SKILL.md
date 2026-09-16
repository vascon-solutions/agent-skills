---
name: address-review-findings
description: Use when a current batch of review findings needs evaluation or fixes. Handle the batch once; ongoing PR review watching belongs to monitor-pr-review.
---

# Address Review Findings

Verify review findings against code, requirements, and prior decisions before acting. Technical evidence determines whether a fix is warranted; do not treat reviewer suggestions as orders.

## Route And Bound The Batch

Use `review-implementation` first for a review-and-fix request without existing findings. For task-doc or documentation findings, use the relevant report-only reviewer when a new review is needed, then return here for authorized corrections. QA reports belong to `qa-triage-and-fix`.

For a PR, retrieve one complete starting snapshot of the relevant reviews, inline threads/replies, head, and checks, following pagination. Freeze the current findings as this invocation's batch. Read-only collection may use the helper in `../monitor-pr-review/scripts/fetch-pr-review-state.mjs` without starting that skill's monitor.

Explicit ongoing PR-review watching or repeated remediation until quiet routes to `monitor-pr-review`. A ready PR, generic CI watch, or negated request such as 'do not monitor' does not authorize that workflow.

## Evaluate And Remediate

- Classify each item as `valid`, `invalid`, `unclear`, `out_of_scope`, `informational`, `duplicate`, or `already_resolved`. Verify code, tests, source contracts, current dependencies, and established decisions. Seek actual usage before adding speculative functionality.
- Explain rejection with evidence. An invalid finding can expose a different real issue; treat it separately and verify it rather than accepting the original premise wholesale.
- Investigate unclear technical facts when available evidence can settle them. Ask about unresolved product or architectural choices; pause only the affected cluster and continue independent fixes.
- A report/evaluation-only request does not authorize edits or messages. A request to address PR findings authorizes scoped remediation and the necessary publication/replies, subject to explicit user limits. Preserve a local-only or no-posting request.
- Fix valid in-scope findings as coherent groups, highest risk first. Aim for one validated replacement candidate and push for the batch, rather than publishing each small edit. Reuse [validation evidence](../task-doc-delivery-loop/references/validation.md); use [focused debugging](../task-doc-delivery-loop/references/debugging.md) for failures.
- Run one final focused implementation review after material behavior changes when the request includes review-and-fix or a delivery owner requires it. Do not restart review for wording/import-only changes. Beyond that, continue for critical/blocking findings or explicit instruction; disclose remaining items instead of looping over polish.

## Publish And Respond

Use `publish-branch` for authorized commit/push work with the existing validation evidence and verified PR base/head. Do not create an empty commit for reply-only work.

Before sending Markdown replies, read [GitHub transport](../publish-branch/references/github-transport.md). Reply once in the original inline thread, not a top-level PR comment. After the valid fix is remotely verified and the reply is confirmed, resolve its thread. Resolve duplicate/already-resolved items only when the remote evidence confirms their disposition. Leave rejected, unclear, informational, and out-of-scope threads unresolved unless the user explicitly directs otherwise.

After the batch, take one final read-only snapshot, report any new findings without automatically absorbing them, and stop. The monitor owns subsequent batches only when separately requested. Never duplicate a successful reply because a later resolution or read-back failed.

Report findings fixed/rejected/deferred/blocked, supporting reasons, candidate and publication state, validation evidence/gaps, and remaining reviewer or user dependencies.
