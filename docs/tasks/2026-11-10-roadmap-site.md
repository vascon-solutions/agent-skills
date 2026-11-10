# Roadmap site skill

- Status: In delivery. Two spec-correctness reviews ran on 2026-11-10: the first returned `revise` (12 findings) and the second `revise` (1 major, 5 minor). All findings were applied, and the spec was amended where they affected it.
- Prepared: 2026-11-10.
- Classification: Feature-grade. A new self-contained skill that ships an app overlay with a database schema, write authorisation, a sync contract that edits a repo file, and a host adapter; plus boundary changes in two existing skills and the pack catalogue.
- Repository baseline: `517ebe5` (`main`) when the spec was read. Delivery branches from `da0a71d`, whose only extra commit changes `skills/docker-app-verify/references/lifecycle.md` and affects no claim here.
- Host baseline: ChatGPT Sites plugin 1.1.4, installed at `~/.codex/plugins/cache/openai-curated-remote/sites/<version>/` (the plugin root; below, `Sites <path>` means a path under it).

## Objective

Make a hosted roadmap site repeatable across projects. Every project gets the same page, from one fixed app and its own design tokens. Readers see the repo roadmap's groups and items. Editors change item status from the page. A three-way `sync` keeps the repo roadmap's status column and the page in agreement, so the page can no longer drift unnoticed the way the four existing hand-built sites did.

## Source Context

Source mode: accepted spec. The design was brainstormed on 2026-11-05 against four hand-built client roadmap sites, `roadmap-todo` and `variant-board`, and accepted on 2026-11-06. The owner made decisions 1–5 and accepted the recommended answers for 6–8. The owner asked for this task doc on 2026-11-10 and, the same day, authorised implementation ending in a ready (not draft) pull request, with no proprietary mentions in the task doc or the implementation.

## Design Reference

Source Spec: `docs/specs/2026-11-05-roadmap-site.md`, especially Decisions 1–8, Design (Ownership, Minimum source format, Sync, Page, Shell, tokens and configuration, Skill layout, Changes to existing skills), Scope exclusions and Validation. Do not reopen those decisions. On 2026-11-10 four spec lines were amended from review evidence, changing no decision:

- the platform service token is passed in for each session and never stored in a file;
- the stale-snapshot age is measured from the last push;
- the app reuses the host starter's sign-in helper;
- `verify` compares only the overlay-owned files, because comparing host files would need a runtime dependency on the Sites plugin path.

## Architecture Summary

`roadmap-site` owns the minimum roadmap format check, the app overlay, the token map, `build`, `sync pull`/`sync push`, `verify`, and the ChatGPT Sites adapter. `roadmap-todo` keeps owning `.agent/roadmap.md` and points to `roadmap-site` for a hosted, editable roadmap.

A project's site starts as the host's current Vinext starter, created by the host's setup script. `build` then applies the skill's overlay to that site directory. The overlay is exactly the file tree under `skills/roadmap-site/starter/`, copied path for path into the site directory; those paths, plus `roadmap-site.config.json` at the site root, are the overlay-owned set. Every other path in the site directory is host-owned and left untouched, except the `.openai/hosting.json` merge.

Repo structure and status reach the site as a snapshot pushed to a token-protected endpoint, and page status edits come back through the same endpoint. The app is therefore redeployed only when the overlay changes, and no roadmap snapshot data is written into the site directory.

The rules that decide correctness live in dependency-free ESM modules under `starter/lib/roadmap/`: parse, three-way merge, the server's clearing of pending edits, the stale-age rule, and write authorisation and read projection. The app imports them, and the CommonJS script and its `node:test` file load the same files with dynamic `import()`.

## Code Evidence

