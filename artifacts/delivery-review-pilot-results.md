# Delivery review pilot results

Both guidance versions detected all three expected defect mechanisms in twelve valid final assessments. Neither proposed a fix that breaks specified corrected behavior. The revised version raised one uncertain return-contract objection. This sample demonstrates no improvement in detection or false positives.

## Results from the valid cohort

Count detection by buggy candidate, independently of finding count. Malformed outputs are excluded entirely.

| Candidate | Baseline | Revised |
| --- | --- | --- |
| c01, Identity defect | run-19, detected, 63.8s | run-24, detected, 53.2s |
| c04, Identity correction | run-23, no findings, 47.8s | run-20, no findings, 58.8s |
| c05, Stale-action defect | run-03, detected, 62.5s | run-22, detected, 44.8s |
| c02, Stale-action correction | run-21, no findings, 45.3s | run-16, one unclear extra, 48.5s |
| c03, Authorization defect | run-17, detected, 34.3s | run-25, detected, 39.5s |
| c06, Authorization correction | run-11, no findings, 31.1s | run-18, no findings, 62.4s |

Baseline detected 3/3 buggy candidates; revised detected 3/3. Neither had a confirmed false positive. Revised had one `unclear` extra across three corrected candidates; baseline had none. Neither had a harmful suggestion on corrected cases. Cumulative valid-assessment time was 284.8 seconds for baseline and 307.1 seconds for revised. These include startup and tools, exclude rejected attempts, and are not delivery wall time. Cost data is unavailable.

Run-16 interprets "reject duplicate pending cancellation" as requiring a rejected JavaScript Promise. The module prevents the duplicate dispatch by returning `false`, but requirements do not explicitly define that return contract. Its source path is reachable; the alleged instruction violation remains uncertain despite the reviewer's `confirmed` label. The owner classified it as `unclear`, excluding it from confirmed-defect and false-positive counts. Throwing instead does not break a specified return contract, so it is not counted as harmful. This case does not demonstrate improved certainty handling.

## Output-contract failures and authorized replacements

Independent shipping review caught incomplete envelope validation. The initial report had wrongly accepted object verdicts and capitalized severity values. Ten of the twelve assessments selected after fixture correction were malformed: four baseline and all six revised. Their findings, scores, and timing conclusions were rejected. These failures are observed output-contract failures, not successful assessments.

The corrected validator checks the canonical key set, string verdict, lowercase severities, finding fields, cleanup, and status/blocker rules in both directions. It checks uncertainty strings, artifact references, and the read-only experiment boundary. Thirteen focused positive/negative controls pass; reassessing all outputs still gives twelve accepted and thirteen rejected. It never normalizes malformed evidence into a pass. Replacement briefs reformatted the instructions and made existing serialization constraints explicit, without findings or answer hints. Candidate, requirements, guidance, model, effort, tools, and review method stayed fixed. Two valid earlier assessments were retained; ten final assessments came from replacement contexts. This brief difference limits comparison.

The revised authorization assessment's first replacement, run-15, also failed the severity contract. The owner authorized one further assessment with "Allow one additional assessment". Run-25 used that single exception. No further allowance was inferred.

There were 25 attempts in total: twelve accepted final assessments and thirteen malformed outputs. This includes two initial identity-fixture attempts, one affected-pair correction, and eleven output-format replacement attempts. All raw failures, input bytes, recovered task payloads, hashes, and receipts remain retained. The earlier report and incorrect audit records remain retained outside the repository beside the corrected records.

A second independent review found that the saved `brief.json` files contained ambient child context rather than dispatched tasks. The owner recovered all 25 exact plaintext task payloads from the visible dispatch calls in the active conversation. Each is retained as `dispatched-task.txt` and `dispatch-payload.json`, with hashes and original dispatch IDs in the index. Persisted parent task text is encrypted, so recovery provenance is explicit in `dispatch-provenance.json`. Replacement diffs are retained; the old ambient logs remain separate.

That review also found missing validator cases for non-complete results with null blockers and malformed collection entries. The owner fixed and locally checked them. Both original independent review cycles were used; these final evidence fixes received local verification without another independent assessment. No further model assessment or review extension was inferred.

## Fixture behavior and provenance

The initial corrected identity fixture lost its pending guard and failed reason when revisiting a record. An owner-run negative-control probe independently reproduced both failures from its retained bytes. The correction stores separate state by record ID and clarifies first selection versus return. Final probes confirm duplicate prevention on revisit, retained failed input, and independent current-record confirmation. Both variants of the affected pair used the final fixture and requirements.

