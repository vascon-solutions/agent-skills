---
name: repo-skill-scan
description: Scan a repository for repeated patterns that are good candidates for new agent skills or CLI commands. Produces a ranked candidate list with verdicts (skill / command / reject) and scope (global / repo-specific). Globally reusable across framework types.
---

# Repo Skill Scan

## Purpose

Identify repeated patterns in a repository that are worth formalizing as agent skills or CLI commands.

This skill does not write docs, maintain agent instruction files, or audit documentation.
It discovers workflow patterns that agents or developers repeat — and decides which deserve formalization, which should become deterministic scripts, and which should be left alone.

## When To Use

Use when:

- you want to know what repo-specific skills or commands are worth adding
- a repo has unclear multi-step procedures that keep recurring across sessions
- you are onboarding to a new repo and want to know what agent skills would help most
- the user asks "what skills should we add for this repo?"
- the user asks "what commands or scripts are missing?"
- you have just finished `repo-docs-audit` and want to also identify automation gaps

## When Not To Use

Do not use when:

- the task is to audit or repair documentation
  Use `repo-docs-audit` or `rewrite-docs-from-code`
- the task is to align `AGENTS.md` and `CLAUDE.md`
  Use `repair-agent-files`
- the task is to validate recent doc changes
  Use `review-doc-changes`
- you only need to understand the repo structure for a single task, not discover automation opportunities

## Required Inputs

You need:

- repository filesystem access (structure, scripts, CI config)
- git history access (commit messages, co-changed file patterns)
- existing docs, `AGENTS.md`, and `CONTRIBUTING.md` if present
- current skill and command inventory (to avoid recommending what already exists)

Before scanning, check:

- `~/agent-skills/skills/` — existing global skills
- `.agents/commands/`, `.claude/commands/`, `agent-commands/` in the repo — existing repo-specific commands

Do not recommend what is already there.

## What To Scan

Scan in this priority order. Earlier sources carry higher-confidence signals.

### 1. Explicit instructions

These name repeated tasks directly:

- `AGENTS.md`, `CLAUDE.md` — multi-step checklists, declared constraints, "before touching X do Y" sections
- `docs/CONTRIBUTING.md` or `CONTRIBUTING.md` — manual procedures described in prose
- `docs/WORKFLOWS.md` or equivalent — declared how-to sections
- PR templates, issue templates — recurring review or validation checklists
- Any `docs/` file with a "How to" or step-numbered section

### 2. Package and build scripts

- `package.json` scripts — look for compound or chained scripts, not simple single-command entries
- `Makefile`, `Taskfile`, `justfile` — each target is a named repeatable sequence
- Shell scripts in `bin/`, `scripts/`, `.github/`, `tools/` — read them; some are formalized commands already
- Note existing scripts as already-handled. Look for **gaps** (tasks described in docs but not scripted) not matches.

### 3. CI/CD pipelines

- GitHub Actions workflows, CircleCI config, GitLab CI, etc.
- What multi-step sequences do jobs describe that a developer would also need to run locally?
- What manual steps are referenced in CI comments but not automated?
- Are there pre-deploy, pre-merge, or pre-release checklists in pipeline files?

### 4. Git history patterns

Run `git log --oneline -100` and look for commit message clusters:

- Recurring verbs: "add [X]", "fix [X]", "update [X]", "scaffold [X]", "wire [X]"
- Commits that name the same file types together (e.g., every "add route" commit touches the same 4 files)
- Recurring bugfix patterns: "fix X when Y is missing", "always update Z after changing W"
- Recurring validation patterns: commits that follow a prior commit within a day to fix a missed step

### 5. Code structure signals

- Are there scaffolding patterns? (every feature module has the same 4–6 files)
- Are there "registry" files (enums, barrel files, route maps, config indices) that must be updated when adding new entities?
- Are there obvious boilerplate sequences for creating routes, modules, API endpoints, or components?
- Do multiple features share a nearly identical internal structure suggesting a template?

### 6. Debugging and validation sequences

- Multi-step validation sequences described in docs or referenced repeatedly in commit messages
- Recurring "check X before Y" patterns
- Patterns where a missed step causes silent failures (high-value skill territory)

## Candidate Classification Rules

For each observed pattern, assign one of five outcomes.

### SKILL candidate

Assign when **all** of the following are true:

