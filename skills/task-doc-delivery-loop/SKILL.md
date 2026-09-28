---
name: task-doc-delivery-loop
description: Deliver approved task docs through implementation, validation, review, and a draft PR. Use for execution, not discovery or report-only review.
---

# Task Doc Delivery Loop

Own delivery of one approved task doc or coherent ordered set in one repository. Preserve scope, exclusions, decisions, and existing authorization. An approved task doc satisfies discovery and design; do not start another planning or execution workflow.

## Endpoint And Scope

Default to a pushed branch and draft PR. A ready PR, narrower endpoint (local-only, commit-only, push-only), or merge requires explicit user wording; carry that wording forward without asking again. A ready PR does not authorize ongoing review monitoring. Never merge without explicit authorization. [Authorization](references/authorization.md) is the shared table for endpoint, monitoring, merge and what a repository may override.

Without a remote, with a non-GitHub remote, or without usable GitHub PR tooling, work up to verified local completion. That means implement, validate, review, and commit unless the user requested a narrower endpoint. Report the publication limitation. Complete at that narrower endpoint only when the user's instruction permits it; otherwise release the delivery as blocked with the limitation. Other-platform publication requires explicit direction.

Group docs only when they share one outcome, dependency order, release boundary, and reviewable PR. Separate independently shippable outcomes and primary repositories; coordinate already-authorized separate deliveries without inventing new scope. Consumer-owned generated or file-dependency refreshes belong to the consumer delivery.

## 1. Establish The Delivery

Read the task sources, relevant repo instructions, and Git state. Verify approval, prerequisites, target branch, existing PR/worktree identity, and intended dirty scope. Correct demonstrably stale mechanical references; ask only when missing approval or a material unresolved decision blocks safe work. Do not reopen settled decisions because a skill suggests another approval gate.

Use the current checkout when task-appropriate and safe. Use `isolated-worktree` for unrelated overlapping edits, protected-branch work without direct authorization, or concurrent mutators. Before installing in an isolated checkout, verify relative/file dependencies resolve to the intended sibling revision and build output; a lockfile alone does not prove freshness.

Keep the delivery in a [delivery ledger](references/delivery-ledger.md) through its helper, `scripts/delivery-ledger.mjs`, never by editing its JSON. Use the [worked examples](references/delivery-examples.md) for first use, a resume, or a findings batch. The owner handles this bookkeeping; the user can ask to deliver or continue without supplying JSON, hashes, revisions or claim IDs.

After resolving the task, checkout, target base and endpoint, use `prepare-init` to generate the input files and source hashes. Fill the existing decisions, authority, dependency identities and audit policy, then `init` and `claim`. If this branch already has a ledger, validate and resume it instead. One claim covers the whole owner session: nested remediation, audit and review coordination, and publication all use it, and never claim again. Generated defaults are not evidence: carry a supplied spec check and requested audit forward. Otherwise record `not_run` or `skipped` for the spec check with its reason, and `not_requested` for an unrequested audit. Read current scoped instructions and any relevant fact the phase needs. Use an existing matching goal when present; create goal tooling only when explicitly requested. Do not require a new durable plan or intermediate commits for routine work.

For migrations, auth/permissions, broad refactors, or dependent phases, record order, prerequisites, irreversible boundaries, and recovery/validation checkpoints. Write a separate plan only when the sequencing needs a durable handoff or the user requests it. Do not prewrite the implementation as a second code document.

## 2. Implement And Validate

Use one implementation owner by default. Delegate bounded independent work only when requested or justified and authorized by applicable instructions. Do not require a fresh implementer and two reviewers for every small step. Preserve explicit model and effort choices; otherwise inherit runtime defaults and scale review depth to risk.

Read [validation](references/validation.md) when choosing checks or reusing evidence. Implement in dependency order with focused checks during development and one deduplicated required final gate. Generate the content manifest with `content-manifest --output-file`; the helper enumerates changed paths and computes modes, hashes and the content identity. Supply relevant input identities and explicit exclusions backed by scope decisions. Record each check with the identity it tested: the manifest for working or local-only content, the frozen OID for a committed gate. For local-only work, never create a commit to give the ledger an OID. Capture failing behavior before a bug fix when practical; add durable tests for named behavioral or contract risks, not for incidental copy, CSS, or DOM shape. Runtime UI acceptance may require browser inspection without requiring a permanent browser test.