The historical mechanisms were verified against a private client UI candidate, its accepted fix, requirements, and integration assertions. Source identities and paths are retained outside the repository and bound by the private-file hash in the manifest. Fixtures are independently written portable reproductions; the original application was not executed. The server authorization pair is explicitly synthetic.

The owner probed all six modules through their exported interfaces. Probes reproduce the three buggy mechanisms and verify corrected behavior, successful flows, rejection recovery, and duplicate guards. Syntax and fixture hashes passed. These probes are delivery evidence outside the repository. Existing portability and renderer suites own structural contracts; no new permanent automated test layer was added.

## Identities and read boundaries

Baseline sources were frozen from delivery base `1223722f46475f6a79611c826a49f2db6ef270e1` before editing. The following entrypoint SHA-256 values identify the versions used for the historical pilot:

- Baseline `e9dac7ce74a30128794d6a22784fb3b838ed23b0de1df5a0c89fd732e7fa58b3`.
- Revised `785ed77fc0fefae20ef8f1ab7d0ee3ea857c51e2e187d67004d1ab1f3cf05f27`.

The [fixture manifest](../tests/fixtures/review-pilot/manifest.json) records full candidate and requirement hashes, triggers, defenses, and neutral provenance. Its SHA-256 is `f4426a340e0d0aa39cf265726578f4a517f6877a06d220c031c964a88c62ba08`.

All assessments used fresh Codex 0.163.0 contexts with no parent history and at most two concurrent jobs. Requested and observed settings were `gpt-5.6-sol`, `medium`. Source/input manifests, outputs, recovered plaintext tasks, tool receipts, times, and result hashes are retained outside the repository. The retained assessment index and envelope audit identify every accepted or rejected result. Source trees and all input bundles remain alongside them; private provenance is withheld from this manifest and report.

Reviewers received only neutral candidates, requirements, selected skill trees, and input manifests. Pair labels, expected findings, fix identities, source descriptions, private material, and other outputs stayed outside their bundles. Tool records show bundle reads and hashes; all input bytes remained unchanged. Filesystem isolation was instructional. No exploit, application mutation, gate, external request, or delegation was observed.

## Limits of the result

The assessment bundles contained the candidate, requirements, and skills tree. They did not contain `agents/reviewer.md` or the canonical reviewer envelope template, and assessments used the default agent rather than the canonical reviewer role. The role-adapter change was therefore not behaviorally tested. The missing template could have contributed to malformed outputs, but this sample does not establish causation.

Post-review wording clarifies where to put security notes in the string verdict, adds requirement uncertainty to `plausible`, and corrects terminology. Those guidance changes were not rerun through the paired behavioral comparison. The separate focused checks exercise the current wording and role contract. The counts above apply to the frozen historical pilot versions, not to a behavioral evaluation of the current wording. Frozen fixture bytes and hashes are unchanged; the manifest records the duplicate-refusal wording ambiguity for its next revision.

The [evidence-state artifact](delivery-review-evidence-states.json) retains five actual post-review canonical outputs: four accepted checks and one excluded attempt. Each received the matching role contract and has input and dispatch hashes. Independent inspection confirmed a source-proven failure as `confirmed`/valid and an effective tenant defense as `refuted`/invalid. The duplicate-Promise output refutes the claim, while owner triage retains it as `unclear` because the frozen wording remains ambiguous. This disagreement is a calibration limit.

The inspector rejected the original synthetic missing-gateway-configuration check because its agent read an unrelated review skill outside the bundle. That contaminated attempt is retained and excluded from acceptance. Its single permitted replacement used identical input-manifest files, stayed within the bundle, and returned `plausible` with the missing configuration check in `unverified`. Independent inspection accepted that replacement and its existing `unclear` owner-triage mapping. The inspected configuration remains deliberately unknown in this synthetic scenario; no production compliance claim is made. These checks are separate from historical comparison scores. The independent inspector also ran a read-only diff check despite its no-gates brief; this boundary breach is retained in the artifact. Verification state remains separate from severity; no role, mode, schema, review bound, or publication authority changed.

These are small standalone modules with supplied requirements, not representative application repositories. Model sampling, integration omissions, ambiguous wording, the fixture correction, output failures, and clarified replacement briefs limit comparison. The experiment establishes neither statistical superiority nor reduced production incidents. It exposed an evaluator-contract failure and an uncertain instruction-violation claim; it does not justify a broader effectiveness claim.
