# Agent Skills Pack

Canonical local-first skill pack for shared agent documentation workflows.

This directory is designed to work well in two modes:

1. Local-first use now as a single editable source of truth
2. Easy migration later into a dedicated team git repo

Recommended long-term home on your machine:

```text
~/agent-skills
```

Recommended structure at that location:

```text
~/agent-skills/
├── README.md
├── bin/
│   └── link-skills.sh
└── skills/
    ├── repo-docs-audit/
    ├── rewrite-docs-from-code/
    ├── repair-agent-files/
    ├── review-doc-changes/
    ├── repo-skill-scan/
    └── scaffold-repo-skill/
```

## Why This Layout

- One canonical source of truth
- No maintained duplicates across `.codex`, `.claude`, and `.agents`
- Easy local iteration
- Easy future extraction into a dedicated team repo
- Stable, tool-agnostic skill directory layout

## Recommended Linking Strategy

Keep the canonical skills here:

```text
~/agent-skills/skills/<skill-name>
```

Link each skill directory into:

```text
~/.codex/skills/<skill-name>
~/.claude/skills/<skill-name>
~/.agents/skills/<skill-name>
```

Prefer per-skill symlinks over symlinking the entire `skills/` directory. This is safer because:

- each tool may already have other local skills
- you do not replace the whole skills directory
- migration is incremental
- conflicts stay local to one skill name

## Install

After moving or cloning this directory to `~/agent-skills`, run:

```bash
~/agent-skills/bin/link-skills.sh
```

Or run it from any location and pass the canonical root:

```bash
/path/to/agent-skills/bin/link-skills.sh /path/to/agent-skills
```

The script also removes symlinks for deprecated skills from all three target directories.

## Included Skills

| Skill | Purpose |
|---|---|
| `repo-docs-audit` | Audit what docs should exist; produce verdicts before rewriting anything |
| `rewrite-docs-from-code` | Write or repair project docs grounded in current code |
| `repair-agent-files` | Create or align `AGENTS.md` and `CLAUDE.md` as a matched pair |
| `review-doc-changes` | Second-pass review of recent doc changes; verify against code |
| `repo-skill-scan` | Scan repo for repeated patterns; recommend skills, commands, or no action |
| `scaffold-repo-skill` | Write an approved skill, command, or script candidate into the correct files with proper structure and wiring |

## Tool-Specific File Semantics

The skills handle two agent instruction files that serve different tools:

- `AGENTS.md` — OpenAI Codex-native; the multi-tool convention used across Codex, Claude Code, and agents.sh-style workflows
- `CLAUDE.md` — Claude Code-specific; auto-loaded at session start by Claude Code

Default convention: `AGENTS.md` owns agent operating behavior; `CLAUDE.md` is a short pointer to it.

## Typical Usage Order

### New repo with no docs

1. `repo-docs-audit` — decide what should exist
2. `rewrite-docs-from-code` — write it
3. `repair-agent-files` — create `AGENTS.md` (and `CLAUDE.md` if needed)

### Existing repo with stale docs and an existing `AGENTS.md`

1. `repo-docs-audit` — audit and plan the target set
2. `repair-agent-files` — fix `AGENTS.md` and `CLAUDE.md`
3. `rewrite-docs-from-code` — repair or replace project docs

### Existing repo — only `AGENTS.md` or `CLAUDE.md` is the problem

1. `repair-agent-files` only

### Second-pass review after another agent changed docs

1. `review-doc-changes`
2. Targeted follow-up as needed:
   - `repair-agent-files`
   - `rewrite-docs-from-code`

### Discovering and creating repo-specific skills or commands

1. `repo-skill-scan` — scan for repeated patterns and get a ranked candidate list
2. `scaffold-repo-skill` — for each approved candidate, propose structure, wait for approval, write the files

## How To Add a New Skill

When adding a skill to this pack, complete all four steps:

1. Create `skills/<skill-name>/SKILL.md` with the standard frontmatter and structure.
2. Add `<skill-name>` to the `SKILL_NAMES` list in `bin/link-skills.sh`.
3. Update `README.md`:
   - Add the skill to the directory tree
   - Add a row to the Included Skills table
   - Add a usage scenario if the skill fits a new workflow not already covered
4. Run the link script to install symlinks:
   ```bash
   ~/agent-skills/bin/link-skills.sh
   ```

Do not consider the skill installed until step 4 is complete.

## Compatibility Notes

- This pack assumes the consuming tool can discover skills through normal filesystem directories and follow symlinked directories.
- If one tool does not follow symlinks correctly, keep this directory as canonical and copy only into that one tool as a fallback.
- If a skill with the same name already exists in one target location, remove or rename it before linking.
- If one environment uses a repo-local `.agents/skills` instead of `~/.agents/skills`, adapt the linking target accordingly.

## Migration To A Team Repo Later

This directory is already laid out like a small standalone repo.

Later you can:

1. Move it into a dedicated repository such as `team-agent-skills`
2. Clone that repo locally to `~/agent-skills`
3. Keep the same symlink strategy

That keeps the local install path stable while letting the contents become shared and versioned.
