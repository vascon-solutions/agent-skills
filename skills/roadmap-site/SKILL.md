---
name: roadmap-site
description: "Use to set up, sync or verify a hosted, editable roadmap page for a repo's roadmap file: one fixed app in the project's own design tokens, where readers see groups and items, editors change item status, note and link, and a three-way sync keeps the repo roadmap's status column and the page in agreement. Not for maintaining the roadmap file itself (roadmap-todo) or a one-off browser board (html-artifact)."
---

# roadmap-site

One roadmap page per project, the same on every project: groups and items from the repo roadmap, item status editable on the page by named editors, flat comments, an activity log, and a masthead that shows how old the repo snapshot is. The repo roadmap stays canonical for structure and status; the page holds notes, links, comments and activity. A three-way `sync` moves status in both directions without either side overwriting the other silently.

This file and [references/source-format.md](references/source-format.md) and [references/sync.md](references/sync.md) are portable: they name no host tool. [references/hosts.md](references/hosts.md) holds the per-host create, secret, build, preview and deploy steps and the conformance record. A host is supported only once its record says so.

## Files

```
roadmap-site/
├── SKILL.md                    portable workflow (this file)
├── starter/                    the app overlay, copied path for path over the host's starter
├── templates/config.json       per-project site config
├── templates/tokens.md         the token map that produces the --app-* block
├── references/source-format.md the minimum roadmap format and its failure messages
├── references/sync.md          three-way rules, conflicts, push guards, credentials
├── references/hosts.md         host adapters and conformance records
├── scripts/roadmap-site.js     check | build | verify | pull | push
└── fixtures/                   synthetic roadmaps (valid and each failure), a sync scenario set, build inputs
```

Placement: `~/agent-artifacts/<project>/sites/<slug>/`, holding `roadmap-site.config.json`, `tokens.md` and the app copy in `site/`. Nothing from the site is committed to the product repo.

## 1. Check the roadmap

```bash
node scripts/roadmap-site.js check ~/Code/<org>/<repo>/.agent/roadmap.md
```

`check` applies the minimum format in [references/source-format.md](references/source-format.md) and fails loudly, naming each row, instead of dropping it. A roadmap that fails needs normalising before anything else; that is a `roadmap-todo` edit made with the owner's consent. There is no alias map: statuses are exactly `todo`, `in-progress`, `blocked`, `done`, `deferred`, `cancelled`.

## 2. Set up a site

1. Create the host's current starter in `<slug>/site/` with the host's own setup step (see [references/hosts.md](references/hosts.md)). Never copy another project's site.
2. Copy [templates/config.json](templates/config.json) to `<slug>/roadmap-site.config.json`: title, one-line summary, repo path, roadmap path, optional repository URL and ref for task-doc links, and the site URL once it exists.
3. Copy [templates/tokens.md](templates/tokens.md) to `<slug>/tokens.md` and resolve the eight `--app-*` rows from the product's theme source at a recorded revision, the same way a `variant-board` token map is resolved: literal values, aliases followed, the font stack verbatim. A web font that is not local or system is `substituted` with the system stack; no web fonts are loaded. Status colours, spacing and the type scale are fixed and never mapped.
4. Build:

   ```bash
   node scripts/roadmap-site.js build <slug>/site --config <slug>/roadmap-site.config.json --tokens <slug>/tokens.md
   ```

   `build` refuses a directory that is not the host's starter and refuses while any token row is `unresolved`. It copies every file under `starter/` to the same path, writes the config (without the repo path or site URL) to `site/roadmap-site.config.json`, writes the token block between the stylesheet markers, names `substituted` and `waived` tokens in the page colophon, and binds the database in the host manifest without touching its other fields. Running it again changes nothing. Every path outside the overlay is host-owned and left alone.
5. Install, build, apply the shipped migration, set the two runtime values and deploy with the host's steps in [references/hosts.md](references/hosts.md). The runtime values are `ROADMAP_EDITOR_EMAILS` (the editor allowlist) and `ROADMAP_SYNC_TOKEN`; their names are listed in the overlay's `.env.example` and their values never enter source.
6. Run the first `push` (below) so the page has a snapshot.

## 3. Who can do what

- Anyone the site is shared with and signed in reads and comments. Anonymous requests can neither comment nor write.
- Only emails in `ROADMAP_EDITOR_EMAILS` change status, note and link. A stale save is refused and the item reloads.
- A comment can be deleted by its author or an editor.
- Readers never see an email or user id; names come from the sign-in full name, else the part of the email before `@`.
- The sync endpoint needs `ROADMAP_SYNC_TOKEN`, plus the host's service token when the site is private.

## 4. Sync

Run from anywhere with the config; the script finds the repo from it. Tokens come from the environment or stdin, never from arguments (see [references/sync.md](references/sync.md#credentials)).

```bash
node scripts/roadmap-site.js pull --config <slug>/roadmap-site.config.json [--prefer repo|page <id>]...
node scripts/roadmap-site.js push --config <slug>/roadmap-site.config.json
```

- `pull` brings page edits into the roadmap file: a one-sided page change is written as the status word only, a repo-side change wins, and a change on both sides to different values is a conflict that leaves the whole file unchanged. Resolve each conflict with `--prefer repo <id>` or `--prefer page <id>`. When an agent runs sync, it asks the owner which side to prefer rather than choosing. `pull` never commits; the owner reviews the diff and commits.
- `push` uploads the committed roadmap as the site snapshot. It needs a clean working tree, a roadmap that passes `check`, and a site snapshot commit that is an ancestor of `HEAD`. The site then clears every pending edit that now matches the repo and keeps the rest with their original base.

The masthead warns once the snapshot is more than 14 days old. Rules, outcomes and messages are in [references/sync.md](references/sync.md).

## 5. Verify a deployed copy

```bash
node scripts/roadmap-site.js verify <slug>/site
```

`verify` compares every overlay-owned file with this skill's `starter/`, ignoring the config file and the token block, and lists each changed or missing file. Host-owned files are not compared. Upgrade a lagging copy by running `build` again from the current skill version, then the host build and deploy; append a new migration for any schema change, never edit an applied one.

## Boundaries

- `roadmap-todo` owns `.agent/roadmap.md` and its format. This skill reads it, and `pull` changes status words only.
- `html-artifact` keeps one-off browser companions, including its kanban board for other triage.
- `variant-board` is unrelated except that this skill reuses its token-map format; no file is shared.
- Not in scope: lanes or derived status, percentages, target dates, assignees, threaded replies, multiple roadmap files per site, scheduled sync, dark mode, and importing state from earlier hand-built sites. A project adopts the skill with a new site and a first `push`.
