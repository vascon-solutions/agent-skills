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
    ├── publish-branch/
    ├── prepare-frontend-handoff/
    ├── prepare-qa-handoff/
    ├── qa-triage-and-fix/
    ├── repo-docs-audit/
    ├── rewrite-docs-from-code/
    ├── repair-agent-files/
    ├── review-doc-changes/
    ├── review-task-docs/
    ├── repo-skill-scan/
    ├── roadmap-todo/
    ├── scaffold-repo-skill/
    ├── html-artifact/
    ├── markdown-artifact/
    ├── image-artifact/
    ├── repo-design-context/
    ├── publish-artifact/
    └── task-doc/
```

## Skills

| Skill                      | Purpose                                                                                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prepare-frontend-handoff` | Prepare implementation handoff notes for frontend developers, including API contracts, screen behavior, route state, form mapping, query/cache behavior, UI states, migration steps, and retired dependencies |
| `prepare-qa-handoff`       | Prepare QA sign-off notes for features with lifecycle flows, endpoint touchpoints, expected behavior, negative coverage, and release validation scope                                                         |
| `qa-triage-and-fix`        | Triage QA reports issue-by-issue, reproduce or contest findings with evidence, implement focused fixes, update authorized report fields, and record validation                                                |
| `publish-branch`           | Publish a branch or working tree safely by staging intentionally, handling push and PR flow, and avoiding accidental publication of unrelated work                                                            |
| `repo-docs-audit`          | Audit what docs should exist; produce verdicts before rewriting anything                                                                                                                                      |
| `rewrite-docs-from-code`   | Write or repair project docs grounded in current code                                                                                                                                                         |
| `repair-agent-files`       | Create or align `AGENTS.md` and `CLAUDE.md` as a matched pair                                                                                                                                                 |
| `review-doc-changes`       | Second-pass review of recent doc changes; verify against code                                                                                                                                                 |
| `review-task-docs`         | Independently review task docs for executability, scope control, and whether they should be split                                                                                                             |
| `repo-skill-scan`          | Scan a repo for repeated patterns; recommend skills, commands, or no action                                                                                                                                   |
| `roadmap-todo`             | Create and maintain durable roadmap or todo files for feature-grade work across repos                                                                                                                         |
| `scaffold-repo-skill`      | Write an approved skill, command, or script candidate with correct structure and wiring                                                                                                                       |
| `task-doc`                 | Create durable task documents for feature-grade work and reject small work that should stay in normal plan mode                                                                                               |
| `html-artifact`            | Convert any Markdown file into a self-contained, browser-ready HTML companion stored in `~/agent-artifacts/`. Supports task docs, roadmaps, QA handoffs, frontend handoffs, repo docs, and generic files |
| `markdown-artifact`        | Create polished Markdown artifact workspaces under `~/agent-artifacts/<slug>/` from ideas, notes, UI/backend designs, learning topics, tutorials, task plans, and other early-stage source docs |
| `image-artifact`           | Create static visual companions from existing Markdown, including summary cards, UI variant boards, comparison boards, decision boards, concept posters, architecture diagrams, and API flow images. Repo Markdown defaults to `~/agent-artifacts/<repo-name>-<source-stem>/images/` |
| `repo-design-context`      | Discover whether local repo styling, design tokens, brand assets, or architecture vocabulary can safely inform generated artifacts |
| `publish-artifact`         | Publish a `~/agent-artifacts/<slug>/` workspace to S3, GitHub Wikis, ClickUp Docs, native Google Docs, or raw Google Drive folders with explicit destination flags. Explicit command only |

## Link Targets

`bin/link-skills.sh` symlinks each skill directory into four tool-specific locations:

| Target directory          | Tool                           |
| ------------------------- | ------------------------------ |
| `~/.claude/skills/<name>` | Claude Code                    |
| `~/.codex/skills/<name>`  | OpenAI Codex                   |
| `~/.cursor/skills/<name>` | Cursor (primary)               |
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

### Feature-grade task planning across agents

1. `task-doc` — turn a roadmap item, issue, PRD, or feature brief into a durable execution artifact
2. Normal agent plan mode — use for small work that does not justify a maintained task doc

### Publishing code safely

