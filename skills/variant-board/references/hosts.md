# Host adapters

The placement rule: anything that changes what a task doc can cite is portable and lives in `SKILL.md`, `anatomy.md` and `lifecycle.md`; anything that only changes how the file is displayed, shared or previewed lives here. Scenario deep links are guaranteed for the canonical file only; a host's preview or published wrapper may not pass the URL hash through or may sandbox scripts, and that limit is recorded per host below.

A host is marked supported only after an actual board from that host passed all applicable checks: structure, token map, a representative scenario opened by its citation hash, the invalid-hash banner, Before labels, and viewport. Unexercised hosts stay `unverified`; they are never reported as supported.

## Claude Code (direct path)

- Filesystem, shell and a browser are available: author the canonical file directly, run the scripts, preview with `artifact-workbench` (`node <artifact-workbench>/scripts/serve-artifact-workbench.js <topic> --live`; add `--capture-selections` only when the owner wants browser choices recorded). Open `http://127.0.0.1:<port>/preview/html/<board>.html#section?…` for scenario checks and `/preview/html/versions/<board>.vN.html` for frozen copies.
- Publishing is optional and uses the host's artifact feature on an issued frozen file, unchanged. Record the URL with `publish`. Claude's page contract asks for dark-mode token redefinitions and allows Google Fonts; the board satisfies the first by re-declaring the light scheme and ignores the second (no web fonts).
- Wrapper: the published artifact wrapper has not been checked for hash pass-through or script preservation; treat published copies as viewing copies and cite the canonical file.
- Workbench note: the workbench's HTML checks warn on the relative `versions/<board>.vN.html` navigation links and on the runtime's scenario-link string. Those are navigation hrefs, not asset loads; the board stays self-contained and the warning needs no action.

Conformance: **supported (direct path)**, verified 2026-09-24 on the pilot `~/agent-artifacts/ncdmb-bid-opening-completion-ux/html/completion.html`: structure and token checks passed against `packages/ui/src/styles.css @ b18416a3`; v1 and v2 issued with v1 bytes unchanged; five brief scenarios opened by hash in Chrome with the expected panes; a forbidden combination showed the banner; Before labels present; no horizontal page scroll at 390 px and 1280 px; frozen navigation and hash replay through the workbench; `board-snapshot` captured v2 at a scenario; a task-shaped citation fixture resolved v1 and v2 and rejected a missing dimension, an unissued version, and a heading-only citation of an interactive section.

## Codex CLI (direct path)

- Same capabilities as Claude Code: filesystem, shell, browser via the workbench. Discover the skill through `~/.codex/skills/variant-board` (installed by `bin/link-skills.sh`) or point the session at the skill directory.
- Publishing: none built in; share the canonical file or use another publisher. Record any URL with `publish`.

Conformance: **unverified**. Attempted 2026-09-24 with `codex exec` (Codex CLI 0.146.0) on the synthetic `route-state` brief: the configured model (`gpt-6-astra`) required a newer CLI, and the explicit fallback (`gpt-5-codex`) is not available on a ChatGPT account, so no board was produced. Rerun after upgrading the CLI; record the date, fixture and check results here when a Codex board passes.

## ChatGPT (bundle path)

- No access to the filesystem or repo: export a bundle (`export-board-bundle.js export`), attach the folder, and ask for the candidate `<board>.html` plus the manifest back. ChatGPT builds from the bundle's starter or current board and returns files; the owner imports them (`import`) and a direct-path agent runs the checks and issues.
- Wrapper: a page rendered inside ChatGPT's own preview may not pass the URL hash through or run inline scripts unchanged; scenario replay is checked on the imported canonical file, not in that preview.

Conformance: **unverified** until a ChatGPT candidate has been imported and passed the checks, including a revision-bundle import.

## Any other host

Choose the path by capability, not by brand: a host with the filesystem and shell uses the direct path; otherwise the bundle path. Add a section here with the preview mechanism, publish step, wrapper limits and conformance record before calling it supported.
