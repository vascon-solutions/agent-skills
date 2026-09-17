---
name: repo-docs-audit
description: Audit repository documentation and instruction files, report what to keep, trim, merge, remove, or create, and recommend a target doc set without editing files.
---

# Repo Docs Audit

Define the smallest useful documentation set from repository evidence. This skill reports findings; it does not write, move, or delete repository files.

Use it for unclear doc scope, missing context, stale docs, or consolidation. When the target is already clear, use `rewrite-docs-from-code`. Instruction-file repair belongs to `repair-agent-files`; review of a particular doc diff belongs to `review-doc-changes`.

## Scope And Evidence

Read [documentation policy](references/documentation-policy.md) for placement, source authority, and preservation rules shared with the editing skills.

Read applicable repository instructions, including nested instructions for the area under review. Inventory documentation in the requested scope, including package-local docs and relevant untracked files. Identify generated documentation, its source, and its consumers before recommending removal.

Inspect representative code, configuration, scripts, and tests to check implementation claims. Record sourced domain rules, accepted requirements, and design rationale separately from implementation facts. A mismatch can be an implementation gap; code does not automatically invalidate the requirement.

## Audit

For each file, identify its reader and purpose: agent instructions, setup/contribution, domain context, architecture, feature orientation, operational guidance, decision history, or generated reference.

Assess accuracy, overlap, useful context, and maintenance cost. Prefer explanations of non-obvious behavior over exhaustive folder listings. A generated reference or compact navigation table can still earn its place for its consumers; derivability from code alone is not grounds for deletion.

Assign a verdict with evidence:

| Verdict | Meaning |
| --- | --- |
| keep | Useful and sufficiently accurate |
| trim | Retain the purpose, remove specific excess or stale claims |
| merge | Identify the destination and unique content to preserve |
| remove | Explain why no useful content or required consumer is lost |
| create | Name the missing reader need and sources available to support it |

For proposed moves, merges, and removals, identify incoming links, tooling references, and whether the latest content is recoverable. Mark unresolved provenance or user-owned material for investigation rather than assuming it is disposable.

Choose docs by need:

- A README may be enough for a small library or utility.
- Add architecture context when auth, state, request flow, jobs, or integration boundaries require explanation across files.
- Preserve sourced domain and decision records that explain rules or tradeoffs code cannot convey.
- Keep setup/contribution guidance for non-obvious prerequisites and repository-specific commands.
- In monorepos, keep shared guidance at the root and distinct package guidance near its consumers.
- Recommend agent instruction files only for actual tool needs and non-obvious operating constraints; `repair-agent-files` determines ownership.

Do not require every category, a particular number of files, or a full repository scan for a focused request.

## Output And Handoff

Report scope and evidence limits, a per-file verdict table, the target doc set, and prioritized corrections. Cite the docs and code or other sources behind actionable findings. Include preservation and link-update requirements in the handoff.

For an audit-only request, finish with the report. For a request that already authorizes cleanup or rewriting, pass the findings and existing authorization to `rewrite-docs-from-code` or `repair-agent-files` and continue the authorized work in that workflow. Do not make the user approve the same scope again. Partial authorization applies only to that subset; unresolved decisions pause only the affected changes.
