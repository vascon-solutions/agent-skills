# Illustrated workflow maps in image-artifact

Status: accepted on 23 October 2026. The recipe-and-safeguards approach and recommended defaults are approved. Brainstorm started on 19 October against agent-skills `bdd85c0`; relevant helper and skill behaviour rechecked on 23 October against `68bf2c0`. Implementation, independent review, remediation and a ready PR are authorized. Pilots use synthetic material only.

## Problem

Product reviews sometimes need one picture that explains how a record moves through lifecycle statuses before and after a change. A useful composition combines a STATUS | BEFORE | AFTER matrix, separate exception rows, a numbered step strip and document distinctions.

This specification contains no proprietary source images, prompts, product names or local source-artifact paths. Examples and pilot workflows are synthetic.

`image-artifact` cannot produce this kind of image consistently today. Automatic routing sends it to `variant-board`. The helper's prompt plan cannot hold a status table or a numbered process. Nothing defines how branches, steps and documents must be drawn, how the result is checked, or what is kept.

## Current behaviour

| Observation | Evidence |
|---|---|
| `state` appears in both the UI regex and the variant regex, so one word satisfies both and the source is handed to `variant-board`. A backend note reading "The reconciler stores state in Postgres" exits 2 with the board handoff. | `skills/image-artifact/scripts/image-artifact-helper.js:141-143`; probe run on 2026-10-19 |
| "flow comparison" also satisfies both signals (`flow` is a UI word, `comparison` is a variant word). A process-comparison brief exits 2. | same lines; probe |
| A process note containing the word "request" infers `api-flow`. | `image-artifact-helper.js:145`; probe |
| The documented precedence "workspace metadata doc type ... before prose-only inference" is not implemented. `inferKind` reads only the Markdown prose. | `skills/image-artifact/SKILL.md:67`; `image-artifact-helper.js:138-150` |
| Explicit `--kind comparison-board` works, but the plan keeps only the first six `- ` bullets. Numbered lists and tables are dropped. It cannot preserve an ordered status matrix or numbered steps. | `image-artifact-helper.js:172-180, 206, 231` |
| The instructions route "before/after options" and "states" to `variant-board` even when the user asks for an image. | `SKILL.md:18, 68` |
| The skill is framed as low-text. Exact text and tables go to `html-artifact` or deterministic SVG. A matrix with about 40 short labels falls between these rules with no guidance. | `SKILL.md:16, 158-162` |
| "Regenerate", "refresh", "replace" or "update" overwrites the existing image, so a revised map would lose the earlier image and prompt. | `SKILL.md:102` |
| No prompt plan is written for a single image; the exact prompt survives only in the chat response. | `SKILL.md:138` |
| `metadata` on an image-only workspace appends a second `## Artifacts` heading and table header on every call instead of adding a row. | `image-artifact-helper.js:340-355`; probe |
| imagegen (a Codex system skill) has an `infographic-diagram` use case and a labelled prompt schema with `Text (verbatim)`. Its workflow already: inspects text accuracy, iterates one change at a time, writes versioned names instead of overwriting, copies the chosen output out of `$CODEX_HOME`, and reports the prompt and the mode used. | `~/.codex/skills/.system/imagegen/SKILL.md:42, 107-113, 151, 172-189` |
| `variant-board` owns before/after of UI drawn in the app's own design system, cited by version and scenario. Its description triggers on "a before/after board". | `skills/variant-board/SKILL.md:3, 8, 110-113` |

## Design risks

Prior local exploration identified these defect classes. Private samples are excluded from the deliverable.

1. **Exception connectors.** Long connectors can obscure their origin or imply a transition from a terminal status.
2. **Duplicate labels.** A prompt can request the same resulting status as both a badge and a bracket label.
3. **Incidental text.** Illustration hints can become unrequested rendered words.
4. **Readability.** Small text can become illegible at the intended display width.
5. **Retention.** Keeping only an image and prompt loses the source brief, inspection result and revision history.
6. **UI resemblance.** Generic process illustrations can drift into invented app windows or controls.

