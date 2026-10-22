# Delivery review pilot comparison

Use this protocol to compare two frozen implementation-review versions on six portable candidates. These are reviewer experiments, separate from product regression tests and the shipping candidate's independent review.

## Freeze the evidence and isolate each assessment

Read the [pilot task](../../docs/tasks/2026-10-18-delivery-review-pilot.md) and the evaluator-only [manifest](../fixtures/review-pilot/manifest.json). The manifest owns provenance, candidate and requirement hashes, expected mechanisms, pair membership, and corrected defenses. Keep it with the evaluator.

Verify historical admission against the original candidate, accepted fix, and requirements. The first two pairs independently model mechanisms verified from procurement UI PR 443. The authorization pair is synthetic. Private source stays outside this repository; portable probes demonstrate the sanitized mechanisms, not execution of the original application.

Freeze baseline skill sources from the verified delivery base before editing, then freeze revised sources before evaluating. Copy each version's linked references so relative links load that version. Do not invoke an installed skill by name or load one version's references from the other checkout.

Prepare twelve neutral input directories, one per candidate and guidance version. Each contains only the candidate, requirements, selected skill tree, and a SHA-256 input manifest. Keep pair labels, fix identities, source descriptions, provenance, expected findings, and other assessments outside every directory. Use fresh contexts without parent history and restrict reads to the supplied directory. Verify actual read paths afterward; isolation is instructional where the runtime cannot enforce a per-job filesystem boundary.

## Probe behavior before scoring

The owner runs small isolated probes outside the repository. Confirm all six candidate hashes and syntax first. Probe these behaviors through each module's exported interface:

- For identity state, open confirmation on A, enter a reason, select B, and confirm. Verify B's initial state and the dispatched ID. Check pending A settlement cannot clear B's draft. Check returning to pending A blocks a duplicate, and a rejected A retains its reason for retry.
- For mutation state, return a successful cancelled record and reject the refresh. Observe the final record and allowed actions. Also check successful refresh, rejected commands, blank reasons, and duplicate pending commands.
- For authorization, request a known other-tenant record and a same-tenant record as a non-reader. Check denied contents and preserve valid-reader downloads, inactive-actor rejection, and absent-record handling.

A corrected fixture must defeat its paired mechanism while retaining required behavior. Do not infer verification from plausible code or a syntax check alone. Preserve the probe, observed results, and input identities outside the repository.

## Give the same bounded brief to fresh reviewers

Use the same runtime, resolved model and effort, tools, brief, and fixture bytes for both variants. Vary only neutral run IDs, paths, content identities, and the selected guidance. Use the existing result envelope and severity rules; do not tell reviewers the expected result or a minimum finding count.

A suitable brief is:

```text
Perform one independent implementation review using only the supplied
<run-root>/skills/review-implementation/SKILL.md and its linked references.
Review <run-root>/candidate.mjs against <run-root>/requirements.md.
The complete intended diff adds this module to an empty fixture base.
Verify the candidate identity against <run-root>/input-manifest.json.
Owner evidence: node --check passed for these bytes. No UI/API acceptance
checkpoint is requested. No additional code or guard exists beyond the
requirements. Use delivery-review context. Only reads and hashing inside
this bundle are permitted. Do not run code, gates, edits, external requests,
or delegation, and do not inspect other runs or evaluator material.
Return exactly the standard JSON envelope with this run ID. Stop after
this assessment, within the recorded task-bound timeout.
```

Run at most two assessments concurrently. Record requested and runtime-observed model and effort separately, full input hashes, the exact brief and output, elapsed time, and unavailable cost data. Keep fixture bytes stable while reviewers run.

Allow one replacement per infrastructure failure, malformed result, or contaminated context. Retain the failed attempt and reason. Never rerun a valid result for a better score. After a material correction, repeat only affected pairs for both variants once; retain the initial findings and identify the final comparison cohort.

## Adjudicate mechanisms and suggestions

For each final assessment, record whether it detected the expected mechanism, any extra findings, and any proposed fix that would break required corrected behavior. Adjudicate extras against source and requirements; the answer key is not proof that an extra finding is false. Validate disputed mechanisms with an owner probe rather than another unrestricted assessment.

Count detection per buggy candidate, false positives per corrected candidate, and harmful suggestions separately. Compare both versions for each pair. Do not score different fixture revisions against each other. Report review time and actual remediation cycles without assuming missing timing or cost data.

Inspect the textual evidence-state contract separately from the score. A source-proven failure is `confirmed` but still needs owner scope triage. A credible vulnerability with an unknown deployed guard is `plausible`, starts as `unclear`, and names the smallest guard inspection in `unverified`. A rejected external allegation against an effective tenant check is `refuted`, cites that check, and follows the existing invalid/rejected path. These are contract examples, not extra scored assessments or claims of observed fixture findings.

Write the [comparison report](../../artifacts/delivery-review-pilot-results.md) with paired results, extra-finding dispositions, source identities, evidence location, and limitations. If both versions already detect the defects, state that no detection improvement was demonstrated. A revised missed baseline detection or harmful suggestion blocks the pilot unless addressed within the authorized bounds. Twelve small assessments cannot establish statistical superiority or production incident reduction.
