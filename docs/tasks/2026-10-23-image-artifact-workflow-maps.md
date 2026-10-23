# Illustrated workflow maps

## Objective

Add a reusable workflow-map recipe to `image-artifact`, preserving status comparisons, numbered actions and document distinctions without generating UI mockups.

## Source context and design

Source Spec: `docs/specs/2026-10-19-image-artifact-workflow-maps.md`.

The accepted approach uses the existing `comparison-board` kind, a brief template and an inspected prompt recipe. A helper guard prevents lossy generic prompt generation. Implementation, independent review, remediation and a ready PR are authorized. All examples, pilots and published material must be synthetic and free of proprietary names or artifact references.

This is a bounded improvement to existing skills and helper behavior. It introduces no new output kind, service, UI, API, dependency or persistence format.

## Code evidence

| Behavior | Source |
|---|---|
| A single `state` token satisfies both UI and variant signals | `skills/image-artifact/scripts/image-artifact-helper.js`, `inferKind` |
| Prompt construction keeps six bullets and omits tables | Same helper, `extractBullets`, `buildPromptPlan` |
| Image-only metadata writes a new table on each invocation | Same helper, `updateMetadata` |
| Existing tests own routing, output placement and issued-board capture | `skills/image-artifact/scripts/image-artifact-helper.test.js` |
| Citation boundaries currently capture conceptual comparisons too broadly | `skills/variant-board/SKILL.md`, Boundaries |

Evidence checked against `68bf2c0`, the verified `origin/main` base at delivery start.

## Scope and preserved behavior

- Add the linked workflow-map recipe and brief template described in the spec.
- Declare the recipe in the brief header and reject generic prompt-plan or prompt-pack writes before output creation, including explicit kind overrides.
- Remove the single-token inference collision while preserving UI-board handoffs and explicit kinds on ordinary sources.
- Append to existing image-only metadata tables and preserve supported table columns and Markdown artifact tables.
- Define version retention, exact-text fallback, allowed repeats, split outputs, truthful provenance and visual inspection.
- Update both skills' discovery and citation boundaries.
- Sanitize the source spec and keep generated images outside Git.

Keep board snapshots, image validation, existing output destinations and ordinary image behavior intact. Do not implement a brief compiler, automate visual checks, add a new skill, or alter unrelated workflow files.

## Verification

| Risk | Smallest owner and evidence |
|---|---|
| Silent information loss or wrong skill routing | Extend the existing CLI routing tests in the helper test file; demonstrate failures before the helper fix |
| Corrupted or duplicated workspace provenance | Add focused CLI coverage of repeated metadata writes, including existing column shapes and repeated output identity |
| Broken existing snapshot and validation paths | Run the complete helper test file and the repository's required `npm test` gate |
| Skill metadata or portability errors | Run skill-creator `quick_validate.py` on both changed skills; use repository portability coverage |
| Incorrect composition or unreadable labels | Generate two synthetic maps, inspect against their briefs at intended display widths, record prompts, versions and failures outside Git |
| Lost edit history | Exercise a local image edit, preserve the original and rerun the full checklist |
| Proprietary details in publication | Inspect every changed file and PR body for private names, project references and local artifact paths |

Permanent tests protect routing and metadata persistence contracts through the existing CLI boundary. Recipe wording and layout get runtime inspection rather than presentation-only tests. No web UI, HTTP API or accessibility audit applies to this CLI and skill change.

## Execution and completion

Use an isolated branch from verified `origin/main`, target `main`, and leave unrelated edits in the original checkout untouched. Record pilot evidence in one external artifact workspace. The repository uses one root package and lightweight delivery mode; the provisional review size is at most ten files, allowing one implementation assessment and its remediation batch. No numeric delegate limit applies.

After implementation and validation, commit the candidate and obtain the requested independent review. Address valid findings, validate affected behavior and sweep equivalent touched paths before publication. Open a ready PR only after required local checks and review remediation pass. No unresolved product decision or further approval gate remains.