These observations establish inspection needs, not a measured generation success rate or validated text budget.

## Objectives

- The same brief produces the same composition and prompt structure, whichever agent or host does the work.
- The brief represents ordered statuses, valid exception branches, Before and After for each status, numbered steps aligned to statuses, roles and document distinctions.
- A fixed inspection checklist catches the defect classes above before an image is reported as done.
- The brief, the exact prompt, the tool mode and every image version are kept.
- Conceptual workflow maps stay distinct from UI mockups.
- The existing exact-text safeguards still apply.
- The existing `comparison-board` kind is reused; no new kind is added.

Non-goals:

- automated visual checking (OCR, layout detection)
- a new skill
- changes to imagegen
- screens or UI states
- backward transitions or loops (reopen, postpone)
- a map with only one side

## Approaches

| | A. Recipe and brief, helper guard | B. A plus helper compile and lint | C. New `workflow-map` kind or skill | D. Status quo |
|---|---|---|---|---|
| What changes | A linked recipe, a brief template and SKILL.md routing text. Small helper fixes. | Also `prompt-plan` parses the brief tables, validates them and writes the exact prompt. | A new kind with its own inference, filename and style, or a separate skill. | Nothing. Agents pass an explicit `--kind comparison-board` and write their own prompts. |
| Consistency | Fixed brief, prompt skeleton and checklist, filled in by the agent | Mechanical: the same brief gives byte-identical prompts | Like A or B | Depends on the agent |
| Fixes routing | Yes, through a declared recipe and the routing text | Yes | Yes | No |
| Fixes the lossy plan | The brief replaces the plan; the helper refuses to write a lossy one | Yes, by compiling it | Yes | No |
| Scope | 2 new docs, focused helper fixes and extensions to the existing helper tests | A plus a parser tied to the template and parser regression coverage | Largest; duplicates the generation contract and routing | None |
| Main risk | The agent's filled-in prompt drifts from the skeleton | The parser and template must change together | Overlapping kinds and triggers | Defects 1 to 3 recur |

**Accepted approach: A.** The defects actually observed came from composition (a duplicated label, connector geometry) and from missing inspection and retention. A recipe and a checklist address all of them. No structural error in the brief was observed that a lint would have caught.

Reconsider B if either of these happens within the first three maps:

- filled-in prompts diverge from the skeleton
- inspection finds a defect a brief lint would have prevented, such as a branch from a terminal status or a step placed in an unknown status

C is rejected: it adds a kind whose only difference from `comparison-board` is a recipe, and you asked to reuse existing kinds. D is rejected as the default: it leaves the misrouting, the lossy plan and the missing retention in place, and it produced defects 1 to 3.

Under every option, deterministic SVG or `html-artifact` remains the fallback when the image itself must carry exact text.

## Accepted design

### Files

```
skills/image-artifact/
├── SKILL.md                         routing, text policy, versioning, a workflow-map branch in Workflow, link to the recipe
├── references/workflow-map.md       new: the recipe
├── templates/workflow-map-brief.md  new: the brief template
└── scripts/
    ├── image-artifact-helper.js      declared recipe, guard, inference and metadata fixes
    └── image-artifact-helper.test.js extensions to existing tests
skills/variant-board/SKILL.md        one boundary line and one description clause
```

The template and the recipe live inside `image-artifact` so the skill stays self-contained, as `variant-board` keeps its own brief template.

### Routing: workflow map or UI board

Ask whether the picture claims how the product's screens look or behave. If it does, it is a `variant-board`. If it explains how people, documents and a record's lifecycle statuses move, drawn with generic illustrations, it is a workflow map.

