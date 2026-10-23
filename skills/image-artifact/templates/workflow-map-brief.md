# <Map title>

- Recipe: workflow-map
- Map id: <stable slug>
- Title: <exact rendered title>
- Subtitle: <exact rendered subtitle>
- Audience and display context: <audience, channel and intended width in pixels>
- Authoritative source: <source and recorded revision>
- Emphasis row: <status or none>
- Aspect ratio: <ratio>
- Layout: <single or split>
- Process side: <Before or After; default After>
- Text mode: <illustrative or exact>
- Brief version: 1

## Sources

| Side | Rendered header | Evidence and revision | Evidence basis | Claim status |
|---|---|---|---|---|
| Before | <header> | <source> | <observed or supplied historical material; identify synthetic sources> | <current or historical> |
| After | <header> | <source> | <basis> | <proposed, approved, merged or released> |

## Statuses

The main path includes the terminal row. Order it without gaps; put exceptions separately. Record presence and exception origins for each side. The shared order must fit both sides.

| Order | Status | Path | Before present | After present | Before exception origins | After exception origins |
|---|---|---|---|---|---|---|

## Matrix

Two rows per status, one per side. Use `No change` or `Not present` explicitly when appropriate. Illustration hints contain no words to render.

| Status | Side | Label | Optional secondary label | Optional third text item | Illustration hint |
|---|---|---|---|---|---|

## Steps

Number from 1 to N. Steps describe the declared process side. Statuses never move backward; a result can name only the next status present on that side's main path, on the last step within the prior status.

| Number | Action | Role | Happens in status | Optional resulting status | Illustration hint |
|---|---|---|---|---|---|

## Roles

Use chips only if multiple roles act in the step strip; otherwise put the role in the footer.

| Role | Permitted actions | Placement, chip or footer |
|---|---|---|

## Documents

| Document | Kind, input or working document or record | Before availability | After availability | Must not imply |
|---|---|---|---|---|

## Accuracy constraints

Record source-backed invariants. Keep assumptions explicit and resolve consequential gaps before prompting.

## Footer

| Item | Exact text |
|---|---|
| Role note | <text or not rendered> |
| Document distinction | <text or not rendered> |
| Provenance | <text matching source status and evidence basis> |

## Rendered text and allowed repeats

Inventory every occurrence, including headings, status labels, exception origins, brackets, role chips, document labels and numerals. Names inside illustrations are rendered text too. Explicitly identify permitted repeat locations and counts. Each cell has at most three items and two text tiers.

| Exact text | Permitted region or regions | Occurrences per part | Repeat rationale, if any |
|---|---|---|---|

Required occurrences: <count per single image or per matrix and steps part>. Initial per-image limits are 45 occurrences, eight words per matrix or step label, fourteen per footer note and two text tiers. Reduce secondary text or split rather than shrinking text.

## Revisions

Start with no entries. Add one row per attempt and part. Dispositions are `pending generation`, `pending inspection`, `current`, `superseded` or `accepted with defects`. Only inspected outputs may be current. Retain failed attempts and record the specific checklist failures.

| Version | Part | Date | Brief version | Mode, generate or edit of version | Tool mode | Prompt file | Image file | Original host output path | Count and display width | Inspection result and failures | Disposition | Copied source version |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
