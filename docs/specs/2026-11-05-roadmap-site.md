# Accepted: roadmap-site skill

Status: accepted on 6 November 2026, from a brainstorm read against agent-skills `517ebe5`. The owner made decisions 1–5 and accepted the recommended answers for 6–8 and the rest of the design. Accepting the spec does not authorise implementation; delivery starts from a task doc.

## Problem

Four hosted roadmap sites have been built for client projects, each by hand:

- **Site A**, the original: a parser over the repo roadmap, status editing, decision and scope views.
- **Site B**, adapted from A: a parser plus a hand-curated product snapshot, lane editing, a Markdown export.
- **Site C**, built independently from a design spec: hand-written item registry, lane editing, threaded comments.
- **Site D**, built ad hoc on 2026-11-04 with the host's generic site skill and no roadmap skill: read-only, with search, filters, milestones and item details.

All four are ChatGPT Sites (a Cloudflare Worker with a D1 database and "Sign in with ChatGPT"). Each looks different, each re-implemented sign-in, editor checks, stale-write protection, comments and activity, and none is reusable for the next project. `roadmap-todo` maintains the repo roadmap but only offers an `html-artifact` kanban board as a browser companion (`skills/roadmap-todo/SKILL.md:66-68`).

The goal is one neutral, uniform roadmap site, reused across projects the way `variant-board` reuses a fixed shell plus the target app's tokens: readable by product owners, PMs and developers, with item status editable from the page, and without becoming a project tracker.

## Current behaviour

| Observation | Evidence |
|---|---|
| Every site has drifted from its repo roadmap. A: 49 of 66 statuses differ and two new item ids (`03-04A` form) are silently dropped by the row regex. B: pinned to 23 items while the repo has 24, and its generator hard-codes 23, so a rebuild throws. C: seeded with 14 items all "planned" while the repo shows 12 items with real statuses, two of them absent from any repo roadmap. | Inventory of each site's data build, `data/roadmap.json` or content registry, against the current repo roadmap, 2026-11-05 |
| The split "repo owns structure, site owns status" is what drifted. Each repo roadmap kept its own status column, which agents kept updating as work shipped; no site read it (A uses only `blocked`, and only until first save; B copies it and never displays it; C has a repo-status mapper that only tests call). | Site model and build files; `roadmap-todo` workflow updates statuses in the repo file |
| No site writes back to the repo. A's spec promised a Markdown export that was never built; B has an editor-only Markdown download applied by hand; C's spec makes repo sync a non-goal. Nothing detects drift beyond a commit hash in a footer. | Site specs and API routes |
| Shared across all three editable sites: groups (milestones) of items; a status pill and outcome text per item; a group roll-up; an item drawer with a status editor, note, link and target; comments; an append-only activity log; a per-item version check that rejects stale saves with 409; "Sign in with ChatGPT" with an editor email allowlist; public names stripped of emails and user ids. | Site schemas, API routes and components |
| Two or three parallel status lanes per item (shared/API/UI or frontend/API) appear in all three editable sites and drive most of their rule code: derived item and group status, lane percentages, lane editors, an "acceptance needs both lanes" rule, a "shared follows API" sentinel. | Site models |
| Project-specific or heavy features: decision scoreboards with blocker attribution by substring match, story or scope coverage, a merged product snapshot from external documents, sub-workstreams hard-wired to one item, a link to a sibling review site, GitHub-only PR URLs, threaded replies with tombstones (about 1,000 lines in C), editor-only field visibility. | Site components and models |
| Specified but never built: weighted checklists, "unverified import" baselines, evidence verification states, a review queue, an owner directory, admin-only deferral. Two tables in B exist and are never used; roughly a third of B's CSS is A's unused styles. | Site specs against code |
| App source sizes: A about 5,300 lines (one 1,586-line component), B similar with a 30 KB stylesheet, C about 2,100 lines of which 1,575 are CSS. | Line counts |
| No site uses the target app's design tokens. Palettes and fonts were picked by eye, from a corporate brand site, or copied from a sibling site; one self-hosts two web fonts. | Site stylesheets against each app's `packages/ui` theme |
| Repo roadmap formats differ but share a shape: a heading per group followed by a table with an id, an item and a status column. Id columns are headed `#`, `ID` or `Phase`; ids look like `1.4`, `00-02`, `BE-03B`, `03-04A`; status cells are backticked words, except one repo that wrote free text ("implemented; acceptance complete, PR open"). Other tables (milestone summaries, decision registers, blocker indexes) carry no status column or a different header. | Four repo roadmaps |
| Status vocabularies: `todo, in-progress, blocked, done, deferred, cancelled` (`roadmap-todo`), plus `superseded` in one repo. Sites mapped these to their own six or five words. | `skills/roadmap-todo/references/status-model.md`; site models |
| `variant-board` keeps boards uniform with a fixed chrome token block and runtime that the verifier compares to the starter, an `--app-*` block produced from a token map with `resolved / substituted / waived / unresolved` rows, and host adapters whose conformance is recorded only after a real run. | `skills/variant-board/SKILL.md`, `references/hosts.md`, `templates/tokens.md` |
| ChatGPT Sites: private Sites require sign-in; signed-in requests carry `oai-authenticated-user-*` headers; sign-in establishes identity, not workspace membership; non-user callers of a private Site use a service bearer token from `get_site`; a shared write endpoint needs its own authorization unless the Site is owner-private; D1 migrations are append-only and applied on deploy. | ChatGPT Sites skill `references/identity-and-secrets.md`, `references/storage.md` (plugin 1.1.3) |
| Global skills in this pack must contain no repo-specific paths, enums or domain rules; a new skill is added to `SKILL_NAMES` in `bin/link-skills.sh`. | `README.md:381`; `bin/link-skills.sh:21` |