- Lifecycle statuses (DRAFT, RESERVED, ACTIVE) are domain states. They are not UI states such as empty, loading or error.
- Steps name actions and outcomes ("Download return receipt"). They do not name controls or their placement ("the Download button in the header").
- If reviewers also need to see a screen in some status, build a variant board as well. The brief can link to it.
- If a request could be either, ask one question: an illustrated process map, or the app's screens?

SKILL.md:18 narrows from "before/after options" to "before/after of UI screens, UI states or options drawn in the app's design system". The inference list starts with the declared recipe. The `variant-board` boundary gains one line: conceptual workflow maps without screens belong to `image-artifact`. Its description gains a matching "not for" clause, because descriptions are what select a skill.

### Brief

Location: `~/agent-artifacts/<topic>/markdown/<map>-brief.md`. Like `variant-board`'s brief, it has a bullet header and fixed tables. The brief is derived from the authoritative spec, PR or code. When they disagree, the source wins and the brief is revised.

Header bullets:

- recipe
- map id
- title and subtitle
- audience and display context, including the intended display width
- authoritative source
- emphasis row
- aspect ratio
- layout (`single` or `split`)
- process side (`Before` or `After`, default `After`), used by the progression arrows and step strip
- text mode (`illustrative` or `exact`)
- brief version

Sections:

| Section | Holds |
|---|---|
| Sources | One row each for Before and After, with a header label (for example "Before the change"), evidence at a recorded revision, evidence basis (`observed` or `supplied historical material`) and claim status. Before is `current` or `historical`; After is `proposed`, `approved`, `merged` or `released`. A merged PR is not evidence of a release or successful runtime acceptance. |
| Statuses | Order, status, path (`main`, `terminal` or `exception`), presence on each side and, for exceptions, the origins on each side. The ordered main path includes the terminal row. This recipe supports one shared forward order; differing orders or loops need another composition. |
| Matrix | Two rows per status, Before and After: label, optional secondary label, and an illustration hint containing no words to render. A side may say `No change` or `Not present`; it is never left blank or filled with invented content. |
| Steps | Number, action, role, the status the step happens in, an optional resulting status, and an illustration hint. Steps describe one declared side, After by default. |
| Roles | Role, what it can do, and whether it appears as a chip on steps or in a footer note. |
| Documents | Document, what kind it is (input, working document or record), the statuses where it is available on each side, and what it must not suggest (for example "signed"). |
| Accuracy constraints | Invariants from the source, such as the synthetic rule "Saving a draft never closes a checkout". |
| Allowed repeats | Exact string, permitted regions and count. Status names in exception origins and step brackets must be listed here if repeated. |
| Footer | Role note, document-distinction callout, and a provenance line derived from the After claim status. |
| Revisions | One row per image version (see Retention). |

Brief rules the agent checks before writing a prompt:

1. Status names are unique. The main path is ordered 1 to n with no gaps, and its last status is terminal. Presence on each side is explicit.
2. For each side where it exists, every exception branches from one or more non-terminal statuses present on that side. Nothing branches from a terminal status. Differing origins are written separately in the corresponding Before and After cells.
3. Every status has both a Before and an After row. A status that exists on only one side reads `Not present` on the other.
4. Steps are numbered 1 to N with no gaps, and each happens in a status on the declared side's main path, including its terminal status. Step statuses never move backwards. Only the last step in a status may name a resulting status, and that must be the next status present on that side's main path. A terminal status has no resulting status.
5. Every step role appears in Roles. Every document named in a label appears in Documents, and no label contradicts that document's availability.
6. The headers and provenance match both sides' source status and evidence basis. Repeated strings have declared regions and counts.
7. The text budget holds (see Text policy).

Option B would automate exactly these seven checks.

### Composition and prompt

The image has fixed regions, from top to bottom:

1. title and subtitle
2. the matrix (STATUS | BEFORE | AFTER, with the claim tag)
3. exception rows, visually separated below the main rows
4. the numbered step strip
5. a footer band

Rules:

- **Progression arrows.** These appear only in the status column, between consecutive main-path statuses present on the declared process side. Name that side beside the progression or strip. The shared matrix does not claim a complete transition graph for the other side.
- **Exception origins.** Each exception row states where it comes from in text, worded "From RESERVED or ACTIVE". Origins shared by both sides appear once; differing origins sit in their respective Before and After cells. Short coloured stubs may mark the source rows. Long exception connectors are omitted. Text makes the origin checkable without relying on drawn routing (defect 1).
- **Repeated text.** Each string appears once unless the brief allows a repeat, such as a status name reused as a bracket label. A resulting status appears as a single end badge after the last step. Illustration hints contain no words (defects 2 and 3).
- **Roles.** Roles appear as chips on steps only when two or more roles act in the strip. Otherwise they go in the footer note.
- **Palette.** The colours carry meaning: neutral grey for Before, green for additions and After emphasis, muted red for exceptions. The palette ignores the app's brand. `--use-repo-design` may supply vocabulary (status, role and document names) but never colours, so the map does not pass for the app.
- **Illustrations.** Draw people, paper documents and forms, calendars, devices, signatures and archives. Draw documents as the Documents table describes them. Never draw app windows, navigation, buttons, menus or screenshots. No logos and no watermarks (defect 6).
- **Text tiers.** A cell holds at most two text tiers.

The recipe gives a prompt skeleton that maps onto imagegen's schema without naming a vendor:

- `Use case`: infographic-diagram
- `Asset type`: the display context from the brief header
- `Composition`: the regions above, in order
- `Text (verbatim)`: every string from the brief, grouped by region and row
- `Constraints`: accuracy constraints, exception origins, document distinctions and permitted text occurrences
- `Avoid`: screenshots, UI chrome, extra copy, logos and watermarks

The filled-in prompt is saved byte for byte before generation.

### Text policy

The default mode is `illustrative`. Labels are requested verbatim, and inspection checks them against the brief. The brief stays authoritative; the image illustrates it. This keeps the existing rules: images are not the source of truth, and an image's accuracy is not claimed without visual inspection.

Accepted provisional budget, to be calibrated:

- at most 45 required text items per image, counting each intended occurrence, including repeats, role chips, document labels and numerals
- at most 3 strings per cell
- matrix and step strings of 8 words or fewer
- footer notes of 14 words or fewer
- two text tiers

These are initial authoring limits, not measured generation guarantees. The pilot must record both the item count and readability at the intended display width.

Over budget, use the `split` layout (one matrix image and one step-strip image) or move secondary text back into the brief. Do not shrink the text. Each split image has its own title, side and claim context, and must meet the budget independently.

`exact` mode is for an image that readers will copy from or rely on word for word: formal records, identifiers, routes, permission strings. The existing safeguard applies there: `html-artifact` first, or hand-written deterministic SVG reusing the same brief with simple icons. Generated images are not used in `exact` mode.

### Inspection checklist

Run the checklist on every version, including edits, and record each failure in the revision log.

1. Every main status appears once, in brief order. Exception rows are separate.
2. Progression arrows join only consecutive main-path statuses present on the relevant side. Nothing leaves a terminal status.
3. Each exception's stated origins match the brief for each side. No long exception connector is drawn.
4. Before and After content sits in the right row and column.
5. Steps are numbered 1 to N in reading order, each with its brief label. Brackets cover the right steps. A resulting status appears once.
6. Every rendered string is in the brief, spelled as written there. Repeats match the declared regions and counts. Document names rendered inside illustrations must also be declared text; hints never authorize extra words.
7. At the brief's display width, every required string is readable.
8. Documents are drawn as their distinctions require. Unavailable documents do not appear in rows where they are unavailable.
9. Headers, claim tag and provenance match the source statuses and evidence basis. Supplied historical material is identified as unverified against current behaviour.
10. Nothing looks like the app's UI. No logos and no watermark.

