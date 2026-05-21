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

For trivial, low-risk requests where delegation overhead exceeds the work, such as committing a one-line typo fix, the main agent may inline the publish flow instead of spawning a worker. Inline execution must still honor every safety gate and final verification rule in this spec.

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

## Default Action Map

Keep the current `publish-branch` behavior unless the user narrows it:

- "commit this" means stage the intended scope and create a commit, with no push unless requested.
- "commit and push" means create a commit and push the current branch, with no PR unless requested.
- "push this branch" means push the current branch and do not create a PR unless requested.
- "publish this" or "publish this branch" means commit intended uncommitted changes if present, push the current branch, and open a draft PR by default.
- "open a PR" or "create a PR" means push if needed and open a draft PR by default.
- Ready-for-review PRs require explicit user wording.
- "do not push" and "commit only" override broader publish defaults.

If the branch already has unpushed commits, the publish scope includes those commits unless the user explicitly asks to publish only new local changes. The main agent must mention this in the worker handoff.

The ambiguity gate applies when the user's wording does not map cleanly to one of these actions or when repo state creates multiple materially different interpretations.

---

## Preflight

The main agent must run a short preflight before delegation, including:

- `git status -sb`
- current branch name
- upstream/default branch risk
- enough file-scope inspection to detect obvious mixed or unrelated changes
- PR/auth checks only when PR creation is requested and the local flow depends on `gh`

The preflight is intentionally smaller than a full code review. It exists to prevent accidental unsafe publishing, not to validate the implementation.

GitHub auth retry ownership stays with the main agent during preflight when PR creation is requested and the local flow depends on `gh`: run `gh auth status`, retry with `zsh -ic 'gh auth status'` if plain auth fails, and pass the result to the worker. If auth cannot be verified, the worker may still commit and push, but must stop before PR creation unless it can independently verify auth through the same approved retry path.

Before delegation, the main agent must also ensure the active permission mode can run the required `git` and `gh` commands. If the worker encounters a permission block, it must report the block instead of attempting alternate destructive commands.

---

## Safety Gates

These gates still apply, including in `/fast` mode:

- Stop before pushing directly to a default or integration branch such as `main`, `master`, `develop`, `release`, `release/*`, `hotfix/*`, `prod`, or any repo-configured protected branch unless the user explicitly requested that branch.
- Stop when the worktree contains mixed or unrelated changes and the user did not confirm the full scope.
- Stop when the requested action is ambiguous, such as "publish this" with no clear commit/push/PR intent and multiple plausible meanings.
- Stop before creating a ready-for-review PR when checks are known to be failing or the user asked for manual validation first.
- Stop if another agent or process is already mutating the same worktree for publishing.

`/fast` never bypasses these gates.

The listed protected branch names are a floor, not a ceiling. When available, inspect repository configuration or GitHub branch metadata to identify additional protected or default branches.

Gate ownership:

- The main agent enforces hard gates before delegation.
- The worker re-checks the same gates immediately before staging, committing, pushing, and PR creation.
- If repo state diverges from preflight, the worker must stop and report the divergence instead of continuing.

The "only one worker" rule is enforced as a main-agent discipline and prompt contract: the main agent must spawn at most one mutation-capable publish worker for a request, must not spawn another until that worker finishes or is abandoned, and must instruct the worker not to spawn competing publish workers. This spec does not require a lockfile; if an implementation adds one, it must be advisory and must not live in committed source.

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

Use `xhigh` for exceptionally risky publish decisions only when explicitly requested or when the local agent runtime already supports that tier. It means the highest available reasoning depth or model class plus manual final verification by the main agent. If the runtime does not support `xhigh`, fall back to `high` and state the downgrade.

Effort tracks risk, but hard gates apply regardless of effort.

Runtime mapping:

- If the environment supports an explicit subagent reasoning-effort parameter, pass `low`, `medium`, `high`, or `xhigh` directly.
- If the environment supports model selection but not explicit effort, map effort to the least capable model that can safely handle the risk; `xhigh` maps to the strongest available model.
- If the environment supports neither, include the selected effort and risk rationale in the worker prompt and state that effort is advisory.

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

Runtime mapping:

- If the environment exposes a fast execution or service-tier option for subagents, apply it to the single publish worker when selected.
- If `/fast` is only a parent-agent toggle and does not propagate to subagents, do not pretend it did. Either choose the fastest safe worker model when model selection is available, or pass "fast requested" as a prompt directive and report that the runtime has no subagent fast flag.
- If fast execution conflicts with an explicit user model or effort request, preserve the user's explicit model or effort and treat fast as best-effort.

---

## Worker Invocation

