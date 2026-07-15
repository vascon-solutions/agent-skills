# Task Doc Contract Adoption

## Objective

Update the reusable `task-doc` and `task-doc-delivery-loop` skills to consume
versioned repository delivery contracts, deduplicate validation, enforce one
initial commit for an original task group, keep publication observable, and hand
PR feedback to repository event automation when available.

## Source Context

Source mode: PRD.

Generation style: transform-only.

This is the `agent-skills` repository workstream from the NCDMB fast task
delivery system design. It must be implemented and published from this
repository as a separate goal/PR from the UI repository support.

## Design Reference

- Source Spec:
  `https://github.com/floatstar/ncdmb-procurement-ui/blob/673991101acd16f3b8ef8dbd546f6f2bb3bea4ef/docs/superpowers/specs/2026-07-16-fast-task-delivery-system-design.md`
- Current skills: `skills/task-doc/SKILL.md` and
  `skills/task-doc-delivery-loop/SKILL.md`
- Existing task convention: `docs/tasks/`

Before this task becomes approved, verify that the immutable Source Spec
permalink resolves from GitHub. This is a prerequisite, not hidden chat context.

## Architecture Summary

The skills remain generic and detect a repository-supported contract version
rather than hardcoding one workspace. `task-doc` emits validated front matter
and separates durable blocking tests from acceptance evidence.
`task-doc-delivery-loop` parses one compatible group, uses ledger checkpoints
without intermediate commits, runs one validation union, creates one initial
commit, publishes observably, and delegates feedback to repository automation
when installed.

## Code Evidence

| Behavior | Source |
| --- | --- |
| `task-doc` rejects small tweaks and currently creates Markdown-only artifacts. | `skills/task-doc/SKILL.md:16-42`; `skills/task-doc/references/task-template.md` |
| The delivery loop requires one primary repository/branch/PR and separate goals for cross-repository implementation. | `skills/task-doc-delivery-loop/SKILL.md:22-30` |
| Ordered implementation currently allows a commit or ledger checkpoint after every task. | `skills/task-doc-delivery-loop/SKILL.md:77-81` |
| PR review/remediation currently uses active-session inspection and waiting. | `skills/task-doc-delivery-loop/SKILL.md:92-99` |
| The repo already stores task artifacts under `docs/tasks/` and uses Node test files under `tests/`. | `docs/tasks/2026-07-01-task-doc-delivery-loop-calibration.md`; `tests/*.test.mjs` |

## Current Behavior To Preserve

- `task-doc` continues to reject small bug fixes, narrow UI tweaks, and local
  cleanup that should stay in normal plan mode.
- Task docs remain human-readable with explicit scope, exclusions, orientation,
  verification, decisions, and approval gates.
- Delivery sets remain one primary repository, worktree/branch, goal/ledger, and
  at most one PR.
- Cross-repository implementation requires separate task docs and goals.
- High-risk work retains broader validation and independent review.
- Findings are assessed rather than blindly applied.
- Repositories without the new contract or event workflow retain safe generic
  fallbacks.
- The skills never merge without explicit authorization.

## Prerequisites

- The approved source spec has an immutable GitHub permalink recorded above.
- The UI repository contract/planner (`DELIVERY-01a`) and test-tier interface
  (`DELIVERY-01b`) are stable enough to bind by version.
- The UI repository exposes `.agent/delivery-capabilities.json` and the
  read-only `delivery:capabilities` discovery command from `DELIVERY-01a`.
- Implementation occurs in an isolated `agent-skills` worktree/branch.

## Scope

- Update `task-doc` to generate versioned YAML contracts when a repository
  advertises support.
- Discover repository support only through the versioned
  `delivery:capabilities` interface; do not guess from file presence.
- Require status, group, risk, commit scope, blocking validation, acceptance,
  nightly coverage, and machine-readable existing/planned references.
- Keep automated policy/functional/security proofs under blocking validation;
  keep acceptance for manual/exploratory evidence.
- Reject stale files/tests/projects/targets through the repository validator
  before approval.
- Require every permanent test proposal to name its durable risk; route ordinary
  presentation checks to acceptance.
- Preserve a documented generic fallback for repositories without the contract.
- Update the delivery loop to parse one compatible group and run one
  deduplicated validation union.
- Replace original-task boundary commits with ledger checkpoints and require
  exactly one initial Conventional Commit after the whole original set passes.
