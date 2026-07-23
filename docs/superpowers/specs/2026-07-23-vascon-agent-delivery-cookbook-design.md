# Vascon Agent Delivery Cookbook — Site Design

**Status:** Approved design — revised after independent review
**Date:** 2026-07-23  
**Audience:** Vascon developers using coding agents  
**Primary outcome:** Help a developer start feature work correctly with an approved task doc before implementation.

## 1. Context

Vascon needs a practical team standard for agent-assisted delivery. The current public skill pack already encodes the desired workflow, but the earlier cookbook presents too much material at once: setup sources, broad principles, a ten-stage lifecycle, recipes, worked examples, checklists, trigger phrases, operating conventions, a complete skill index, installation guidance, and external reading. It also contains retired routes such as `task-first-implementation` and `scaffold-repo-skill`.

The replacement should behave like a daily working companion, not a reference manual. It must make the task-doc gate obvious, show developers what to do next, provide copyable agent prompts, and progressively reveal standards and specialist skills only when relevant.

## 2. Product Position

The cookbook is a clear Vascon engineering standard:

> This is how Vascon uses coding agents for feature-grade work.

The standard is firm, practical, and non-punitive.

- Feature-grade work requires an approved task doc before implementation.
- Improvements use a task doc when their scope or risk justifies one.
- Small changes and known fixes downshift to a short plan.
- Human approval remains the decision gate.
- The Vascon public skill pack is the authoritative scope.
- Third-party skills are mentioned only when a workflow truly depends on them.
- Private AlphaDigital and personal workflows are excluded.

## 3. Information Architecture

The site is one responsive route with anchored navigation and progressive disclosure.

### Primary navigation

1. Workflow
2. Principles
3. Prompt Lab
4. Recipes
5. Standards
6. Skills

### Content order

1. **Header:** official Vascon logo, “Engineering Cookbook,” primary section links.
2. **Hero:** “Start every feature with an approved task doc,” a short explanation, and a primary “Start a feature” action.
3. **Golden path:** the four approved delivery stages.
4. **Working principles:** eight enforceable habits that support the workflow.
5. **Prompt Lab:** static, locally customized prompt examples.
6. **Situation recipes:** focused routes for common work.
7. **Stack standards:** standards surfaced by implementation context.
8. **Skill reference:** searchable secondary index.
9. **Install/update:** one compact link to the public repository and its current installation instructions.

The homepage must not lead with installation, skill sources, a catalog, or a broad lifecycle diagram.

## 4. Golden Path

The site reduces feature delivery to four memorable stages.

### 1. Classify and spec

- Primary skill: `task-doc-intake`
- Supporting skill: `task-doc`
- Purpose: classify the request, downshift small work, or turn feature-grade work into a bounded task doc.
- Inputs: rough brief, screenshots or Figma, API contracts, constraints, similar code, and relevant repository context.
- Output: an approved change inventory and a durable task doc.
- Gate: stop before implementation.

### 2. Approve

- Owner: a human developer, lead, or designated reviewer.
- Purpose: confirm scope, decisions, acceptance criteria, preserved behavior, exclusions, risks, and verification.
- Supporting skill: `review-task-docs` for high-risk or unresolved scope.
- Output: explicit task-doc approval or requested changes.
- Gate: ambiguous approval does not authorize implementation.

### 3. Deliver and verify

- Primary skill: `task-doc-delivery-loop`
- Purpose: implement the approved scope in dependency order, apply relevant standards, validate, and prepare the bounded delivery for review.
- Contextual standards: TanStack frontend, TanStack Start, NestJS API, forms, migrations, audit logging, Nx, and Ultracite.
- Output: a validated implementation on a bounded branch with accounted-for evidence.

### 4. Review, remediate, and close out

- Orchestrator: the same `task-doc-delivery-loop` started in stage 3.
- Internal review skill: `review-implementation`.
- Internal remediation skill: `address-review-findings`.
- Purpose: complete the delivery loop by judging the diff against the task doc, verifying findings before fixes, rerunning affected checks, publishing to the approved boundary, and accounting for PR state.
- Output: a review verdict, dispositioned findings, final validation evidence, and known branch or PR state.

Stages 3 and 4 are phases inside one `task-doc-delivery-loop` run, not instructions to invoke the delivery loop and then repeat a second standalone review cycle. The standalone review and remediation recipes remain available for completed work that did not enter through the delivery loop or for existing findings that need evaluation.

Every stage presents:

- why the stage exists;
- the skill used;
- required inputs;
- expected output;
- a copyable prompt;
- the human or evidence gate;
- the next action.

## 5. Working Principles

This section appears immediately after the golden path.

