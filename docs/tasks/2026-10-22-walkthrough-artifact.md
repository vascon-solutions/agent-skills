# Walkthrough artifact skill

- Status: Implemented 2026-10-22 on `feat/walkthrough-artifact`. Both pilots passed; publishing to claude.ai is still unverified (see `skills/walkthrough-artifact/references/hosts.md`). The link script runs from the canonical checkout after merge.
- Prepared: 2026-10-22.
- Classification: Improvement; one new self-contained skill plus boundary lines in two existing skills and the pack catalogue.
- Repository baseline: `1223722f46475f6a79611c826a49f2db6ef270e1` (`origin/main`). Recheck at execution time.

## Objective

Make a product-audience walkthrough of shipped features on a non-production environment repeatable. It has one complete HTML page of real screenshots and an A4 landscape PDF printed from it. A manifest records where each image came from and what was changed to capture it. A bundled script checks the page against its manifest and prints the PDF.

## Source Context

Source mode: accepted spec. The design was brainstormed and accepted on 2026-10-22 against three hand-built client walkthroughs and the current skills. Dee authorised building it on a new branch.

## Design Reference

Source Spec: `docs/specs/2026-10-22-walkthrough-artifact.md`, especially Decisions 1-6, Design, Tests and Acceptance pilot. Do not reopen those decisions.

## Architecture Summary

`walkthrough-artifact` owns the brief, curation, page building, checking, printing and publishing guidance. audit-ui stays the only owner of browser capture, accounts, demo changes and cleanup; the walkthrough writes its audit brief and links its report. The page is built from a starter like `variant-board`, and one dependency-free Node script provides `check` and `pdf`. Preview uses artifact-workbench single-file mode; publishing to claude.ai goes through the host Artifact tool with a `files` map.

## Code Evidence

| Behavior | Source |
|---|---|
| html-artifact requires a doctype and rejects any `<img>` that is not a data URI; its source of truth is Markdown. | `skills/html-artifact/scripts/verify-layout-artifact.js:49, 82`; `skills/html-artifact/SKILL.md:10, 158-165` |
| html-artifact lists routes away in a When Not To Use section. | `skills/html-artifact/SKILL.md#When Not To Use` |
| audit-ui is audit-only, completes an adopted brief once, carries the screenshot limit in its brief, defaults to 12 and never captures secrets. | `skills/audit-ui/SKILL.md:11, 38-39, 61, 116, 160`; `skills/audit-ui/assets/templates/audit-brief.md:36` |
| Chrome discovery exists but is not exported. | `skills/image-artifact/scripts/image-artifact-helper.js:431#findChrome` |
| Workbench single-file mode serves the HTML file's folder as the asset root. | `skills/artifact-workbench/scripts/serve-artifact-workbench.js:97-104` |
| Starter-plus-verifier precedent: CommonJS scripts with `usage`, subcommands and `node:test` tests beside them. | `skills/variant-board/starter.html`; `skills/variant-board/scripts/verify-variant-board.js#usage`; `skills/variant-board/scripts/variant-board.test.js` |
| Installation uses an explicit allowlist checked against `skills/`. | `bin/link-skills.sh#SKILL_NAMES`; `tests/skills-portability.test.mjs` "link script lists every skill directory exactly once" |
| Every Markdown link in a skill must resolve, and every reference file must be linked from a SKILL.md. | `tests/skills-portability.test.mjs` "skill Markdown references resolve", "every skill reference is reachable" |
| The README catalogues skills in a directory tree, a Skills table and workflow scenarios. | `README.md` lines around 39-43, 100-103, 317-324 |
| Chrome's Skia PDFs write one uncompressed `/Type /Page` object per page. | Observed on the three client PDFs, 2026-10-19 (see spec) |

## Current Behavior To Preserve

- audit-ui stays audit-only and keeps its default screenshot limit; it gains one routing line only.
- html-artifact behavior and verifier are unchanged; it gains one When Not To Use line only.
- image-artifact, publish-artifact and artifact-workbench are unchanged.
- Skills stay self-contained: copy `findChrome`, do not import across skill folders.
- No client names, client hostnames or absolute local paths in committed docs, fixtures or tests. Fixtures are synthetic.
- The untracked `docs/specs/2026-10-19-image-artifact-workflow-maps.md` in the main checkout is not part of this delivery.