- Requires reading multiple files and making judgment calls based on what is found
- Cannot be reduced to a fixed sequence — the outcome depends on repo state
- Involves coordination logic: "if X is present do A, otherwise do B"
- Failure to follow it causes real errors or broken behavior, not just inconvenience
- Recurs across multiple features, modules, or sessions — not a one-off

Skills are for **reasoning-heavy workflows**. The agent is making decisions, not just running steps.
Output: a structured `SKILL.md` file. Global or repo-specific.

### AGENT COMMAND candidate

Assign when **all** of the following are true:

- Agent-executed: the agent reads the command and acts, not the shell
- Lighter than a full skill: no structured decision rules, no multi-section SKILL.md needed
- A focused prompt is enough to guide the agent reliably through the task
- Repo-specific: references this repo's file layout, naming conventions, or domain patterns
- Recurs often enough to justify a `/command-name` shortcut

Agent commands are for **focused, repo-scoped prompts** the agent follows on demand.
Output: a markdown file in `.agents/commands/` or `.claude/commands/`. Always repo-specific.

### CLI SCRIPT candidate

Assign when **all** of the following are true:

- Shell-executed: runs in a terminal or CI pipeline, not by an agent
- Deterministic: same preconditions → same fixed sequence of shell commands
- No judgment required beyond "did this step succeed?"
- Would run identically on any machine with the correct environment
- Currently requires a developer to remember the sequence or order

CLI scripts are for **deterministic repeatable shell sequences**.
Output: a shell script in `bin/` or `scripts/`, or a new `package.json` script entry.

### REJECT — already handled

Assign when:

- A `package.json` script, CI job, Makefile target, or existing command already covers this
- A linter, formatter, type-checker, or pre-commit hook enforces it automatically
- An existing global skill in `~/agent-skills` already handles it

Do not recommend what tooling already enforces.

### REJECT — not worth formalizing

Assign when any of the following is true:

- Evidence in fewer than 3 distinct places (code paths, commits, or docs sections)
- One-off task scoped to a current migration, incident, or temporary state
- Too broad to be actionable: "improve code quality", "refactor everything"
- Too narrow to escape this specific situation: "fix this particular bug"
- Already generic framework or tool behavior (e.g., "run the dev server")
- The overhead of maintaining the skill/command exceeds the time it saves

## Output Destination

Each candidate maps to exactly one destination:

| Candidate type | Destination | Format |
|---|---|---|
| SKILL — global | `~/agent-skills/skills/<name>/SKILL.md` | Structured SKILL.md with frontmatter, decision rules, output contract |
| SKILL — repo-specific | `.agents/commands/<name>/SKILL.md` or `.claude/commands/<name>/` | Same SKILL.md format, but may reference repo-specific detail |
| AGENT COMMAND | `.agents/commands/<name>.md` or `.claude/commands/<name>.md` | Focused markdown prompt; no structured sections required |
| CLI SCRIPT | `bin/<name>.sh`, `scripts/<name>.sh`, or `package.json` scripts | Shell script or npm script entry |

**A SKILL is global when:**
- It can be written without hardcoding repo-specific paths, enums, or domain rules
- It applies to at least the same repo type (same framework family), often to multiple types
- An agent in a different repo of the same type would benefit from it unchanged

**An AGENT COMMAND is always repo-specific.** Agent commands reference repo layout, naming conventions, or domain patterns by design. Do not add them to the global skill pack.

**A CLI SCRIPT is always repo-specific.** Scripts belong in the repo they serve.

When unsure between SKILL and AGENT COMMAND: if the task needs structured decision rules and conditional logic, it is a skill. If a focused prompt is enough, it is an agent command.

When unsure on global vs repo-specific for a skill: prefer repo-specific. Do not inflate the global pack.

## Step-By-Step Instructions

1. Check the existing global skill inventory (`~/agent-skills/skills/`) and any repo-local commands. Record what already exists — you will exclude these from recommendations.

2. Scan the repo using the six source types above. Take notes per source; do not collapse into a summary yet.

3. For each observed pattern, write a one-line description: *what recurs, where, how often, and what happens when it is missed.*

4. Apply the five-outcome classification to each pattern. Be strict on rejections — most patterns should not become skills or commands.

5. For each SKILL, AGENT COMMAND, or CLI SCRIPT candidate, assign the correct output destination.

