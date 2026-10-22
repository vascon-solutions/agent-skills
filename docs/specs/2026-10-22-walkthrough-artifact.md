# Accepted: walkthrough-artifact skill

Status: accepted on 22 October 2026, from a brainstorm read against agent-skills `bdd85c0`. No skill, helper or test changes have been made.

## Problem

Product reviews need a step-by-step walkthrough of shipped features running on a non-production environment. It needs real screenshots, a PDF copy, and a record of where each image came from and what was changed to capture it. Three walkthroughs were built by hand for a client product:

- `~/agent-artifacts/<client>-contract-milestones/walkthrough/`
- `~/agent-artifacts/<client>-qa-modifications/walkthrough/`
- `~/agent-artifacts/<client>-qa-modifications/walkthrough-rows-15-18-19/`, captured through audit-ui journey mode in `~/agent-artifacts/ui-audits/qa-rows-15-18-19-walkthrough/20261017T091229Z/`

Each time, someone copied the template, wrote a print wrapper and printed with Chrome by hand. They then checked the render, ran unslop by its real path, copied the PDF and published through the host Artifact tool. No skill prints or makes PDFs.

## Current behaviour

| Observation | Evidence |
|---|---|
| The pages have 27, 22 and 24 sections and 25, 18 and 21 images. The PDFs are 5.0, 2.8 and 3.2 MB, A4 landscape, and have one page per section. | Folder listings; PDF page objects counted on 2026-10-19 |
| The screen file is an HTML fragment with no doctype, shaped for the host Artifact tool. `print.html` differs only by the doctype, head and body tags. | `diff` of the rows 15-18-19 pair |
| Chrome (Skia) writes one uncompressed `/Type /Page` object per page, so page count needs no dependency. | Grep of all three PDFs |
| The manifest drifted from the page in 2 of 3 walkthroughs: the first lists 14 `screenshots/` paths while the page uses 25 `img/` files; the third says "20 screenshots" and "No PDF built" after revisions added a 21st image and a PDF. | The three `manifest.md` files |
| Curated images are renumbered from raw captures (audit `15-04` is the portal Accept; page `15-04` is the public confirm page), and no manifest line names its source capture. | Audit `screenshots/`; rows 15-18-19 manifest |
| Accounts, created records and cleanup appear in both the audit `report.md` and the walkthrough manifest. | Audit `report.md` "Created Records" and "Cleanup"; manifest "Accounts" and "Mutations" |
| A Mailpit capture was added to the audit run an hour after `report.md` was written, and the report was not updated. Renders of the walkthrough page were also kept in the audit's `logs/`. | Audit `screenshots/15-03a-*` (11:35) vs `report.md` (10:35); `logs/v2-*.png` |
| No captured image needed pixel redaction: Mailpit's HTML tab shows buttons, not URLs, and the invite page removes its token from the address bar. | `img/15-03-mailpit-invite-adhoc.png`; rows 15-18-19 manifest |
| The status table first appeared in the 14 Oct walkthrough (20 rows) and was copied as HTML into the next one. Five colour tones carry free label text ("Live on dev", "Partly live", "API only, UI pending"). | Both qa-modifications pages |
| html-artifact converts existing Markdown, requires a single file and a doctype, and rejects a non-data-URI `<img>`. | `skills/html-artifact/SKILL.md:10, 158-165`; `scripts/verify-layout-artifact.js:49, 82` |
| audit-ui is audit-only, completes an adopted brief once, defaults to 12 screenshots and never captures secrets. The screenshot limit is a brief field. | `skills/audit-ui/SKILL.md:11, 38-39, 61, 116, 160`; `assets/templates/audit-brief.md:36` |
| publish-artifact has no claude.ai destination and its secret scan skips images. | `skills/publish-artifact/SKILL.md:10, 200` |
| image-artifact finds headless Chrome but does not export the function. | `skills/image-artifact/scripts/image-artifact-helper.js:431` |
| artifact-workbench single-file mode serves the HTML file's folder as the asset root, so `img/` previews. | `skills/artifact-workbench/scripts/serve-artifact-workbench.js:97-104, 434` |
| Adding a skill also means adding it to `SKILL_NAMES` in `bin/link-skills.sh`, enforced by a test. `npm test` runs only `tests/*.test.mjs`. | `README.md:354-369`; `tests/skills-portability.test.mjs:163`; `package.json` |
| Global skills must contain no repo-specific paths, enums or domain rules. | `README.md:373` |

## Decisions

1. **Page source.** One complete HTML document with `@media print`, printed directly. No wrapper and no `print.html`.
2. **Images.** Never embedded as data URIs. claude.ai receives `img/` through the Artifact `files` map; the PDF is the single-file copy.
3. **Capture.** Every capture of the app or mail sandbox goes through audit-ui. A follow-up capture is a new small run under the same audit slug, not an edit to a finished run. Render checks of the walkthrough page go to scratch, never the audit folder.
4. **Status table.** Optional. Rows live in manifest.md under `## Status` with five fixed tones (done, partial, info, neutral, blocked) and free label text. The next walkthrough copies that table, and `check` compares the page against it.
5. **Screenshot limit.** Audit-ui keeps its default of 12; the walkthrough's audit brief sets a per-item range and a total.
6. **Placement.** A global skill in this pack. Accent, environment label, scope unit, status labels and allowed origins come from the brief. An origin allow-list replaces production-URL detection.

## Design

**Purpose.** Produce a product-audience walkthrough of shipped features running on a non-production environment: one HTML page of real screenshots, an A4 landscape PDF of it, and a manifest.

**Not for.** Acceptance verdicts (audit-ui), Markdown companions (html-artifact), UI variants (variant-board), conceptual workflow images (image-artifact, see `2026-10-19-image-artifact-workflow-maps.md`), or production environments.

