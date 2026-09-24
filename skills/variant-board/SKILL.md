---
name: variant-board
description: "Use to build or revise a UI variant board (before/after, option comparison, state coverage, or defect report) for a section, page, feature or UX change: drawn in the target app's own design system on a white editorial page, issued in frozen versions that specs and task docs cite by section and scenario, and rendered with whichever host is in use. Use it whenever someone asks for a variant board, a before/after board, UI variants or options to compare, a mock of proposed UI states for a task doc, or a revision or new version of an existing board, even if they call it a prototype or a companion."
---

# variant-board

A variant board is a discussion aid: one self-contained HTML page that shows a surface's proposed states, options, or defects in the target app's own design system, with a white editorial frame around the mocks. Specs and task docs cite a board at an issued version, a section id, and a scenario, so the board must be repeatable, recognisable as the app, and frozen once cited. The repo spec or task doc stays authoritative; a board never authorises implementation.

This file and [references/anatomy.md](references/anatomy.md) are the portable part: they name no host tool and travel inside a bundle. [references/lifecycle.md](references/lifecycle.md) holds the issuance, citation, index, migration and bundle procedures. [references/hosts.md](references/hosts.md) holds the per-host adapter (preview, publish, wrapper limits) and the conformance record.

## Files

```
variant-board/
├── SKILL.md                      portable workflow (this file)
├── starter.html                  page shell, chrome tokens, empty --app-* block, mock primitives, runtime
├── templates/brief.md            the brief the board is built from
├── templates/tokens.md           the token map that produces the --app-* block
├── references/anatomy.md         core and purpose sections, masthead facts, revision notes, runtime contract
├── references/lifecycle.md       issue, cite, index, migrate, bundle export/import
├── references/hosts.md           host adapters and conformance records
├── scripts/verify-variant-board.js   check | scenario | cite | issue | bump | publish | migrate
├── scripts/export-board-bundle.js    export | import
└── fixtures/workspace/           two synthetic boards with briefs and token maps
```

Canonical placement: `~/agent-artifacts/<topic>/html/<board>.html`, frozen copies in `html/versions/<board>.v<N>.html`, brief and token map in `markdown/<board>-brief.md` and `markdown/<board>-tokens.md`, index in `boards.md`. No `metadata.md` is needed. Authoring may happen anywhere; the canonical file is what gets verified, issued and cited.

## 1. Start from a brief, not a document

Infer the brief from the conversation, the repo and the source of truth; ask only about a material gap (which surface, which source of truth, which commit). Write it to `markdown/<board>-brief.md` from [templates/brief.md](templates/brief.md) whenever the board will be cited, because the brief is what a second agent or a bundle host reads. It carries:

- product, repo path, surface, source of truth, and the commit the source was read against
- one or more purposes: `proposed-change`, `unsettled-choice`, `state-coverage`, `defect-report`
- sections with stable ids (assigned here, never changed once cited) and the purpose each carries
- scenarios: `#section?dimension=id&…` rows with the expected visible result, for every consequential combination
- theme source path and commit, open questions, predecessors

Read the actual product source at the recorded commit before drawing a Before pane. Do not infer current behaviour from an older board.

## 2. Resolve the app's tokens

The mock uses the app's real colours, radius, semantic washes and body font. Produce `markdown/<board>-tokens.md` from [templates/tokens.md](templates/tokens.md): one row per `--app-*` token with the source token, file, mode, revision, literal value and a status.

- Follow aliases (`--color-default: var(--color-border)`) and app-level overrides to a literal; keep the literal verbatim, never converted.
- Use the app's font stack verbatim when it is local or a system stack. A web font that cannot be embedded is `substituted` with a system stack and the substitution is named on the page.
- `waived` rows need the board owner's decision in the revision notes (`data-type="decision" data-waives="--app-…"`) naming the role and reason. `unresolved` rows make the board a draft: previewable, not issuable.
- When evidence is missing (no theme file, unresolved alias, conflicting sources), ask `repo-design-context` with a `board-mock` request and the theme path; it returns literal tokens and the body font at high confidence, and reports medium or low confidence instead of applying it.
- Read the real component files once for proportions (button height, input padding, radius, badge size) and match them in the mock primitives; look-alikes, not imports. Extend the primitives per board when the app has a component the starter lacks.

## 3. Build from the starter

Copy [starter.html](starter.html) to `html/<board>.html`. Keep the `--board-*` block, the runtime script and the page shell exactly as shipped; the verifier compares them to the starter. Fill in, in this order:

1. `<html data-board-id="<board>" data-board-version="1" data-board-issued="false">`.
2. Masthead: eyebrow (product · surface · scope), H1, lede, and the facts `source-of-truth`, `read-against`, `theme-source`, `version` (`v1 · YYYY-MM-DD · working`), `status`, `tokens` (name every substituted or waived token).
3. One `<section class="board-section" id="…" data-purpose="…">` per brief section, with an H2. Add only the parts the purpose needs (see [references/anatomy.md](references/anatomy.md)); nothing is manufactured to fill a slot.
4. The `--app-*` block from the token map, and a `[data-app-scheme="dark"]` block only when the app ships a dark mode, with a mock-only Scheme control.
5. The `#board-scenarios` JSON: dimensions, options (`rec: true` draws the Recommended tag) and `controlling → dependent` dependencies with an `allowed` map, per interactive section.
6. Renderers: `VariantBoard.mount({ sectionId: function (selection, api) { return html; } })`, built from state and copy tables. Use `api.panes({ view, before, after })` for Before/After/Side-by-side and `api.frame(html, note)` for a single mock. The mock is inert: only the controls, and `data-reveal="section.dimension=option"` affordances that are themselves dimensions, change what is shown.
7. Revision notes (a `proposal` entry for v1) and the colophon: sources read, Before-pane sources, token status, the fixtures disclaimer and "Prototype markup is a discussion aid, not an implementation."

The page is always light: `color-scheme: light`, chrome on white, mocks on `--app-background`. Host dark-mode rules are met by re-declaring the light scheme, never by inventing a dark palette. No web fonts, no remote scripts, stylesheets, images or `url()`; navigation links to sources and frozen versions are fine.

## 4. Verify before anyone cites it

Scripted, from the skill directory:

```bash
node scripts/verify-variant-board.js check ~/agent-artifacts/<topic>/html/<board>.html
node scripts/verify-variant-board.js scenario <board.html> '#section?dimension=id&…'
```

`check` covers structure (stamps, facts, section ids against the brief, purpose parts, revision notes, colophon, chrome and runtime equal to the starter, no network references) and the token map (`--app-*` equals the map; `resolved` values re-read from the theme file at the recorded revision when the repo is present; substitutions and waivers visible; unresolved rows reported as draft). `scenario` resolves one hash under the exact citation policy.

In a browser, through the host's preview (see [references/hosts.md](references/hosts.md)):

- open the board at each representative scenario hash from the brief and confirm the expected visible result; every consequential role × state combination the brief lists
- confirm invalid hashes (missing, repeated, unknown, forbidden) show the red "Cited scenario not found" banner and reset the named section to defaults, including after a prior replay or control change; an unknown section leaves existing selections unchanged; a bare `#section` just scrolls
- confirm a controlling change hides the states its route cannot reach and repairs the dependent selection; unrelated sections do not move
- Before panes carry "reconstructed from source @ commit" and their claims trace to files named in the colophon
- at 390 px and 1280 px the board wrapper has no page-level horizontal scroll; the mock keeps its own width and scrolls inside its frame
- no console errors

## 5. Issue, cite, revise

Working edits accumulate under an unissued number. Issue when the owner says so or a spec or task doc is about to cite the board:

```bash
node scripts/verify-variant-board.js issue <board.html> [--date YYYY-MM-DD]
```

`issue` runs the checks, stamps the working file `issued`, adds the `issued` revision entry linking the frozen file, writes `html/versions/<board>.v<N>.html`, and records the version, date and digest in `boards.md`. Issuing identical bytes again is a no-op; a frozen file is never overwritten. Any later change to an issued working copy, including a typo, needs `bump` (new number, `working` status, a `proposal` entry) before it can be issued.

Cite with the repo's familiar text plus the anchor and, for interactive sections, the complete scenario:

```
Companion: `~/agent-artifacts/<topic>/html/<board>.html` (v3) — "Section heading" (#section?dimension=id&…)
```

`node scripts/verify-variant-board.js cite '<citation text>'` resolves it to the frozen file, checks the version and issued stamp, finds the section, and validates the scenario. Higher working versions never satisfy a lower citation. Boards that were cited before issuance existed are migrated with `migrate` (see [references/lifecycle.md](references/lifecycle.md)).

Publication is optional and host-specific; a URL learned after issue goes into `boards.md` with `publish`, never into frozen HTML.

## 6. Hosts without this filesystem

`node scripts/export-board-bundle.js export …` writes a self-contained authoring pack (instructions, brief with ids, token map, starter, sources, and for a revision the current board, frozen versions, index entry and base manifest). The host returns a candidate plus the manifest; `import --bundle <original-bundle-dir>` compares the returned manifest with the retained original export, checks the base has not moved, preserves complete revision entries and frozen files, validates the candidate, then replaces the working file. Details and the conformance rules are in [references/lifecycle.md](references/lifecycle.md) and [references/hosts.md](references/hosts.md).

## Boundaries

- `html-artifact` keeps document companions, clickable flows and approach comparisons that no task doc will cite as a board. If it will be cited as a companion, it is a board.
- `image-artifact` no longer generates variant boards; its `board-snapshot` captures an issued frozen version at a validated scenario for a static image.
- `artifact-workbench` is unchanged and serves boards and their `versions/` folder as it serves any workspace HTML.
- Do not retrofit existing boards in bulk, generate a per-product component kit, or publish anywhere without the owner's instruction.