If the host cannot view images, the version is recorded as `unverified` and is not presented as accurate. This matches the existing file-level validation rule.

### Revisions and fallbacks

- Every generation or edit writes a new version, `<map>.v<N>.png`. Workflow maps are never overwritten, including on "regenerate". This is a deliberate exception to `SKILL.md:102`, and it matches imagegen's own versioning rule.
- Use an edit of the previous version for a local defect, such as a duplicate label or one stray connector. Regenerate for a structural defect, such as a missing row or the wrong order. Keep a local edit focused and rerun the whole checklist after every attempt.
- After three failed attempts, stop and offer three choices: switch to the `split` layout, switch to deterministic SVG, or accept the image with its known defects listed in the revision log. Accepting needs the user's decision.
- When the source changes (a PR merges or behaviour changes), raise the brief version and generate a new image version. Earlier versions stay and are marked superseded.

### Retention

```
~/agent-artifacts/<topic>/
├── markdown/<map>-brief.md        brief and revision log
├── images/<map>.v<N>.png          every version, never overwritten
├── images/<map>.v<N>.prompt.txt   exact prompt, or the edit instruction plus the base version
└── metadata.md                    one row per version: comparison-board, brief, image, tool mode
```

For `split`, use `<map>.v<N>.matrix.png` and `<map>.v<N>.steps.png`, each with a matching `.prompt.txt`. Both parts share a version. A local edit creates a new set; copy the unchanged part and its prompt under the new number and record its source version. Inspect both parts before marking the set current. Deterministic SVG uses the same naming with `.svg`.

The image-only metadata table has one row per version and part. In an existing Markdown artifact table, add the versioned paths to the matching source row. Preserve the existing table shape. The brief's revision log records inspection and disposition in either case.

Revision log columns:

- version
- date
- brief version
- mode (`generate`, or `edit of vN`)
- tool mode
- prompt file
- image file
- the host's original output path
- inspection result
- disposition (`pending generation`, `pending inspection`, `current`, `superseded` or `accepted with defects`)

Also record the part (`single`, `matrix` or `steps`), rendered item count, intended display width, inspection failures and any copied source version. A prompt-only or unverified attempt is never marked current; record it as pending generation or inspection.

Tool mode records only what the host reports. Possible values are `imagegen built-in`, `imagegen CLI <model> <quality> <size>`, `prompt only` (no generator available) and `deterministic SVG`. A model name is never guessed (existing rule, `SKILL.md:224`).

The workspace copy is canonical. Save the exact submitted prompt before generation, or the exact edit instruction with its base image version. In a host with no image generator, save the brief and next version's prompt, recorded as `prompt only`; the image can then be generated in a host that has one. A prompt-only attempt does not supersede an inspected image.

### Helper changes

1. **Declared recipe.** A source whose header bullets include `- Recipe: workflow-map` resolves to `comparison-board` without prose inference. It is never handed to `variant-board`, whatever words it contains.
2. **Guard.** `prompt-plan` and `prompt-pack` on a declared workflow-map brief exit non-zero, write nothing, and point to `references/workflow-map.md`. Check the declaration before creating directories or applying `--kind`; explicit kind flags cannot bypass this guard. The brief is the plan and the exact prompt is the pack; the generic six-bullet output would lose information.
3. **Inference fix.** One word can no longer count as both the UI signal and the variant signal; this removes the `state` double count. Undeclared sources that read as UI documents with variants still hand off. The handoff message also names the workflow-map recipe for conceptual process maps.
4. **Metadata fix.** When an image-only table already exists, `metadata` adds a row to it instead of appending a new section.

Changes 3 and 4 fix existing defects and could ship as separate commits. `board-snapshot`, `validate` and every other route stay unchanged.

The routing documentation must describe the implemented precedence. Remove its unsupported workspace-metadata inference claim; adding metadata-based classification is outside this change. Do not broaden this work into a general inference rewrite.

### Boundaries

