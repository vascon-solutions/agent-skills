# Host adapters

The placement rule: the source format, sync rules, roles and the overlay are portable and live in `SKILL.md`, `source-format.md` and `sync.md`. How a site is created, given its runtime values, built, previewed and deployed lives here. A host is marked supported only after a real site on that host passed every hosted check below; until then it is `unverified`, with the failing or unrun item named.

## ChatGPT Sites

The site is a ChatGPT Site: a Cloudflare Worker built from the Sites plugin's Vinext starter, with a D1 database bound as `DB` and "Sign in with ChatGPT". `<plugin-root>` is the installed Sites plugin directory, `~/.codex/plugins/cache/openai-curated-remote/sites/<version>/`. Creating, deploying and reading Site credentials use the plugin's native Sites tools, which are available in a Codex session with the plugin, not in other agents.

### Set up and build

From an empty `<slug>/site/`:

1. `node <plugin-root>/scripts/project-setup.mjs` copies the current Vinext starter (portable profile unless `SITES_MANAGED_LINUX_CONTAINER=1`).
2. `node <plugin-root>/scripts/install-dependencies.mjs` installs once (Node `>=22.13.0`).
3. `node scripts/roadmap-site.js build <slug>/site --config … --tokens …` applies the overlay and sets `"d1": "DB"` in `.openai/hosting.json`, keeping `project_id` and every other field.
4. `node <plugin-root>/scripts/build-site.mjs` builds the Worker into `dist/`. The overlay ships its first migration (`drizzle/0000_init.sql` with its `drizzle/meta/` files), generated with the starter's `npm run db:generate`; do not regenerate it. A later schema change appends a new migration with `npm run db:generate` and is committed with the overlay.

Overlay-owned paths replace the starter's `app/page.tsx`, `app/layout.tsx` (starter title, description and `codex-preview` metadata removed), `app/globals.css`, `db/schema.ts` and the empty `drizzle/meta/_journal.json`, and add `app/roadmap-view.tsx`, `app/api/{roadmap,items,comments,sync}/route.ts`, `lib/roadmap/`, `drizzle/0000_init.sql`, `drizzle/meta/0000_snapshot.json` and `.env.example`. Everything else is host-owned and untouched, including `vite.config.ts` and its `sites()` integration, `worker/`, `scripts/`, `package.json`, the lockfile, `app/chatgpt-auth.ts` (reused for sign-in), `db/index.ts`, `drizzle.config.ts`, `components/`, `hooks/`, the host's `lib/` files, `vendor/`, `.npmrc` and `.gitignore`.

### Local preview

