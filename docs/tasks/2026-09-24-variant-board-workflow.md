# Portable Variant Board Workflow

- Status: Ready for implementation handoff; implementation not started.
- Prepared: 2026-09-24.
- Classification: Feature-grade; one coherent delivery covering the new board contract and the existing routes that must hand off to it.
- Repository baseline: `fac71e45bbe0e120762ca8d3c0feefe0d60df16c`. Recheck at execution time.

## Objective

Make UI variant boards repeatable, recognisable as the target app, portable across supported agent hosts, and reliable as versioned evidence in specs and task documents. A board should retain white editorial chrome, use the app's design system in its mocks, and replay a cited section and scenario from an immutable issued file.

## Source Context

Source mode: spec, with code-grounded intake. Dee requested a final subagent review, remediation of its findings, and creation of this task in `agent-skills`. That request authorises these documents; it does not authorise implementation, commits, or publication now.

The final review of revision 3 found five contract gaps: changed-byte issuance, revision-bundle context and stale import, legacy citation migration, executable image-helper routing, and incomplete scenario hashes. All five were accepted and corrected in source-spec revision 4. Intake additionally identified the explicit installation allowlist and README catalogue as required integration points.

## Design Reference

- Source Spec: `/Users/dee/agent-artifacts/variant-board-workflow/markdown/spec.md`, revision 4, especially §§5.1–5.9 and §9.
- Intent: `/Users/dee/agent-artifacts/variant-board-workflow/markdown/handoff.md`.
- Read-only examples: `/Users/dee/agent-artifacts/memo-delivery-ux/html/variants.html`, `/Users/dee/agent-artifacts/tender-workspace-ux/html/variants.html`, `/Users/dee/agent-artifacts/tender-workspace-ux/html/commercial.html`, and `/Users/dee/agent-artifacts/tender-workspace-ux/html/authority.html`.
- Read-only pilot theme: `/Users/dee/Code/FLOATSTAR/ncdmb-procurement-ui/packages/ui/src/styles.css`; determine the source revision and relevant app overrides at pilot time.

D1–D3 remain settled: a separate host-neutral `variant-board` skill; app-styled mocks with fixed editorial chrome; Before panes reconstructed from a named source revision, with app screenshots optional. Revision 4 is the delivery basis. Do not reopen those decisions or restart discovery.

## Architecture Summary

`variant-board` owns authoring from a brief, the reusable self-contained HTML starter, token provenance, scenarios, issuance, bundles and verification. Host adapters own preview and optional publication, with filesystem-capable hosts authoring directly and other hosts returning candidates from source bundles. `image-artifact` captures exact issued board states through a browser, while retaining its existing generation workflow for illustrative companions. Existing HTML document companions and the workbench remain separate capabilities.

## Code Evidence

Paths in this table are relative to the repository root.

| Current behaviour | Source |
|---|---|
| HTML companions accept Markdown, hand-built inline JavaScript and named artifact kinds; repo design is opt-in and assets must be self-contained. | `skills/html-artifact/SKILL.md`, Purpose, Artifact Kinds, Repo Design Context, Single-File Rule |
| The existing verifier checks markers and external asset references; it is not a board lifecycle verifier. | `skills/html-artifact/scripts/verify-layout-artifact.js` |
| Image-board generation is routed both by instructions and by executable helper logic. | `skills/image-artifact/SKILL.md`, Output Kinds and Workflow; `skills/image-artifact/scripts/image-artifact-helper.js`, `KIND_FILENAMES`, `inferKind`, `variantNames`, `visualStyle`, `buildPromptPack` |
| Image helper regression tests already use Node's test runner and temporary directories. | `skills/image-artifact/scripts/image-artifact-helper.test.js` |
| Repo design discovery has explicit high/medium/low confidence rules and currently requires the consuming opt-in flag. | `skills/repo-design-context/SKILL.md`, Purpose, Discovery Order, Confidence |
| Brainstorm currently routes clickable prototypes to HTML and static directions to image generation. | `skills/brainstorm/SKILL.md`, prototype routing paragraph |
| The workbench recursively discovers HTML and serves nested HTML paths, including a versions directory, through its existing workspace routes. | `skills/artifact-workbench/scripts/serve-artifact-workbench.js`, `discoverWorkspace`, `routeWorkspaceRequest` |
| Installation enumerates a fixed allowlist rather than discovering arbitrary skill folders. | `bin/link-skills.sh`, `SKILL_NAMES` |
| The README advertises image-generated UI variant boards and lists installed skills. | `README.md`, Skills and artifact workflow examples |

