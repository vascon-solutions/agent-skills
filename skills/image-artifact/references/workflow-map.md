# Illustrated workflow maps

Read this recipe when an existing source needs a conceptual Before and After map of people, lifecycle statuses, actions and documents. Use the existing `comparison-board` kind. UI mockups and UI state comparisons belong to `variant-board`.

## Prepare the brief

Copy [the brief template](../templates/workflow-map-brief.md) to `markdown/<map>-brief.md` in the artifact workspace. Derive it from the authoritative source, recording its revision and the basis for every claim. Synthetic examples must say they are synthetic. A merged PR does not establish a release or successful runtime acceptance.

Keep `- Recipe: workflow-map` in the bullet header before the first level-two heading. The generic helper's `prompt-plan` and `prompt-pack` commands reject this declaration before writing anything, including with explicit kind flags. Fill the prompt below directly from the brief; do not remove the declaration to obtain the generic six-bullet plan.

The recipe supports one shared forward lifecycle order, Before and After content for each status, separate exceptions, and one step strip for a declared process side, After by default. The ordered main path includes its terminal row. A side without a status says `Not present`; unchanged content may say `No change`. Different lifecycle orders, loops and single-sided maps need another composition.

Before prompting, check:

1. Status names are unique, the main path is numbered without gaps, and its last status is terminal. Presence on each side is explicit.
2. Every exception has non-terminal origins present on the relevant side. List differing origins separately for Before and After.
3. Every status has both comparison cells, including explicit absence or unchanged content.
4. Steps run from 1 to N without gaps. Each happens in a main-path status on the declared side, including terminal statuses where appropriate. Statuses never move backward. Only the last step in a status may name the next present main-path status as its result. Nothing leaves a terminal status.
5. Step roles exist in Roles. Named documents exist in Documents, and labels and illustrations respect their availability and distinctions.
6. Headers, claim tags and provenance match source status and evidence basis. Every repeated text occurrence is declared with its regions and count.
7. The per-image text budget and intended display width are explicit.

## Compose the image

Use these regions in order:

1. Title and subtitle.
2. STATUS | BEFORE | AFTER matrix, with a truthful After claim tag.
3. Exception rows separated from the main rows.
4. Numbered step strip, labeled with its process side.
5. Footer with role notes, document distinctions and provenance.

Progression arrows appear only in the status column and join consecutive main-path statuses present on the declared process side. Label that side. The shared matrix does not establish a complete transition graph for the other side.

State exception origins in words, for example `From RESERVED or ACTIVE`. Shared origins appear once; differing origins appear in the relevant comparison cells. Optional short stubs can mark source rows. Omit long exception connectors, especially ones passing a terminal row.

Each text item appears only at its declared locations. A resulting status has one end badge after the relevant step; avoid requesting both a badge and a bracket with the same result. Brackets identify the steps actually performed in their named status, not the status reached afterward. Roles use chips only when multiple roles act in the strip; otherwise use a footer note.

Draw people, paper, calendars, tools, devices, signatures and archives. Illustration hints describe shapes and actions, never additional words. Do not draw app windows, navigation, buttons, menus or screenshots. No logos or watermarks.

Use neutral grey for Before, green for additions and After emphasis, and muted red for exceptions. Do not apply the product's visual theme. `--use-repo-design` may supply verified status, role or document vocabulary only. Keep cells to two text tiers.

## Text and layout

Default to `illustrative` mode. Request labels verbatim and inspect them against the brief. Markdown remains authoritative.

Start with these provisional per-image limits:

- 45 required text occurrences, including headings, repeats, role chips, document labels and numerals.
- Three text items per cell and two text tiers.
- Eight words per matrix or step label.
- Fourteen words per footer note.

These limits are authoring guidance, not a generation guarantee. Count every occurrence, including planned repeats. Do not shrink text to fit. Remove secondary text or use `split`, with one matrix image and one step-strip image. Give each part its own title, side and claim context and apply the limits independently. Inspect at the brief's intended display width.