## Prerequisites

Node 20+. Chrome or Chromium for the `pdf` command and pilot (tests do not need it). Read access to the client walkthroughs under `~/agent-artifacts/` for the pilot only.

## Scope

- `skills/walkthrough-artifact/` per the spec's Skill files layout: `SKILL.md`, `starter.html`, `templates/manifest.md`, `references/capture.md`, `references/hosts.md`, `scripts/walkthrough-artifact.js` (`check`, `pdf`), `scripts/walkthrough-artifact.test.js`, a synthetic fixture, and `agents/openai.yaml`.
- `check` and `pdf` behave as the spec's `check` and `pdf` sections define.
- Boundary lines in `skills/html-artifact/SKILL.md` and `skills/audit-ui/SKILL.md`.
- README directory tree, Skills table row and a workflow scenario; `SKILL_NAMES` entry; run `./bin/link-skills.sh`.

## Excluded

- Changes to audit-ui's default limit, report format or run lifecycle.
- A data-URI or inline-HTML output mode.
- A publish-artifact destination for claude.ai.
- Pixel redaction tooling, OCR or automated clipping detection.
- Rebuilding or editing the existing client walkthroughs in place.
- Publishing anything to claude.ai during delivery.

## Pre-Implementation Verification

- Confirm the Code Evidence lines still hold on the branch base.
- Confirm the installed Chrome's flag for printing without header and footer (`--no-pdf-header-footer` or the older `--print-to-pdf-no-header`).
- Confirm unslop's scanner entry point and arguments (`skills/unslop/scripts/scan.mjs`).

## Likely Files To Touch

- `skills/walkthrough-artifact/**` (new)
- `skills/html-artifact/SKILL.md`, `skills/audit-ui/SKILL.md`
- `README.md`, `bin/link-skills.sh`

## Decisions Required Before Implementation

None. The spec settles the design. The spec's open items (host acceptance of a full document, the Chrome flag, clipping found by reading the PDF) are resolved during implementation or the pilot.

## Execution Rules

- Follow the spec's file layout and `check` failure list; do not add features beyond it.
- Match variant-board's script style (CommonJS, `usage`, exit 0 on pass and 1 on failure, every failure reported).
- Apply test-audit admission to the new test file; no presentation-only tests.

## Deliverables

- The new skill, linked and catalogued.
- Two boundary lines.
- Pilot results recorded in `references/hosts.md` without client names.

## Completion Verification

| Risk | Evidence | Owner | Command or scenario |
|---|---|---|---|
| Manifest drifts from the page (missing, unused or unlisted images; missing raw capture) | Failing and passing fixture cases | `walkthrough-artifact.test.js` | `node --test skills/walkthrough-artifact/scripts/walkthrough-artifact.test.js` |
| Token or unlisted host reaches a page; remote load | Fixture cases for JWT, `token=`, `Bearer `, foreign origin, remote `src` | same | same |
| Status table differs from manifest rows | Fixture case | same | same |
| Altered print block, missing doctype, cover not first, empty alt or caption | Fixture cases | same | same |
| PDF page count wrong | Counter on a committed small Chrome PDF; `pdf` refuses a mismatch | same | same |
| Skill not installed or links broken | Existing portability tests | `tests/skills-portability.test.mjs` | `npm test` |
| Real walkthrough works end to end | Pilot 1: rebuilt rows 15-18-19 walkthrough passes `check`, PDF has 24 pages; pilot 2: `check` reports the `screenshots/` vs `img/` drift on a copy of the contract-milestones walkthrough | Delivery owner | Scratch copies under `~/agent-artifacts/`, results in `references/hosts.md` |

## Approval Gates

None for implementation. Publishing to claude.ai stays opt-in and is not part of delivery.

## Completion Criteria

All Completion Verification rows pass, `npm test` passes, the link script has run, and the draft PR describes the pilot results and any open spec items.

## Follow-ups

- Confirm on the first real publish whether claude.ai accepts a full document unchanged, and record it in `references/hosts.md`.
- Optional preset of brief values kept in a client repository, not this pack.
