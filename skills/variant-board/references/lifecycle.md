# Lifecycle: issue, cite, index, migrate, bundle

All commands run from the skill directory with Node; paths may use `~`.

## Versions

- The working file `html/<board>.html` always holds the latest version. `<html data-board-version="N" data-board-issued="true|false">` and the masthead stamp `vN · date · issued|working` agree.
- Working edits batch under an unissued number. Bumps between issues do not freeze anything.
- `issue` writes the frozen copy `html/versions/<board>.vN.html` and never edits it again. The working file is stamped issued first, so the working issued copy and the frozen file are byte-identical.
- Once N is issued, any changed bytes intended for issuance, including a copy fix, need `bump` to N+1 (or higher) with `working` status and a `proposal` entry. `check` fails an issued working copy whose bytes differ from its frozen file, and `issue` refuses to overwrite.
- Issuing byte-identical content again is a no-op.

```bash
node scripts/verify-variant-board.js issue  <board.html> [--date YYYY-MM-DD] [--skip-theme-source]
node scripts/verify-variant-board.js bump   <board.html> [--to N] [--date YYYY-MM-DD] [--note 'what changed']
```

`issue` refuses when any check fails, when a token row is `unresolved`, or when N is at or below the reserved legacy number. `--skip-theme-source` skips only the re-read of resolved values from the theme repo (for a machine without it); the warning is printed so the gap stays visible.

## Citations

Repo convention plus anchor and scenario:

```
Companion: `~/agent-artifacts/<topic>/html/<board>.html` (v17) — "Where the commands go" (#commands?variant=a&route=external&state=submissions-closed&viewer=chair)
```

Specs keep `(source: …html)` and add `(vN)` when they cite a decision.

```bash
node scripts/verify-variant-board.js cite 'Companion: `~/agent-artifacts/<topic>/html/<board>.html` (v17) — "Heading" (#section?…)'
```

Resolution: the frozen path is derived from the path and `(vN)`; the frozen file must exist with `data-board-version="N"` and issued status; the section is found by anchor or, failing that, by heading text; an interactive section must be cited with a complete, dependency-valid scenario. A higher working version never satisfies a lower citation. The report says whether the working file is byte-identical to the frozen file, which is the only case where the working file may be opened as a convenience for that citation.

## Index: `boards.md`

One per topic workspace, plain Markdown, maintained by the scripts. Per board: file, brief, token map, current version and status, reserved legacy number, notes, a table of issued versions (date, frozen file, digest, published URLs per host) and, for migrated boards, the inventoried legacy citations. It is what a second agent reads before revising, and what the bundle path updates on import.

```bash
node scripts/verify-variant-board.js publish <board.html> --version N --url <url> --host <claude|codex|chatgpt|…>
```

`publish` records a URL learned after issue for that version, after confirming the frozen file's digest is unchanged. Publishing an issued version uploads the frozen file unchanged; the canonical file is never edited from the published side. A URL known before issuance may also appear in the colophon.

## Legacy boards

A board cited before issuance existed (`commercial.html (v17)` with no frozen file) is migrated on its first revision:

```bash
node scripts/verify-variant-board.js migrate <board.html> \
  --citation 'Companion: `~/agent-artifacts/<topic>/html/<board>.html` (v17) — "Heading"' --location '<repo>/.agent/tasks/<task>.md:7' \
  [--citation … --location …] [--reserve N]
```

This inventories each citation in `boards.md` as `legacy — historical version unavailable` and reserves every number up to the highest cited or stamped one. No historical file is reconstructed. Only inventoried citations are exempt from frozen resolution (`cite` reports them as legacy, never as verified). The first new issued number is above the reserved number (`bump` picks it), and every citation written after migration uses the frozen-version contract.

## Bundles: hosts without this filesystem

A direct-path host reads the repo and theme, writes the canonical file and runs the checks itself. A host without the filesystem works from a **source bundle** and returns a candidate.

```bash
node scripts/export-board-bundle.js export <board-id> --workspace <topic> --out <dir> --brief <brief.md> --tokens <tokens.md> [--sources <dir>] --new
node scripts/export-board-bundle.js export <board.html> --out <dir> [--sources <dir>]                      # revision, inferred when the board exists
node scripts/export-board-bundle.js import <candidate-dir> --into <topic-or-path> [--bundle <bundle-dir>] [--skip-theme-source]
```

A bundle holds `README.md`, `instructions/` (this skill's portable files), `brief.md` (ids assigned), `tokens.md`, `starter.html`, `sources/` (requirement and source excerpts with file path and commit, prepared by the exporter) and `manifest.json`. A **revision bundle** adds `current/<board>.html`, `current/versions/*.html`, `current/boards.md` (that board's entry, with accepted decisions) and manifest fields `baseVersion`, `baseIssued`, `baseDigest` and `frozen` digests. The host starts from the current board, keeps ids and revision notes, and returns `<board>.html` plus the manifest byte for byte; a candidate cannot claim `data-board-issued="true"`.

`import` compares the manifest with the current canonical board before touching anything: a changed working file, a changed or missing frozen file, or a version issued after export is a **stale base** and is rejected without replacing the working file or any issued version (re-export from the current base). A new-board import needs an unused board id and path, and finds the brief and token map in the workspace, the candidate folder, or `--bundle <dir>`. The candidate is then validated with the same structure and token checks as `check`; rejections leave the workspace unchanged. On success the working file is replaced, the brief and token map are placed if missing, and `boards.md` records the import. Issuance still happens on the canonical file after the manual checks.

Verification of a returned candidate is the acceptance evidence for that host; record it in [hosts.md](hosts.md).
