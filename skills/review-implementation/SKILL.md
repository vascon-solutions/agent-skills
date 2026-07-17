---
name: review-implementation
description: Use when reviewing a finished implementation, completed branch, or another agent's code against a referenced task doc, spec, plan, roadmap item, PRD, or acceptance criteria.
---

# Review Implementation

## Purpose

Verify whether finished code satisfies the referenced task, spec, plan, roadmap item, PRD, or acceptance criteria.

This is a report-only skill. Review the implementation as a work product, not the author's reasoning, and do not edit files while using it.

## Mode

Use one mode per review:

- **Direct review:** read the referenced source, inspect the diff and relevant code, then report findings yourself.
- **Delegated review:** only when the user explicitly asks for an agent, subagent, or delegated review and the environment supports it, dispatch a fresh review agent with the focused prompt below. The delegated reviewer also reports only.

If the user asks to review and fix in one request, use `address-review-findings` as the orchestration skill. It will run this review flow first, then evaluate and fix valid findings.

## When To Use

Use when the user asks to:

- review an implementation against a plan/spec/task doc
- check whether another agent's implementation matches requirements
- run a pre-merge implementation review
- inspect a git diff for scope creep, missed requirements, regressions, or test gaps

## When Not To Use

Do not use when:

- reviewing the task doc itself before implementation - use `review-task-docs`
- reviewing recent documentation edits - use `review-doc-changes`
- fixing or remediating findings - use `address-review-findings`

## Workflow

1. Read the referenced plan/spec/task doc. If no source is referenced, ask once. If the user declines to provide one or none exists, run a quality-only review and label the verdict accordingly.
2. Read applicable repo instructions such as `AGENTS.md` or `CLAUDE.md`.
3. Inspect the implementation diff and relevant code. Use `git status`, `git diff`, and targeted file reads.
4. In delegated review mode, dispatch the most capable review agent available with only the focused review context. If delegation is unavailable, perform the review locally and state that limitation.
5. Review in two passes:
   - spec compliance: requirements met, missed, or exceeded
   - implementation quality: correctness, architecture, maintainability, tests, regressions
6. Report findings first, ordered by severity. Do not edit files during the review.

## Delegated Review Prompt

When delegation is explicitly requested and supported, use a fresh review agent/subagent. Prefer the highest practical reasoning effort for review. Avoid passing broad session history unless the review needs it.

```text
Review the current implementation against:

{PLAN_OR_SPEC_PATH}

Read the plan/spec, applicable repo instructions, git status, git diff, and relevant files.

Report only. Do not modify files.

Check:
- every requirement is implemented
- no requirement is missed or contradicted
- no unrequested scope was added
- repo instructions are followed
- user-visible behavior is correct
- tests and validation are adequate
- risks, regressions, and edge cases are identified

Output:
- verdict: pass, pass-with-fixes, or fail
- critical findings
- important findings
- minor findings
- missing validation
- recommended fixes

For each finding include file:line, the violated requirement or risk, why it matters, and the smallest credible fix.
```

## Severity

- Critical: broken required behavior, data loss, security issue, auth/permission regression, build-blocking error, or severe mismatch with the plan.
- Important: missed requirement, risky architecture, bad error handling, meaningful test gap, accessibility issue, or likely user-facing defect.
- Minor: polish, naming, small maintainability issue, or low-risk cleanup.

These categories are the finding vocabulary shared across this pack, so findings move cleanly into `address-review-findings`.

Do not inflate severity. Do not bury blocking findings under summary text.

## Acting On Findings

To act on findings, use `address-review-findings`.

## Example Flow

1. User asks for a review of the current branch against `docs/tasks/payments.md`.
2. Read the task doc, repo instructions, `git status`, `git diff`, and the touched files.
3. Report `Verdict: pass-with-fixes` with findings ordered as Critical, Important, then Minor.
4. Stop. Do not fix the findings in this skill.

## Output Shape

```md
Verdict: pass-with-fixes

Critical
- None

Important
- [path/to/file.ts:42] Requirement X is not implemented. This matters because... Smallest fix: ...

Minor
- [path/to/file.ts:88] ...

Missing Validation
- `pnpm type-check` was not run, or no test covers...
```