- Runtime values come from `site/.dev.vars` (untracked: the starter's `.gitignore` ignores `.env*` and `.dev.vars*`), one `KEY=value` per line for `ROADMAP_EDITOR_EMAILS` and `ROADMAP_SYNC_TOKEN`. Use a throwaway local sync token. The preview reads the file at start ("Using secrets defined in .dev.vars"); restart the preview after changing it.
- Apply the migration to the local database once, after the host build:

  ```bash
  node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_init.sql
  ```

- `npm run dev` serves `http://localhost:5173`. Sign in as the mock user at `/signin-with-chatgpt?return_to=/`. The mock user is `seedy@sites.test` with the full name "Seedy"; list or omit that email in `ROADMAP_EDITOR_EMAILS` to test the editor and reader roles. Because the mock user has a full name, the no-full-name fallback is covered by the script's tests, not by the preview.
- Point `siteUrl` in the config at the preview and run `push` with the local token to load a snapshot.

### Hosted

1. Create the Site with the native create call; it starts private. Persist its id with `node <plugin-root>/scripts/set-project-id.mjs --project-id <id>` (Worker build: no `--static-directory`).
2. Set `ROADMAP_EDITOR_EMAILS` and `ROADMAP_SYNC_TOKEN` as Site runtime secrets through the native Sites tools. Keep `ROADMAP_SYNC_TOKEN` in the project's private credentials file; never put either value in source or `.openai/hosting.json`.
3. Package and publish with the plugin's source helper and the native save and deploy calls for the Site's audience. Sites applies the D1 migration before uploading the Worker.
4. For sync against a private Site, call the native `get_site` in the session that runs sync and pass its service bearer token to the script as `ROADMAP_SERVICE_TOKEN` through stdin or the environment. Do not write it to a file, and do not change the Site's audience to make sync work. The script sends it as `OAI-Sites-Authorization: Bearer …`.

Host notes:

- The starter's `.gitignore` pattern `.env*` also matches `.env.example`, so the overlay's `.env.example` is not tracked in the Site's source repository unless it is force-added. The key names are also listed in `SKILL.md`.
- A request the platform redirects to sign-in makes the script stop with "redirected … needs a current ROADMAP_SERVICE_TOKEN".

### Pre-implementation verification (2026-11-10, plugin 1.1.4)

- The task doc's host evidence still holds on plugin 1.1.4: `project-setup.mjs` requires an empty destination and never layers templates; the starter ships `app/chatgpt-auth.ts` whose `displayName` falls back to the full email (the overlay never uses that field); Node `>=22.13.0`; `.openai/hosting.json` starts as `{"d1": null, "r2": null}`; local mock sign-in is `seedy@sites.test`; D1 is bound as `DB` with migrations from `npm run db:generate`.
- The overlay applied cleanly on top of the portable-profile starter; the retained-template fallback (`--template-source`) was not needed.
- The local preview reads `.dev.vars` at the site root.
- Service token: the plugin documents only that `get_site` may return `siwc_bypass_bearer_token` and that dispatch "validates and consumes" it. Whether a session other than the authoring one can obtain it, and whether it is consumed per request (a pull or push makes two requests) or per session, is not documented. **Unverified.**
- Sharing with one named second account: the plugin distinguishes only "confirmed owner-private" from "other supported audiences" and documents no call that shares a Site with one named account. The hosted non-editor check is therefore **not runnable** as documented; the local gate's role checks stand as the evidence.

### Conformance

**Local gate: passed** on 2026-11-10 with plugin 1.1.4, Node 24, portable profile, on the synthetic roadmap `fixtures/roadmaps/valid.md` in a scratch git repo:

- host setup and install; `build` (19 files written, second run 0); `verify` ok; host build passed; type check clean; local D1 migration applied; runtime values from `.dev.vars`;
- the page rendered from a pushed snapshot; masthead facts, status summary, collapsed all-done group and token colophon shown;
- with the editor list excluding the mock user: no edit form, and a status write returned 403; anonymous write, comment and delete returned 401; forged identity headers were stripped by the preview;
- with the list including it: status, note and link saved, with the pending marker and item activity; a stale save showed the conflict message and reloaded the item; a comment was added and deleted;
- the read payload and page HTML contained no email or user id; the sync endpoint refused a missing and a wrong token with 401;
- pull reported a conflict and left the file unchanged; `--prefer repo` discarded the page side and applied the other page edit as a status-word change; after commit, push cleared the pending edit; a post-push conflict showed the conflict marker naming both values; `--prefer page` resolved it; a push from an older commit was refused as a non-ancestor;
- status filters, search and the URL filter state, including after reload;
- no page-level horizontal scroll at 390 px and 1280 px, with the drawer closed and open; no console errors.

**Local recheck after review fixes: passed** on 2026-11-10, same setup: `build` (second run 0 files), `verify`, host build and type check; same-site and `text/plain` writes refused with 403 and an anonymous same-origin write with 401; editor form save and stale-save conflict; comment added and deleted; one push cleared a pending edit; a conflicted item's drawer took focus on Close and returned it to the row on Escape; an edit saved back to its base after the repo moved showed the repo status with no marker, matching `pull`, which reported only the real conflict; no console errors.

**Hosted: `unverified: not run`.** No Site was created; the Sites tools are not available outside a Codex session with the plugin. Still to run on a private Site built from the same synthetic roadmap: real sign-in, an editor edit, a non-editor refused (if a second account can be shared), the service-token reach for sync, deploy and migration apply, and one pull and push round trip. Record the date, plugin version and each result here; do not record the Site URL or any account.

## Any other host

Add a section with the create, runtime-value, build, preview and deploy steps and a conformance record before calling the host supported. A host without a server and database cannot run this overlay; a single-file adapter (for example a claude.ai Artifact with a shared database) would be a separate overlay.