1. `publish-branch` — inspect scope, commit intentionally, push safely, and open a draft PR when requested

### Preparing handoffs

1. `prepare-qa-handoff` — write QA/ClickUp sign-off notes without leaking implementation details
2. `prepare-frontend-handoff` — write implementation handoffs for frontend developers when API contracts or UI migration behavior changes

### Handling QA reports

1. `qa-triage-and-fix` — triage each QA issue, fix real bugs, contest unsupported findings with evidence, and update authorized report fields

### Reviewing and tracking feature work

1. `review-task-docs` — challenge a task doc before implementation starts
2. `roadmap-todo` — keep feature-grade backlog items concise, durable, and linked to task docs

### Generating HTML artifact companions

1. `html-artifact` — convert any `.md` file into a self-contained browser-ready HTML file stored in `~/agent-artifacts/`. Works standalone or as an opt-in step after `task-doc`, `roadmap-todo`, `prepare-qa-handoff`, or `prepare-frontend-handoff`.

### Generating image artifact companions

1. `image-artifact` — convert existing Markdown into static visual companions. Repo Markdown defaults to `~/agent-artifacts/<repo-name>-<source-stem>/images/`; explicit `--workspace ./artifacts/<source-stem>` or `--out ./artifacts/<source-stem>/images/<file>` keeps outputs in the repo when desired. Use it for shareable summaries, UI variant boards, comparison boards, decision boards, concept posters, architecture diagrams, and API flow images.

### Applying repo design context to artifacts

1. `repo-design-context` — shared helper for `html-artifact --use-repo-design` and `image-artifact --use-repo-design`. It discovers local design tokens or architecture vocabulary, applies only high-confidence results, and falls back to neutral output otherwise.

### Publishing artifact workspaces externally

1. `publish-artifact` — push a `~/agent-artifacts/<slug>/` workspace to one or more destinations with `--to s3`, `--to wiki`, `--to clickup`, `--to google-docs`, or `--to google-drive`. With no `--to`, it preserves the private S3 archive flow; `--share markdown` or `--share html` still creates an S3 presigned URL and optional secret gist. Bucket access is never modified.

### Creating Markdown artifact workspaces

1. `markdown-artifact` — turn rough ideas, notes, learning topics, UI/backend design options, feature proposals, tutorials, or operational task plans into polished Markdown under `~/agent-artifacts/<slug>/markdown/`.
2. Optional follow-up: `html-artifact` — render the Markdown into the same workspace's `html/` folder with an explicit `--out` path.
3. Optional follow-up: `image-artifact` — render the Markdown into the same workspace's `images/` folder when it clearly benefits from a visual summary, diagram, option board, or variant board.

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

Skills in this pack must remain framework-agnostic and contain no repo-specific paths, enums, or domain rules. Repo-specific skills belong in the project's `.cursor/skills/` directory for Cursor, or `.agents/skills/` as a compatibility fallback, not here.

To contribute a new skill or fix:

1. Fork or branch from `main`
2. Follow the "How To Add a Skill" checklist above
3. Open a pull request — include in the description: what gap the skill fills and why it belongs in the global pack rather than a repo

## Compatibility Notes

- The link script assumes the consuming tool discovers skills through filesystem directories and follows symlinked directories.
- **Cursor symlinks:** Cursor had a symlink-discovery bug for home-directory skills; it was fixed in Cursor 2.5 (February 2026). Symlinks into `~/.cursor/skills` work on 2.5+. If you are on an older version, copy the skill directory directly instead.
- **Cursor repo-local skills:** Use `.cursor/skills/` as the primary path. As of Cursor 2.5.26 (February 2026), `.agents/skills/` was not reliably discovered; Cursor staff confirmed `.agents/skills` support on March 11, 2026, but `.cursor/skills/` remains the safer default.
- If a tool does not follow symlinks, copy the skill directory directly into that tool as a fallback — do not edit the copy; keep `~/agent-skills` as the source of truth.
- If a skill with the same name already exists in a target location, remove or rename it before linking.
- If an environment uses a repo-local `.cursor/skills/` or `.agents/skills/` instead of the home-directory paths, adapt the linking target in `link-skills.sh` accordingly.
