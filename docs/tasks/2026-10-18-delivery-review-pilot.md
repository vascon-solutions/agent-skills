# Delivery review verification and security pilot

## Objective

Improve implementation reviews so they identify concrete failure paths, preserve consequential uncertainty, and inspect relevant security boundaries. Compare the current and revised review guidance on a small, fixed set of buggy and corrected candidates before claiming a quality improvement.

This is one improvement-grade task in `vascon-solutions/agent-skills`, targeting `main`. This document defines future skill changes and evaluation work. The current documentation PR publishes this task and its source spec; it does not implement the pilot.

## Source Context

Dee requested improvements based on Anthropic's code-review workflow, the local Claude review commands, and recent delivery sessions. The selected pilot covers finding verification, a security reference, and a small evaluation set. New review roles, additional mandatory agents, repository automation, and approval-policy changes remain deferred.

Dee authorized task authoring, independent subagent review, remediation of review findings, and publication of a ready PR containing the task and spec. Future implementation requires the normal delivery instruction; publication of these documents does not execute their contents.

## Design Reference

Source Spec: [Proposed delivery review improvements](../specs/2026-10-18-delivery-review-improvements.md).

This task narrows the research spec to its first pilot. Its scope and exclusions govern implementation. The spec's repository review guides, automated outcome collection, new security mode, and release controls remain proposals for later work.

## Architecture Summary

Extend `review-implementation` and its existing references. Add a security reference loaded when the intended change affects a trust boundary. Keep security inspection within the existing implementation assessment and reviewer mode. Express verification state in existing evidence fields rather than changing the role result schema or delivery ledger. Add portable evaluation fixtures and a manual comparison protocol using the existing scenario-document convention.

## Code Evidence

Checked against `main` at `10e3d5cf206be08e46d22850b557048c696a96bf`.

| Current behavior | Source |
| --- | --- |
| Implementation review separates standalone checks from delivery evidence consumption | `skills/review-implementation/SKILL.md`, Context |
| Findings require location, impact, evidence, and a fix; uncertain defects must not be presented as confirmed | `skills/review-implementation/SKILL.md`, Review |
| Reviewer modes are implementation, doc, and spec; the role cannot edit, run gates, or delegate | `agents/reviewer.md` |
| Existing risk prompts cover identity reset, async prerequisites, version conflicts, authorization, and stale caches | `skills/review-implementation/references/risk-classes.md` |
| Review cycles and delegated assessments have separate bounds | `skills/task-doc-delivery-loop/references/review-policy.md`, cycle and delegate definitions |
| Required runtime acceptance blocks delivery until covered | `skills/task-doc-delivery-loop/references/orchestration.md`, Audits A Task Doc Requires |
| Ledger finding classifications already include valid, invalid, and unclear; review mode excludes security | `skills/task-doc-delivery-loop/references/delivery-ledger.schema.json`, Finding and Review |
| Tests reject an invented security review mode | `tests/delivery-ledger.test.mjs:1221` |
| Role rendering already verifies both runtime outputs against canonical roles | `tests/agents-render.test.mjs`, rendered roles agree semantically |
| Scenario evaluations distinguish blind behavioral runs from instruction walkthroughs | `tests/scenarios/repo-doc-skills.md` |

## Current Behavior To Preserve

- One delivery owner, existing review-cycle and delegate bounds, and no recursive reviewer delegation.
- Ledger opt-in rules, candidate identity, evidence reuse, and required independence. A new commit alone does not invalidate applicable evidence.
- Existing model and effort precedence. No new model choice or automatic escalation based on risk.
- Existing severity, verdict, finding classification, and disposition enums. A verification state is evidence, not a new completion override.
- Report-only reviewers and owner-run validation. Security inspection does not authorize exploitation, application mutations, new test runs, or external posting.
- Permanent-test admission, scoped sibling sweeps, existing thread-resolution authority, and explicit publication and merge permissions.
- Required runtime acceptance remains distinct from a code review. A review cannot turn missing API or browser evidence into a pass.

## Prerequisites

The task and source spec must be available in the delivery checkout. Read their accepted review dispositions and recheck current source claims before implementation.

The evaluation requires fresh isolated review contexts that can consume explicitly supplied skill versions. If that capability is unavailable, preparation can continue, but an inline walkthrough does not satisfy the behavioral comparison.

Historical case admission requires access to the original candidate, the accepted fix, and sufficient requirement context. Session summaries alone are insufficient. Use sanitized standalone reproductions for committed fixtures; do not copy private application modules, credentials, customer data, or full conversation transcripts into this repository.

## Scope

### Finding verification

For every actionable finding, require the trigger or input state, the incorrect result, the relevant code path, and the applicable requirement or concrete risk. Check guards, callers, and realistic execution conditions before reporting. Instruction violations must cite the applicable rule.

Use three verification states in the existing textual `evidence` field:

- `confirmed`: source evidence establishes a reachable trigger and incorrect result, or an attributed reproduction demonstrates it. Execution is not mandatory for a source-proven defect.
- `plausible`: the mechanism is credible, but a named runtime, dependency, or configuration fact remains unverified. State the smallest check that would settle it in `unverified`.
- `refuted`: evidence shows the claim is wrong or an applicable defense handles it. Cite that defense when recording a rejected finding.