| Behavior | Source |
|---|---|
| `roadmap-todo` maintains the roadmap file only, respects the existing format, warns against changing status schemes unasked, and offers `html-artifact` as its only browser companion. | `skills/roadmap-todo/SKILL.md:50-57#Workflow`, `:66-68#Optional Companion`, `#Cautions` |
| `roadmap-todo`'s from-scratch template is a group heading and an `\| # \| Item \| Status \| Task doc \|` table. Its status model is `todo, in-progress, blocked, done, deferred, cancelled`, and it defers to a repo's existing vocabulary. | `skills/roadmap-todo/references/roadmap-template.md#Example`; `skills/roadmap-todo/references/status-model.md:3` |
| `html-artifact` lists `roadmap-todo` among the skills it follows as an opt-in step; README repeats it. | `skills/html-artifact/SKILL.md:17`; `README.md:315` |
| Fixed-shell precedent: the verifier compares the starter's chrome and runtime byte for byte and checks that `--app-*` equals the token map. The map's rows are `resolved / substituted / waived / unresolved`, and host conformance is recorded only after a real run. | `skills/variant-board/SKILL.md#2. Resolve the app's tokens`, `#4. Verify before anyone cites it`; `skills/variant-board/templates/tokens.md`; `skills/variant-board/references/hosts.md` |
| Script conventions: CommonJS with `usage`, subcommands, every failure reported, exit 0 or 1, and a `node:test` file beside the script, run directly rather than through `npm test`. | `skills/variant-board/scripts/verify-variant-board.js#usage`; `skills/variant-board/scripts/variant-board.test.js`; `package.json#scripts.test` runs only `tests/*.test.mjs` |
| Pack rules enforced by tests: every skill directory is listed once in `SKILL_NAMES`; relative Markdown links in a skill resolve; every reference file is reachable from its `SKILL.md`; frontmatter scalars containing `: ` or ` #` are quoted; draft specs and plans are not installed. | `bin/link-skills.sh:21#SKILL_NAMES`; `tests/skills-portability.test.mjs:159, 211, 224, 243, 293` |
| Global skills contain no repo-specific paths, enums or domain rules. | `README.md:381` at `517ebe5` |
| README catalogues skills in a directory tree, a Skills table and workflow scenarios. | `README.md:36-44`, `:86`, `:101-105`, `:309`, `:315-325` |
| Per-host interface metadata lives in `agents/openai.yaml`. | `skills/variant-board/agents/openai.yaml` |
| Sites setup: `scripts/project-setup.mjs` needs an empty destination and copies either the Vinext starter or a `--template-source`. Its own rule says retained sources replace the starter and templates are never layered. Source edits after setup are the normal workflow. | Sites `scripts/project-setup.mjs:18-22`; Sites `skills/sites/SKILL.md:21, 26-34`; Sites `skills/sites/templates/vinext-starter/README.md:14` |
| Sites build: the `sites()` build integration in `vite.config.ts` must be preserved; Worker builds omit `static`; the starter title, description and `codex-preview` metadata must be replaced. | Sites `skills/sites/SKILL.md:60, 94, 163` |
| Sites starter facts: it ships `app/chatgpt-auth.ts`. Its `displayName` falls back to the full email address. It requires Node `>=22.13.0`. `.openai/hosting.json` starts with `d1: null`, and the Site's `project_id` is written by `set-project-id.mjs`. | Sites `skills/sites/templates/vinext-starter/app/chatgpt-auth.ts:30-38`, `package.json#engines`, `.openai/hosting.json`; Sites `skills/sites/SKILL.md:36-39, 85-87` |
| Sites local preview: the portable profile simulates sign-in on loopback as one fixed mock user (`seedy@sites.test`) and supports local D1 migrations. Local `.env*` and `.dev.vars*` files are ignored by Git, and secret key names are documented only in `.env.example`. | Sites `skills/sites/templates/vinext-starter/README.md:20, 33, 108-116`; Sites `skills/sites/references/identity-and-secrets.md` (Secrets) |
| Sites starter layout: besides the host-owned files below, the starter ships replaceable app files (`app/page.tsx`, `app/layout.tsx`, `app/globals.css`), `db/schema.ts`, `db/index.ts`, `drizzle.config.ts`, an empty `drizzle/meta/_journal.json`, `components/`, `hooks/`, `lib/`, `examples/` and `public/`. | Sites `skills/sites/templates/vinext-starter/` |
| Sites identity: signed-in requests carry `oai-authenticated-user-id`, `-email` and an optional percent-encoded full name. Private Sites require sign-in, and public Sites can receive anonymous requests. Non-user callers of a private Site send `OAI-Sites-Authorization: Bearer <siwc_bypass_bearer_token>` from `get_site`. A write endpoint needs its own authorisation unless the Site is owner-private. | Sites `skills/sites/references/identity-and-secrets.md:7-9, 23-29` |
| Sites credentials: keep credentials in session memory and pass them through stdin, never as shell arguments, in files, or in output. A future task must be able to obtain access without the authoring session. | Sites `skills/sites/SKILL.md:14`; `references/identity-and-secrets.md:29` |
| Sites audiences: deployment distinguishes only "confirmed owner-private" from "other supported audiences"; no documented call shares a Site with one named account. | Sites `skills/sites/SKILL.md:125-128` |
| Sites storage: D1 is bound as `DB`; the Drizzle schema lives in `db/schema.ts`; migrations come from `npm run db:generate`, are committed and immutable, and are applied on deploy. Use one statement per `prepare()` and `batch()` for several. | Sites `skills/sites/references/storage.md` |
| Sites remix copies a published Site's bundled source but not its runtime settings or database. | Sites `skills/sites-remix/SKILL.md:8-11` |