1. **Match the process to the risk.** Small changes and known fixes use a short plan. Improvements and feature-grade work require a task doc. Contract, permission, migration, persistent-state, and cross-module risks cannot bypass the gate silently.
2. **The task doc is the delivery contract.** It records scope, decisions, preserved behavior, acceptance criteria, exclusions, and verification. Writing it does not authorize code; explicit approval does.
3. **Work from the real repository.** Read repository instructions, current code, tests, contracts, screenshots, and nearby completed features. Codebase evidence outranks an imagined architecture.
4. **Follow patterns before creating new ones.** Reuse components, request helpers, schemas, modules, and templates. A new pattern requires an identified gap and an accepted trade-off.
5. **Keep one coherent delivery boundary.** One outcome maps to one approved scope, one branch or isolated worktree, and one reviewable draft PR. Split unrelated work or changes with different review and release boundaries.
6. **Apply standards while building and reviewing.** Load only the standards relevant to the work and use the same standards again during implementation review.
7. **Separate implementation, review, and remediation.** Review is report-only. Findings are classified as valid, invalid, unclear, or out of scope before any fix.
8. **Evidence comes before “done.”** Run the repository checks, inspect their output, account for failures, and review the final diff. Ready-for-review and merge remain explicit human decisions.

The previous “Budget for it” principle is excluded from the engineering standard. Fresh sessions and lean agent files may appear as supporting tips, not headline rules.

## 6. Static Prompt Lab

The first release contains no AI model, API call, account, server-side prompt processing, or persistence.

### User flow

1. Choose a prompt recipe.
2. Fill a small set of optional or required placeholders.
3. Review the assembled prompt.
4. Copy it into a coding agent.

All customization happens in browser memory. Nothing is transmitted or saved.

### Initial prompt recipes

1. Start a feature with `task-doc-intake`.
2. Deliver an approved task doc with `task-doc-delivery-loop`.
3. Review implementation against a task doc and relevant stack standards.
4. Address verified review findings.
5. Handle QA findings with `qa-triage-and-fix`.
6. Plan a small fix without unnecessary task-doc ceremony.

### Prompt anatomy

Every recipe states:

- when to use it;
- required context and placeholders;
- skills to invoke;
- standards to apply when relevant;
- required output;
- where the agent must stop for approval;
- verification expectations.

### Composer fields

Fields vary by recipe but reuse a small common vocabulary:

- feature or outcome;
- task-doc path;
- repository area, route, endpoint, or module;
- source notes or acceptance criteria;
- relevant stack standards;
- validation commands or repository checks;
- publish boundary.

Empty optional fields are omitted cleanly from the final prompt. Required fields show inline guidance.

### Recipe contract

Each Prompt Lab recipe is stored as structured data with:

- `id` and display label;
- `whenToUse`;
- `requiredFields`;
- `optionalFields`;
- exact `template`;
- `stopCondition`;
- `expectedOutput`.

The templates below are the approved first-release copy. Bracketed values are populated by the local composer. Optional sentences are omitted when their fields are blank.

#### Start a feature

- Required: `[feature]`, `[repo-area]`, `[source-notes]`
- Optional: `[additional-context]`
- Stop condition: task doc written and awaiting explicit approval; no implementation.

```text
Use $task-doc-intake for [feature] in [repo-area].

Source notes and acceptance criteria:
[source-notes]

[additional-context]

Inspect the current repository and classify the work first. If it is small or a known fix, return the classification and a short 1–3 step plan, then stop. If it is an improvement or feature-grade, map the notes and codebase evidence into a bounded change inventory, resolve material gaps one question at a time, and create the task doc through $task-doc.

Include scope, decisions, current behavior to preserve, acceptance criteria, exclusions, likely files, risks, and verification. Do not write implementation code. Stop after the task doc is written and ask me to review and explicitly approve it.
```

#### Deliver an approved task doc

- Required: `[task-doc-path]`
- Optional: `[standards]`, `[validation]`, `[publish-boundary]`
- Stop condition: delivery loop reaches its approved endpoint or reports a blocker.

```text
Use $task-doc-delivery-loop to deliver the explicitly approved task doc at [task-doc-path].

[standards]
[validation]
[publish-boundary]

Treat the task doc as the source of truth. Respect its exclusions and preserved behavior. Implement in dependency order, apply the relevant Vascon standards, run the required validation, perform implementation review, evaluate and remediate valid findings, and publish only to the approved boundary. Report calibration, validation evidence, review verdict, finding dispositions, and final branch or PR state.
```

#### Review implementation with standards

- Required: `[task-doc-path]`, `[review-scope]`
- Optional: `[standards]`, `[validation-context]`
- Stop condition: report-only verdict; no edits.