- Permit at most one focused commit per later review-remediation batch; no code
  change means no commit.
- Apply low/medium/high validation/review calibration from the contract.
- Use repository validation locks when advertised and diagnose low-risk runs
  that exceed 30 minutes.
- Keep commit, push, and PR creation observable in the active process; prohibit
  detached/unobserved publication.
- Apply the repository delivery-monitor label during ready-PR publication when
  the repository advertises the completion observer.
- Hand remediation to repository automation when installed; otherwise use
  complete reaction-aware polling across reviews, comments, inline threads,
  checks, and reactions.
- Emit implementation-to-ready-PR time, publication time/evidence, and
  one-initial-commit compliance events for the repository rollout collector.
- Add `tests/task-doc-contract.test.mjs` and
  `tests/task-doc-delivery-loop.test.mjs` covering the new policy.
- Update templates, examples, skill metadata, and README guidance.

## Excluded

- Implementing any consuming repository's schema, planner, lock, Nx targets,
  hooks, CI, test audit, or GitHub workflows.
- Editing `publish-branch`, `address-review-findings`, or unrelated skills
  without a separate verified compatibility task.
- Hardcoding NCDMB project names, bot login, commands, branches, or PR history.
- Allowing one goal to implement multiple primary repositories.
- Requiring event remediation in repositories that do not advertise it.
- Weakening publish safety or the never-merge rule.

## Pre-Implementation Verification

- Re-read the current skills, templates, examples, README, and test conventions.
- Resolve the immutable source-spec permalink prerequisite.
- Confirm the exact contract version/interfaces that landed from `DELIVERY-01a`
  and `DELIVERY-01b`.
- Run the consuming repository's `delivery:capabilities` command and bind only
  to advertised compatible interface versions.
- Confirm how consuming repositories advertise planner, lock, event remediation,
  completion observer, and metrics support.
- Invoke the `writing-skills` workflow before editing reusable skills.

## Likely Files To Touch

- `skills/task-doc/SKILL.md`
- `skills/task-doc/references/task-template.md`
- `skills/task-doc/references/examples.md`
- `skills/task-doc-delivery-loop/SKILL.md`
- `skills/task-doc-delivery-loop/agents/openai.yaml`
- `README.md`
- `tests/task-doc-contract.test.mjs`
- `tests/task-doc-delivery-loop.test.mjs`

## Decisions Required Before Implementation

None after the immutable spec permalink and consuming contract interfaces are
available. Those are explicit prerequisites; implementation must not guess them.

## Execution Rules

- Use the `writing-skills` workflow and keep language repository-agnostic.
- Do not duplicate repository schema logic in prose; call advertised validators.
- Treat unknown or incompatible capability versions as an explicit safe-fallback
  condition, not permission to guess commands.
- Treat ledger checkpoints as non-git progress records.
- Do not create intermediate commits for the original delivery set.
- Do not detach or delegate publication in a way that loses active observability.
- Never infer completion from green checks alone and never merge.

## Deliverables

- Contract-aware `task-doc` skill/templates/examples.
- One-initial-commit, deduplicated-validation delivery loop.
- Observable publication, delivery-monitor handoff, review-batch commits, event
  handoff, and safe fallbacks.
- Structured delivery/commit/timing metrics output.
- Two focused Node policy test files and updated README/metadata.

## Completion Verification

- `node --test tests/task-doc-contract.test.mjs` passes and proves contract-aware
  generation, blocking/acceptance separation, planned references, micro-task
  rejection, capability discovery/version negotiation, and no-contract fallback.
- `node --test tests/task-doc-delivery-loop.test.mjs` passes and proves one
  initial commit for a three-task set, ledger-only internal checkpoints, one
  commit per later review batch, no-op batches, risk calibration, observable
  publication, monitor-label handoff, event-enabled handoff, reaction-aware
  fallback, metrics output, and never merge.
- Existing `node --test tests/*.test.mjs` passes.
- No NCDMB-specific implementation details appear in reusable skill prose.

## Approval Gates

None beyond normal `agent-skills` review. GitHub App/secrets/write automation
belong to the consuming repository automation task.

## Completion Criteria

Reusable task creation and delivery consume advertised repository contracts,
avoid duplicate validation and original-task commit fragmentation, publish
observably, support event automation, and remain safe in repositories without
the new system.

## Follow-ups

- Separate compatibility tasks for `publish-branch` or other skills only if
  implementation reveals a verified conflict.
