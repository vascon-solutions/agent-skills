---
name: isolated-worktree
description: Use when work needs an isolated checkout separate from the current working tree — starting feature or task-doc delivery work, executing an implementation plan, or when unsure whether the session is already inside a worktree.
---

# Isolated Worktree

## Overview

Ensure work happens in an isolated workspace without paying for one you already
have. Detect existing isolation first. Then use the platform's native worktree
tool. Fall back to manual `git worktree` only when no native tool exists.

**Core principle:** Detect, then native, then git. Never fight the harness, and
never verify a worktree by running a test suite.

## Step 0: Detect Existing Isolation

Before creating anything, check whether you are already isolated:

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
```

**Submodule guard:** `GIT_DIR != GIT_COMMON` is also true inside a submodule.
If `git rev-parse --show-superproject-working-tree` prints a path, you are in a
submodule — treat it as a normal checkout.

- **`GIT_DIR != GIT_COMMON` (not a submodule):** already in a linked worktree.
  Report the path and branch (or detached-HEAD state) and skip to Step 2. Do
  NOT create another worktree.
- **`GIT_DIR == GIT_COMMON`:** normal checkout. If the repo's instruction files
  (`AGENTS.md`/`CLAUDE.md`) or the user already declare a worktree preference,
  honor it without asking; otherwise ask once before creating one.

## Step 1: Create the Workspace

### 1a. Native tool (preferred)

If the platform provides a worktree mechanism — a tool named like
`EnterWorktree` or `WorktreeCreate`, a `/worktree` command, or a `--worktree`
flag — use it and skip to Step 2. Native tools own placement, branching, and
cleanup; `git worktree add` alongside one creates phantom state the harness
cannot manage.

### 1b. Git fallback (no native tool)

Directory priority: explicit instruction-file/user preference, then an existing
`.worktrees/` (or `worktrees/`; `.worktrees` wins if both exist), then default
to `.worktrees/` at the repo root. Carry the selected directory through every
command below:

```bash
WORKTREES_DIR=".worktrees"   # replace with the directory the priority selected
```

Pick the branch name before creating anything — derive it from the task (for
example `feat/<task-slug>`), then validate the format and confirm it is unused:

```bash
BRANCH_NAME="feat/example-task"
git check-ref-format --branch "$BRANCH_NAME"
git show-ref --verify --quiet "refs/heads/$BRANCH_NAME" \
  && { echo "branch already exists — pick another name"; }
```

Project-local directories MUST be gitignored before use. Probe with a trailing
slash — a `.worktrees/` ignore rule does not match the slash-less path until
the directory actually exists, so the no-slash probe appends duplicates:

```bash
git check-ignore -q "$WORKTREES_DIR/" || { echo "$WORKTREES_DIR/" >> .gitignore; }
```

Skip the gitignore step when the selected directory lives outside the
repository.

Then create and enter it:

```bash
git worktree add "$WORKTREES_DIR/$BRANCH_NAME" -b "$BRANCH_NAME"
cd "$WORKTREES_DIR/$BRANCH_NAME"
```

If creation fails with a permission/sandbox error, say so and work in place.

## Step 2: Setup and Verify Identity

Install dependencies with the package manager the lockfile declares — never a
hardcoded one:

```bash
if   [ -f pnpm-lock.yaml ];     then pnpm install --prefer-offline
elif [ -f bun.lockb ];          then bun install
elif [ -f yarn.lock ];          then yarn install
elif [ -f package-lock.json ];  then npm install
elif [ -f Cargo.toml ];         then cargo build
elif [ -f pyproject.toml ];     then poetry install
elif [ -f requirements.txt ];   then pip install -r requirements.txt
elif [ -f go.mod ];             then go mod download
fi
```

Verification is **checkout identity, not a test run**:

```bash
pwd
git rev-parse --show-toplevel
git branch --show-current
git status --short
```

Report: `Worktree ready at <path> on branch <name>.` Then start the task.
Do not run the project's test suite as a readiness check — baseline test
status belongs to the task's own validation plan, and a full suite can cost
more than the task itself.

## Step 3: Hygiene

- When the work is finished and merged or abandoned, remove the worktree:
  `git worktree remove <path>` (then `git worktree prune`).
- If `git worktree list | wc -l` shows more than ~6 entries, tell the user and
  offer to prune stale ones before adding another.

## Quick Reference

| Situation | Action |
|-----------|--------|
| Already in linked worktree | Skip creation (Step 0) |
| In a submodule | Treat as normal checkout |
| Native worktree tool available | Use it, never raw git |
| No native tool | Git fallback under the selected dir (default `.worktrees/`) |
| Worktree dir not gitignored | Probe with trailing slash, add to `.gitignore` first |
| `pnpm-lock.yaml` present | `pnpm install`, never `npm install` |
| Sandbox blocks creation | Report, work in place |
| Many stale worktrees | Warn and offer to prune |

## Red Flags

**Never:**

- Create a worktree when Step 0 already detects one — nested worktrees and
  worktree sprawl are the #1 failure mode.
- Use `git worktree add` when a native tool (e.g. `EnterWorktree`) exists.
- Run `npm install` in a repo with a non-npm lockfile.
- Run the test suite to "verify" a fresh worktree.
- Leave finished worktrees behind without at least offering cleanup.
