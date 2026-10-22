---
name: walkthrough-artifact
description: "Use when someone wants a step-by-step walkthrough of shipped features as they run on a non-production environment, for a product or business audience: real screenshots on one HTML page, an A4 PDF of the same page, and a manifest of where each image came from and what was changed to capture it. Use it for requests such as a product walkthrough, a screenshot walkthrough of a release or QA sheet, a demo deck from the dev or staging site, or a new revision of an earlier walkthrough. Not for acceptance verdicts (audit-ui), Markdown companions (html-artifact), UI variant boards (variant-board), generated concept images (image-artifact) or production environments."
---

# walkthrough-artifact

A walkthrough shows shipped behavior to people who will not open the app themselves. It has three parts. The page is one complete HTML file with one section per printed page. The PDF is printed from that page in A4 landscape. The `manifest.md` records the environment, the audit runs the screenshots came from, and every image's source.

audit-ui owns every capture: browser sessions, accounts, demo records and cleanup. This skill writes the audit brief, curates the captures, builds the page, checks it against the manifest and prints it. [references/capture.md](references/capture.md) holds the capture rules and the image inspection checklist. [references/hosts.md](references/hosts.md) holds preview and publishing per host.

## Files

```
walkthrough-artifact/
├── SKILL.md
├── starter.html                     page shell: tokens, page types, @media print block
├── templates/manifest.md            manifest skeleton
├── references/capture.md            audit brief fields, capture rules, inspection checklist
├── references/hosts.md              preview and publish per host
├── scripts/walkthrough-artifact.js  check | pdf | text
├── agents/openai.yaml               Codex display metadata
└── fixtures/                        synthetic walkthrough, its audit run, a 3-page Chrome PDF
```

## Output

```
~/agent-artifacts/<topic>/walkthrough[-<scope>]/
├── <name>.html          the page, and the print source
├── <name>.pdf
├── img/<item>-<nn>[a-z]-<slug>.png
└── manifest.md
```

Raw captures stay in `~/agent-artifacts/ui-audits/<slug>/<run>/` and are linked from the manifest, never copied. Rendering checks of the page go to a scratch folder, never the audit folder.

## 1. Take the brief

Collect, and write at the top of `manifest.md` from [templates/manifest.md](templates/manifest.md):

- the scope unit (Row, Slice, Item) and the scope items
- the environment label printed on every page, and the allowed origins
- the served builds, and how they were confirmed; say "not fingerprinted" when they were not
- accounts and their credential source, never a password
- allowed demo changes and the marker text they carry, such as "Walkthrough demo"
- audit runs to adopt, and an earlier walkthrough to carry the status table from
- the accent colour and the label for each status tone in use

Ask one question only when the environment, the accounts or the allowed demo changes are unclear. Refuse a production environment.

## 2. Get the evidence

Adopt an existing audit run only when its recorded builds match the served builds. If the builds cannot be confirmed, say so and adopt it only with the user's agreement.

Otherwise, and for any missing shot, write an audit-ui journey brief following [references/capture.md](references/capture.md) and run audit-ui. A top-up capture after a run has finished is a new small run under the same audit slug; list every run in the manifest.

## 3. Curate

Copy the chosen captures into `img/` as `<item>-<nn>[a-z]-<slug>.png`, numbered in page order. For each image, add one manifest line under `## Images`:

```
- img/15-03-invite-email.png: Ad hoc member · session 24 · invitation email. from: `screenshots/15-05-mail-invite.png`
```

`from:` is the raw capture, relative to a listed audit run or as a full path. Open every image and go through the inspection checklist in [references/capture.md](references/capture.md). When an image fails it, recapture through audit-ui; do not edit pixels.

## 4. Build the page

Copy [starter.html](starter.html) to `<name>.html`. Delete optional sections you do not use rather than commenting them out. Set `--accent` and `--env-label` in the tokens block and the `<title>`. Keep the `walkthrough:print` block exactly as shipped; `check` compares it with the starter. Fill, in order:

1. **Cover.** Title, one sentence, date and environment label.
2. **Overview.** What changed, who does what, and a strip with one card per scope item.
3. **Status** (optional): one row per item from the manifest's `## Status` table, with the badge class `t-<tone>` and the label text. Tones are `done`, `partial`, `info`, `neutral` and `blocked`; labels are free text from the brief. Carry the table forward from the earlier walkthrough's manifest, not its HTML.
4. **One `section.page.shot` per step.** The screenshot with real alt text, a caption of `actor · record · screen`, a heading that states what the reader should notice, short text and an optional note.
5. **Closing** (optional): items that are API only or not pictured.

Write for the product audience in the app's own words. Keep demo record names, test accounts and the environment visible as what they are.

## 5. Check

```bash
node <skill>/scripts/walkthrough-artifact.js text <name>.html | node <unslop>/scripts/scan.mjs --stdin
node <unslop>/scripts/scan.mjs manifest.md
node <skill>/scripts/walkthrough-artifact.js check <name>.html
```

`<skill>` is this skill's folder and `<unslop>` is the installed `unslop` skill's folder, if available. Without it, review the page text and manifest against unslop's rules by hand.

Fix every scanner hit, then run `check`. It reads the page without its HTML comments, reads image lines only from `## Images`, and reports every failure, not only the first. It fails when:

- the doctype or the cover-first order is missing, or the print block differs from the starter
- a local reference (`src`, `srcset`, `poster` or CSS `url()`) points outside `img/` or its file is missing, an `img/` file is unused, or an image has no manifest line
- a manifest image line names an unused or missing file, has no `from:`, or names a raw capture missing from a present audit run
- alt text is empty, or a figure has no caption
- the page loads anything remote, or the page or manifest names a URL whose origin is not under `Allowed origins`; the published URL under `## Revisions` is exempt
- the page or manifest contains a JWT, `token=`, `access_token` or a `Bearer` token
- the page status table and the manifest `## Status` rows differ in items, tones, labels or order

It prints the page count, image count and image size. Do not write those counts into the manifest by hand.

## 6. Print

```bash
node <skill>/scripts/walkthrough-artifact.js pdf <name>.html [--copy-to <dir>]
```

It prints with headless Chrome (`CHROME_BIN` or a standard install) and fails unless the PDF has one page per section. Each printed page hides overflow, so then read the PDF page by page and look for clipped text or a cropped screenshot. Use `--copy-to` only when the user asks for a copy elsewhere, such as `~/Downloads`.

## 7. Preview and publish

Preview with `artifact-workbench` in single-file mode; it serves `img/` beside the page. Publish only when the user asks, following [references/hosts.md](references/hosts.md), and add the URL under `## Revisions`.

## Revisions

A revision edits the same folder. Add a dated line under `## Revisions` that says what changed and whether it was published, rerun `check` and `pdf`, and keep earlier PDFs only if the user asks.

## Boundaries

- `audit-ui` gives verdicts and owns capture; a walkthrough never replaces an acceptance audit.
- `html-artifact` turns Markdown into HTML companions; its single-file rule does not apply to this page.
- `variant-board` shows proposed UI drawn as mocks; a walkthrough shows shipped UI as screenshots.
- `image-artifact` draws concept images; never mix generated images into a walkthrough.
- `publish-artifact` does not scan images for secrets, so the inspection checklist is the only image check.
