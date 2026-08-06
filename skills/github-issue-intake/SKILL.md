---
name: github-issue-intake
description: Use when a reported bug or improvement needs code-grounded repository intake and an approved GitHub issue for teammate handoff before optional task-doc creation.
---

# GitHub Issue Intake

## Purpose

Turn a bug report, improvement, screenshot, or code finding into a truthful, code-grounded GitHub issue. The issue is the primary artifact. Do not implement the requested change.

## Hard Gates

- Do not modify implementation files or create implementation branches or PRs.
- Do not write to GitHub until the user approves the exact title, exact body, repository, and metadata. Require explicit approval for every issue or approved split set.
- Treat requests such as `just create it`, `do it quickly`, or `go ahead` as permission to run intake, not approval of a draft the user has not seen. Stop after the preview and wait.
- When an initial request asks for one issue but contains independent outcomes, explain the split and ask once whether to proceed with separate issues. If the user explicitly confirms one umbrella issue after that warning, honor the override and preserve clearly separable sections.
- Do not claim reproduction or artifact existence without evidence.
- If the user supplies a path or link for a task doc, branch, or PR that does not exist, exclude it from the issue body. Do not preserve it as `planned`, `intended`, or a required future artifact.
- Do not invent acceptance criteria or implementation requirements to make an incomplete report look actionable. Inspect the repository or ask one material question.
- Treat issue approval as issue approval only, never implementation approval.

## Workflow

### 1. Resolve context

Collect the report and supplied evidence, resolve the repository, read repository instructions, and identify the evidence revision when it is not the default branch. Ask for the repository only when explicit references and local context remain ambiguous.

### 2. Check conventions and duplicates

Inspect issue templates, issue guidance, and recent comparable issues. Search open and closed issues for duplicates before drafting. If a likely duplicate exists, present the relationship and require approval before commenting or creating a distinct follow-up. Commenting is also a GitHub write.

### 3. Classify and split

Classify report type as `bug`, `improvement`, or `unresolved`. Classify delivery size as `small/fix`, `improvement`, or `feature-grade`.

Split independently assignable or verifiable outcomes into separate issue drafts by default. Combine symptoms only when they share one root cause and one delivery outcome. For cross-repository work, identify the primary owner and split repository-specific deliverables when each can ship independently.

### 4. Inspect the codebase

Trace focused entry points, ownership, current behavior, shared patterns, tests, preserved contracts, and likely implementation files. Keep three evidence classes explicit:

- `verified` — established directly from code, tests, runtime reproduction, or authoritative documentation;
- `reported` — supplied by the user, screenshot, QA note, or external report but not independently reproduced; and
- `inferred` — reasoned from verified facts and labeled as an inference.

Never upgrade reported or inferred behavior to verified silently. Use `implementation-map` only when the affected surface independently justifies a durable map.

### 5. Resolve material gaps

Ask one focused question at a time only when the answer changes scope, ownership, acceptance criteria, or exclusions. Do not ask the user for facts the repository can resolve safely. For unresolved design choices, present two or three realistic options and lead with a recommendation.

### 6. Draft and preview

Map the required content into useful repository templates. Otherwise read and use `references/issue-template.md`.

Show the repository, exact title, exact body, duplicate-search result, split set, and proposed existing metadata. Suggest only labels that already exist. Do not invent or apply labels, assignees, milestones, or project placement without explicit approval.

### 7. Create and verify

After explicit approval, prefer the available GitHub connector and use authenticated `gh` only as a focused fallback. Verify that the created issue matches the preview and return its number and URL.

If authentication or write access fails, preserve the exact copy-ready draft and report the blocker. Never imply that an unapproved or failed write succeeded.

## Task-Doc Handoff

- `small/fix`: recommend direct teammate handoff. Do not offer task-doc creation unless the user challenges the classification.
- `improvement` or `feature-grade`: offer `create the task doc now`, `leave it to the assignee`, or `continue deliberating`.
- For create-now, invoke `task-doc` in `issue` / `transform-only` mode and stop before implementation.
- Offer a task-doc-only PR separately after the doc exists. Publishing requires explicit approval and the `isolated-worktree` plus `publish-branch` skills.
- Do not mention a task-doc path, branch, or PR before it exists. Update the issue only after the referenced artifact is real.
- A user-supplied nonexistent artifact path does not reserve that path. For teammate handoff, state only that no task doc was created and the assignee may create one after reviewing the issue.

## Completion

Report the classification, evidence limits, issue URL or write blocker, approved metadata, and selected handoff state. When handing off without a task doc, say that no task doc was created without inventing a path.

## Common Mistakes

| Mistake | Correction |
| --- | --- |
| Bundling unrelated reports on the first request for one issue | Recommend separate issues and ask once; honor an explicit override after the tradeoff is clear. |
| Filling missing repository context with plausible requirements | Inspect the codebase or ask one material question; do not guess. |
| Turning screenshots into verified reproduction | Label screenshot behavior as reported unless reproduced. |
| Adding a planned task-doc path | State that no task doc exists without inventing a path. |
| Treating `just create it` as draft approval | Complete intake, show the exact preview, and wait for explicit approval. |
| Applying plausible labels automatically | Suggest only existing labels and wait for approval. |
| Creating a task doc for a local fix | Hand off the approved issue directly. |
