---
name: repair-agent-files
description: Create or repair AGENTS.md and CLAUDE.md so one file is the clear agent authority with no duplication or conflict between them.
---

# Repair Agent Files

## Purpose

Produce a single clear source of truth for coding-agent behavior in the repository.

This skill handles all agent instruction file states:

- no `AGENTS.md` — create it
- `AGENTS.md` bloated or mixing project docs — trim it
- both `AGENTS.md` and `CLAUDE.md` exist — align them
- only `CLAUDE.md` exists — introduce `AGENTS.md`, reduce `CLAUDE.md`

## When To Use

Use when:

- the repo has no `AGENTS.md` and needs one
- `AGENTS.md` is too long, duplicative, or mixes docs with agent instructions
- `AGENTS.md` and `CLAUDE.md` conflict or overlap
- `CLAUDE.md` contains rules that should live in `AGENTS.md`
- the user asks for a clean source of truth for coding-agent behavior

## When Not To Use

Do not use when:

- the main problem is missing or stale project docs
  Use `rewrite-docs-from-code`
- the correct target doc set is still unclear
  Use `repo-docs-audit` first
- the task is a second-pass audit of recent doc changes
  Use `review-doc-changes`

## Tool-Specific File Semantics

Know the distinction before deciding what each file should own:

- `AGENTS.md` — OpenAI Codex-native; the multi-tool convention across Codex, Claude Code, and agents.sh-style workflows
- `CLAUDE.md` — Claude Code-specific; auto-loaded at session start by Claude Code

**Default behavior:**
- `AGENTS.md` owns agent operating behavior, constraints, and doc hierarchy
- `CLAUDE.md` is a short pointer to `AGENTS.md`

**Exception:** if the repo uses only Claude Code and `CLAUDE.md` needs to carry more, it should still defer to `AGENTS.md` rather than duplicate it.

Never expand both files into parallel instruction systems.

## Required Inputs

You need:

- repo structure
- current `AGENTS.md` and `CLAUDE.md` if they exist
- enough code inspection to identify critical paths and constraints
- current project docs if they exist, so `AGENTS.md` can point outward rather than duplicate them

## Step-By-Step Instructions

### 1. Assess the current state

Read `AGENTS.md` and `CLAUDE.md` if they exist. Classify:

- neither exists → create both from scratch
- only `CLAUDE.md` → create `AGENTS.md`, reduce `CLAUDE.md` to pointer
- only `AGENTS.md` → repair if needed, skip CLAUDE.md work
- both exist → align; `AGENTS.md` wins by default

### 2. For a new AGENTS.md — scan the repo

Identify:
- validation commands (lint, build, test — whatever applies)
- critical paths and constraints that agents must not break
- repo navigation shortcuts (key files, common change locations)
- what project docs exist and what they each own
- compliance, safety, or governance constraints if the domain has them

Do not add project knowledge here. Project docs hold project knowledge.

### 3. Build or repair AGENTS.md

Use this section structure as the minimum viable frame:

1. **Source-of-truth declaration** — one or two lines at the top
2. **Doc hierarchy** — table pointing outward to project docs
3. **Session bootstrap** — what to read before writing code (3–5 lines)
4. **Critical constraints** — what must never break; key file paths
5. **Agent operating rules** — minimal-change rules, import/API conventions
6. **Repo navigation** — key files + common change locations
7. **Validation** — commands to run before claiming done
8. **Doc update rules** — when to update docs vs when not to
9. **Completion report** — standard handoff block

Remove anything that:
- narrates the project for a human reader
- duplicates content in project docs
- belongs in a contributor guide
- is likely to change frequently and is not required every session

**Code block rules:**
- **Keep** a code block only when it enforces a critical constraint where prose alone is ambiguous — e.g., a prohibited API paired with the correct alternative that isn't obvious.
- **Remove** code blocks for patterns that are consistently followed in the codebase — agents discover them by reading existing files.
- **Remove** code blocks for anything a linter or formatter auto-corrects (import order, formatting style). Documenting what the tool fixes for you is redundant.
- **Keep** operational command blocks (validation, test flags, setup commands) — these are instructions to execute, not patterns to infer.

**Size guidance:** target 120–180 lines. Under 200 for most repos. Over 300 is almost certainly bloated.

### 4. Repair CLAUDE.md

Standard minimal form when AGENTS.md is the authority:

```markdown
# CLAUDE.md

**AGENTS.md is the single source of truth for agent behavior in this repository.**

In every new session:
1. Read `AGENTS.md` in full before writing any code.
2. Follow the doc hierarchy and operating rules defined there.
3. Do not treat this file as a second source of truth.
```

If the repo is Claude Code-only and CLAUDE.md needs to carry more, keep it as the authority but apply the same discipline: no project narrative, no duplicated rules, point outward.

### 5. Confirm the file pair

Verify:
- one file owns agent behavior; the other defers or covers only tool-specific behavior
- no operating rules, checklists, or repo context are duplicated
- an agent reading both files sees one unambiguous precedence model

## Decision Rules

- `AGENTS.md` should own agent behavior by default
- `CLAUDE.md` should almost always be a 5–10 line pointer
- Do not split operating rules across both files
- If both files have unique high-value content, migrate it to the correct owner — do not keep both copies
- If a section helps human readers more than agents, it belongs in project docs, not in `AGENTS.md`
- Temporary implementation detail does not belong in `AGENTS.md`
- A code block earns its place only if an agent would plausibly get the constraint wrong without it and the correct approach is not discoverable by reading existing files. When in doubt, remove it and point the agent to the relevant files instead.

## Expected Outputs

Produce:

- a compact `AGENTS.md` with the standard section structure
- a `CLAUDE.md` that defers clearly to `AGENTS.md`
- a short summary of what moved, what was deleted, and why

## Cautions / Common Failure Modes

- Turning `AGENTS.md` into a project wiki
- Letting `CLAUDE.md` become a second operating manual
- Including architecture detail that belongs in `/docs`
- Making the file so long agents stop reading it
- Treating the section list as a rigid required template rather than a minimum frame
- Adding code blocks for patterns the agent can find in existing files — point to the files instead
- Documenting what the linter already enforces and auto-fixes

## Example Usage

Use this skill when a user says:

- "Rewrite AGENTS.md to be lean and agent-focused."
- "Create AGENTS.md for this repo."
- "Our AGENTS.md is too big and duplicates the docs."
- "Make CLAUDE.md point to AGENTS.md."
- "We have both AGENTS.md and CLAUDE.md. Make them consistent."
- "Remove overlap between our instruction files."