## Current Behavior To Preserve

- `roadmap-todo` never implements, keeps entries concise, does not rewrite what it was not asked to change, and does not offer a companion after routine status updates. It gains only the minimum-format notes and a changed companion line, and it still never touches a site.
- `html-artifact`'s behaviour, layouts and verifier are unchanged, including the draggable kanban board. Only its follow-on list and the matching README sentence change.
- `variant-board` is unchanged. `roadmap-site` reuses the token-map format but does not import any variant-board file.
- Skills stay self-contained: no imports across skill folders, and no runtime dependency on the Sites plugin path. Host-specific steps live only in `references/hosts.md`.
- Host-owned files in a site directory are never overwritten. That is every path not in the overlay-owned set, including `vite.config.ts`, `worker/`, `scripts/`, `package.json`, the lockfile, `app/chatgpt-auth.ts`, `db/index.ts`, `drizzle.config.ts`, `components/`, `hooks/`, the host's own `lib/` files, `vendor/`, `.npmrc` and `.gitignore`. `.openai/hosting.json` is merged (`d1: "DB"`), never replaced, so its `project_id` survives.
- No proprietary mentions in the task doc or anything committed by this delivery: no client, customer or private organisation names, client project names or slugs, client hostnames, Site URLs, account emails or identifiers, or absolute local paths. Generic platform names the design needs (ChatGPT Sites, claude.ai, Cloudflare D1, Node) are allowed. Fixtures are synthetic. Do not copy content or the "verified on pilot <path>" style from existing sites or from `variant-board/references/hosts.md`.
- `sync` never commits, never rewrites anything in the roadmap file except status words, and never prints, logs, sends to the activity log, or stores a secret.
- The unrelated working-tree changes in the main checkout (README, implementation-map, review-implementation, task-doc-delivery-loop, the 2026-11-04 spec and two new reference files) are not part of this delivery. Deliver from an isolated worktree.

## Prerequisites

- Node 20+ for the skill scripts and their tests. Node 22.13+ and network access for the local build gate, which runs the host starter's setup and install.
- The Sites plugin installed (for its setup and build scripts, used locally).
- For the hosted pilot only: a Codex session with the Sites plugin, run by the owner or a Codex delivery session the owner starts. The Sites tools are not available in Claude Code. A second ChatGPT account is needed for the hosted reader and non-editor checks, but only if the platform can share a Site with it.

## Scope

