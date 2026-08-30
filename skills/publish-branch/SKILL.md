---
name: publish-branch
description: Use when the user asks to commit, push, publish, ship, create a PR, open a draft PR, or otherwise send local branch or working-tree changes to GitHub.
---

# Publish Branch

## Purpose

Publish local work intentionally. The main agent runs the publish path inline by default — safety preflight, staging, committing, pushing, opening a draft PR when requested, and final verification. A single worker subagent owns the mutable path only when the user asks for delegation or it is materially useful (large or risky publish, or parallel work in flight).

Keep the change set scoped, rely on repo hooks where they already exist, and do not silently publish unrelated work.

When the caller provides a validated immutable candidate, switch to push-only candidate mode. Publish the exact candidate OID and preserve its validation identity; the general staging and commit rules below do not apply to that mode.

## Approval Gates

These gates apply even in `/fast` mode:

- Stop and ask when the worktree contains mixed or unrelated changes. Do not default to `git add -A` unless the user confirmed the whole worktree is in scope.
- Stop and ask before pushing directly to a default, protected, or integration branch such as `main`, `master`, `develop`, `release`, `release/*`, `hotfix/*`, or `prod` unless the user explicitly requested that branch.
- Stop and ask when the requested action is ambiguous and does not map cleanly to the action rules below.
- Stop and ask when a merge or ready-for-review PR would be unsafe because known checks are failing or the user explicitly wants manual validation first.
- Stop if another agent or process is already mutating the same worktree or publish path.
- Do not force-push, merge, rebase shared history, or rewrite published history as part of normal publish.

The main agent enforces these gates during preflight. When work is delegated, the worker re-checks them before staging, committing, pushing, and PR creation. If state diverges from preflight, whoever holds the publish path stops and reports the divergence.

## Action Rules

User wording maps to actions this way unless the user narrows it:

- `commit this`: stage the intended scope and create a commit, with no push unless requested.
- `commit and push`: create a commit and push the current branch, with no PR unless requested.
- `push this branch`: push the current branch, with no PR unless requested.
- `publish this` or `publish this branch`: commit intended uncommitted changes if present, push the current branch, and open a draft PR by default.
- `open a PR` or `create a PR`: push if needed and open a draft PR by default.
- `commit only` or `do not push`: override broader publish defaults.
- Ready-for-review PRs require explicit user wording.

If the branch already has unpushed commits, publish includes those commits unless the user explicitly asks to publish only new local changes.

## Immutable Candidate Mode

Record the expected candidate OID, verify that `HEAD` equals it, and require a clean worktree before publication: no modified tracked files and no staged changes. Untracked or ignored transient artifacts (coverage output, caches, logs) do not make the worktree dirty and must not be staged. Candidate mode is push-only with respect to repository contents: it must not format, generate, stage, commit, amend, or otherwise mutate the candidate, and it must not invent a second validation plan. Existing non-mutating push hooks may run; if a hook changes tracked files, the index, or the OID, stop and report that the candidate identity was invalidated.

Push the branch containing the exact validated candidate OID, then verify the remote ref resolves to that OID. Open or update the requested PR only after this identity check succeeds.

## GitHub Markdown Transport

For PR titles or other plain values, use non-interpolating argument transport. For PR bodies, comments, or replies containing Markdown, use `--body-file` or an equivalent file-backed, non-interpolating transport. Never place Markdown backticks or command substitutions inside an interpolated shell string.

After each GitHub Markdown mutation, perform one remote read-back and compare the stored content with the intended file. On a read-back mismatch, edit the existing remote object in place and read it back once more; never create a second body, comment, or reply. If a safe in-place edit is unavailable or fails, stop and report the mismatch. Retry only a failed mutation; never repeat a successful creation because the read-back or a later operation failed.

## Delegation Rules

Run the publish path inline after preflight by default. Delegate to one mutation-capable worker subagent only when the user explicitly asks for delegation, or when it is materially useful — a large or high-risk publish, or when other work must proceed in parallel. Routine commits, pushes, and draft PRs stay inline.

When delegating, default worker mechanics:

- Spawn exactly one worker for the publish path.
- Use the current repository checkout by default, not an isolated worktree.
- Run the worker to completion before the final user-facing report.
- Use a worker or implementation-oriented subagent type when the runtime supports one; otherwise use the default/general-purpose subagent.
- Do not use worktree isolation unless the environment requires it or the user explicitly requests it.

The "only one worker" rule is a main-agent discipline and prompt contract. Do not spawn a second mutation-capable publish worker until the first finishes or is abandoned.

If worktree isolation is used, the worker pushes from the isolated checkout and reports the pushed branch and commit hash. The main agent must fetch or otherwise refresh refs in the parent checkout before verification; parent `git log -1` alone is insufficient until refs are refreshed.

## Effort And Fast Mode

Explicit user instructions win. Supported overrides include reasoning effort (`low`, `medium`, `high`, `xhigh`), `/fast` or no-fast wording, review depth, and delegation/no-delegation wording.

Infer effort from risk when the user does not specify it:

- `low`: docs-only changes, skill docs, small scripts/config edits, simple commit-only requests, or clean-tree publish where the branch already has intended commits.
- `medium`: normal source changes, several-module changes, tests/build/package/dependency updates, related untracked directories, or moderate commit-and-push/draft-PR flows.
- `high`: migrations, schema changes, auth/security/payment/permission/secrets-adjacent code, broad refactors, generated code mixed with hand edits, known failing checks, conflict markers, or protected-branch risk requiring confirmation.
- `xhigh`: only when explicitly requested or when the local runtime already supports that tier for exceptionally risky decisions. If unsupported, fall back to `high` and state the downgrade.

