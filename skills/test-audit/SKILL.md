---
name: test-audit
description: Evaluate permanent-test value, audit redundant coverage, or prune an authorized test scope while preserving critical contracts. Use for test admission decisions and suite rationalization, not routine test execution or live UI/API audits.
---

# Test Audit

Keep the smallest durable suite that catches meaningful regressions. This skill
supplies test-value decisions within the user's workflow; it does not launch a
delivery loop, require a task document, or authorize publication.

## Resolve The Assignment

- For new or changed tests, apply the admission rule below to the changed scope.
- For a review/audit request, inspect and report; do not change tests.
- For authorized cleanup, inventory, classify, and apply defensible changes in
  coherent batches without asking again for already authorized work.
- For an entire subsystem or project, cover every in-scope test file and case,
  including parameter rows with distinct risks. Do not stop after a few easy
  deletions. End when the agreed inventory is dispositioned and authorized
  changes are validated, or name the specific blocker and remaining work.

Read applicable repository policy, the task and existing evidence. Record the
checkout/base, dirty state, included projects, and test/CI configuration. Discover
commands from that repository; do not assume Vitest, Nx, a branch, or coverage
tooling. Other projects require their own baselines and contract maps.

## Permanent-Test Admission

A permanent test needs a named durable risk: authentication, authorization,
business/financial rules, API contracts, mutations, persistence, workflow or
route transitions, recovery, or another independently meaningful contract.
Require a concise answer to:

1. What observable failure would this test catch, and why does it matter?
2. Why is repeatable regression protection needed instead of delivery evidence?
3. Which existing test can own it? If adding another layer, what distinct failure
   cannot the existing owner detect?
4. Is this the smallest effective boundary using an independent expectation?

Extend an existing focused test when appropriate. One test per changed function
or acceptance bullet is not a requirement. Do not create exports, flags, or
wrappers solely to reach private implementation when the behavior is testable
through its real boundary. Useful existing injection boundaries are not defects
merely because tests use them.

Ordinary labels, headings, static copy, cosmetic order, classes, colors,
animation, and DOM nesting need no permanent tests. Verify presentation once
when relevant. Preserve meaningful keyboard/ARIA behavior and wording that is
itself a legal, accessibility, or business contract; accessible names remain
valid interaction locators. Error/loading states merit tests when they protect
input, allowed actions, recovery, or duplicate-write prevention.

For bug regressions, demonstrate the intended failure before the fix and success
after it using the repository's test-first policy. Use an isolated baseline when
needed; do not disturb unrelated edits. If reproduction is unavailable, report
the limitation rather than claiming a proven regression test.

## Choose Runtime Evidence Separately

Use [audit-ui](../audit-ui/SKILL.md) for a real browser journey and
[audit-api](../audit-api/SKILL.md) for real HTTP contracts and persisted outcomes
when the task needs that evidence. Their reports and temporary scenarios live
outside the application repository; an audit does not imply a new committed
Playwright/Hurl suite. Use their environment and mutation rules.

A permanent E2E test is justified by a critical cross-boundary regression that
cheaper focused coverage cannot protect. Do not replay the same risk at unit,
integration, and browser layers. Conversely, a one-time audit is not an
equivalent replacement for sole critical CI regression protection. Record
whether browser evidence uses real services or intercepted responses.

## Audit And Classify

Search to locate candidates, then inspect complete cases, assertions, relevant
production owners and overlapping coverage. Consult history or dependency
implementation when the contract's purpose is unclear. Names, LOC, mocks,
slowness, snapshots, and source inspection are signals, never deletion verdicts.

Look for presentation-only cases, repeated journeys testing the same risk,
expectations derived from the implementation under test, mocks that supply the
behavior being asserted, private call-shape assertions, and negatives that pass
because an unrelated guard rejected first. Check independent public, security,
release, migration, configuration, and architecture contracts before pruning
apparently static tests.

Use a compact ledger in the existing task/report location; a small batch can use
the session report. Each candidate records its test location, actual failure
detected, disposition and reason, surviving test/contract or why none is needed,
and focused verification. Inspect relevant callers before proposing removal of
support code. Use these dispositions:

| Disposition | Required evidence |
| --- | --- |
| Keep | Distinct risk and owning assertion |
| Merge | Named survivor can detect the removed case's failure; carry missing assertions first |
| Rewrite | Preserve the named contract while removing coupling or incidental assertions |
| Delete | No durable contract, or equivalent repeatable protection identified |
| Investigate | Uncertain ownership or value; retain pending evidence |

For broad cleanup, use the ledger to examine whole redundant layers before
reorganizing files. Name one primary owner per contract; justify secondary tests
by distinct failure modes. Splitting a large file is useful only when it improves
isolation, ownership, or execution; moving unchanged assertions is not pruning.

Retain sole critical protection. Repair or relocate its proof before retiring
the old case. A failing baseline can reveal a real defect; do not delete it to
make the suite green. Record unrelated defects without silently adding fixes.

## Reduction Targets And Coverage

Honor a requested reduction target as a search objective, never permission to
remove valuable protection. Define the denominator (cases, declarations, test
LOC, or support LOC), included scope, and stopping boundary up front. Separate
removed cases from parameterization, moved code, and shortened formatting.
If safe candidates fall short, report the achieved reduction and reasons for
retention after completing the agreed sweep; do not fabricate success.

If a coverage tolerance is requested, record its metrics and whether it means
percentage points or relative percent. Use identical production-file scope,
instrumentation, include/exclude rules, dependencies and test selection before
and after. Report line/branch measures available and changes in affected critical
owners as well as the aggregate; never shrink the denominator, lower thresholds,
or add assertion-free probes to meet a number. Coverage is supporting evidence:
unchanged percentages can conceal lost authorization or negative-path assertions.
If comparable measurement is unavailable, state that and do not claim the bound
was met. Do not install tooling or launch broad coverage runs contrary to the
user's or repository's validation limits.

## Apply, Validate, And Report

Apply authorized dispositions within scope. Remove orphaned fixtures/helpers
only after checking consumers. Production cleanup needs authorization within the
task; identify test-only seams as follow-ups when production edits are excluded.
Keep CI discovery and configuration valid when moving tests. Do not edit inputs
during an active test run.

Run the smallest affected retained tests and applicable checks; confirm tests
actually executed, since some runners succeed with zero matches. Use the calling
workflow's final gates, review bounds and reusable evidence. Do not add full
suites, blanket mutation testing, or a second review loop. For doubtful critical
assertions, a narrowly isolated negative control can establish that the intended
failure is detected; restore temporary changes and record the result.

Report decisions and retained risks, before/after counts (production, tests and
support separately), actual checks and runtime-audit links, coverage comparability
or gaps, and unresolved candidates. Distinguish tests moved from tests removed.
For a cross-project request, finish/report each named project against its own
policy; do not propagate deletions or CI changes from one project to another.
