# Validation Evidence

Use one validation owner per delivery or remediation batch. Reviewers and publishing steps consume its evidence rather than independently recreating it. Standalone reviews may run targeted checks when evidence is absent or inadequate.

## Choose Evidence For The Claim

- Identify the behavior, contract, or requirement the check can actually prove. A typecheck is not a build; a mock-based unit test is not proof of a database constraint; a passing suite does not establish every acceptance criterion.
- Use the smallest relevant check during implementation. Add a permanent regression test for a named durable risk, especially authorization, data integrity, lifecycle transitions, concurrency, recovery, or public contracts. Avoid tests that only mirror implementation details or fix ordinary wording/layout in place.
- For a bug fix, reproduce the symptom before editing when practical. Confirm a regression test detects the original failure using a safe isolated baseline or equivalent evidence; do not revert unrelated changes just to demonstrate red-green.
- For visual acceptance criteria, inspect the rendered behavior. A focused manual/browser check can prove the requested outcome without committing a presentation-only test. Preserve explicit user restrictions and report any resulting evidence gap.
- Use repo-required checks and hooks for the final candidate. Deduplicate equivalent manual checks when hooks already prove the same claim against the same inputs. Never bypass a required gate to save a run.

## Reuse And Invalidation

Record enough to attribute results: command, working directory, scope, exit/result, relevant environment and dependency state, and tested commit or identifiable uncommitted content. Include sibling file-dependency source/build identity when relevant. With a [delivery ledger](delivery-ledger.md), the `validation` entry is that record: a content manifest for working or local-only content, the frozen OID for a committed gate. Where the repository already writes validation receipts, point at the receipt instead of restating it. Otherwise a session receipt is sufficient; do not build new tooling for it.

Run focused checks while changing behavior; run one required final gate per candidate and rerun only checks that are missing or invalidated. There is no once-per-commit rerun rule: a new OID alone does not require rerunning a check whose tested inputs are demonstrably unchanged. Record that as an explicit reuse of the original evidence, never as a new run, and never relabel an old receipt as passing for a new OID. Reuse passing evidence while the inputs and assumptions relevant to that check remain unchanged. Moving from implementation to review to publishing to reporting does not invalidate it. Neither does a commit-message-only change with identical tested content. Refresh evidence when code, generated output, dependencies, configuration, environment, or external state material to the claim changes, or when evidence cannot be matched to the candidate.

Reuse the repository's existing heavy-command wrapper when there is one, and follow its ownership check before using its unlock command. Without one, serialize heavy work in the owner and record that host-wide enforcement is unavailable; do not install a lock service. Run pushes directly or redirect their output to a file, because an early-closing consumer such as `head` can interrupt them. Build file lists from NUL-delimited Git output (`-z`), never by splitting on whitespace.

After remediation, rerun affected checks. An unrelated documentation edit does not require a full application suite. A failed check needs a rerun after its cause is addressed. A tracked-file mutation by formatting or commit/push hooks can invalidate earlier evidence; inspect what changed and rerun what it affects.

## Report Honestly

Read the actual result before claiming success. Distinguish passing, failed, skipped, unavailable, and pending checks. Do not extrapolate focused coverage into 'all tests pass.' Verify remote head and PR base/state for publication claims; old local test results do not establish current CI status.

Missing evidence is a gap to obtain within scope or disclose. Known failures affecting the change or a required readiness gate block a ready PR until fixed; unrelated failures must be reported with evidence and handled according to repo policy. Budget or elapsed time is not verification.