- `skills/roadmap-site/`, laid out as the spec's Skill layout:
  - `SKILL.md`: the portable workflow (check, set up, build, sync, verify), naming no host tool.
  - `starter/`: the overlay. That is the page, item drawer and activity view; the API routes (read, editor writes with a version check, comments, sync); `db/schema.ts` and its first migration, generated with the host's `db:generate` and committed with its `drizzle/meta/` files (replacing the host's empty journal); the app layout with the starter metadata replaced; the stylesheet with a marked `--app-*` block; `lib/roadmap/*.mjs`, added beside the host's `lib/` files; and `.env.example` naming `ROADMAP_EDITOR_EMAILS` and `ROADMAP_SYNC_TOKEN` without values.
  - `templates/config.json` and `templates/tokens.md`.
  - `references/source-format.md`, `references/sync.md` and `references/hosts.md`.
  - `scripts/roadmap-site.js` (`check | build | verify | pull | push`) and its `node:test` file.
  - `fixtures/` (synthetic) and `agents/openai.yaml`.
- **`build <site-dir> --config <file> --tokens <file>`**:
  - It refuses a directory that is not a host Vinext starter, for example one with no `sites()` in `vite.config.ts`.
  - It copies every file under `starter/` to the same path in the site directory, writes the project config to `<site-dir>/roadmap-site.config.json`, and writes the `--app-*` block from the token map between the stylesheet markers.
  - It merges `d1: "DB"` into `.openai/hosting.json`.
  - It refuses when any token row is `unresolved` and names `substituted` and `waived` tokens in the page colophon.
  - It is idempotent: running it again on a built directory changes nothing.
- **`verify <site-dir>`** compares every file under `starter/` with the same path in the site directory, ignoring `roadmap-site.config.json` and the content between the stylesheet's token markers. It reports each changed or missing file and exits 1 on drift. Host-owned paths are not compared.
- Behaviour exactly as the spec defines:
  - the minimum source format and its failures;
  - the three-way pull rules, `--prefer repo|page <id>`, orphaned edits, and status-word-only writes;
  - the push guards (clean tree, passing check, the site's snapshot commit must be an ancestor of `HEAD`) and the server's clearing of pending edits;
  - the page order, fixed status labels and colours, and the warning 14 days after the last push;
  - flat comments;
  - the activity entries, with push entries naming the commit and git author;
  - no email or user id in any read response. A signed-in user with no full name is shown as the part of the email before `@`, never as the host helper's email fallback.
- **Authorisation:**
  - Signed-in visitors read and comment. Anonymous requests can neither comment nor write, which matters if a Site is ever made public.
  - Only emails in `ROADMAP_EDITOR_EMAILS` write status, note and link.
  - A comment can be deleted by its author or an editor, and by no one else.
  - The sync endpoint requires `ROADMAP_SYNC_TOKEN`, plus the platform service token when the Site is private.
- **Credentials:** the script reads `ROADMAP_SYNC_TOKEN` and the platform service token from stdin or the environment, never from arguments. `references/hosts.md` documents keeping `ROADMAP_SYNC_TOKEN` in the project's private credentials file, obtaining the service token for each session without writing it to a file, and how the two runtime values reach a local preview (the untracked local env file the starter supports, with the mock user's `seedy@sites.test` as the local editor fixture).
- **`roadmap-todo`:**
  - `references/roadmap-template.md` shows the optional `Outcome` column and the `Outcome:` line under a group heading.
  - `references/status-model.md` notes that a roadmap backing `roadmap-site` uses exactly the six words.
  - `SKILL.md`'s Optional Companion names `roadmap-site` for a hosted, editable roadmap.
  - A Workflow note says an existing roadmap is normalised to that format only with the owner's consent.
  - The format is restated briefly and `roadmap-site` is named by skill name, without a cross-skill file link.
- **`html-artifact`:** the follow-on line no longer lists `roadmap-todo`, and neither does `README.md:315`.
- **Catalogue:** README directory tree, Skills table row and a workflow scenario; the `SKILL_NAMES` entry; run `./bin/link-skills.sh`.
- **Hosted pilot** on a synthetic roadmap, with results recorded in `references/hosts.md`.

