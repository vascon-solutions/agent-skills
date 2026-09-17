---
name: rewrite-docs-from-code
description: Create or repair repository docs using current implementation evidence while preserving sourced requirements and domain context. Use when the target docs or cleanup scope are known.
---

# Rewrite Docs From Code

Write useful project documentation with distinct scopes and traceable sources. Preserve the user's requested destination and endpoint.

Use `repo-docs-audit` when the target doc set needs investigation; consume an existing audit without repeating it. A bounded request such as fixing one setup guide needs no preliminary audit. `repair-agent-files` owns instruction-file creation and authority changes. `review-doc-changes` owns report-only review of a doc diff.

## Before Editing

Read applicable repo instructions and [documentation policy](../repo-docs-audit/references/documentation-policy.md). That policy owns file placement, source authority, recovery of removed content, and verification.

Resolve the authorized target files or cleanup scope from the request and any prior audit. Do not expand a focused rewrite into unrelated consolidation. Preserve sourced domain knowledge and accepted requirements even when implementation differs; document that difference explicitly.

## Write From Evidence

1. Inspect code, configuration, scripts, and tests relevant to each doc's purpose. For a broad rewrite, use the relevant profile in [repo shape guidance](references/repo-shape-guide.md); skip unrelated stacks.
2. Verify implementation claims through active paths. Cite important source files and symbols; use line numbers only when needed for a narrow claim. Attribute requirements and rationale to their own sources.
3. Give each doc a clear reader and responsibility. Explain flows, boundaries, prerequisites, and non-obvious constraints. Use compact navigation tables where helpful; avoid exhaustive inventories and generic framework tutorials.
4. Apply authorized merges and removals with the shared preservation rules. Carry forward unique content before removing its old home, and update affected links and consumers.
5. Update existing doc indexes and instruction-file references only where changed paths or ownership make them stale. Do not assume `AGENTS.md` exists, create a hierarchy table by default, or change agent authority as a side effect. Route an authorized authority repair through `repair-agent-files`.
6. Verify the result using the shared checks. Distinguish observed code behavior, accepted requirements, inference, and runtime behavior that was not tested.

## Choosing Useful Content

| Content | Include when |
| --- | --- |
| Context/domain | Sourced business rules, terminology, or role definitions explain behavior or obligations |
| Architecture | Non-obvious runtime flow or ownership spans files or subsystems |
| Feature orientation | Entry points and relationships save meaningful discovery effort; use `implementation-map` for a requested detailed trace |
| Setup/contribution | Prerequisites, commands, or workflows are specific to this repository |
| Operations | Recovery, deployment, migrations, or background work need maintained operational guidance |
| Decision history | Accepted or superseded decisions explain consequential tradeoffs |

Do not create categories that add no useful content. A current implementation description must not imply that every accepted requirement is already enforced.

## Output

Report files created or changed, significant moves/removals and their rationale, preserved requirements or unresolved discrepancies, and validation performed or unavailable. Include recovery locations when needed. Stop at the requested local edit endpoint unless publication is also authorized.
