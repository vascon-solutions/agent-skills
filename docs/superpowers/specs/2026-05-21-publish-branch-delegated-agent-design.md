# Publish Branch Delegated Agent - Design Spec

**Date:** 2026-05-21
**Status:** Approved - ready for implementation planning
**Source:** Brainstorming session on subagent-driven publish and commit flows

---

## Purpose

Update the `publish-branch` skill so publish, commit, push, and PR flows can be executed by a worker subagent by default. The main agent still performs a short preflight, but the delegated worker may own the final mutable path: staging, committing, pushing, and opening a PR when the user requested those actions.

The goal is faster routine publishing while preserving hard safety gates around mixed worktrees, protected branches, and ambiguous user intent.

---

## Current Behavior

The current skill is conservative:

- The main agent owns final staging, commit, push, and PR decisions.
- Subagents are limited to read-only inspection or sidecar tasks such as drafting PR text.
- Parallel workflows that mutate the same git worktree are blocked.

That model avoids accidental publishing, but it does not match the desired workflow where a subagent can perform the publish action directly.

---

## Desired Behavior

`publish-branch` should use a delegated execution model:

1. The main agent runs a minimal preflight.
2. The main agent chooses a subagent reasoning effort from the change risk unless the user explicitly specifies one.
3. The main agent chooses whether to use the coding agent fast option unless the user explicitly specifies `/fast` or disables fast execution.
4. One worker subagent receives the full publish task and may mutate the worktree.
5. The worker performs the requested action: commit only, commit and push, publish branch, or open draft PR.
6. The main agent verifies the final git state and reports the outcome.

Only one worker may own the mutable publish path at a time.

---

## User Overrides

Explicit user instructions win over automatic decisions.

Supported override categories:

- Reasoning effort: `low`, `medium`, `high`, or `xhigh`.
- Fast execution: `/fast`, "use fast", "do not use fast", or equivalent wording.
- Review depth: "review first", "no review", "just publish", "commit only", "do not push".
- Delegation: "use a subagent", "do not use a subagent", or equivalent wording.

When the user explicitly specifies an effort level, the skill must use that effort unless the requested environment cannot support it. When unsupported, the agent should state the limitation and use the nearest supported option.

---

## Preflight

The main agent must run a short preflight before delegation, including:

- `git status -sb`
- current branch name
- upstream/default branch risk
- enough file-scope inspection to detect obvious mixed or unrelated changes
- PR/auth checks only when PR creation is requested and the local flow depends on `gh`

The preflight is intentionally smaller than a full code review. It exists to prevent accidental unsafe publishing, not to validate the implementation.

---

## Safety Gates

These gates still apply, including in `/fast` mode:

- Stop before pushing directly to a default or integration branch such as `main`, `master`, `develop`, or `release` unless the user explicitly requested that branch.
- Stop when the worktree contains mixed or unrelated changes and the user did not confirm the full scope.
- Stop when the requested action is ambiguous, such as "publish this" with no clear commit/push/PR intent and multiple plausible meanings.
- Stop before creating a ready-for-review PR when checks are known to be failing or the user asked for manual validation first.
- Stop if another agent or process is already mutating the same worktree for publishing.

`/fast` never bypasses these gates.

---

## Effort Selection

If the user does not specify effort, infer it from uncommitted changes and requested action.

Use `low` for:

- docs-only changes
- skill documentation changes
- small scripts or config edits
- simple commit-only requests
- clean tree publish requests where the branch already has intended commits

Use `medium` for:

- normal source changes
- changes across several modules
- tests, build config, package metadata, or dependency updates
- untracked directories that appear related to the request
- commit-and-push or draft PR flows with moderate scope

Use `high` for:

- migrations or schema changes
- auth, security, payment, permission, or secrets-adjacent code
- broad refactors
- generated code mixed with hand edits
- known failing checks
- conflict markers
- protected/default branch risk that requires user confirmation

Use `xhigh` only when explicitly requested or when the environment's local convention already uses it for exceptionally risky publish decisions.

---

## Fast Execution

Fast execution and reasoning effort are separate knobs.

`/fast` means use the coding agent fast option for speed. It does not mean low effort, shallow safety gates, or skipped branch protection.

Automatic fast selection:

- Use fast automatically for low- or medium-risk publish actions when the user did not request review.
- Do not use fast automatically for high-risk changes.
- Do not use fast automatically when the user asks for a review, CI diagnosis, careful PR writeup, or detailed validation.
- If the user explicitly requests `/fast`, use fast even for high-risk changes, while preserving hard safety gates and the inferred or explicit reasoning effort.

Examples:

- "commit this" with docs-only changes: fast + low effort.
- "publish this branch" with ordinary app code: fast + medium effort.
- "open a draft PR for these auth changes": normal speed + high effort.
- "/fast publish this migration branch": fast + high effort.

---

## Worker Contract

The worker subagent receives a narrow task prompt with:

- repository path
- observed preflight state
- requested action
- selected reasoning effort
- whether fast execution is enabled
- exact safety gates it must honor
- instruction not to revert unrelated user changes
- instruction not to spawn competing publish workers

The worker may:

- stage intended files
- create a commit
- push the current branch
- open a draft PR when requested
- rely on repo hooks unless the user explicitly asked otherwise

The worker must not:

- bypass hooks unless explicitly instructed
- push to a protected/default branch without explicit user instruction
- include unrelated changes after detecting mixed scope
- create a ready-for-review PR unless explicitly requested
- continue after a hard safety gate without asking

---

## Reporting

The worker must report:

- files or scope included
- branch name
- commit hash and commit message, when a commit was created
- push status
- PR URL, when created
- validation and hooks that ran
- blockers, skipped checks, or follow-ups

The main agent must verify final state with at least:

- `git status -sb`
- `git log -1 --oneline` when a commit was created
- PR or push evidence when relevant

The final user-facing report should distinguish worker-reported actions from main-agent verification.

---

## Non-Goals

- No multi-worker publish mutation.
- No automatic ready-for-review PRs.
- No bypassing branch protection or user confirmation gates.
- No full code review unless requested or required by risk.
- No automatic CI waiting unless the user asks to monitor CI.

---

## Implementation Notes

The existing skill text should be updated in place rather than split into a separate skill. The most important edits are:

- Replace the "main agent owns final publish path" rule with the delegated ownership model.
- Add override, effort selection, and fast execution sections.
- Update the workflow so preflight happens before spawning one mutable worker.
- Keep the current GitHub auth retry guidance.
- Keep final verification in the main agent before reporting completion.