The prior browser review confirmed that the memo board has independent per-section Surface/State/View controls, and Approval & Award changes the controlling route before resetting dependent state. Reuse that behavioural evidence; the new starter still needs its own focused browser validation.

## Current Behaviour To Preserve

- Boards remain discussion aids. Repo specs/task docs remain authoritative; a board or browser choice does not authorise production implementation.
- Preserve `/Users/dee/agent-artifacts/<topic>/{html,markdown,images}/` placement and the familiar `Companion: path (vN) — section` citation text.
- Preserve non-board HTML kinds, including clickable flows and approach comparisons, and non-board image generation.
- Preserve neutral/opt-in repo design for consumers other than the explicit `board-mock` request. A theme path alone does not override ambiguity or confidence checks.
- Keep board HTML self-contained, with inline CSS/JavaScript and embedded assets; preview must not conceal missing dependencies. Navigation links to sources and frozen versions are not external asset loads.
- Keep the thirteen existing boards and product-repo documents untouched by this delivery. Exercise migration with copied or synthetic fixtures.
- Preserve unrelated working-tree edits and existing public helper behaviour outside the retired board-generation route.

## Prerequisites

- At execution time, verify repository instructions, checkout identity, relevant skill bodies and the source spec's revision. At preparation, the main checkout was on `codex/clarify-ci-monitoring-authorization` with unrelated edits to `skills/review-implementation/SKILL.md` and `skills/task-doc-delivery-loop/SKILL.md`.
- Use the maintained `skill-creator` workflow when implementing the skill. Select a safe implementation checkout through the existing delivery workflow; this document does not select a branch, worktree or PR target.
- Node and a supported browser are needed for the helper/runtime checks. Read access to a product repo is needed for the NCDMB pilot.
- Actual Claude, Codex and ChatGPT sessions are needed to prove their respective host paths. Missing host access does not block independent implementation, but unrun host pilots remain explicit incomplete acceptance evidence.

## Scope

### Board skill, brief and starter

- Add `skills/variant-board/SKILL.md`, a concise anatomy reference, brief/token templates, `starter.html`, the verifier and bundle exporter. Keep portable instructions free of host tool names and place host-specific steps in separate adapter sections/references.
- Infer the brief from supplied context. Ask only about material missing information. Persist a brief for citable boards with stable section IDs, product/source revisions, purpose, theme evidence and scenario expectations.
- Include the mandatory masthead, brief-defined sections, revision notes and colophon. Add Before/After, options/tradeoffs, state matrix or defect sections only where the purpose requires them. Interactivity is allowed under any purpose.
- Supply fixed `--board-*` chrome, separate `--app-*` mock tokens, pane/table layouts and basic mock primitives. Match mock proportions to read component evidence. Keep chrome white; support a mock-only Scheme control when the target app has dark mode.

### Scoped scenario runtime

- Each interactive section owns its own declared dimensions and selection object. There is exactly one selected option per dimension in that scope. Unrelated section controls must not change one another.
- Declare directed controlling-to-dependent relationships. A parent choice remains selectable; after it changes, invalid dependent choices reset deterministically to an allowed option. Keep valid choices where applicable. Support declared acyclic dependency order and reject malformed/cyclic definitions or configurations with no valid dependent option rather than drawing an invalid state.
- Render mocks from the declared tables and selection. Product controls are inert except explicitly declared reveal interactions represented in scenario state. Support both Today-as-variant and Before/After/Side-by-side-as-view.
- Use `#section?dimension=id&...` for scenario replay on load and hash changes. A replay must contain every dimension in that scope exactly once, use known IDs, and satisfy dependencies. Reject missing/duplicate/unknown/forbidden assignments with the visible error banner; do not silently coerce them. Bare `#section` remains ordinary navigation.
- A control change and a cited replay have different policies: interaction may repair dependent state; replay must honour the exact requested tuple or report failure.