## Excluded

- Everything in the spec's Scope exclusions. That includes lanes, percentages, decision and scope views, target dates, assignees, threaded replies, multiple roadmap files, scheduled sync, dark mode, and importing state from the existing sites.
- Migrating, editing or retiring the four existing client sites.
- Adopting the skill on a real client project. Both the local gate and the pilot use only a synthetic roadmap.
- A claude.ai Artifact adapter or any second host.
- Distributing the app as a published Site for others to remix.
- Changes to `roadmap-todo`'s status vocabulary or to `variant-board`.

## Pre-Implementation Verification

- Confirm the Code Evidence rows still hold on the branch base and on the installed Sites plugin, and record the plugin version in `references/hosts.md`.
- Run the host setup into a scratch directory (portable profile), install, and confirm that the starter files the overlay replaces and those it must leave alone are as listed above, and which untracked local env file the preview reads. If the overlay cannot be applied cleanly, use the fallback: a complete retained template passed with `--template-source`, which then vendors its own sign-in helper. Record the reason in `references/hosts.md`.
- Confirm how a session outside the authoring Codex session obtains the platform service token for a private Site, and whether dispatch "consumes" it per request (so a pull followed by a push needs a fresh token each) or per session. If it cannot be obtained, record private-Site sync as `unverified`; do not persist the token or change the Site's audience to make sync work.
- Confirm whether a Site can be shared with one named second account. If not, the hosted non-editor check is recorded as not runnable, and the local gate's role checks stand as the evidence.

## Likely Files To Touch

- `skills/roadmap-site/**` (new)
- `skills/roadmap-todo/SKILL.md`, `skills/roadmap-todo/references/roadmap-template.md`, `skills/roadmap-todo/references/status-model.md`
- `skills/html-artifact/SKILL.md`
- `README.md` and `bin/link-skills.sh`

## Decisions Required Before Implementation

None. The spec settles the design. This task makes one boundary choice: overlay on the host's current starter, with the owned and host-owned files listed above and the retained-template fallback. The service-token path and second-account sharing are checked before the pilot.

## Execution Rules

- Follow the spec's layout, format rules and sync rules. Do not add features beyond them; anything that seems to be missing goes to Follow-ups.
- Follow the variant-board script conventions for `roadmap-site.js`. Shared rules live only in `starter/lib/roadmap/*.mjs`; the script and tests load those files, never copies.
- Keep the app source small. The spec records the existing sites at about 2,100–5,300 lines; this app has a fraction of their features and should be well under the smallest.
- Write no secret, token, email allowlist, Site identifier or Site URL into the skill, fixtures, output or the activity log. Before publishing, grep the diff, commit messages and PR body for proprietary mentions as defined above.
- Apply `test-audit` admission to new permanent tests. No rendered-copy or stylesheet tests; the local gate and the pilot cover rendering.

## Deliverables

- The new skill, linked and catalogued.
- The `roadmap-todo` and `html-artifact` boundary changes.
- Local gate and pilot results in `references/hosts.md`, with no client names, Site URLs or account identifiers. The host is marked supported only if every hosted item passed. Otherwise it is marked `unverified` and the failing or unrun item is named; a pilot that was never run is recorded as `unverified: not run`.
- A ready (not draft) pull request, as the owner instructed on 2026-11-10, describing the local gate, the pilot results and anything left open. If the hosted pilot is not run, the PR states that ChatGPT Sites is `unverified: not run` in `references/hosts.md`; that is a recorded limitation, not a reason to keep the PR in draft.

## Completion Verification

