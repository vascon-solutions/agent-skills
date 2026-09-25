---
name: review-implementation
description: Review finished code against a task doc, spec, or acceptance criteria. Report findings; use address-review-findings for fixes.
---

# Review Implementation

Assess the work product against requirements and implementation risks. Report findings without editing product code, task docs, Git state, or GitHub. Reading a PR is permitted; posting, resolving threads, and publishing are not part of this skill.

## Context

- **Standalone review:** retrieve the referenced PR/diff, source requirements, relevant code, and existing check evidence using read-only tools. If necessary, run targeted local tests/typechecks/builds to substantiate a finding; use [validation guidance](../task-doc-delivery-loop/references/validation.md). Allow ordinary temporary test output, but do not alter tracked sources, install dependencies, or start costly/live diagnostics simply to fill a checklist. Report unavailable validation.
- **Delivery review:** consume the supplied candidate diff and validation evidence. Inspect files, read-only Git state, and source material independently. Do not rerun suites, build, install, format, start servers, or mutate GitHub. Request a specific missing or invalidated check from the delivery owner, explaining the gap. Evidence reuse is not blind trust: verify its scope and candidate identity.

Infer the context from the request; do not ask the user to choose a mode when it is evident. Find the referenced task from supplied context, PR links, or repo conventions before asking. If no authoritative source exists, label the result quality-only rather than inventing requirements.

## Review

Read relevant repo instructions and review the full intended diff, including uncommitted changes when in scope. Evaluate both requirement compliance and implementation quality: preserved behavior, excluded scope, contracts, errors/recovery, authorization, state transitions, accessibility, and adequacy of validation. Scale inspection to risk; do not demand a full repository tour or additional tests for cosmetic details.

When the diff adds or moves stateful UI (dialogs, forms, drafts, retry or idempotency tokens), check three risks that automated PR reviewers repeatedly catch after delivery:

- **Identity change:** a component the router or parent reuses across records (for example a route param change) drops dialogs, form values, and attempt tokens, so an action opened for one record cannot run against the next.
- **Async prerequisites:** controls that depend on another read (a selector fed by configuration, a roster, permissions) accept input only once that read has succeeded, and submission is gated only when the prerequisite is required for the write; unrelated fields stay usable, and loading and failure are stated rather than treated as absent data.
- **Version conflicts:** after an optimistic-concurrency refusal, a retry never pairs the new version with stale edited values, so it cannot overwrite the other save. Either the refreshed record replaces the edited state (reset or remount) before a retry is possible, or the draft is kept separately and the retry only follows an explicit reconciliation against the refreshed record.

Use direct review unless a fresh reviewer is explicitly requested or required by the calling workflow and delegation is available. When delegating, supply focused source paths, repo/base/head or diff, candidate evidence, prior decisions, and the review context. The reviewer does not inherit broad chat history or delegate again. One reviewer can assess both compliance and quality; separate agents per pass are not mandatory. The coordinating agent may delegate; the reviewer itself must not recursively delegate.

For each actionable finding include file:line or symbol, violated requirement or concrete risk, impact, supporting evidence, and the smallest credible fix. Classify severity:

- **Critical:** broken required behavior, data loss, security/permission regression, build blocker, or severe requirement mismatch.
- **Important:** missed requirement, likely defect, meaningful validation gap, risky design, or accessibility failure.
- **Minor:** low-risk maintainability or polish.

Do not inflate uncertainty into a confirmed defect or invent findings to justify the review. Preserve prior product decisions; flag new conflicting evidence rather than silently adding requirements.

## Output

Report `pass`, `pass-with-fixes`, or `fail`, findings ordered by severity, and missing validation. Distinguish inspected evidence from checks you ran and note whether review was local or independent. A pass applies to the stated scope and evidence, not to unverified runtime behavior.

For authorized remediation, return findings to `address-review-findings`. Report-only review does not independently trigger a fix, another review, or publication.