## Decisions

1. **Status home: three-way sync.** The repo roadmap's status column stays canonical. A page edit records the repo status it started from. A `sync` step compares repo, page and that base: a one-sided change is applied, and a change on both sides to different values is reported as a conflict for a person to resolve. Agents keep updating `.agent/roadmap.md` as they do today. (Owner, 2026-11-05.)
2. **Host: ChatGPT Sites first,** as one basic app reused for any roadmap. The data format, page shell and sync contract stay host-neutral so another adapter can be added later; it stays `unverified` until exercised. (Owner.)
3. **One status per item.** No lanes. Lane work is expressed as separate items or in the linked task doc. (Owner.)
4. **New skill, `roadmap-site`.** `roadmap-todo` keeps owning the roadmap file and adopts the same minimum format; its companion offer points to `roadmap-site` instead of the kanban board. (Owner.)
5. **Editors and comments.** Anyone the Site is shared with can read and comment; only emails in a `ROADMAP_EDITOR_EMAILS` runtime secret can change status, note and link. Comments are flat plain text per item; the author or an editor can delete one. (Owner.)
6. **No target date per item.** Timing belongs to groups in the repo roadmap; the site adds no schedule field. (Recommendation accepted by the owner, 2026-11-06.)
7. **Stale-snapshot warning.** The masthead always shows the snapshot's age and turns it into a warning once the snapshot is more than 14 days old. The threshold is fixed in the shell, not configured per project. (Recommendation accepted.)
8. **Sync authority is the token.** Holding `ROADMAP_SYNC_TOKEN` is enough to pull and push. Each push's activity entry records the commit and the git author name the script sends, for display only. (Recommendation accepted.)

## Design

### Ownership

| Data | Owner | Synced |
|---|---|---|
| Groups, item ids, item text, outcome, order, task-doc link | Repo roadmap | Pushed to the site by `sync push`; never edited on the page |
| Item status | Repo roadmap, editable on the page | Three-way, by `sync pull` and `sync push` |
| Note, link, comments, activity | Site | Not written to the repo |

### Minimum source format

The site reads one file, `.agent/roadmap.md` by default (configurable). `roadmap-site check` parses it with these rules and fails loudly instead of dropping rows.

- A **group** is the nearest preceding heading of level 2 or 3 above an item table. Heading text is the group title, shown verbatim.
- An optional line `Outcome: <one sentence>` directly under the group heading is the group's plain-language outcome.
- An **item table** is a Markdown table whose header has an id column (`ID` or `#`), an `Item` column and a `Status` column, matched case-insensitively. Optional columns, by header: `Outcome` (plain-language result, shown before the item text) and `Task doc` or `Link` (a repo path or URL). Any other columns are ignored. Tables without these headers are ignored, so milestone summaries, decision registers and blocker indexes need no change.
- An **id** has backticks stripped, matches `[A-Za-z0-9][A-Za-z0-9._-]*`, and is unique across the file. A duplicate or malformed id fails the check.
- A **status** cell starts with one of `todo`, `in-progress`, `blocked`, `done`, `deferred`, `cancelled`, optionally backticked. Text after the word is kept as a repo note; `sync` replaces only the word. Any other first word fails the check, naming the row; normalising it is a `roadmap-todo` edit made with the owner's consent. There is no per-project alias map.
- Item and outcome cells allow inline Markdown (code, links, emphasis); nothing else is rendered.

Example (generic):

```markdown
## Milestone 2: Usable catalog
Outcome: A merchant lists products and a shopper can browse them.

| ID | Item | Outcome | Status | Task doc |
|---|---|---|---|---|
| 2.1 | Product media upload and signed reads | Merchants attach product photos | `done` | `.agent/tasks/BE-02-media.md` |
| 2.2 | Catalog API: products, variants, prices | Products can be created and priced | `in-progress` — PR open | `.agent/tasks/BE-03-catalog.md` |
| 2.3 | Inventory and reservations | Stock prevents overselling | `todo` | — |
```