### Token provenance

- Map each used app token to its source token, file, theme/mode, source revision, literal value and status. Resolve aliases and app overrides without converting available literals or substituting from memory.
- Support `resolved`, `substituted`, `waived` and `unresolved` rows. Label substitutions and waivers visibly. A waiver must reference Dee's actual recorded decision naming the roles and reason. Unresolved rows block issuance.
- Add the `board-mock` input to `repo-design-context` without weakening other consumers' opt-in or confidence rules. Use the exact app font when embeddable/local; label necessary system-font substitutions.

### Issuance, citations and legacy migration

- Keep a mutable `html/<board>.html`; issue immutable `html/versions/<board>.v<N>.html` only after the required checks. Stamps and revision notes distinguish working proposals, issuance and accepted decisions.
- Working edits may batch. Once N is issued, any changed bytes require a new number for issuance, even a typo correction. Identical repeated issuance is a no-op; conflicting frozen files must not be overwritten. Apply final issued stamps/notes before freezing so the working issued copy and frozen file agree.
- Maintain `boards.md` with board identity, current/issued versions, dates, brief and publication metadata. Publication URLs learned after issue update the index only. Published copies of issued versions use frozen content unchanged.
- Resolve familiar citation text to the exact frozen version, section and complete valid scenario. A latest file cannot substitute for historical evidence. Link issued revisions from the working board and index.
- On a legacy board's first migration, inventory its existing citations as historical versions unavailable. Only those inventoried citations are exempt from frozen resolution. Issue above the greatest known cited/masthead number; do not invent historical files. New citations always use the exact issued contract.
- Make the issue/import procedure concrete in the skill and verifier interface. A separate publishing or database service is not required.

### Direct and bundle authoring

- Export a self-contained authoring pack: portable instructions, brief with IDs, token map, starter, necessary requirement/source excerpts with provenance, and scenario expectations.
- Distinguish new-board and revision bundles. Revision bundles include current HTML, the board's relevant index/history and accepted decisions, relevant frozen versions, and the base version/content digest plus frozen-file digests.
- A returned candidate must retain its base manifest. The documented direct-path import procedure checks the current canonical base before replacing anything, rejects stale bases without mutation, validates the candidate and preserves issued files. New-board import requires an unused destination identity.
- Mark each host supported only after actual candidate validation. Record whether its wrapper preserves scripts and hashes. Canonical-file scenario replay is mandatory; wrapper limitations must remain visible in host evidence.

### Existing skill integration and installation

- Route UI variant-board authoring/revision to the new skill from `brainstorm`, `html-artifact` and `image-artifact`; preserve other prototype/companion uses.
- Update the image helper's kind mapping, inference, default variants and prompt construction so retired explicit `ui-variant-board` requests and inferred UI-board requests return a clear handoff to `variant-board`, without producing generation plans/prompts.
- Add `board-snapshot` as browser capture of frozen issued HTML and a validated scenario. It accepts those inputs directly, bypasses image-generation planning and saves a version/scenario sidecar. Keep existing illustrative generation separate.
- Add `variant-board` to `bin/link-skills.sh` and update the README catalogue and affected examples. Do not install symlinks into Dee's live agent directories just to test registration.

## Excluded

- Production UI implementation; bulk retrofit, rewrite or republication of the existing boards; edits to product-repo specs/tasks.
- A per-product generated component/CSS library, real app component imports or pixel-perfect app reconstruction.
- New publishing destinations, changes to `publish-artifact`, public deployment or uploading private pilot material without the applicable user instruction.
- Changes to workbench behaviour, other orchestration workflows or unrelated dirty files.
- A general schema/runtime framework beyond the board scenarios described here.

## Pre-Implementation Verification

Recheck the code-evidence entry points, helper call sites/tests and installer allowlist. Confirm nested frozen HTML previews and navigation work with the current workbench before proposing any workbench change. Verify available host capabilities rather than assuming a branded host always has a filesystem or browser. Read actual product source at the recorded revision before building a pilot; do not infer current product behaviour from an old board alone.

## Likely Files To Touch