### Skill files

```
skills/walkthrough-artifact/
  SKILL.md
  starter.html                         complete document: tokens, page types, @media print
  templates/manifest.md
  references/capture.md                what the audit-ui brief must say; image inspection checklist
  references/hosts.md                  claude.ai publish with the files map; other hosts unverified
  scripts/walkthrough-artifact.js      check | pdf
  scripts/walkthrough-artifact.test.js
  fixtures/walkthrough/                3-page synthetic walkthrough with tiny PNGs
```

### Output

```
~/agent-artifacts/<topic>/walkthrough[-<scope>]/
  <name>.html        the page, and the print source
  <name>.pdf
  img/<item>-<nn>[a-z]-<slug>.png
  manifest.md
```

Raw captures stay in `~/agent-artifacts/ui-audits/<slug>/<run>/` and are linked, never copied.

### Workflow

1. **Brief.** Collect the scope unit and items, the environment label and allowed origins, and the served builds with how they were confirmed. Also collect accounts and the credential source (never the password), allowed demo changes and their marker text, and audit runs to adopt. Finally collect the previous walkthrough to carry the status table from, the accent colour and status labels. Write them at the top of manifest.md; there is no separate brief file.
2. **Evidence.** Adopt an audit run only when its recorded builds match what is served. Otherwise write an audit-ui journey brief following `references/capture.md`. It sets a screenshot limit per item plus a total, demo changes carrying the marker text, one session per account and logout-all at the end. Cleanup is recorded in `report.md`, and in Mailpit only the HTML tab is captured (never Text, Raw, Headers or Link Check). A top-up capture is a new run.
3. **Curate.** Copy chosen captures to `img/`. Each manifest line gives actor, record, screen and `from: <run>/screenshots/<file>`. Inspect every image for token URLs, passwords, personal data beyond seeded test accounts and hostnames outside the allow-list. Recapture through audit-ui instead of editing pixels.
4. **Build.** Copy `starter.html` and fill the cover and the overview (what changed, who does what, step strip). Add the optional status page from `## Status` and one page per step (screenshot, "actor · record · screen" caption, heading, text, optional note). End with an optional closing page for API-only or not-pictured items. Set `--accent` and `--env-label` from the brief.
5. **Check.** Run unslop's scanner on the page text and manifest, then `walkthrough-artifact.js check`.
6. **Print.** Run `walkthrough-artifact.js pdf`, then read the PDF page by page for clipped text, since each `.page` hides overflow.
7. **Preview and publish.** Preview with artifact-workbench single-file mode. Publish to claude.ai only when asked, following `hosts.md`, and record the URL under Revisions. Copy the PDF elsewhere only when asked.

The manifest links the audit report for accounts, created records and cleanup evidence and keeps only a one-line summary of each.

### `check`

Reports every failure, not just the first. It fails when:

- the doctype or cover-first order is missing, or the starter's print block is altered
- an `<img>` points outside `img/`, or its file is missing
- a file in `img/` is unused or has no manifest line
- a manifest line names a missing file, or a missing raw capture when the audit run is present
- an image has empty alt text, or a step figure has no caption
- the page loads anything remote
- the page or manifest contains a URL whose origin is not on the allow-list
- the text contains a JWT, `token=`, `access_token` or `Bearer `
- the page status table differs from `## Status` in items, tones or labels

It prints page count, image count and total size, so the manifest does not carry them as prose.

### `pdf`

Finds Chrome (`CHROME_BIN` or standard install paths, copied from `image-artifact-helper.js:431`), prints `<name>.html` to `<name>.pdf` without a browser header or footer, and fails unless the PDF's page objects equal the `section.page` count. No dependencies.

### Changes outside the skill

- html-artifact, When Not To Use: product walkthroughs of a running environment go to walkthrough-artifact.
- audit-ui: one line saying walkthrough briefs come from walkthrough-artifact and set their own screenshot limit and capture rules.
- README: directory tree, Skills table row, usage scenario.
- `SKILL_NAMES` in `bin/link-skills.sh`, then run the link script.
- No change to image-artifact, publish-artifact or artifact-workbench.

## Tests

Regression risks:

- the manifest drifting from the page (observed in 2 of 3 walkthroughs)
- a token or unlisted host reaching a published page
- a status table no longer matching its manifest rows
- a PDF with extra or missing pages

One test file runs against the fixture and covers each `check` failure, plus the page counter on a small committed Chrome PDF so the test needs no Chrome. Run with `node --test skills/walkthrough-artifact/scripts/walkthrough-artifact.test.js`. The `SKILL_NAMES` entry is already covered by `tests/skills-portability.test.mjs`. No other layer is added.

## Acceptance pilot

1. In a scratch copy, rebuild the 17 Oct rows 15, 18 and 19 walkthrough from its existing audit run. `check` passes and the PDF has 24 pages.
2. Run `check` on a copy of the contract-milestones walkthrough and confirm it reports the `screenshots/` vs `img/` drift.
3. Publish to claude.ai only if asked; that publish shows whether the host accepts a full document unchanged.

## Open, to settle during implementation

- Whether claude.ai accepts a full document unchanged. If not, the publish step strips the outer document tags.
- The Chrome flag that removes the print header and footer on the installed version.
- Clipped text is found by reading the PDF, not by the script.

## Alternatives rejected

- Extending html-artifact: its Markdown-source and single-file rules do not fit, and embedding would make 3-5 MB pages.
- Putting it in audit-ui: audit-ui is audit-only.
- Audit evidence alone: walkthroughs need demo records an acceptance audit does not create.
- Status quo: the manifest drifted in 2 of 3 walkthroughs, and the same manual steps repeated every time.