Default worker mechanics:

- Spawn exactly one mutation-capable worker subagent for the publish path.
- Use the current repository checkout by default, not an isolated worktree.
- Run the worker to completion before the main agent sends the final user-facing report.
- Use a worker or implementation-oriented subagent type when the runtime supports one; otherwise use the default/general-purpose subagent with the worker contract in this spec.
- Do not use worktree isolation unless the environment requires it or the user explicitly requests it.

If worktree isolation is used, the worker must push from its isolated checkout and report the pushed branch and commit hash. The main agent must fetch or otherwise refresh refs in the parent checkout before verification; parent `git log -1` alone is insufficient until refs are refreshed.

---

## Worker Handoff Template

The main agent should send a structured handoff in this shape:

```yaml
publish_worker_handoff:
  repo_path: "/absolute/path/to/repo"
  requested_action: "commit_only | commit_and_push | push_only | publish_branch | draft_pr"
  action_source: "user wording or inferred default"
  branch:
    current: "feature/example"
    upstream: "origin/feature/example or none"
    default_or_protected_risk: false
  scope:
    intended_files:
      - "path/to/file"
    untracked_or_dirty_summary: "short summary"
    mixed_scope_confirmed: false
    includes_existing_unpushed_commits: true
  auth:
    gh_required: true
    gh_auth_verified: true
    gh_retry_used: "none | interactive_shell | failed"
  execution:
    reasoning_effort: "low | medium | high | xhigh"
    fast_requested: false
    fast_mapping: "runtime flag | model choice | prompt-only | unsupported"
    worker_checkout: "same-checkout | isolated-worktree"
  safety_gates:
    - "Do not push protected/default branches without explicit user instruction."
    - "Do not include unrelated changes."
    - "Do not create ready-for-review PRs unless explicitly requested."
    - "Do not bypass hooks unless explicitly instructed."
    - "Stop if state diverges from preflight."
```

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
- force-push, merge, rebase shared history, or rewrite published history unless the user explicitly requested that exact operation and the main agent confirmed it before delegation

---

## Reporting

The worker must report in this shape:

```yaml
publish_worker_report:
  status: "completed | blocked | partial"
  files_or_scope:
    - "path/to/file"
  branch: "feature/example"
  commits:
    created:
      hash: "abc1234 or none"
      message: "commit message or none"
    pre_existing_unpushed:
      - "def5678"
  push:
    attempted: true
    status: "pushed | skipped | failed"
    remote_ref: "origin/feature/example or none"
  pr:
    requested: true
    status: "created | skipped | failed"
    url: "https://github.com/org/repo/pull/123 or none"
    draft: true
  validation:
    hooks_ran:
      - "pre-commit"
    manual_commands:
      - "npm test"
    skipped:
      - "manual validation not requested"
  blockers:
    - "none or concrete blocker"
  verification_state:
    worker_git_status: "git status -sb output"
    worker_head: "git log -1 --oneline output"
```

The main agent must verify final state with at least:

- `git status -sb`
- `git log -1 --oneline` when a commit was created
- PR or push evidence when relevant

The main agent must overwrite or append its own verification block before reporting to the user:

```yaml
main_agent_verification:
  git_status: "git status -sb output"
  head: "git log -1 --oneline output or not checked"
  push_evidence: "remote ref, gh output, or not checked"
  pr_evidence: "PR URL/state, gh output, or not checked"
```

The final user-facing report should distinguish worker-reported actions from main-agent verification.

Partial-publish failures are valid terminal states. If commit succeeds but push or PR creation fails, stop after the partial state, report the local commit hash and branch refs, and do not destructively clean up with `git reset`, force-push, or history rewriting.

---

## Non-Goals

- No multi-worker publish mutation.
- No automatic ready-for-review PRs.
- No bypassing branch protection or user confirmation gates.
- No full code review unless requested or required by risk.
- No automatic CI waiting unless the user asks to monitor CI.
- No force-push, merge, rebase of shared history, or history rewrite as part of normal publish.

---

## Implementation Notes

The existing skill text should be updated in place rather than split into a separate skill. The most important edits are:

- Replace the current `publish-branch` lines that say "Keep final staging, commit, push, and branch or PR decisions on the main agent," "Use read-only delegation only," and "Do not delegate the final publish path" with the delegated ownership model in this spec.
- Add override, effort selection, and fast execution sections.
- Update the workflow so preflight happens before spawning one mutable worker.
- Keep the current GitHub auth retry guidance, with main-agent preflight ownership and worker re-check behavior as described above.
- Keep final verification in the main agent before reporting completion.
- Preserve the current default action map where publish/PR flows open a draft PR by default.
