---
name: review-doc-changes
description: Independently review recent documentation and instruction-file changes, rescan the codebase, and recommend or apply corrections. Use for second-pass audits where recent doc edits should not be accepted at face value.
---

# Review Doc Changes

## Purpose

Perform an independent review of recently changed documentation.

This skill is deliberately skeptical:

- it does not trust recent edits by default
- it rescans code independently to verify claims
- it evaluates whether revised docs are accurate, lean, non-duplicative, and worth keeping
- it accepts "all changes are correct" as a valid outcome

## When To Use

Use when:

- an agent or human recently changed docs and they need independent vetting
- the repo was already "cleaned up" once and now needs a quality check
- the user asks for validation, challenge, or second-pass review of doc edits

## When Not To Use

Do not use when:

- there are no recent doc changes to review
- the task is initial doc creation or an audit of what should exist
  Use `repo-docs-audit` or `rewrite-docs-from-code`
- the task is only to align `CLAUDE.md` and `AGENTS.md`
  Use `repair-agent-files`

## Required Inputs

You need:

- access to recently changed doc and instruction files (via `git diff` or direct inspection)
- access to the current codebase for independent verification

Do not assume recent edits are correct because they are recent.
Do not assume recent edits are wrong because they are recent.

## Step-By-Step Instructions

1. Identify changed doc and instruction files. Use `git diff --name-only` or inspect the worktree.
2. Separately identify any code changes in the same worktree — do not conflate them with doc changes.
3. Read each changed doc as it currently exists.
4. Independently scan the codebase to verify specific claims in the changed docs.
5. For each changed file, audit:
   - **Accuracy** — do claims match current code?
   - **Scope discipline** — does the file stay in its lane, or does it drift into another doc's territory?
   - **Overlap** — does it now duplicate content from another file?
   - **Durable value** — will this be useful in six months, or is it a current-state snapshot?
   - **Lean structure** — could it be shorter without losing meaning?
6. Assign a verdict to each file:
   - **accept** — changes are correct and improve the doc
   - **trim** — broadly correct but over-specified or too long
   - **revert / replace** — changes introduced errors, bloat, or scope drift
   - **remove** — the file or section should not exist
7. Apply clear, low-risk improvements directly. For larger structural changes, report and recommend instead of acting.
8. Produce the final review with verdicts and rationale.

## When to Apply vs When to Report

**Apply directly when:**
- the fix is clearly correct and contained (stale reference, wrong path, inaccurate claim)
- the change is a deletion or reduction with no ambiguity about intent

**Report and recommend when:**
- the change requires structural judgment (merging files, reassigning scope)
- the change might conflict with user intent or ongoing work
- you are uncertain whether a claim is wrong vs merely imprecise

## Decision Rules

- Recent edits get no presumption of correctness or incorrectness
- Verify against code, not against the author's apparent intent
- Prefer deletion over light polish when a doc still does not earn its place after the edits
- Challenge generated inventories and folder listings regardless of how clean they look
- Keep `AGENTS.md` lean and agent-focused
- Do not preserve structure just because it was recently introduced
- If all recent changes are correct, say so explicitly — accept all is a valid outcome

## Expected Outputs

Produce:

- a per-file verdict (accept / trim / revert / remove)
- concrete mismatches against current code
- applied fixes where appropriate
- recommendations for further changes where applicable
- explicit "accept all" if the changes are correct

## Cautions / Common Failure Modes

- Rubber-stamping recent edits
- Reviewing only the diff without rescanning the code
- Focusing on wording polish instead of accuracy
- Being too deferential to recently added structure
- Conflating code changes with doc changes in a mixed worktree
- Declaring everything wrong out of contrarianism

## Example Usage

Use this skill when a user says:

- "Claude already updated the docs. Independently audit them."
- "Review the uncommitted documentation changes and challenge them."
- "Do a second-pass review of the docs another agent just wrote."
- "Check if the doc changes from the last session are actually correct."