6. Score each candidate by value:
   - **High**: blocks agent work without it, recurs frequently (≥5 evidence points), failure causes real errors
   - **Medium**: saves meaningful time, recurs occasionally (3–4 evidence points), workaround exists
   - **Low**: marginal gain, rarely needed, easily discovered by reading the code once

7. Apply the anti-inflation cap: produce a maximum of 5 candidates. If nothing clears the rejection thresholds, output zero candidates. "No strong candidates" is a valid and useful result.

8. For the top 2–3 candidates, propose a skill or command name and one-sentence purpose statement.

9. Do not write any SKILL.md files, command files, or scripts until the user approves the candidate list.

## Output Contract

Produce this structure:

```
## Skill/Command Candidates

### [Candidate Name]
- Type: SKILL | AGENT COMMAND | CLI SCRIPT | REJECT
- Destination: [exact path or directory]
- Value: High | Medium | Low
- Evidence: [specific files, commits, or doc sections where this pattern appears]
- Rationale: [why this classification, not a restatement of the evidence]
- Proposed purpose: [one sentence — only for non-rejected candidates]

---
```

Follow with a summary section:

```
## Summary

Top recommendations (ranked by value):
1. …
2. …

Global skill proposals (~/agent-skills/skills/):
- …

Repo-specific skill proposals (.agents/commands/ or .claude/commands/):
- …

Agent command proposals (.agents/commands/ or .claude/commands/):
- …

CLI script proposals (bin/ or package.json):
- …

Rejected candidates:
- [Name] — [one-line reason]
```

If there are no candidates worth recommending, say so explicitly with the reason.

## Portability Notes

This skill is framework-agnostic. The six scan sources (explicit instructions, scripts, CI, git history, code structure, debugging sequences) apply to any repo type.

Do not assume:

- A `src/features/` layout
- A Next.js pages or app router structure
- Any specific test framework
- Any specific state management or validation library

When stack-specific signals are present — for example, a NestJS module topology with a DI registry, a Next.js `_app.tsx` with a guard sequence, or a TanStack Router route tree with loaders — use them to sharpen candidate evaluation. Do not require them.

Adapt the scan focus per repo type:

| Repo type | High-signal scan targets |
|---|---|
| Next.js | `_app.tsx` or root layout, `middleware.ts`, route guard pattern, API route structure |
| Vite SPA | Router setup, state management init, API utility, env var wiring |
| TanStack Router / Start | Route tree, loader pattern, `beforeLoad` hooks, search param usage |
| NestJS | `app.module.ts`, module topology, guard/interceptor chain, migration commands |
| Express / Fastify | Middleware chain order, route grouping, auth middleware placement |
| Monorepo | Workspace topology, cross-package dependency graph, root vs per-package tooling |

## Boundary With Existing Skills

| Skill | What it does | Hard boundary |
|---|---|---|
| `repo-docs-audit` | Decides what docs should exist | `repo-skill-scan` does not evaluate docs or produce doc verdicts |
| `rewrite-docs-from-code` | Writes or repairs project docs | `repo-skill-scan` does not create or modify any file |
| `repair-agent-files` | Aligns AGENTS.md / CLAUDE.md | `repo-skill-scan` does not touch instruction files |
| `review-doc-changes` | Reviews recent doc edits | `repo-skill-scan` does not review or validate changes |

`repo-skill-scan` reads docs and instruction files only as inputs for finding declared patterns. It does not audit, modify, or produce them.

## Cautions / Common Failure Modes

- Recommending skills for patterns already covered by CI/CD, linters, or existing commands
- Recommending global skills for patterns that are too repo-specific to port
- Inventing skill candidates for theoretical patterns not evidenced in code or history
- Treating every multi-step task as a skill — agent commands or CLI scripts are often the right answer
- Confusing agent commands with CLI scripts — one is executed by the agent, the other by the shell
- Adding agent commands to the global skill pack — they are always repo-specific
- Skipping the rejection step — not every pattern deserves formalization
- Exceeding 5 candidates by failing to force prioritization
- Proposing a skill that duplicates an existing skill in the global pack

## Example Usage

Use this skill when a user says:

- "What skills are missing from this repo?"
- "Scan the repo and tell me what should become a skill or command."
- "What repeated tasks should we formalize?"
- "Help me figure out what agent commands would be most useful here."
- "What workflows keep recurring in this codebase that we should automate?"
- "We just set up docs. Now what automation gaps exist?"