```text
Use $review-implementation to review [review-scope] against [task-doc-path].

[standards]
[validation-context]

Read the task doc, repository instructions, diff, relevant code, and tests. Review for spec compliance first and implementation quality second. Apply the listed standards as explicit review criteria. Report only: verdict, critical findings, important findings, minor findings, missing validation, and the smallest credible fix for each finding. Do not edit files.
```

#### Address review findings

- Required: `[findings-source]`, `[task-doc-path]`
- Optional: `[validation]`, `[publish-boundary]`
- Stop condition: every finding is dispositioned and affected checks have run; behavior-changing ambiguity pauses for human input.

```text
Use $address-review-findings for the findings in [findings-source], evaluated against [task-doc-path].

[validation]
[publish-boundary]

Verify each finding against the code, tests, task doc, repository instructions, and prior decisions. Classify every item as valid, invalid, unclear, or out of scope. Ask before editing when an unclear item could change behavior or affect other fixes. Fix valid findings, reject invalid findings with evidence, defer out-of-scope items, and rerun affected checks. If the fixes materially change behavior, run one final $review-implementation. Report all finding dispositions and remaining risk.
```

#### Handle QA findings

- Required: `[qa-source]`, `[feature-area]`
- Optional: `[authorized-report-fields]`, `[validation]`
- Stop condition: every QA item has a disposition and focused validation evidence.

```text
Use $qa-triage-and-fix for the QA findings in [qa-source] covering [feature-area].

[authorized-report-fields]
[validation]

Handle every issue individually. Reproduce or verify it, classify it, fix confirmed defects, contest unsupported findings with evidence, and escalate product decisions instead of guessing. Change only report fields I have authorized. Run focused validation for meaningful fixes and return the per-issue dispositions, files changed, validation evidence, and remaining blockers. Prepare or refresh a QA handoff only if I explicitly ask for one.
```

#### Plan a small fix

- Required: `[symptom]`, `[repo-area]`
- Optional: `[reproduction]`, `[validation]`
- Stop condition: classification and short plan returned; no implementation.

```text
Classify the following work before implementation:

Symptom: [symptom]
Repository area: [repo-area]
[reproduction]
[validation]

If this is a known fix with no new contract, permission boundary, migration, persistent state, or cross-module design, skip the task doc. Return the classification, evidence or reproduction, and a focused 1–3 step fix plan, then stop for confirmation. If the work crosses one of those boundaries, explain why it requires $task-doc-intake instead. Do not implement yet.
```

### Deferred enhancement

AI prompt refinement is explicitly deferred. If reconsidered, it requires a separate design covering API billing, team access, quotas, rate limits, privacy, retention, and failure behavior.

## 7. Situation Recipes

Recipes provide a short ordered chain, not a full narrative.

### Build a feature

`task-doc-intake` → task-doc approval → one `task-doc-delivery-loop` run, which internally uses `review-implementation` and `address-review-findings` when needed

### Review completed work

Task doc or source criteria → `review-implementation` + relevant stack standards → verdict → optional `address-review-findings`

### Handle QA findings

QA report → `qa-triage-and-fix` → focused validation → done report

`prepare-qa-handoff` is optional and appears only when the team explicitly needs a new or refreshed feature handoff after the fixes. It is not the routine final step for fixing QA bugs.

### Understand existing code

`implementation-map` → optional visual companion → bounded maintenance task or `task-doc-intake`

Each recipe shows its trigger, ordered skills, expected output, and copyable Prompt Lab shortcut.

## 8. Stack Standards

Standards are grouped by the type of work they govern:

- **Frontend:** `tanstack-fe-standard`, `tanstack-start-standard`, `forms-rhf-zod-standard`
- **API and data:** `nestjs-api-standard`, `migration-discipline`, `audit-logging-standard`
- **Workspace:** `nx-monorepo-standard`
- **Code quality:** `ultracite-standard`

The standards section explains the team rule:

> Apply the relevant standard during implementation and pair it with `review-implementation` when compliance needs an explicit verdict.

It does not reproduce entire `SKILL.md` files. Each card provides the use case, core guardrail, and example prompt.

## 9. Skill Reference

The skill index remains secondary and searchable. The current inventory comes from the registered `SKILL_NAMES` in `bin/link-skills.sh`, enriched with each registered skill's `name` and `description` frontmatter. Deprecated names are excluded.

Exact first-release groups:

