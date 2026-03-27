---
name: scaffold-repo-skill
description: Scaffold a new repo-specific skill, agent command, or CLI script from an approved candidate. Presents the proposed structure for user approval before writing any file. Use after repo-skill-scan produces an approved candidate.
---

# Scaffold Repo Skill

## Purpose

Turn an approved skill, agent command, or CLI script candidate into the correct set of files.

This is the implementation step that follows `repo-skill-scan` approval. It enforces a structure-approval gate before writing, applies the correct format per candidate type, and wires the new file into the repo's link script and README.

## When To Use

Use when:

- `repo-skill-scan` has produced an approved candidate and the user says to proceed
- the user explicitly names a candidate and asks for it to be created
- a new repo-specific skill, command, or script needs to be created from scratch

## When Not To Use

Do not use when:

- no candidate has been approved yet — run `repo-skill-scan` first
- the task is to add a skill to the global pack at `~/agent-skills`
  Follow the "How to add a new skill" section in `~/agent-skills/README.md` instead
- the task is to write project docs — use `rewrite-docs-from-code`
- the task is to create or repair `AGENTS.md` / `CLAUDE.md` — use `repair-agent-files`

## Verification Gate

For every candidate, before writing any file:

1. Present the proposed structure to the user (see format per type below).
2. Wait for explicit approval.
3. Only then write the files.

Do not create or modify any file until the user confirms the proposed structure.

## Decision Rules

### SKILL vs AGENT COMMAND

Use SKILL format when the candidate requires:
- structured decision rules with conditional logic
- multiple coordinated files or cross-cutting touchpoints
- an approval gate or compliance check
- reasoning at each step, not just execution

Use AGENT COMMAND format when:
- a focused prompt is enough to guide the agent reliably
- no decision rules or conditional branching are needed
- the task is scoped to one clear operation

### What belongs in SKILL.md vs references/

Keep SKILL.md lean — target 60–120 lines of prose. Extract to `references/` when content is:
- a checklist with more than ~5 items
- a file map or lookup table
- a module/pattern catalogue
- code examples that the skill points to but does not execute inline
- regression or verification steps that are longer than a short list

Always in SKILL.md, never in references/:
- Purpose, Approval Gates, Decision Rules, Workflow steps, Validation, Output, Done Report

### SKILL.md required section order

1. Frontmatter — `name`, `description`
2. `## Purpose` — one short paragraph, what the skill does and what it does not
3. `## Approval Gates` — explicit stop-and-ask points; omit section if none apply
4. `## Decision Rules` — if/then logic and classification rules
5. `## Workflow` — numbered steps; point to `references/` files for detail
6. `## Validation` — commands to run before declaring done
7. `## Output` — what the agent must produce
8. `## Done Report` — standard handoff block

### Agent command required structure

- Frontmatter — `name`, `description`
- One-line invocation reminder (e.g. `> Invoke: type /name in Claude Code`)
- Phase structure if multi-step: Plan → Implement → Validate
- Done Report block
- No `## Decision Rules` section required; embed any branching in the phase prose

## Step-By-Step Instructions

### For a SKILL candidate

1. Read the repo's existing `.agents/skills/` directory to understand conventions already in use — section names, references structure, link script format, README table layout.

2. Present the proposed structure and wait for approval:
   ```
   Proposed: .agents/skills/<name>/
   ├── SKILL.md
   │   ├── Purpose — [one line on what it will say]
   │   ├── Approval Gates — [list stops, or "none"]
   │   ├── Decision Rules — [key rules to encode]
   │   ├── Workflow — [n steps; references external file for X]
   │   ├── Validation — [commands]
   │   └── Output — [what agent produces]
   └── references/
       └── <file>.md — [what it will contain]
   ```
   Do not write any file until the user confirms this structure.

3. Write `.agents/skills/<name>/SKILL.md` following the required section order.

4. Write `references/` files. Keep each reference file focused on one type of content — do not mix checklists with file maps.

5. Add `<name>` to `SKILL_NAMES` in the repo's link script (`.agents/bin/link-agents.sh` or equivalent).

6. Add a row to `.agents/skills/README.md` in the Skills table.

7. Run the link script from the repo root:
   ```bash
   .agents/bin/link-agents.sh
   ```

8. Confirm symlinks were created in `.claude/skills/` and `.codex/skills/`.

### For an AGENT COMMAND candidate

1. Read the repo's existing `.agents/commands/` to understand the format in use.

2. Present the proposed structure and wait for approval:
   ```
   Proposed: .agents/commands/<name>.md
   - Phase 1 Plan: [what the agent will state before acting]
   - Phase 2 Implement: [what it will do]
   - Phase 3 Validate: [how it confirms done]
   ```
   Do not write any file until the user confirms.

3. Write `.agents/commands/<name>.md`.

4. Add `<name>.md` to `COMMAND_NAMES` in the link script.

5. Add a row to `.agents/skills/README.md` in the Commands table.

6. Run the link script and confirm symlinks in `.claude/commands/` and `.codex/commands/`.

### For a CLI SCRIPT candidate

1. Present the proposed structure and wait for approval:
   ```
   Proposed: bin/<name>.sh (or package.json script entry)
   - Purpose: [one line]
   - Inputs/args: [none | list]
   - Steps: [numbered sequence]
   ```
   Do not write any file until the user confirms.

2. Write the script to `bin/` or `scripts/`.

3. Make it executable: `chmod +x bin/<name>.sh`.

4. If a short alias is useful, add an entry to `package.json` scripts.

## Cautions / Common Failure Modes

- Writing files without presenting the structure first — always gate on approval
- Putting checklist or reference content directly in SKILL.md — extract to `references/`
- Writing a SKILL.md over 200 lines — it will not be read fully; extract more to references
- Forgetting to update the link script after adding a skill or command
- Forgetting to run the link script after updating it — symlinks will be stale
- Creating a skill for a global candidate — global skills belong in `~/agent-skills`, not in the repo

## Example Usage

Use this skill when a user says:

- "Go ahead and create the skill for [candidate name]."
- "Implement the top candidates from the scan."
- "Write the SKILL.md for [approved candidate]."
- "Create the agent command for [candidate]."
- "Scaffold the skill — use the structure we discussed."