Delegate a requested browser audit (`audit-ui`) to an available audit role, such as a `ui-auditor` agent definition, when the runtime offers one. It does not use up the repository's delegated implementation-review allowance. Run it on a cheaper model only when no explicit model or effort choice from the user or repository is in force. Implementation and fixes stay with the delivery owner. Before delegating, prove which URL serves the candidate. Hand over a brief with URLs, available test personas and secure credential sources, fixture identifiers and scenarios, so the auditor does not rediscover them. Consume its verdict, findings and report path, not its transcript, and send rechecks for affected checkpoints only. If the runtime cannot select the role, perform the audit inline and record that limitation (`role_runs` with `execution: inline` and its `fallback_reason`). A failing audit stays failing until fixed and rechecked.

When a check fails, read [debugging](references/debugging.md), investigate, and fix related failures within the authorized scope. A recoverable failure is work to do, not automatically a user approval gate. Record unrelated/environmental failures and their effect on completion.

## 3. Review And Remediate

Use `review-implementation` in delivery-review mode with the task sources, complete diff, candidate identity, prior decisions, and validation evidence. Use one independent reviewer when requested or required and available; otherwise perform a local review and identify its limits. When an independent review is required and no approved independent reviewer is available, report the gate as blocked (a `role_runs` record with `fallback_reason: independence_required`); a self-review is only ever supplementary. Additional task-boundary reviews need an explicit gate or a material risk boundary. A PR-bound delivery receives review unless the user explicitly waives it and repo policy permits that.

Use `address-review-findings` to evaluate valid, invalid, unclear, and out-of-scope findings. Apply valid fixes as one coherent batch. Rerun invalidated checks; request one final focused review only after material behavioral remediation. Where repo policy permits another delegated review, use a fresh reviewer with the remediation diff, original findings, claimed dispositions, affected requirements and candidate identity. Otherwise verify remediation locally and state the independence limit. Record review dispositions in the ledger before publishing. Continue beyond this bound for new critical/blocking findings or explicit instruction, not endless polish. Keep independent work moving when one finding needs clarification.

## 4. Publish And Close

Use `publish-branch` for the agreed endpoint. Supply candidate identity and applicable evidence; publication must not invent another validation plan. If a validated commit is supplied, use exact-candidate mode. Otherwise commit the intended scope, account for hook changes, and verify the resulting candidate before pushing. For a commit, push or PR endpoint, `freeze` the final intended commit after hooks and publish that frozen candidate unchanged. Cite the original precommit review and audit records when their manifests still match the frozen content; a commit alone does not require another review or audit. Hand `publish-branch` the ledger under your claim; it records each push and PR write as a prepared, then verified, publication. Keep this delivery's summary block in the PR body.

Take one final PR snapshot: URL, base, draft/ready state, head, checks, reviews, and unresolved threads. Pending CI or reviewer approval is external state: report it accurately without calling the PR merge-ready. For a create-PR endpoint, report delivery complete with pending external checks clearly separated; keep any explicitly requested green-CI, approval, or merge gate open until satisfied. Do not wait for review or remediate newly arriving comments automatically. A separate current-findings request uses `address-review-findings`; explicit ongoing PR-review monitoring uses `monitor-pr-review`. Generic CI watching is read-only unless remediation is requested.

When monitoring was requested, consume its result once: `quiet_complete` returns to the agreed closeout gates; `waiting_for_reviewer` and `waiting_for_user` identify dependencies; `blocked` follows runtime blocking policy; `externally_terminated` requires checking closed/merged state. A quiet window or spent budget is not proof of completion.

Split phases into fresh sessions by default; keep one session when the user asks and record `session_mode: same_session`. At the endpoint, or on interruption when you can hand off safely, `release` the ledger with the applicable `next` (or none), and give the ledger path and a copy-ready continuation brief. Otherwise leave the claim in place. `next` is advice and authorizes nothing. Do not launch another CLI, create a task or schedule a monitor to get a fresh session, and never abandon authorized unfinished work for a cleaner context.

Report what shipped, task checkpoints, branch/commit and PR when applicable, review/finding dispositions, verification evidence and gaps, preserved unrelated files, and remaining dependencies. Shape the report with `unslop`: outcome and gaps first, no session narration, evidence in place of adjectives, inside the completion-report budget. Reuse valid evidence instead of rerunning commands merely to write the final answer. Retrospect briefly on repeated cycles or notable delays, distinguishing measured overhead from estimates.