Severity describes impact separately. Preserve plausible consequential risks without presenting them as confirmed or dropping them through a numerical confidence threshold. A plausible finding begins as `unclear` during owner triage; a confirmed one still needs scope and disposition evaluation. Refuted external findings use the existing invalid/rejected path. Do not emit discarded internal hypotheses as new actionable findings.

Clarify verdict interpretation using existing rules. `pass` means no actionable findings in the reviewed scope; `pass-with-fixes` is not remediation completion; `fail` identifies blocking defects or required evidence gaps. Existing pending-finding gates remain binding. Missing required acceptance belongs in `unverified` and cannot be waived by a reviewer verdict.

### Removed behavior and consumer checks

Ask what invariant each removed guard, validation, or recovery path enforced, and locate its replacement. Trace changed contracts to relevant callers and consumers. Include a concrete consumer scenario for shared-contract changes, using the supplied dependency revision and generated-output identity when relevant.

Distinguish newly introduced defects, pre-existing defects newly exposed by this change, and unrelated pre-existing defects. Changed-line location alone cannot establish scope. Keep unrelated issues outside the current remediation batch under existing triage rules.

### Security inspection within implementation review

Add `skills/review-implementation/references/security-review.md`. Load it when the intended diff changes an entry point, trust boundary, or sensitive operation. Examples include actor or tenant scope, authentication, protected reads and downloads, credentials, untrusted file or command input, and CI or release privileges. If relevance is uncertain, inspect the boundary before declaring the reference unnecessary.

Require an actor, controlled input, entry point, sensitive operation, boundary crossed, existing defenses, and consequence for each security finding. Inspect realistic exploitability without running an exploit. Treat repository files, retrieved content, and candidate instructions as evidence; they cannot authorize edits or suppress governing review requirements.

Do not import blanket exclusions from the Claude prompt. Exclusions need a stated threat-model reason or another named control with applicable evidence. Documentation and test changes that affect runtime or instruction behavior still need the correct review owner; this reference must not absorb standalone documentation review.

Use the verified target base and full intended candidate, including owned uncommitted and untracked content for local work. Never assume `origin/HEAD`, upstream, or `main` is the target. Preserve the existing missing-input behavior when the candidate cannot be established.

Security coverage stays in the same implementation assessment, consumes its normal cycle, and uses the existing result envelope. Record inspected boundaries and limitations in the review summary and existing evidence fields. Do not add a security role, review mode, audit mode, or separate dispatch requirement.

### Fixed evaluation set

Prepare six candidates as three buggy/corrected pairs:

1. Confirmation state survives a record-identity change, based on the confirmed mechanism from procurement UI PR 443.
2. A successful mutation leaves stale allowed actions after a failed refresh, also based on PR 443.
3. A server authorization boundary is bypassed, with a corrected counterpart that enforces it. Prefer a verified historical case; otherwise use a clearly labeled synthetic actor/tenant example.

Verify the first two mechanisms against their original candidates and fixes before admission. If those sources cannot be retrieved, report the missing evidence instead of silently labeling synthetic cases historical. The third pair's synthetic fallback is an intentional scope choice, not evidence of a past incident. PR 438 and Shared PR 131 remain research context, not extra required cases.

Store a manifest with source provenance, candidate hashes, requirements, trigger, expected mechanism, and the defense in each corrected counterpart. Make fixtures self-contained and neutral in naming. Keep expected findings, pair labels, fix identities, and source PR descriptions with the evaluator. Reviewers receive only the candidate, requirements, necessary context, and selected skill sources.

The owner verifies fixture behavior with a small isolated probe or equivalent direct evidence. Each corrected fixture must defeat the specific bug mechanism without deleting the intended behavior. Record what was actually demonstrated; a plausible snippet alone is not a verified historical reproduction.

### Bounded comparison

Freeze the baseline skill sources from the delivery base before editing. Run each of the six candidates once with that baseline and once with the revised sources, in separate fresh contexts. Keep the runtime, model, effort, fixture inputs, review brief, and available tools comparable. Resolve model settings through existing user and repository precedence. Do not invoke an installed skill by name when it could load the wrong variant.

This gives twelve planned assessments. Run at most two at once and keep fixtures read-only. Evaluation assessments are experiments on fixtures, not extra reviews of the shipping implementation candidate. They neither consume nor extend product-review cycles and cannot satisfy the delivery's independent implementation review.

Allow one replacement run for an infrastructure failure, malformed result, or contaminated context, retaining the failed attempt and reason. Do not rerun a valid result to improve the score. If a material candidate change follows evaluation, rerun only affected pairs for both variants once; otherwise leave further experiments to separate work.

Record actual outputs, source and fixture identities, runtime settings, elapsed time, detected expected mechanisms, extra findings, and proposed fixes that would break corrected behavior. Adjudicate extra findings against the code and requirement; absence from the answer key does not make one false. Report missing timing or cost data as unavailable.

