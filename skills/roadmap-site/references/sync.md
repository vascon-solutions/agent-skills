# Sync

The repo roadmap's status column is canonical. A page edit records the repo status it started from (its **base**). `pull` compares repo, page and base; `push` replaces the site snapshot. The rules live in `starter/lib/roadmap/merge.mjs`, which both the script and the app load.

## Site state

- **Snapshot:** commit, git author, generation and push time, groups and items with repo status.
- **Item state,** one row per item that has a page edit: pending `status` and `base`, note, link, version, editor name, time. A save whose status equals the snapshot's repo status leaves nothing pending.
- **Comments** (flat, plain text) and **activity** (status, note and link edits, comments, pushes and pulls).

Displayed status is the pending page status when there is one, otherwise the snapshot's. A pending item shows "Changed on the page, not yet in the repo"; when the snapshot has moved away from the edit's base, the item shows a conflict marker naming both values.

## `pull`

For each pending edit, with `repo` the file's current status:

| Page changed (page ≠ base) | Repo changed (repo ≠ base) | Result |
|---|---|---|
| any | any, and page = repo | already equal; the next push clears it |
| yes | no | the page status is written into the file's status cell |
| no | yes | the repo wins; the page edit is discarded on the site |
| yes | yes, to a different value | **conflict** |
| item no longer in the file | | **orphaned**, reported every pull |

- Any conflict stops the pull: nothing is written and nothing is sent. Rerun with `--prefer page <id>` (write the page status) or `--prefer repo <id>` (discard the page edit) for each conflict. `--prefer repo <id>` also drops an orphaned edit. An agent asks the owner which side to prefer.
- Only status words change. Every other byte of the file, including the repo note after the word and text outside tables, is preserved. The script prints each changed line.
- The pull is recorded in activity with the commit, the operator's git name and the counts. A discard is applied only if the page edit is unchanged since the pull read it; otherwise it is skipped with a warning, and the next pull sees the newer edit.
- `pull` never commits.

## `push`

Guards, all checked before anything is sent:

1. the working tree is clean (`git status --porcelain` is empty);
2. the roadmap passes `check`;
3. the site's current snapshot commit is an ancestor of `HEAD`, so an old branch cannot roll the page back. An unknown commit is refused too. The first push has no site snapshot and skips this guard.

The site stores the new snapshot and clears every pending edit whose status equals the new repo status. The rest stay pending with their original base, so an edit made between a pull and a push is compared against what it started from on the next pull. The activity entry names the short commit and the git author name the script sends; that name is for display only.

## Staleness

The masthead shows the snapshot's short commit, push date and age, and the number of pending page changes. The snapshot is stale, and shown as a warning, once more than 14 days have passed since the last push. The threshold is fixed.

## Credentials

- `ROADMAP_SYNC_TOKEN` is the sync authority: holding it is enough to pull and push. Keep it in the project's private credentials file, never in source, fixtures or the site config.
- The host's service token for a private site is obtained for each session and never written to a file. The script sends it only as the host's service header.
- Both reach the script through the environment (`ROADMAP_SYNC_TOKEN`, `ROADMAP_SERVICE_TOKEN`) or through stdin with `--token-stdin` as `KEY=value` lines. An argument ending in `token` is refused. Neither value appears in output, the activity log or any request field other than its own header.

```bash
printf 'ROADMAP_SYNC_TOKEN=%s\nROADMAP_SERVICE_TOKEN=%s\n' "$SYNC" "$SERVICE" | node scripts/roadmap-site.js push --config <config> --token-stdin
```

## Endpoint

`GET /api/sync` returns the snapshot commit and push time and the pending edits. `POST /api/sync` takes `{ "action": "push", "snapshot": … }` or `{ "action": "pull", "commit", "author", "applied", "discard" }`. Both need the `x-roadmap-sync-token` header; a missing or wrong token gets 401, and a site with no token configured answers 503.
