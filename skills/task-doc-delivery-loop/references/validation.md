# Validation Evidence

Use one validation owner per delivery or remediation batch. Reviewers and publishing steps consume its evidence rather than independently recreating it. Standalone reviews may run targeted checks when evidence is absent or inadequate.

## Choose Evidence For The Claim

- Identify the behavior, contract, or requirement the check can actually prove. A typecheck is not a build; a mock-based unit test is not proof of a database constraint; a passing suite does not establish every acceptance criterion.
- Use the smallest relevant check during implementation. Add a permanent regression test for a named durable risk, especially authorization, data integrity, lifecycle transitions, concurrency, recovery, or public contracts. Avoid tests that only mirror implementation details or fix ordinary wording/layout in place.
- For a bug fix, reproduce the symptom before editing when practical. Confirm a regression test detects the original failure using a safe isolated baseline or equivalent evidence; do not revert unrelated changes just to demonstrate red-green.
- For visual acceptance criteria, inspect the rendered behavior. A focused manual/browser check can prove the requested outcome without committing a presentation-only test. Preserve explicit user restrictions and report any resulting evidence gap.
- Use repo-required checks and hooks for the final candidate. Deduplicate equivalent manual checks when hooks already prove the same claim against the same inputs. Never bypass a required gate to save a run.

## Reuse And Invalidation

Record enough to attribute results: command, working directory, scope, exit/result, relevant environment and dependency state, and tested commit or identifiable uncommitted content. Include sibling file-dependency source/build identity when relevant. A session receipt is sufficient; do not build new tooling for it.

Reuse passing evidence while the inputs and assumptions relevant to that check remain unchanged. Moving from implementation to review to publishing to reporting does not invalidate it. Neither does a commit-message-only change with identical tested content. Refresh evidence when code, generated output, dependencies, configuration, environment, or external state material to the claim changes, or when evidence cannot be matched to the candidate.

After remediation, rerun affected checks. An unrelated documentation edit does not require a full application suite. A failed check needs a rerun after its cause is addressed. A tracked-file mutation by formatting or commit/push hooks can invalidate earlier evidence; inspect what changed and rerun what it affects.

## Report Honestly

Read the actual result before claiming success. Distinguish passing, failed, skipped, unavailable, and pending checks. Do not extrapolate focused coverage into 'all tests pass.' Verify remote head and PR base/state for publication claims; old local test results do not establish current CI status.

Missing evidence is a gap to obtain within scope or disclose. Known failures affecting the change or a required readiness gate block a ready PR until fixed; unrelated failures must be reported with evidence and handled according to repo policy. Budget or elapsed time is not verification.
