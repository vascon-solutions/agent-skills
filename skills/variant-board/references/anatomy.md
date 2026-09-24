# Board anatomy

Portable. Names no host tool; travels inside a bundle with `SKILL.md`.

## Core, on every board

1. **Masthead**: eyebrow (product · surface · scope), H1, lede, and the facts list. Facts are `<dd data-fact="…">` entries the verifier reads:
   - `source-of-truth` — the task doc, spec or notes the board draws from
   - `read-against` — branch and commit the source was read at (`develop @ b18416a3`)
   - `theme-source` — theme file and commit (`packages/ui/src/styles.css @ 9011ce0c`), or "none found"
   - `version` — the stamp `v<N> · <YYYY-MM-DD> · issued|working`, agreeing with `<html data-board-version data-board-issued>`
   - `status` — proposal, accepted, superseded, and so on
   - `tokens` — "all resolved" or a count naming every substituted and waived token
2. **Sections from the brief**: `<section class="board-section" id="<stable id>" data-purpose="…">` with an H2. Ids come from the brief and never change once cited; headings may be reworded. `data-purpose` lists the purposes the section carries (space-separated).
3. **Revision notes**: `<section id="revisions">` with `<ol class="revision-list" data-board-part="revisions">`. Each `<li>` carries `data-version`, `data-type`, `data-date`, `data-author` and, for a waiver, `data-waives="--app-…"`. Types: `issued`, `proposal`, `decision`, `amendment` (name what it amends in the text). A new working v1 starts with a `proposal`; `issue` appends the `issued` entry with a link to the frozen file. Decisions are recorded by the board owner, not by an agent.
4. **Colophon**: `<footer class="colophon" id="colophon">` with the sources read, the files the Before panes were reconstructed from, the token status (`<span data-colophon="tokens">`, naming substituted and waived tokens), the fixtures disclaimer and the closing sentence "Prototype markup is a discussion aid, not an implementation."

## Purpose parts, only when the brief's purpose calls for them

| Purpose | Parts the section carries | Marker |
|---|---|---|
| `proposed-change` | Before / After / Side-by-side panes; a same/changed proof table when behaviour is claimed unchanged | `data-board-part="panes"` on the runtime mount, or `data-board-part="before-pane"` on a static pane; `data-board-part="proof"` on the table |
| `unsettled-choice` | option pairs or trios with exactly one `Recommended` tag per question; a side-by-side comparison table; a "What this board cannot settle" list | `data-board-part="options"`, `"comparison"`, `"cannot-settle"` |
| `state-coverage` | a state matrix; a mock exhaustive over the states and viewers the brief lists | `data-board-part="state-matrix"` |
| `defect-report` | "On the page today": block anatomy plus verified defects with finding codes | `data-board-part="defects"` |

A board may combine purposes; a section may carry more than one. If there are no defects there is no defects section; if one state needs no matrix there is none. Every Before pane is labelled "reconstructed from source @ commit"; `api.panes()` writes the label from the `read-against` fact, static panes write it by hand. A screenshot of the running app may be attached as a check when the environment allows, never required.

## Interactivity is orthogonal to purpose

Any section under any purpose may be static or carry controls. Interactive sections declare their dimensions in the `#board-scenarios` JSON and render through the runtime; `state-coverage` only adds the obligation to be exhaustive and to include the matrix.

## Runtime contract

The starter ships the runtime as `<script id="board-runtime">`; boards do not edit it. It reads the declaration:

```json
{ "sections": { "commands": {
  "dimensions": [
    { "id": "variant", "label": "Variant", "options": [{ "id": "today", "label": "Today" }, { "id": "a", "label": "A", "rec": true }] },
    { "id": "route", "label": "Route", "options": [{ "id": "depot" }, { "id": "external" }] },
    { "id": "state", "label": "State", "options": [{ "id": "draft" }, { "id": "submitted" }, { "id": "authority-review" }] }
  ],
  "dependencies": [
    { "controlling": "route", "dependent": "state", "allowed": { "depot": ["draft", "submitted"], "external": ["draft", "submitted", "authority-review"] } }
  ]
} } }
```

- **Dimensions** are ordered; one segmented control per dimension, rendered into `<div class="controls" data-controls="<section>">`. `rec: true` draws the Recommended tag. Typical dimensions: `variant`, `route` or `model`, `state`, `viewer`, `view`; any subset, any extra the brief needs, including a `reveal` dimension for a sub-state (open sheet, expanded dialog) so it stays citable.
- **Scopes**: each interactive section owns one selection object. Exactly one option is selected per dimension per scope (`aria-pressed="true"`); controls in one section never change another.
- **Dependencies** are directed `controlling → dependent` pairs with an `allowed` map from each controlling option to the dependent options it admits. A dimension may have several controllers; the options it offers are the intersection of what each controller allows. A controlling option is never hidden because of the current dependent selection. When a controlling selection changes, dependents are re-evaluated in dependency order: invalid options are hidden, still-valid selections are kept, an invalid selection resets to the first valid option. The runtime rejects unknown ids, duplicate ids, cycles, and any reachable combination of controlling options that leaves a dependent with no valid option; it shows the rejection in the banner instead of drawing a wrong state.
- **Render from tables**: `VariantBoard.mount({ commands: function (selection, api) { … } })` returns the HTML for `<div data-mock="commands">` from the selection and the board's copy tables. `api.panes({ view, before, after, beforeNote, afterNote })` draws Before / After / Side-by-side panes from a `view` dimension; `api.frame(html, note)` draws one mock. "Today" as the first value of a `variant` dimension is the other Before model; both are supported.
- **Inert mock**: nothing inside the mock responds to clicks except elements marked `data-reveal="<section>.<dimension>=<option>"`, which set that dimension through the same path as a control.
- **Scenario ids** serialise as `#<section>?dimension=id&…` in dimension order; the runtime shows the current one under the controls as a link. On load and on `hashchange` the runtime replays a cited scenario exactly: every dimension of that scope assigned once, known ids, dependency-valid. A missing, repeated, unknown, forbidden or malformed assignment shows the "Cited scenario not found" banner with the reason and leaves the defaults; nothing is coerced. A bare `#section` is ordinary navigation. Coercion (dependent repair) applies to a person changing a control, never to a citation.

Board-specific work is the tables, the `allowed` maps, and the renderers. The shell, controls, sync and hash handling come from the starter unchanged.

## Chrome and mock

- Chrome tokens `--board-*` are fixed by the starter: one neutral sans stack, one monospace stack, no display serif, no web fonts. The verifier rejects a changed block.
- Mock primitives (`.m-btn`, `.m-pill`, `.m-alert`, `.m-tabs`, `.m-card`, `.m-input`, `.m-textarea`, `.m-table`, `.m-sheet`, `.m-dialog`) consume only `--app-*`. Match their proportions to the app's component files (height, padding, radius) and extend them per board when the app has a component the starter lacks. Fidelity target: a product owner cannot tell at a glance.
- The mock keeps its intended viewport inside `.frame` and scrolls there; the board wrapper never scrolls horizontally at 390 px or 1280 px. The board must not imply mobile behaviour the app does not have.
- When the app ships a dark mode, add a `.mock[data-app-scheme="dark"] { --app-… }` block from the token map's `dark` rows and declare a `scheme` dimension (`light`, `dark`) in the sections that show the mock; pass `scheme: selection.scheme` to `api.panes()` or as the third argument of `api.frame()` and the runtime sets `data-app-scheme` on the mock only. The verifier requires the scheme dimension whenever dark rows exist, and the board chrome stays light.
