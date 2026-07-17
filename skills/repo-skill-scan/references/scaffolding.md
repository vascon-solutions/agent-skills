# Scaffolding Approved Candidates

Reference for the scaffolding phase of `repo-skill-scan`. Use only after the user approves a candidate. Discovery writes nothing; this phase writes the approved files.

## Verification Gate

For every candidate, before writing any file:

1. Present the proposed structure (format per type below).
2. Wait for explicit approval of that structure.
3. Only then write the files.

Do not create or modify any file until the user confirms the proposed structure.

## SKILL vs AGENT COMMAND vs CLI SCRIPT

Use **SKILL** format when the candidate needs structured decision rules with conditional logic, multiple coordinated files, an approval/compliance gate, or reasoning at each step.

Use **AGENT COMMAND** format when a focused prompt is enough, no branching is needed, and the task is one clear operation. Always repo-specific.

Use **CLI SCRIPT** when the sequence is shell-executed and deterministic (same preconditions → same steps). Always repo-specific.

## What belongs in SKILL.md vs references/

Keep SKILL.md lean — target 60–120 lines of prose. Extract to `references/` when content is a checklist over ~5 items, a file map or lookup table, a module/pattern catalogue, non-inline code examples, or long regression/verification steps.

Always in SKILL.md, never in references/: Purpose, Approval Gates, Decision Rules, Workflow steps, Validation, Output, Done Report.

### SKILL.md required section order

1. Frontmatter — `name`, `description`
2. `## Purpose` — one short paragraph: what it does and does not do
3. `## Approval Gates` — explicit stop-and-ask points; omit if none apply
4. `## Decision Rules` — if/then logic and classification
5. `## Workflow` — numbered steps; point to `references/` for detail
6. `## Validation` — commands to run before declaring done
7. `## Output` — what the agent must produce
8. `## Done Report` — standard handoff block

### Agent command required structure

- Frontmatter — `name`, `description`
- One-line invocation reminder (e.g. `> Invoke: type /name in Claude Code`)
- Phase structure if multi-step: Plan → Implement → Validate
- Done Report block
- No `## Decision Rules` section; embed branching in the phase prose

## Steps per type

### SKILL candidate

1. Read the target repo's existing `.agents/skills/` (or `~/agent-skills/skills/` for a global candidate) to match conventions — section names, references structure, link-script format, README table layout.
2. Present the proposed structure and wait for approval:
   ```
   Proposed: <.agents/skills|~/agent-skills/skills>/<name>/
   ├── SKILL.md
   │   ├── Purpose — [one line]
   │   ├── Approval Gates — [list stops, or "none"]
   │   ├── Decision Rules — [key rules]
   │   ├── Workflow — [n steps; references external file for X]
   │   ├── Validation — [commands]
   │   └── Output — [what agent produces]
   └── references/
       └── <file>.md — [what it will contain]
   ```
3. Write `SKILL.md` in the required section order.
4. Write `references/` files, one content type each — do not mix checklists with file maps.
5. Add `<name>` to the link script's skill list (`.agents/bin/link-agents.sh` for a repo, `bin/link-skills.sh` for the global pack).
6. Add a row to the relevant README skills table.
7. Run the link script from the repo root and confirm symlinks were created.

### AGENT COMMAND candidate

1. Read the repo's existing `.agents/commands/` to match the format.
2. Present the proposed structure and wait for approval:
   ```
   Proposed: .agents/commands/<name>.md
   - Phase 1 Plan: [what the agent states before acting]
   - Phase 2 Implement: [what it does]
   - Phase 3 Validate: [how it confirms done]
   ```
3. Write `.agents/commands/<name>.md`.
4. Add `<name>.md` to `COMMAND_NAMES` in the link script.
5. Add a row to the repo README commands table.
6. Run the link script and confirm symlinks.

### CLI SCRIPT candidate

1. Present the proposed structure and wait for approval:
   ```
   Proposed: bin/<name>.sh (or package.json script entry)
   - Purpose: [one line]
   - Inputs/args: [none | list]
   - Steps: [numbered sequence]
   ```
2. Write the script to `bin/` or `scripts/`.
3. Make it executable: `chmod +x bin/<name>.sh`.
4. If a short alias is useful, add a `package.json` scripts entry.

## Global vs repo-specific destination

A candidate is **global** (`~/agent-skills/skills/`) only when it can be written without hardcoding repo-specific paths, enums, or domain rules and applies across repos of the same type. For global additions, follow the "How to add a new skill" section in `~/agent-skills/README.md`. Agent commands and CLI scripts are always repo-specific — never add them to the global pack. When unsure on global vs repo-specific, prefer repo-specific.

## Cautions

- Writing files before presenting and getting structure approval.
- Putting checklist or reference content directly in SKILL.md instead of `references/`.
- Writing a SKILL.md over ~200 lines — it will not be read fully; extract more.
- Forgetting to update, or to re-run, the link script after adding a skill/command — symlinks go stale.
- Creating a repo-local skill for a global candidate, or adding a repo-specific command to the global pack.
