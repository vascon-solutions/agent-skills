---
name: review-doc-changes
description: Review a specified documentation or instruction-file diff against code and authoritative sources. Report findings without editing the candidate or applying corrections.
---

# Review Doc Changes

Review documentation changes without mutating repository files, Git state, or external services. An independent assessment means checking evidence rather than accepting the author's conclusions; it does not automatically require another agent.

For an initial documentation inventory, use `repo-docs-audit`. For already-authorized corrections, return findings to `address-review-findings`, which can use `rewrite-docs-from-code` or `repair-agent-files`. Keep the review candidate unchanged while assessing it, even in a combined review-and-fix request.

## Establish The Candidate

Resolve the requested scope from the conversation, PR, commit range, or worktree. Record the repository, baseline, candidate revision or worktree state, and included files. Never assume an empty unstaged diff means there is nothing to review.

- **Uncommitted work.** Inspect `git status --short`, `git diff --name-status --find-renames`, `git diff --cached --name-status --find-renames`, and `git ls-files --others --exclude-standard`. Read the staged and unstaged patches separately when both affect a path. Inspect relevant untracked docs directly; do not sweep unrelated files into scope.
- **Commit or branch review.** Resolve base and head commits and inspect `git diff --name-status --find-renames <base> <head>`. For a PR or branch contribution, use the verified merge-base with the intended target branch unless the user requested a different comparison. Inspect the corresponding patch and candidate files at that revision, not unrelated working-tree versions.
- **Deletions and renames.** Read old content from the baseline (for example `git show <base>:<old-path>`) and compare its preserved content, incoming links, and replacement destination. For staged-versus-worktree review, use the index as the old side where appropriate. A deleted file cannot be reviewed by opening its current path.
- **Ambiguous history.** Inspect likely recent doc commits for a request such as "last session." If the intended baseline remains material and unresolved, ask one focused question. State any limited scope you can review meanwhile. With no Git history, use supplied before/after artifacts and disclose the limitation.

Keep code changes visible as context and verify doc claims against the code belonging to the selected candidate. Avoid checkout/reset operations to obtain that evidence.

## Evaluate

Read applicable repository instructions and [documentation policy](../repo-docs-audit/references/documentation-policy.md). It defines placement, source authority, preservation, and verification; existing location alone is not a defect.

Check:

- Accuracy of implementation claims, paths, commands, and integration descriptions.
- Preservation and attribution of domain rules, accepted requirements, and decision rationale. Identify implementation discrepancies without rewriting policy to fit code.
- Lost unique content, broken links, or tooling consumers after deletions, renames, or merges.
- Reader value and responsibility: duplication, generic filler, misleading inventories, or useful orientation removed merely because it is derivable from code.
- Instruction-file authority and nested scope, using `repair-agent-files` guidance when needed. Operational command blocks can be useful; remove redundant style examples only when they add no guidance beyond enforced tooling.

Inspect relevant code and test assertions. Reuse supplied validation evidence when it matches the candidate. Run read-only or ordinary temporary-output doc checks only when needed to substantiate a finding; do not install dependencies, apply formatter fixes, or execute live operations during review.

## Findings And Output

For each actionable finding, give severity, file and line/symbol (old path for deletions), concrete impact, supporting evidence, and the smallest credible correction. Label uncertainty. A preference without a reader problem, requirement, or concrete risk is not a defect.

Give per-file verdicts where useful: `accept`, `trim`, `replace/revert`, or `remove`. These are recommendations, not edits. Accepting every change is a valid result.

Report the exact reviewed scope, findings ordered by severity, and validation evidence and limits. Distinguish tests read from tests run. If the candidate changes during review, identify invalidated evidence and reassess only the affected scope. For a combined review-and-fix request, hand the completed findings and existing authorization back to remediation without a new blanket approval step.
