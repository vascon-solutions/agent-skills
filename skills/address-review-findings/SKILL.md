---
name: address-review-findings
description: Use when code review, PR review, requested changes, review comments, or spec-compliance findings need evaluation, code changes, clarification, pushback, tests, or validation.
---

# Address Review Findings

## Purpose

Evaluate and remediate reviewer findings after a code, PR, or spec-compliance review. Findings are inputs to verify, not orders to blindly apply.

This skill is self-contained: the evaluation discipline it needs is in the Evaluating Findings section below. It works the same with or without any external code-review skill installed.

Common prompt:

```text
Use address-review-findings to review against <plan-or-spec-path> and fix valid findings.
Use address-review-findings with a delegated review to review against <plan-or-spec-path> and fix valid findings.
```

## Source Routing

| Findings come from | Route |
| --- | --- |
| Implementation review, task doc, plan, spec, roadmap item, PRD, or acceptance criteria | Use this skill. Run `review-implementation` first if findings do not already exist. |
| Existing code review, PR review, or inline reviewer comments with a fix request | Use this skill; evaluate with the Evaluating Findings rules below. |
| QA report, bug tracker export, or tester issue list | Use `qa-triage-and-fix`. |
| Code review feedback without a referenced plan and without a remediation request | Use this skill for evaluation only: apply the Evaluating Findings rules, classify, push back where warranted, and stop before editing. |

## When Not To Use

Do not use when:

- the user only wants a report-only implementation review - use `review-implementation`
- the user wants QA issue triage - use `qa-triage-and-fix`
- the user wants the task document reviewed before implementation - use `review-task-docs`
- the user wants recent documentation changes reviewed - use `review-doc-changes`

## Workflow

1. Read all findings, referenced plans/specs, repo instructions, and relevant diffs before changing files.
2. If the user asks to review and fix against a plan/spec and findings do not already exist, run `review-implementation` first. If the user explicitly asks for a delegated review and the environment supports it, use `review-implementation` delegated review mode; otherwise review locally.
3. Route the source using the table above. If the right owner is another skill, switch to that skill before editing.
4. Evaluate every finding before implementing, using the Evaluating Findings rules below.
5. Classify each finding as `valid`, `invalid`, `unclear`, or `out of scope`.
6. Stop and ask before implementing if any finding is unclear and could affect the other fixes.
7. Fix valid findings in this order: critical or blocking issues, simple low-risk fixes, then complex refactors or behavior changes.
8. Validate after meaningful fixes, then run final validation appropriate to the repo. Confirm success with command output before declaring the loop done (`verification-before-completion` if installed).
9. If the original request asked for a full review-and-fix loop, run one final `review-implementation` after fixes and report any remaining findings.

## Evaluating Findings

Findings are suggestions to evaluate, not orders to follow. Technical correctness over social comfort. No performative agreement ("you're absolutely right", "great catch"), no gratitude filler, and no implementing before verifying — just verify, then state the fix or the reasoned pushback.

For each finding:

- **Understand first.** Restate the technical requirement in your own words. If it is unclear, ask before touching anything — do not partially implement a related set on partial understanding, since items often interact.
- **Verify against reality.** Check the finding against the codebase, tests, requirements, platform/version constraints, and prior user decisions. Confirm whether it is technically correct *for this codebase*, whether it breaks existing behavior, and whether there is a reason the current code is the way it is.
- **Apply YAGNI.** If a finding asks to "implement properly", grep for actual usage first. Unused speculative functionality gets flagged for removal, not built.
- **Classify** as `valid`, `invalid`, `unclear`, or `out of scope`.

Push back — with technical reasoning, not defensiveness — when a finding is technically wrong, breaks existing behavior, adds unused speculative functionality, is outside the requested scope, or conflicts with the user's prior architectural decisions. Cite the file, test, or requirement that supports the pushback. If you cannot verify a finding, say so and ask for direction rather than guessing. If you pushed back and were wrong, state the correction factually and move on.

Fix one finding or tightly related group at a time, in the order in Workflow step 7, and test each meaningful fix before moving on.

When replying to inline review comments on GitHub, reply in the comment thread (`gh api repos/{owner}/{repo}/pulls/{pr}/comments/{id}/replies`), not as a top-level PR comment.

## Example Flow

1. User asks to address findings against `docs/tasks/payments.md`.
2. Run `review-implementation` if no findings were provided yet.
3. Evaluate the resulting findings with the Evaluating Findings rules.
4. Classify six findings: four valid, one invalid, one unclear.
5. Ask about the unclear finding before editing if it affects the others.
6. Fix valid findings from highest risk to lowest, validating as you go.
7. Push back on the invalid finding with file, test, or requirement evidence.
8. Run final validation and, for a full review-and-fix loop, run a final `review-implementation`.

## Output

When finished, report:

- findings fixed
- findings rejected or deferred, with reasons
- files changed
- validation run and results
- remaining risk or follow-up work

Use concise engineering prose. Findings and fixes should be traceable to the original review items.