- `skills/variant-board/SKILL.md`, `references/anatomy.md`, host references as needed, `templates/brief.md`, `templates/tokens.md`, `starter.html`.
- `skills/variant-board/scripts/verify-variant-board.js`, `export-board-bundle.js`, and focused test/fixture files or small shared runtime helpers if needed.
- `skills/image-artifact/SKILL.md`, `scripts/image-artifact-helper.js`, `scripts/image-artifact-helper.test.js`.
- `skills/html-artifact/SKILL.md`, `skills/repo-design-context/SKILL.md`, `skills/brainstorm/SKILL.md`.
- `bin/link-skills.sh`, `README.md`.

Inspect the workbench and existing verifiers for compatibility; they are not automatic write targets. Repository fixtures must use synthetic content rather than copying private NCDMB board/source material into this reusable skill pack.

## Decisions Required Before Implementation

None. The source contract and review remediation define the delivery scope. Exact helper decomposition, CLI flags and parser choice are implementation choices; document the chosen interfaces and use them consistently. Host access is a verification dependency, not an unsettled product decision.

## Execution Rules

Keep this as one delivery: introducing the skill while leaving executable board-generation routes or installer registration behind would leave an inconsistent workflow. Use the repo's existing Node/script conventions and small shared helpers where they reduce duplicated scenario or verifier logic. Do not execute the whole test suite merely to establish a baseline or add permanent tests for editorial copy and spacing.

## Deliverables

1. An installed/discoverable skill package with the starter, templates, authoring/issue/import instructions, verifier, bundle exporter and host adapters.
2. Consistent routing and browser-snapshot behaviour in the existing skills/helper, preserving non-board output paths and formats.
3. Focused automated evidence for runtime/issuance/import/routing invariants, browser evidence for the starter, and honest per-host conformance records.

## Completion Verification

Automate the contracts where mistakes would invalidate evidence:

- Independent scope selection; route change followed by dependent repair; invalid configuration rejection; valid exact scenario replay; missing/duplicate/unknown/forbidden hash rejection; bare-anchor navigation.
- Structure and token-map acceptance/rejection, including aliases/overrides at a recorded revision, substituted/waived roles, absent waiver evidence, and unresolved issuance failure.
- v1/v2 issuance retains unchanged v1 bytes; identical reissue is idempotent; changed bytes cannot overwrite v1; a copy-only correction uses a new issued number; late publish metadata leaves frozen bytes unchanged.
- Legacy migration reserves historical numbers, exempts only recorded old citations, and validates new citations normally.
- New and revision bundle round trips; decisions/custom board content preserved; stale-base import and frozen-file conflicts rejected without replacement.
- Explicit and inferred image-board requests do not generate prompts; board-snapshot uses issued/scenario-validated input; existing non-board helper cases remain passing.

Use Node's existing test convention. Run the new focused board tests and `node --test skills/image-artifact/scripts/image-artifact-helper.test.js`; select additional existing checks only when touched behaviour requires them. Test link-script registration with isolated temporary targets rather than live installation.

In a browser, verify a multi-section memo-style board and a controlling-route/dependent-state board, including exact and invalid hashes, expected visible results, Before labels, light chrome and wrapper layout at 390 px and 1280 px. Verify frozen-version navigation through the unchanged workbench. These are prototype checks, not a production app audit.

Build the NCDMB pilot from read-only source evidence in a separate artifact workspace, issue v1 and v2, and verify a task-shaped citation fixture using the product's citation convention. Do not alter existing product task docs merely to demonstrate citation parsing. Use synthetic copied fixtures for migration tests.

Run the applicable checks on an actual Claude direct-path board, a Codex direct-path board and a ChatGPT bundle candidate. Include a revision-bundle import case. Record host wrapper limits separately from canonical-file results. Host sessions not actually exercised remain unverified; they must not be reported as supported or as completed acceptance.

## Completion Criteria

All scoped files agree on the workflow, the required automated and browser checks pass, previously issued citations retain their exact evidence, and each claimed host path has the recorded acceptance evidence required by the source spec. Full three-host portability acceptance remains incomplete until all three pilots have run. A delivery report must distinguish implementation completion from any unavailable host validation.

## Follow-ups

Bulk legacy migration and per-product generated component kits remain deferred. No follow-up is a prerequisite beyond the scoped acceptance evidence above.
