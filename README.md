# Agent Skills Pack

Portable, reusable agent skills for coding-agent workflows.

Skills in this pack are framework-agnostic and repo-agnostic. They are designed to work across Next.js, Vite, NestJS, Express, TanStack, and monorepo projects.

```text
~/agent-skills/
├── README.md
├── .gitignore
├── bin/
│   ├── install.sh        ← first-time install + link
│   └── link-skills.sh    ← re-link after updates
└── skills/
    ├── repo-docs-audit/
    ├── rewrite-docs-from-code/
    ├── repair-agent-files/
    ├── review-doc-changes/
    ├── repo-skill-scan/
    └── scaffold-repo-skill/
```

## Skills

| Skill | Purpose |
|---|---|
| `repo-docs-audit` | Audit what docs should exist; produce verdicts before rewriting anything |
| `rewrite-docs-from-code` | Write or repair project docs grounded in current code |
| `repair-agent-files` | Create or align `AGENTS.md` and `CLAUDE.md` as a matched pair |
| `review-doc-changes` | Second-pass review of recent doc changes; verify against code |
| `repo-skill-scan` | Scan a repo for repeated patterns; recommend skills, commands, or no action |
| `scaffold-repo-skill` | Write an approved skill, command, or script candidate with correct structure and wiring |

## Link Targets

`bin/link-skills.sh` symlinks each skill directory into three tool-specific locations:

| Target directory | Tool |
|---|---|
| `~/.claude/skills/<name>` | Claude Code |
| `~/.codex/skills/<name>` | OpenAI Codex |
| `~/.agents/skills/<name>` | agents.sh and compatible tools |

Per-skill symlinks are used (not the whole `skills/` directory) so each tool's existing skills are not disturbed.

## Install

### Option 1 — curl one-liner

```bash
curl -fsSL https://raw.githubusercontent.com/vascon-solutions/agent-skills/main/bin/install.sh | bash
```

Clones to `~/agent-skills` and links all skills in one step.

### Option 2 — manual clone

```bash
git clone git@github.com:vascon-solutions/agent-skills.git ~/agent-skills
~/agent-skills/bin/link-skills.sh
```

### Option 3 — degit (no git history)

```bash
npx degit vascon-solutions/agent-skills ~/agent-skills
~/agent-skills/bin/link-skills.sh
```

Use this if you want a clean local copy without git history. Note: you cannot `git pull` to update — re-run degit to refresh.

## Update

```bash
cd ~/agent-skills && git pull && bin/link-skills.sh
```

The link script is idempotent — it skips symlinks that already point to the correct source and only adds new ones.

## Typical Usage

### New repo with no docs

1. `repo-docs-audit` — decide what should exist
2. `rewrite-docs-from-code` — write it
3. `repair-agent-files` — create `AGENTS.md` (and `CLAUDE.md` if needed)

### Existing repo with stale docs

1. `repo-docs-audit` — audit and plan the target set
2. `repair-agent-files` — fix `AGENTS.md` and `CLAUDE.md`
3. `rewrite-docs-from-code` — repair or replace project docs

### Only `AGENTS.md` or `CLAUDE.md` needs fixing

1. `repair-agent-files` only

### Second-pass review after another agent changed docs

1. `review-doc-changes`
2. Targeted follow-up as needed: `repair-agent-files`, `rewrite-docs-from-code`

### Discovering and creating repo-specific skills or commands

1. `repo-skill-scan` — scan for repeated patterns; get a ranked candidate list
2. `scaffold-repo-skill` — for each approved candidate: propose structure → wait for approval → write files

## How To Add a Skill

When adding a skill to this pack, complete all four steps:

1. Create `skills/<skill-name>/SKILL.md` with the standard frontmatter and structure.
2. Add `<skill-name>` to `SKILL_NAMES` in `bin/link-skills.sh`.
3. Update `README.md`:
   - Add the skill to the directory tree
   - Add a row to the Skills table
   - Add a usage scenario if it fits a workflow not already covered
4. Run the link script:
   ```bash
   ~/agent-skills/bin/link-skills.sh
   ```

Do not consider the skill installed until step 4 is complete.

## Contributing

Skills in this pack must remain framework-agnostic and contain no repo-specific paths, enums, or domain rules. Repo-specific skills belong in the project's `.agents/skills/` directory, not here.

To contribute a new skill or fix:

1. Fork or branch from `main`
2. Follow the "How To Add a Skill" checklist above
3. Open a pull request — include in the description: what gap the skill fills and why it belongs in the global pack rather than a repo

## Compatibility Notes

- The link script assumes the consuming tool discovers skills through filesystem directories and follows symlinked directories.
- If a tool does not follow symlinks, copy the skill directory directly into that tool as a fallback — do not edit the copy; keep `~/agent-skills` as the source of truth.
- If a skill with the same name already exists in a target location, remove or rename it before linking.
- If an environment uses a repo-local `.agents/skills/` instead of `~/.agents/skills/`, adapt the linking target in `link-skills.sh` accordingly.
