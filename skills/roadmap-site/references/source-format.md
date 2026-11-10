# Minimum source format

The site reads one file, `.agent/roadmap.md` by default (`roadmapPath` in the config). `check`, `pull` and `push` all parse it with these rules; the same rules run on the page's server. Nothing is dropped silently: every row of an item table becomes an item or a failure naming its line and id.

## Rules

- **Group.** The nearest heading of level 2 or 3 above an item table. Its text is the group title, shown verbatim. Level 1 and level 4+ headings do not start a group.
- **Group outcome.** An optional `Outcome: <one sentence>` line as the first non-blank line under the group heading.
- **Item table.** A pipe table (rows start with `|`) whose header has an id column (`ID` or `#`), an `Item` column and a `Status` column, matched case-insensitively. Optional columns: `Outcome` (shown before the item text) and `Task doc` or `Link` (a repo path or URL; `—` means none). Other columns are ignored.
- **Other tables** are ignored when they lack an id or `Item` column, so milestone summaries, decision registers and blocker indexes need no change. A table with id and `Item` columns but no `Status` column fails.
- **Id.** Backticks stripped; must match `[A-Za-z0-9][A-Za-z0-9._-]*` (for example `1.4`, `00-02`, `BE-03B`, `03-04A`) and be unique across the file.
- **Status.** The cell starts with one of `todo`, `in-progress`, `blocked`, `done`, `deferred`, `cancelled`, optionally backticked. Text after the word is the repo note (a leading `—`, `:` or `;` separator is dropped for display). `sync` replaces only the word.
- **Inline Markdown** in item and outcome cells: code, links, bold and emphasis render; nothing else does.
- Fenced code blocks are skipped. Lane roadmaps and prose are not read. One roadmap file per site.

## Example

```markdown
## Milestone 2: Usable catalog
Outcome: A merchant lists products and a shopper can browse them.

| ID | Item | Outcome | Status | Task doc |
|---|---|---|---|---|
| 2.1 | Product media upload and signed reads | Merchants attach product photos | `done` | `.agent/tasks/BE-02-media.md` |
| 2.2 | Catalog API: products, variants, prices | Products can be created and priced | `in-progress` — PR open | `.agent/tasks/BE-03-catalog.md` |
| 2.3 | Inventory and reservations | Stock prevents overselling | `todo` | — |
```

## Failure messages

| Case | Message |
|---|---|
| Duplicate id | `line 6 (row "1.1"): duplicate id, first used on line 5` |
| Malformed id | `line 6 (row "#7 bad"): malformed id; ids match [A-Za-z0-9][A-Za-z0-9._-]*` |
| Unknown status word | `line 5 (row "1.1"): unknown status "superseded"; use one of todo, in-progress, blocked, done, deferred, cancelled` |
| Free-text status | `line 5 (row "1.1"): free-text status "implemented; acceptance complete, PR open"; the cell must start with one of …` |
| Empty status | `line 5 (row "1.1"): status cell is empty` |
| Missing status column | `line 3: table has ID and Item columns but no Status column` |
| Table with no group | `line 3: item table has no level 2 or 3 heading above it` |

Each failure fixture under `fixtures/roadmaps/` produces one of these. Fix them in the roadmap file with `roadmap-todo`, with the owner's consent; there is no per-project alias map.