Lane roadmaps (`.agent/roadmaps/*.md`) and prose sections are not read. One roadmap file per site.

### Sync

`scripts/roadmap-site.js` runs from a repo checkout with the project's site config. It talks to the site through a sync endpoint protected by a `ROADMAP_SYNC_TOKEN` runtime secret, plus the platform's service token when the Site is private. The script takes both through stdin or the environment, never as arguments. `ROADMAP_SYNC_TOKEN` may be kept in the project's private credentials file. The platform service token is obtained for each session and never written to a file. Neither enters source, the snapshot or output. (Amended 2026-11-10: the Sites skill forbids keeping platform credentials in files.)

- **Site state.** The current snapshot (commit, generation time, groups, items with repo status); one state row per item that has a page edit (`status`, `base` = the snapshot's repo status when the first unsynced edit was made, note, link, version, editor, time); comments; activity.
- **Displayed status** is the page edit when one is pending, otherwise the snapshot's repo status. A pending item carries a "Changed on the page, not yet in the repo" marker; a conflicted item carries a conflict marker naming both values.
- **`sync pull`** reads pending edits and the repo file. Per item: page changed and repo equals base → write the page status into the file's status cell; repo changed and page equals the new repo status → nothing to do; both changed to different values → report a conflict and leave the file. An edit whose item no longer exists is reported as orphaned. Only status words change; every other byte of the file is preserved. The result is a diff for the owner to review and commit; `sync` never commits.
- **Conflicts** are resolved explicitly per item: `--prefer repo <id>` or `--prefer page <id>`. An agent running sync asks the owner rather than choosing.
- **`sync push`** requires a clean working tree at a commit that passes `check`, and refuses when the site's current snapshot commit is not an ancestor of `HEAD` (so an old branch cannot roll the page back). It uploads the snapshot; the server then clears every pending edit whose status equals the new repo status and keeps the rest pending with their original base, so an edit made between pull and push is compared correctly on the next pull.
- **Drift is visible.** The masthead shows the snapshot commit, date and age, warning after 14 days, and the number of pending page changes; activity records each push (with commit and git author name) and each pull.

Pushing the snapshot through the endpoint means a status change in the repo reaches the page without a redeploy; the app is redeployed only when the shell changes.

### Page

One app, one page, always light, in the same order on every project:

1. **Masthead.** Project name and one-line summary from config; facts: roadmap file, repo snapshot (`<short sha> · <date>`), pending page changes, last change on the page; sign-in state. The snapshot fact becomes a warning 14 days after the last push (decision 7).
2. **Status summary.** A count per status, and "N of M done" where cancelled and deferred items are not counted. No percentages and no weighting.
3. **Controls.** Status filter chips and a text search over id, item and outcome. Filter state lives in the URL.
4. **Groups,** in file order. Each shows its title, outcome line and counts; a group whose items are all done or cancelled starts collapsed. Each item row shows id, outcome (or item text when there is no outcome), status pill, pending or conflict marker, link and comment count.
5. **Item drawer.** Item text, outcome, repo status and page status when they differ, repo note, task-doc link, note, link, comments and the item's activity. Editors see the status, note and link form; a stale save shows a conflict message and reloads the item.
6. **Activity.** All status, note and link edits, comments and syncs, newest first, grouped by day, each linking to its item.

Statuses render with fixed labels and colours on every project: To do, In progress, Blocked, Done, Deferred, Cancelled. Readers never see editor emails or user ids; names come from the sign-in full name, falling back to the part of the email before `@`.

### Shell, tokens and configuration

- **Fixed per skill version:** the app source (pages, components, API routes, schema and migrations, sign-in helpers), the chrome token block and status colours. `roadmap-site verify` compares a deployed copy's overlay-owned files to the starter and lists any changed or missing one, ignoring the config file and the token block (amended 2026-11-10: host-owned files are not compared, which would need a runtime dependency on the host plugin).
- **Per project:**
  - `roadmap-site.config.json`: title, summary, repo path, roadmap path, optional repository URL and ref for task-doc links.
  - `tokens.md`: the same token-map format as `variant-board`, producing a small `--app-*` block (primary, primary foreground, background, foreground, muted, border, radius, font) used for the header band, primary buttons, focus ring, radius and body font. Status colours, spacing and type scale stay fixed so every roadmap reads the same. A web font that is not local or system is `substituted` with the system stack and named in the colophon; no web fonts are loaded.
  - `ROADMAP_EDITOR_EMAILS` and `ROADMAP_SYNC_TOKEN` as Site runtime secrets.
- Placement: `~/agent-artifacts/<project>/sites/<slug>/`, with the config and token map beside the app copy. Nothing from the site is committed to the product repo.

### Skill layout

```
roadmap-site/
├── SKILL.md                    portable workflow: check, set up, sync, verify
├── starter/                    the app files applied over the host's starter; the host's sign-in helper is reused
├── templates/config.json
├── templates/tokens.md
├── references/source-format.md the minimum format above, with failure messages
├── references/sync.md          three-way rules, conflicts, push guards
├── references/hosts.md         ChatGPT Sites adapter and conformance record
├── scripts/roadmap-site.js     check | build | verify | pull | push
└── fixtures/                   generic roadmaps (valid, each failure case) and a sync scenario set
```

`SKILL.md` and the references name no host tool; `references/hosts.md` holds the Sites-specific create, secret, build and deploy steps and any wrapper limits, as `variant-board` does.

### Changes to existing skills

- `roadmap-todo`: the template and status model match the minimum format (id, `Item`, `Status`, optional `Outcome` and `Task doc`; `Outcome:` line under a group heading); the companion offer names `roadmap-site` for a hosted, editable roadmap, still only when it helps and never after routine status updates. It continues not to touch any site.
- `html-artifact`: remove `roadmap-todo` from its "after … writes its output" list; the kanban board stays for other triage.
- `README.md` and `bin/link-skills.sh`: add the skill.
- Existing sites are not migrated. A project adopts the skill with a new Site and a first `sync push`; old site state is not imported.

## Scope exclusions

Lanes and derived status; per-item target dates; weighted or lane percentages; decision scoreboards; story or scope coverage; merged external product snapshots; per-item sub-workstreams; unverified-import baselines (the sync base replaces them); evidence verification states and editor-only fields; review queues; owners, assignees and dependencies; timelines and Gantt views; threaded replies, comment resolution and notifications; email allowlists in source; GitHub-only link validation; links to sibling sites; multiple roadmap files per site; automatic or scheduled sync; dark mode; importing state from the existing sites.

## Risks

- **Parse strictness.** Repos that write free-text statuses or other id headers fail `check` until normalised. This is deliberate, because silent dropping is how Site A lost items, but it puts a one-time cleanup in front of adoption.
- **Sync lag.** Repo changes reach the page only after a push. The 14-day warning makes a forgotten sync visible but does not prevent it; scheduled sync remains excluded.
- **Private-Site service access.** Whether the platform service token reaches a Site shared beyond its owner, and how long it lives, is not verified. If it does not, sync needs another supported access path; this blocks conformance, not the design.
- **Starter maintenance.** The fixed shell must be upgraded deliberately across deployed copies; `verify` shows which copies lag a skill version.

## Alternatives considered

- **Site owns status** (repo status column removed): no merge logic, but agents finishing work would need to write to the site instead of the file, and the repo loses status history. Rejected by the owner.
- **Repo owns status, read-only page** (Site D's model): simplest and never drifts, but people cannot update status from the page. Rejected by the owner.
- **claude.ai Artifact with a shared database:** a single HTML file with sign-in, roles and comment threads supplied by the platform, and edits Claude can read directly; editors need claude.ai access and Codex sessions cannot publish it. A candidate second adapter.
- **Extending `roadmap-todo`:** one skill to find, but it would mix an app, deploy and sync into a skill whose contract is "keep entries concise, do not implement". Rejected by the owner.
- **Optional declared lanes:** fits multi-repo delivery but brings back the derived-status and lane-editor code that dominates the existing sites. Rejected by the owner.

## Validation

- `check` passes the generic fixtures shaped like each surveyed format (headings at level 2 and 3, ids such as `1.4`, `00-02`, `BE-03B`, `03-04A`, extra columns, ignored summary tables) and fails with a named row on duplicate ids, unknown status words, a free-text status and a missing status column.
- Sync scenarios cover every cell of repo-changed × page-changed, a same-value convergence, a conflict and each `--prefer`, an orphaned edit, an edit made between pull and push, a dirty tree, and a push from a non-descendant commit; a pull changes only status words (byte comparison of the rest of the file).
- API checks: anonymous and non-editor writes are refused, a stale save returns 409, the sync endpoint refuses a missing or wrong token, and no read response contains an email or user id.
- Conformance on a real ChatGPT Site, recorded in `references/hosts.md` before the host is called supported: sign-in, an editor edit, a non-editor refused, a comment added and deleted, pull applying an edit, a conflict reported, push clearing pending edits, a stale push refused, filters and search, and no page-level horizontal scroll at 390 px and 1280 px.
- Permanent tests follow `test-audit` admission: the durable risks are the source-format contract, the three-way rules with byte-preserving writes, and write authorisation. Rendered-copy and stylesheet checks are not admitted as permanent tests.