| Risk | Evidence | Owner | Command or scenario |
|---|---|---|---|
| Rows silently dropped or misparsed (the Site A failure) | Synthetic fixtures pass: headings at levels 2 and 3; ids `1.4`, `00-02`, `BE-03B` and `03-04A`; case-insensitive `ID` and `#` headers; optional `Outcome` and `Task doc` or `Link` columns mapped; the `Outcome:` line under a heading; extra columns; ignored summary tables. Each of these fails and names the row: duplicate id, malformed id, unknown status, free-text status, missing status column. | `skills/roadmap-site/scripts/roadmap-site.test.js` | `node --test skills/roadmap-site/scripts/roadmap-site.test.js` |
| Three-way merge applies the wrong side or overwrites silently | Every repo-changed × page-changed case. A same-value convergence. A conflict is reported and the file is left alone. Each `--prefer`. An orphaned edit. An edit made between pull and push is compared on the next pull. | same | same |
| Pull changes more than status words | Byte comparison of the rest of the fixture file after a pull, including trailing repo-note text | same | same |
| Push rolls the page back or publishes an unchecked or dirty state | Push is refused for a dirty tree, a failing check, and a site snapshot commit that is not an ancestor of `HEAD`, using a temporary git repo | same | same |
| Server clears the wrong pending edits | Clearing keeps non-matching edits with their original base, tested against `starter/lib/roadmap` | same | same |
| Unauthorised write, stale overwrite, or leaked identity | Anonymous and non-editor status, note and link writes are refused. An anonymous comment is refused. A comment deleted by someone who is neither its author nor an editor is refused; the author's and an editor's deletes succeed. A stale version returns 409. Sync refuses a missing or wrong token. Read payloads contain no email or user id, including for a user with no full name. | same, against the authorisation and projection module | same |
| Secrets leak through sync | Pull and push runs assert that neither token value appears in stdout, stderr, the activity payload, or any request field other than its header | same | same |
| Stale warning at the wrong time | The age rule, given an injected clock, warns after 14 days from the last push and not before | same | same |
| Build or verify misbehaves on a real copy | `build` is idempotent (a second run leaves every overlay-owned file and `.openai/hosting.json` byte-identical), leaves host-owned files untouched, and refuses an unresolved token row or a non-starter directory. `verify` passes a copy that differs only in config and token block, ignores a changed host-owned file, and reports a changed or missing overlay file. | same, on a minimal synthetic site directory | same |
| Skill not installed, links broken, frontmatter unquoted | Existing portability tests | `tests/skills-portability.test.mjs` | `npm test` |
| The app does not build or run | Local gate, required for completion. In a scratch directory: host setup and install, then `build`, then the host build passes. Local D1 migrations apply. Runtime values come from the untracked local env file. Preview with mock sign-in: the page renders from a pushed synthetic snapshot. The mock user, with the editor list excluding it, is refused an edit; with the list including it, edits status, note and link, and a stale save shows the conflict message. A comment is added and deleted. Pull applies a page edit to the scratch repo, a conflict is reported, push clears pending edits, and a stale push is refused. Filters, search and the URL filter state work. No page-level horizontal scroll at 390 px and 1280 px. No console errors. | Delivery owner, any session with Node 22.13+ | Results recorded in `references/hosts.md` |
| Works on the real host | Hosted pilot on a private Site built from the same synthetic roadmap. Covers real sign-in, a non-editor refused when a second account can be shared, the service-token reach for sync, deploy and migration apply, and one pull and push round trip. | Owner, in a Codex session with the Sites plugin | Results recorded in `references/hosts.md` |

## Approval Gates

- The hosted pilot is outward-facing: creating the pilot Site, setting its runtime secrets, and sharing it with a second account. The owner confirms the account and audience before the Site is created.
- No other gates. Accepted scope needs no further approval once implementation is authorised.

## Completion Criteria

Every Completion Verification row except the hosted pilot passes. The hosted pilot either passes or is recorded as `unverified` with its failing or unrun item named, leaving the host unsupported. `npm test` passes, the link script has run, and the ready PR describes the local gate and pilot results.

## Follow-ups

- Adopt the skill on a first real project, with a new Site and a first `sync push`.
- A claude.ai Artifact adapter: a single HTML file whose sign-in, roles and comment threads come from the platform.
- Retire the four hand-built client sites once their projects adopt the skill.
