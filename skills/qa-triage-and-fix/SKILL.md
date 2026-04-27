---
name: qa-triage-and-fix
description: Use when a QA report needs per-issue triage, code fixes, contested findings, validation evidence, or status/comment updates on the report itself.
---

# QA Triage and Fix

## Purpose

Handle a QA issue report end to end, regardless of whether it is pasted into chat, attached as a file, exported from a tracker, or written as a plain list. For each reported issue: reproduce or rule out, fix real bugs in the smallest credible scope, contest intentional or unsupported findings with evidence, defer ambiguous policy to product, and update only the report's status/comment fields when the user asks for that.

This skill is project-agnostic. Use the host repository's own conventions, doc hierarchy, package manager, and validation commands; do not assume a stack.

## Approval Gates

- Stop before editing report fields beyond status and developer/engineering comment, unless the user explicitly authorizes more.
- Stop before inventing product policy for ambiguous behavior; mark the issue as needing a product decision instead.
- Stop before changing code outside the current repo's scope; classify and document the handoff.
- Stop before destructive git operations or broad refactors that are not strictly required for the reported issue.
- Stop before mass-updating statuses; confirm with the user once the triage plan is clear.

## Decision Rules

- **Real bug in this repo:** reproduce or identify the faulty contract, add or adjust focused tests, make the smallest local fix, and mark the issue done only after validation.
- **Cross-package or shared-contract bug:** update the upstream package or contract first using its own workflow, propagate the change into this repo using whatever sync mechanism the repo already uses, then validate.
- **Not reproducible:** add regression coverage when practical; otherwise leave a precise comment naming the surface tested, the input shape, the build state, and the remaining evidence gap so QA can re-test cleanly.
- **Intentional behavior:** mark as contested or not applicable using the report's existing status vocabulary, and explain the code or policy basis.
- **Product policy gap:** mark as needing a product decision; do not encode new business rules without an explicit source.
- **Out-of-scope surface:** classify with the closest existing status, name the local evidence if any, and note that no code change was made here.
- **Duplicate / already fixed:** point to the existing fix or the prior issue.

## Workflow

1. **Bootstrap from the repo's own instructions.** Read whatever the repo treats as the source of truth for agent behavior, setup, architecture, and contribution workflow. Follow its doc hierarchy. Do not assume one is present; adapt to what exists.
2. **Load any prior QA context the user names** (previous reports, prior task notes, related PRs). Do not invent paths; only read what the user references or what the repo plainly contains.
3. **Parse the report with a structured parser when possible.** For unstructured input, capture issue ID, status field, and comment field exactly as written before changing anything. Record original field names so updates preserve them.
4. **Triage every issue** into one of: code fix here, cross-package fix, intentional/contested, product decision, out-of-scope, duplicate, or needs more evidence.
5. **For code fixes, open the owning module first.** Match existing module boundaries, naming, layering, DTO/validation patterns, and test conventions in the repo. Do not introduce new patterns just to fix a bug.
6. **When third-party package behavior matters,** inspect the actual installed or vendored source before relying on assumptions from docs or types.
7. **Test-first discipline:** add or update the narrowest failing test that captures the reported behavior, then implement the minimal fix. If the repo lacks a relevant test surface, add one consistent with existing test style.
8. **Cross-package changes:** make the upstream change first, propagate it into this repo using the repo's own sync command (whatever that is), then validate locally. Verify the upstream change is committed; flag if it is left dirty.
9. **Update the report last.** Preserve all original issue content and any non-target fields; change only the status and the developer/engineering comment fields the user authorized.
10. **Re-read or re-parse the report after writing** to confirm issue count, identifiers, statuses, and comments are intact and aligned with the source format.

## Validation

Run the narrowest credible validation the repo defines for the surfaces touched. Discover commands from the repo's own docs, task runner, package metadata, build config, or CI config; do not hardcode tool names.

Typical buckets to cover when relevant:

- Build / typecheck for the language(s) touched.
- Unit tests for service or pure-logic changes.
- Integration / e2e tests for user flows, validation, persistence, or regression behavior.
- Lint or formatter only when the repo treats it as non-mutating, or when the user requested it; flag mutating linters before running them.
- Cross-package: run the upstream package's own tests before syncing.

If a relevant command is skipped, record why in the handoff.

## Output

Keep working notes concrete:

- Issue IDs fixed, contested, deferred to product, or marked out-of-scope.
- Code and test files changed.
- Report issues updated and the exact fields touched.
- Validation commands run and their result.
- Validation commands not run and why.
- Any evidence still needed from QA.

## Done Report

At handoff, report:

- what changed
- which validation commands ran and their result
- which validation commands were not run and why
- assumptions, risks, or unverified areas (including any dirty upstream package changes)