- **Intake and planning:** `roadmap-todo`, `task-doc`, `task-doc-intake`, `review-task-docs`, `implementation-map`
- **Delivery and publishing:** `task-doc-delivery-loop`, `isolated-worktree`, `publish-branch`
- **Implementation standards:** `audit-logging-standard`, `forms-rhf-zod-standard`, `migration-discipline`, `nestjs-api-standard`, `nx-monorepo-standard`, `tanstack-fe-standard`, `tanstack-start-standard`, `ultracite-standard`
- **Review and remediation:** `review-implementation`, `address-review-findings`, `review-doc-changes`
- **QA, audits, and handoffs:** `audit-api`, `audit-ui`, `qa-triage-and-fix`, `prepare-frontend-handoff`, `prepare-qa-handoff`
- **Documentation and repository health:** `repo-docs-audit`, `rewrite-docs-from-code`, `repair-agent-files`
- **Artifacts:** `html-artifact`, `markdown-artifact`, `image-artifact`, `artifact-workbench`, `repo-design-context`, `publish-artifact`
- **Skill-system maintenance:** `repo-skill-scan`

Search matches skill name, purpose, and workflow tags. Empty results provide a reset action and direct the developer to situation recipes.

## 10. Visual Design

The approved direction is “Vascon blue field manual.”

- Official Vascon transparent logo, bundled locally.
- Primary navy: `#000054`.
- Action and highlight blue: `#43BAFF`.
- Cool paper-white and pale blue-gray surfaces.
- Editorial `ui-serif` or Georgia headings.
- System sans-serif body text.
- Monospace labels for stages, skill names, and prompt content.
- Numbered modules, thin rules, restrained circular geometry inspired by the Vascon mark, and strong approval-gate callouts.
- Minimal rounding and shadows; hierarchy comes from spacing, color blocks, typography, and borders.
- No decorative stock photography, model-generated illustrations, or inline SVG artwork.

The site must meet accessible contrast requirements. The light sky blue is used as an accent or on sufficiently dark surfaces, not for low-contrast body text.

## 11. Interaction Design

- Sticky desktop navigation and compact mobile menu.
- Anchor links support direct navigation to major sections.
- Progressive disclosure keeps detailed skill context collapsed until requested.
- Prompt recipes update the preview immediately in browser memory.
- Copy actions provide visible and screen-reader feedback.
- If the Clipboard API fails, the prompt becomes selectable and the site explains how to copy manually.
- Skill search and category filters work without network access.
- Keyboard focus is visible, controls have accessible names, and all interactions work without a pointer.
- Motion is restrained and respects reduced-motion preferences.

## 12. Technical Shape

- The site is initialized in the dedicated project directory `sites/vascon-agent-cookbook/`; the skill-pack repository root is never replaced or treated as the site root.
- One route built with the Sites starter structure inside that directory.
- Static structured data for stages, principles, prompts, recipes, standards, and skills.
- Small client-side components only where state is useful: prompt composer, copy feedback, filters, mobile navigation, and disclosure panels.
- No database, object storage, app-owned authentication state, uploads, connectors, or external API.
- The official logo is copied into site assets and not hotlinked.
- The skill index is generated from the registered public inventory in `bin/link-skills.sh` and enriched from skill frontmatter at implementation time.
- The first deployment is owner-private for review. Team rollout requires an explicit access decision naming the supported workspace, group, or member list; that access is configured and verified only after approval. Public access is never inferred.

## 13. Error and Empty States

- Missing required Prompt Lab input: inline explanation; copying remains disabled until resolved.
- Clipboard unavailable: select-all fallback with concise manual instruction.
- Skill search has no results: reset action plus links to recipes and standards.
- Local interaction state never blocks reading the underlying guidance.
- The site does not depend on the Vascon corporate site being online after the logo is bundled.

## 14. Verification

Before publishing:

- production build succeeds;
- all referenced Vascon skills exist in the current repository;
- retired skill names do not appear;
- navigation and anchored sections work on desktop and mobile;
- Prompt Lab recipes assemble expected text with optional fields present and absent;
- copy success and fallback behavior work;
- search, filters, empty state, and reset work;
- keyboard navigation and visible focus work;
- color contrast and reduced-motion behavior are acceptable;
- the official logo renders sharply at supported sizes;
- no prompt input or interaction data is transmitted;
- the owner-private review deployment loads successfully;
- after an explicit team-access decision, at least one intended non-owner access path is verified without making the site public.

## 15. Success Criteria

The site succeeds when a Vascon developer can:

1. understand the task-doc rule within the first viewport;
2. identify whether work needs a task doc;
3. copy a correct feature-intake prompt in under two minutes;
4. understand the human approval boundary;
5. find the relevant implementation or review standard without scanning the full catalog;
6. distinguish report-only review from remediation;
7. customize and copy any Prompt Lab recipe while understanding its stop condition.

## 16. Out of Scope

- AI chat or prompt refinement;
- OpenAI API usage;
- conversation or prompt history;
- user accounts or team analytics;
- private AlphaDigital skills;
- a third-party skill installation catalog;
- the old ten-stage lifecycle;
- a Friday workshop or training-course section;
- full `SKILL.md` reproduction;
- publishing or merging from the site;
- live synchronization with GitHub in the first release.