Use `exact` mode when readers must copy or rely on the image's precise wording, such as identifiers, routes or permission strings. Use `html-artifact` or deterministic SVG with simple icons, derived from the same brief. Do not use image generation in exact mode.

## Fill and retain the prompt

Use this skeleton. Replace placeholders from the brief; do not invent source content. The filled prompt must enumerate the required text by region and row, including allowed repeated occurrences.

```text
Use case: infographic-diagram
Asset type: <audience and display context; intended display width>
Primary request: <title, Before and After scope, process side, source status>
Composition: <single or split part; aspect ratio; ordered regions; emphasis row>
Visual style: white editorial background, charcoal text, neutral grey Before,
green additions and After emphasis, muted red exceptions, generic illustrations.
Text (verbatim):
<every required occurrence grouped by region, status row, side and step number>
Illustrations:
<word-free hints by region; document kinds and availability from the brief>
Constraints:
<accuracy invariants; main-path order and process side; exception origins in words;
allowed text occurrences; step brackets and result badge; roles; truthful provenance>
Avoid: screenshots, app chrome, invented copy, long exception connectors,
unlisted repeated labels, logos, watermarks, unreadable small text.
```

Save the exact submitted prompt before generation. Follow the host's image-generation workflow and record only the tool mode it reports. Never guess a model. If generation is unavailable, keep the next version's prompt with `prompt only` mode and `pending generation` disposition; do not claim an image exists.

## Inspect every version

Use this checklist for every generation and edit, including unchanged parts of a split set:

1. Main statuses appear once and in brief order; exceptions are separate.
2. Progression arrows connect consecutive main-path statuses present on the declared process side. Nothing leaves a terminal status.
3. Exception origins match each side's brief. No long exception connectors appear.
4. Before and After content occupies the correct row and column.
5. Steps run from 1 to N in reading order with their exact labels. Brackets cover the right steps and each resulting status appears once.
6. Every rendered word and numeral is declared. Spelling, occurrence counts and locations match the brief, including labels inside illustrations.
7. Every required item is readable at the intended display width.
8. Documents respect their kind, availability and distinctions. No working document implies a signed or final record unless the source supports it.
9. Headers, claim tag and provenance match the source evidence. Unverified historical material and synthetic material are labeled accordingly.
10. Nothing resembles the product's UI. No logos or watermark.

Record specific failures in Revisions. If images cannot be viewed, record `unverified` inspection and `pending inspection` disposition. File-level validation alone does not establish accuracy.

## Revise and retain

Every generation or edit creates a new version, including requests to regenerate. Keep earlier images and prompts. This recipe overrides the ordinary image replacement and optional prompt-sidecar defaults.

```text
markdown/<map>-brief.md
images/<map>.v<N>.png
images/<map>.v<N>.prompt.txt
metadata.md
```

For a split set, use `<map>.v<N>.matrix.png` and `<map>.v<N>.steps.png`, each with a matching `.prompt.txt`. Both parts share a version. A local edit creates a new set; copy an unchanged part and its prompt under the new number and record its source version. Inspect the full set before marking it current. Deterministic outputs use `.svg` with the same version scheme.

Edit the prior image for a local defect; regenerate for a missing row, wrong order or other structural failure. Keep local edits focused and rerun the whole checklist. Save the exact edit instruction, base version and any copied source version. Raise the brief version when source claims change. Mark an earlier current version superseded only after its replacement passes inspection.

After three failed attempts, stop and present the remaining choices: split the composition, use deterministic SVG, or accept listed defects. Acceptance with defects requires the user's decision.

Keep the workspace copy canonical. Update image-only metadata with one row per output version and part. For an existing Markdown artifact table, append versioned paths to its source row without changing its columns. The brief revision log carries prompts, tool mode, original host output path, inspection details and disposition. A prompt-only attempt never supersedes an inspected image.

Specs and task docs may cite the brief version and inspected image version, naming the part for split sets, as illustration. The authoritative source and brief carry the claims. A citation does not turn a conceptual map into a UI board or runtime acceptance evidence.
