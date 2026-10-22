# Delivery review pilot results

Both guidance versions detected all three expected defect mechanisms. The revised version introduced no harmful suggestions on corrected cases. This sample demonstrates no detection improvement. One baseline objection depends on ambiguous return-contract wording. Its correctness is unresolved, so it establishes neither a defect nor a false positive.

## Results from the final cohort

The six final candidates have twelve completed assessments, one per version. Count detection by buggy candidate rather than finding count. The revised identity review split a mechanism into two findings that the baseline grouped together.

| Candidate | Baseline | Revised |
| --- | --- | --- |
| c01, Identity defect | run-07, detected, 39.4s | run-14, detected, 73.4s |
| c04, Identity correction | run-13, no findings, 41.2s | run-08, no findings, 63.0s |
| c05, Stale-action defect | run-03, detected, 62.5s | run-10, detected, 63.9s |
| c02, Stale-action correction | run-09, one ambiguous extra, 76.3s | run-04, no findings, 48.3s |
| c03, Authorization defect | run-05, detected, 41.6s | run-15, detected, 36.3s |
| c06, Authorization correction | run-11, no findings, 31.1s | run-06, no findings, 44.1s |

Baseline detected 3/3 buggy candidates; revised detected 3/3. Baseline raised one ambiguous extra across three corrected candidates; revised raised none. Neither version proposed a fix that breaks specified corrected behavior. Cumulative assessment time was 292.0 seconds for baseline and 329.0 seconds for revised. These totals include startup and tool time, exclude superseded attempts, and are not delivery wall time. Cost data is unavailable.

In run-09, the reviewer interpreted "reject duplicate pending cancellation" as requiring a rejected JavaScript Promise. The fixture already prevents the duplicate dispatch by returning `false`; its requirements specify no Promise rejection contract. The source and probe establish duplicate prevention, but the wording does not settle the Promise contract. The owner classified the extra as `unclear` and excluded it from confirmed-defect and false-positive counts. Throwing instead would not violate a specified return contract, so it is not counted as a harmful suggestion. No false-positive improvement is demonstrated.

## Fixture correction and replacement history

Initial run-01 found two valid additional lifecycle defects in the first corrected identity fixture. Navigating away and back could lose the pending guard and rejected reason. The owner changed it to retain independent state by record ID and clarified first selection versus return. Direct probes confirmed duplicate prevention, retained failed input, and independent current-record confirmation. Initial run-02 also found real identity and asynchronous-ownership defects in the buggy counterpart.

Both variants of the affected pair were assessed against the final requirements. The initial outputs and bytes remain retained as run-01 and run-02; they are outside the final score. This was one fixture correction with two additional valid assessments, not a rerun to improve a valid score.

Run-12 returned an invalid `completed` status and a string instead of the cleanup object. Its output was not accepted. Run-15 replaced it once with identical candidate and guidance bytes. No further replacement was needed. There were fifteen attempts in total: twelve final assessments, two retained initial assessments, and one malformed attempt. Shipping implementation review is separate from these experiments.

## Identities, provenance, and read boundaries

Baseline sources were frozen from delivery base `1223722f46475f6a79611c826a49f2db6ef270e1` before editing. The entrypoint SHA-256 values are:

- Baseline `e9dac7ce74a30128794d6a22784fb3b838ed23b0de1df5a0c89fd732e7fa58b3`.
- Revised `785ed77fc0fefae20ef8f1ab7d0ee3ea857c51e2e187d67004d1ab1f3cf05f27`.

The [fixture manifest](../tests/fixtures/review-pilot/manifest.json) records full candidate and requirement hashes, triggers, defenses, and source provenance. Its SHA-256 for this report is `796d66fbc9a4764fca6999b6d7ca53c8ca29dd162c8b08b03206fcb138e5cc91`.

The two historical mechanisms were checked against procurement UI PR 443 candidate `8f290a2bca56e6311c2868128e21978839045a08`, fix `d7981e74cb626cfab99ffdffba7881d7e9f65c50`, the original route/workspace, requirements, and added integration assertions. These fixtures are independently written portable reproductions. The original React application was not executed. The server authorization pair is explicitly synthetic.

All assessments used fresh Codex 0.163.0 contexts with no parent history and at most two concurrent jobs. Requested and observed settings were `gpt-5.6-sol`, `medium`. Exact briefs, source/input manifests, raw outputs, tool-read receipts, elapsed times, and result hashes are retained under `/Users/dee/agent-artifacts/delivery-review-pilot-2026-10-22/evidence/assessment-index.json`. Baseline and revised source trees and every input bundle are retained alongside it. Original private provenance is separate under `private-source/` and is not committed.

Each reviewer received a neutral candidate, requirements, selected skill tree, and input manifest. Pair labels, expected findings, fix identities, source descriptions, and other outputs remained outside those bundles. Tool records show only bundle reads and hashes; all input bytes remained unchanged. Read isolation was instructional, not an enforced per-job sandbox. No exploit, application mutation, gate, external request, or recursive delegation was observed.

## Validation and limits

The owner ran all six exported-interface probes, including the additional revisit and failure cases. They reproduced the three buggy mechanisms and verified corrected behavior without removing valid flows. Syntax checks passed for each frozen candidate. The retained probe and its results are delivery evidence, not another permanent application test layer. Existing portability and renderer tests continue to own structural contracts.

Revised actionable outputs used textual `confirmed` evidence. The scenario protocol separately supplies explicitly illustrative `plausible`/`unclear` and `refuted`/invalid mappings for contract inspection; those examples are not scored behavioral runs. Severity remains separate from verification. No role, mode, schema, cycle limit, or publication authority changed.

These are small standalone modules with supplied requirements, not representative application repositories. Guidance was explicit and fixtures omit integration complexity. Model sampling, the fixture correction, the ambiguous duplicate wording, and one malformed output limit comparison. The findings establish neither statistical superiority nor reduced production incidents.