Effort tracks risk, but hard gates apply regardless of effort.

Runtime mapping:

- If subagents support explicit `reasoning_effort`, pass the selected effort directly.
- If only model selection is available, map effort to the least capable model that can safely handle the risk; `xhigh` maps to the strongest available model.
- If neither is available, include the selected effort and risk rationale in the worker prompt.
- If `/fast` propagates to subagents, apply it to the single publish worker when selected.
- If `/fast` is only a parent-agent toggle, choose the fastest safe worker model when available or pass `fast_requested` as prompt context; report when no subagent fast flag exists.

## Main-Agent Preflight

Before delegation or inline publish:

1. Inspect scope with `git status -sb` and targeted diffs.
2. Identify the current branch, upstream, unpushed commits, and default/protected branch risk.
3. Inspect enough file scope to detect obvious mixed or unrelated changes.
4. Resolve the requested action using the action rules above.
5. Choose effort and fast-mode mapping.
6. Check PR prerequisites only when PR creation is requested:
   - Prefer the environment's existing GitHub integration or workflow.
   - If the flow relies on `gh`, run `gh --version` and `gh auth status`.
   - If plain `gh` auth is invalid, retry with `zsh -ic 'gh auth status'`.
   - If interactive-shell auth succeeds, pass that state to the worker and run PR commands through the same interactive shell.
   - If both plain `gh` and the interactive-shell retry fail, continue branch operations and stop only before PR creation.
7. Ensure the active permission mode can run the required `git` and `gh` commands. If a worker hits a permission block, it reports the block instead of trying alternate destructive commands.

The preflight is intentionally smaller than a full code review. It prevents unsafe publishing; it does not validate the implementation.

## Worker Handoff

Send the worker a structured handoff in this shape:

```yaml
publish_worker_handoff:
  repo_path: "/absolute/path/to/repo"
  requested_action: "commit_only | commit_and_push | push_only | publish_branch | draft_pr | candidate_push | candidate_draft_pr | candidate_ready_pr"
  action_source: "user wording or inferred default"
  candidate_oid: "40-hex validated OID or none"
  candidate_gate_evidence: "supplied evidence identity or none"
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

Also instruct the worker:

- Do not revert unrelated user changes.
- Do not spawn competing publish workers.
- In non-candidate mode, stage only intended files. Use `git add -A` only after the full worktree scope is confirmed. In candidate mode, do not stage or commit anything.
- Respect existing repo hooks. Do not bypass hooks unless the user explicitly asked.
- Prefer repo-standard commands and root scripts over ad hoc tool entrypoints.
- If SSH auth is required for push, retry with the environment's standard SSH bootstrap helper if one exists, for example `zsh -ic 'source ~/.zshrc; loadssh; git push ...'`.

## Worker Report

Require the worker to return:

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
    remote_ref_oid: "40-hex OID or none"
  candidate:
    candidate_oid: "40-hex validated OID or none"
    local_head_oid: "40-hex OID or none"
    identity_verified: "true | false | not applicable"
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

Partial publish is a valid terminal state. If commit succeeds but push or PR creation fails, stop after the partial state, report local refs, and do not clean up destructively with `git reset`, force-push, or history rewriting.

## Validation

In immutable candidate mode, consume the supplied candidate evidence and do not start a second manual validation plan. The remaining rules in this section apply to non-candidate publication.

- Treat repo hooks as the default baseline when they already run on commit or push.
- Run manual validation only when the user asked for it, when hooks are intentionally skipped, or when the change risk justifies extra checks.
- If manual validation runs, choose the smallest relevant command, for example `pnpm typecheck`, `npm test -- <target>`, `pytest <path>`, `cargo test -p <crate>`, or the workspace's affected target command.
- If schema or migration changes are part of the scope, run the repo's migration status and apply commands against an appropriate environment unless the user explicitly says not to.
- If manual validation is not run, say that repo hooks were relied on and note any known gaps, such as missing or intentionally lightweight pre-push checks.

## Main-Agent Verification

Before reporting completion, verify final state independently:

- `git status -sb`
- `git log -1 --oneline` when a commit was created
- push evidence when relevant, such as remote ref state or `git ls-remote`
- PR evidence when relevant, such as the PR URL and state from the GitHub integration or `gh`

In candidate mode, verify the remote ref OID equals the candidate OID. A pushed branch name or local `HEAD` alone is insufficient identity evidence.

Append a main-agent verification block to the worker report:

```yaml
main_agent_verification:
  git_status: "git status -sb output"
  head: "git log -1 --oneline output or not checked"
  push_evidence: "remote ref, gh output, or not checked"
  candidate_oid: "40-hex validated OID or none"
  remote_ref_oid: "40-hex OID or none"
  candidate_identity_verified: "true | false | not applicable"
  pr_evidence: "PR URL/state, gh output, or not checked"
```

## Output

The user-facing report must distinguish worker-reported actions from main-agent verification. Provide:

- files or scope published
- branch name and commit hash
- whether existing unpushed commits were included
- whether the branch was pushed directly or published through a draft PR
- PR URL when created
- validation and hooks that ran
- blockers, skipped checks, partial-publish state, or follow-up the user still owns