- **`variant-board`** keeps UI boards showing screens, UI states or options in the app's design system, with its existing issuance and citation rules. Like workflow maps, these boards are discussion aids; runtime acceptance requires its own evidence.
- **`html-artifact`** stays the home for faithful readable text, and its `svg-figure-sheet` is one route for `exact` mode. No change is needed there.
- **imagegen** is used as is. The recipe feeds its schema and workflow and does not restate its mode rules.
- **`markdown-artifact`** may hold the authoritative spec that the brief cites. The brief itself comes from the template.

Specs and task docs may link a workflow map as an illustration by naming its brief version and inspected image version, plus the part for split maps. The authoritative claims remain in the source and brief; linking a map never makes it a UI board or runtime acceptance evidence. Amend `variant-board`'s broad "cited companion" boundary to apply to UI mockups, while allowing conceptual workflow-map illustrations.

## Validation criteria

Helper behaviour, as permanent tests extending the existing routing test (`image-artifact-helper.test.js:140-155`):

- A declared workflow-map brief is recognized before prose inference even when it contains "state", "flow comparison" and "before/after". `prompt-plan` and `prompt-pack`, including calls with explicit kind flags, write no files or directories and point to the recipe. This extends the existing CLI routing test to prevent silent loss of source information.
- The existing UI-board source still hands off.
- A backend note that mentions "state" no longer hands off.

Metadata: one new test, since `metadata` has no coverage today. Calling it twice on an image-only workspace must leave one table with two rows. The durable risk is a corrupted workspace record.

No permanent tests for the recipe or template text: that would test presentation only.

Runtime pilot, run as an acceptance check rather than a permanent test:

- Write briefs for two workflows: synthetic equipment checkout and workshop registration, to show the schema generalises.
- Generate each in a host with an image generator.
- Run the checklist on each, and record versions, prompts, rendered item counts, display widths and inspection results. Exercise a local edit and retain both versions. Use the split layout if either brief exceeds its per-image budget.

The pilot also calibrates the text budget.

## Decision record

The design approval covers these decisions on 23 October 2026:

1. **Helper scope.** Use approach A, the recipe, brief and helper guard. Defer compile and lint until the evidence described under Approaches warrants reconsideration.
2. **Versioning.** Preserve every workflow-map image version and its exact submitted prompt, including on regeneration or edits.
3. **Citation.** Link the brief and an inspected image version as illustration. UI mockups keep `variant-board`'s citation rules; runtime acceptance needs separate evidence. Narrow `variant-board`'s rule that every cited companion counts as a board.
4. **Text budget.** Start with 45 text occurrences, 8-word labels and two tiers, then calibrate through the two pilot maps. The pilot must validate these limits.
5. **Exception rendering.** State origins in text, with optional short stubs. Omit long exception connectors.
6. **Skill discovery.** Update `variant-board`'s description and Boundaries section so conceptual workflow maps select `image-artifact`.

There are no unresolved design choices. Pilot results may justify changing the provisional text limits or revisiting helper compilation. The implementation pilot is recorded below; delivery verification is recorded separately.

## Implementation pilot

The implementation pilot used synthetic equipment checkout and workshop registration, with 29 and 31 required text occurrences. Both passed the recipe's ten-point inspection at 1200 CSS pixels. A local equipment-map edit removed unrequested handwriting inside a document illustration; the failed original, exact prompts and replacement remain in the external pilot workspace.

These results support the recipe at the observed text counts. They do not validate the full 45-occurrence ceiling, split composition or exact mode. The provisional limits remain guidance, and the pilot provides no reason to add a compiler.

## Out of scope

- Maps with only one side (a current process with no comparison)
- Backward transitions and loops
- More than one step strip per image
- Automated image checks
- Changes to imagegen, `html-artifact` or `artifact-workbench`
- Importing proprietary source artifacts or product details. Only synthetic briefs and newly generated pilot outputs are permitted.
