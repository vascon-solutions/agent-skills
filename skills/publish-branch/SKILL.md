---
name: publish-branch
description: Publish or ship the current branch or working tree safely when the user asks to commit, push, publish, ship, create a PR, or open a draft PR by checking scope, committing intentionally, pushing with the repo's SSH setup, and opening a draft PR when appropriate.
---

# Publish Branch

## Purpose

Use this skill when the user asks to publish or ship a branch, commit and push changes, open a PR, open a draft PR, or otherwise send local work to GitHub. Keep the change set intentional, rely on repo hooks where they already exist, and do not silently publish unrelated work.

## Approval Gates

- Stop and ask when the worktree contains mixed or unrelated changes. Do not default to `git add -A` unless the user confirmed the whole worktree is in scope.
- Stop and ask before pushing directly to `develop`, `main`, or any other default or integration branch unless the user explicitly requested that branch.
- Stop and ask when a merge or ready-for-review PR would be unsafe because known checks are failing or the user explicitly wants manual validation first.
- Stop and ask before any parallel workflow that would let more than one agent mutate the same git worktree or publish path.
- If plain `gh auth status` is invalid, retry through the user's interactive shell before treating GitHub auth as unavailable. Continue branch operations like inspect, stage, commit, and push. Only stop before PR creation if both plain `gh` and the interactive-shell retry fail.

## Decision Rules

- If the current branch is a default or integration branch such as `develop`, stay on it only when the user explicitly wants a direct push there. Otherwise create a feature branch first.
- If the remote uses SSH and push fails with key or auth errors, retry with the environment's standard SSH bootstrap helper if one exists, for example `zsh -ic 'source ~/.zshrc; loadssh; git push ...'`.
- If `gh auth status` fails in the non-interactive shell, retry with `zsh -ic 'gh auth status'`. When that succeeds, run PR commands through the same interactive shell, for example `zsh -ic 'gh pr create ...'`.
- If the working tree is clean except for the intended files, stage explicit file paths when the scope is narrow. Use `git add -A` only after scope is confirmed.
- If the user asked only for commit and push, do not open a PR automatically.
- If the user asked for a publish or PR flow, open a draft PR by default. Only create a ready-for-review PR when the user explicitly asks for it.
- Prefer repo-standard commands and root scripts over ad hoc tool entrypoints.
- Respect existing repo hooks. Use them as the baseline instead of bypassing them unless the user explicitly asks.
- Keep final staging, commit, push, and branch or PR decisions on the main agent.
- Use read-only delegation only when the environment supports it and the user explicitly asked for delegation or parallel agent work.
- If a worker-style subagent is used, keep it to sidecar tasks such as drafting a PR body or summarizing validation results. Do not delegate the final publish path.

## Workflow

1. Inspect scope with `git status -sb` and targeted diffs.
2. Identify whether the current branch is safe to publish directly. If it is `develop` or another shared branch, confirm before pushing there.
3. If delegation is explicitly requested and supported by the environment, keep it narrow: use a read-only subagent for mixed-scope inspection or a sidecar subagent for PR-body drafting, while the main agent retains ownership of the final publish path.
4. Check PR prerequisites only when a PR is requested:
   - Prefer the environment's existing GitHub integration or workflow.
   - If the flow relies on `gh`, run `gh --version` and `gh auth status`.
   - If plain `gh` auth is invalid, retry with `zsh -ic 'gh auth status'`; if that succeeds, use `zsh -ic 'gh pr create ...'` for PR creation.
   - If both plain `gh` and the interactive-shell retry are invalid, continue branch operations and stop only before PR creation.
5. Stage only the intended files.
6. Commit with a terse message that matches the actual change.
7. Let repo hooks run on commit and push. Run extra manual validation only when the user asked for it, when hooks do not cover the risk, or when a high-risk change needs more confidence.
8. Push the current branch:
   - Prefer `git push -u origin <branch>` when upstream is not set.
   - If SSH auth is required, retry with the environment's standard SSH bootstrap helper.
9. If the user asked for a PR, open a draft PR after the push succeeds:
   - Prefer the environment's existing GitHub integration or workflow.
   - Use the remote default branch unless the user specified a different base.
10. Report exactly what was published and any remaining manual step.

## Validation

- Treat repo hooks as the default baseline when they already run on commit or push.
- Run manual validation only when the user asked for it, when hooks are intentionally skipped, or when the change risk justifies extra checks.
- If you run manual validation, choose the smallest relevant command, for example `pnpm typecheck`, `npm test -- <target>`, `pytest <path>`, `cargo test -p <crate>`, or the workspace's affected target command.
- If schema or migration changes are part of the scope, run the repo's migration status and apply commands against an appropriate environment unless the user explicitly says not to.
- If manual validation is not run, say that repo hooks were relied on and note any known gaps, such as missing or intentionally lightweight pre-push checks.

## Output

Provide:

- the files or scope that were published
- the branch name and commit hash
- whether the branch was pushed directly or published through a PR
- the validation that ran
- any blocker, skipped check, or follow-up the user still owns

## Done Report

- What changed.
- Which files were included in the publish scope.
- What validation ran.
- Any remaining risks, blockers, follow-ups, or unrelated repo failures.