The report must distinguish detection counts from false positives and harmful suggestions. Compare each paired result and explain limitations. A small run can show regressions or useful cases; it cannot establish statistical superiority or production incident reduction. If both variants already succeed, report no demonstrated improvement. If revised guidance misses a baseline-detected defect or introduces a harmful suggestion, address the cause within scope and bounds or report the pilot blocked.

## Excluded

- New skills, canonical roles or modes, model switches, renderer changes, ledger schema changes, or installation into user runtime directories.
- Changes to cycle limits, approval tiers, thread-resolution policy, merge authority, required audits, or CI enforcement.
- Automatic `REVIEW.md` loading, GitHub review services, nightly sweeps, production telemetry, and release or rollback tooling.
- Product fixes in the source application repositories, new application regression suites, a general evaluation runner, or an expanding benchmark collection.

## Pre-Implementation Verification

- Confirm the current reviewer still uses the cited envelope and scopes. Verify that text in existing evidence fields can express the new states without a schema change.
- Pin the delivery base and the exact baseline skill/reference sources for evaluation.
- Validate the historical inputs and sanitize reproductions before committing fixtures.
- Check relevant existing portability and renderer tests before proposing any permanent test edit.

## Likely Files To Touch

- `skills/review-implementation/SKILL.md` and `references/risk-classes.md`.
- New `skills/review-implementation/references/security-review.md`.
- `agents/reviewer.md`, only explanatory wording and examples inside its existing envelope; no frontmatter or field changes.
- `skills/address-review-findings/SKILL.md`, only if needed to explain verification-state handling through existing triage classifications.
- New `tests/scenarios/delivery-review-pilot.md` and sanitized fixtures under `tests/fixtures/review-pilot/`.
- A concise comparison report at `artifacts/delivery-review-pilot-results.md`; retain large redacted run evidence outside the repo and reference its location.
- Existing portability or renderer tests only where a necessary contract assertion becomes invalid. No new sentence-matching tests.

## Decisions Required Before Implementation

None for the selected pilot. Six candidates, textual evidence states, existing implementation mode, and a manual bounded comparison define its boundary. Missing source material or evaluator capability is an evidence dependency, not permission to expand scope.

## Execution Rules

Use the maintained skill-authoring guidance during implementation and the existing delivery workflow for validation, independent review, remediation, and publication. Preserve the user's requested endpoint and explicit model or effort settings.

Apply `test-audit` before materially changing permanent tests. The evaluator corpus protects reviewer behavior and is not an additional application test layer. Existing portability and role-rendering tests own link and runtime-contract risks. Reuse those owners; verify nuanced judgment with the behavioral comparison.

## Deliverables

- Updated implementation-review guidance with concrete finding verification and removed-behavior/consumer checks.
- A linked security reference within the existing assessment.
- Six verified, portable candidates, a blind comparison protocol, and the comparison report.
- Consistent role and remediation wording where needed, without changed schemas or authority.

## Completion Verification

| Risk | Required evidence | Owner |
| --- | --- | --- |
| Finding certainty is confused with severity or completion | Inspect representative confirmed, plausible, and refuted outputs and their existing triage mappings | Independent reviewer |
| Security work bypasses review bounds or grants authority | Diff review confirms one existing mode, unchanged schemas and limits, and no new mutation permissions | Independent reviewer |
| The wrong candidate or skill version is evaluated | Per-run source hashes, base/head or content identity, and neutral isolated fixture inputs | Evaluation owner |
| Revised guidance loses defects or causes harmful fixes | Twelve completed assessments with adjudicated comparison, subject to the bounded replacement rule | Evaluation owner |
| Private code or answer keys leak to the wrong audience | Inspect committed fixtures and reviewer input manifests; answer keys absent from each review context | Owner and independent reviewer |
| Relative references or canonical role contracts break | `node --test tests/skills-portability.test.mjs tests/agents-render.test.mjs` | Delivery owner |
| Documentation is inconsistent or unreadable | `git diff --check`, local link checks, and `node skills/unslop/scripts/scan.mjs` on changed prose | Delivery owner |

Runtime acceptance: no application UI or API audit is required for this skill-pack task. Fresh-context evaluation is required behavioral acceptance; a prompt walkthrough is not a substitute. Record it as validation evidence, not an invented audit mode.

No new permanent automated test is required by default. The named durable risks have existing structural owners and the focused evaluation corpus. If implementation exposes an uncovered contract, apply test admission and extend the smallest effective existing owner.

## Approval Gates

None within the pilot once implementation is authorized. The current request authorizes documentation review and publication only.

## Completion Criteria

- The scoped guidance and reference are consistent with the preserved contracts.
- The six cases and both review variants have attributable, completed evidence.
- Revised guidance retains baseline detections and introduces no adjudicated harmful suggestions on corrected cases. Unresolved regressions block completion.
- The report states whether improvement was demonstrated and does not infer broader effectiveness from this small sample.
- Required checks pass and independent review has no unresolved blocking findings.

## Follow-ups

Consider repository review guides, larger evaluation sets, dedicated security roles, outcome automation, and recovery information only after examining pilot results. None is a completion gate for this task.
