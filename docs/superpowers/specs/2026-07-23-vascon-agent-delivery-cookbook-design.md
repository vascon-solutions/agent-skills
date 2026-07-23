# Vascon Agent Delivery Cookbook — Site Design

**Status:** Approved design  
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
9. **Friday workshop:** one worked team exercise.
10. **Install/update:** one compact link to the public repository and its current installation instructions.

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

### 3. Implement and verify

- Primary skill: `task-doc-delivery-loop`
- Purpose: implement the approved scope in dependency order, apply relevant standards, validate, review, and prepare a draft PR.
- Contextual standards: TanStack frontend, TanStack Start, NestJS API, forms, migrations, audit logging, Nx, and Ultracite.
- Output: validated implementation on a bounded branch with accounted-for evidence.

### 4. Review and close gaps

- Review skill: `review-implementation`
- Remediation skill: `address-review-findings`
- Purpose: judge the completed diff against the task doc, separate review from remediation, verify findings before fixing them, and rerun affected checks.
- Output: a verdict, dispositioned findings, validation evidence, and known PR state.

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

### Deferred enhancement

AI prompt refinement is explicitly deferred. If reconsidered, it requires a separate design covering API billing, team access, quotas, rate limits, privacy, retention, and failure behavior.

## 7. Situation Recipes

Recipes provide a short ordered chain, not a full narrative.

### Build a feature

`task-doc-intake` → task-doc approval → `task-doc-delivery-loop` → `review-implementation` → `address-review-findings`

### Review completed work

Task doc or source criteria → `review-implementation` + relevant stack standards → verdict → optional `address-review-findings`

### Handle QA findings

QA report → `qa-triage-and-fix` → focused validation → `prepare-qa-handoff`

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

The skill index remains secondary and searchable. It is sourced from structured site data rather than handwritten repeated markup.

Suggested groups:

- intake and planning;
- implementation and standards;
- verification and audits;
- review and remediation;
- QA and handoffs;
- documentation and repository health;
- artifacts and publishing;
- skill-system maintenance.

Search matches skill name, purpose, and workflow tags. Empty results provide a reset action and direct the developer to situation recipes.

## 10. Friday Workshop

The workshop section gives the CTO or facilitator a repeatable live exercise:

1. Start with a rough feature request.
2. Run `task-doc-intake`.
3. Review the resulting scope and task doc.
4. Explicitly approve it.
5. Explain how `task-doc-delivery-loop` would implement it under relevant standards.
6. Run or demonstrate `review-implementation`.
7. Evaluate and remediate one example finding.

The workshop is a teaching path through the same site, not a separate course.

## 11. Visual Design

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

## 12. Interaction Design

- Sticky desktop navigation and compact mobile menu.
- Anchor links support direct navigation to major sections.
- Progressive disclosure keeps detailed skill context collapsed until requested.
- Prompt recipes update the preview immediately in browser memory.
- Copy actions provide visible and screen-reader feedback.
- If the Clipboard API fails, the prompt becomes selectable and the site explains how to copy manually.
- Skill search and category filters work without network access.
- Keyboard focus is visible, controls have accessible names, and all interactions work without a pointer.
- Motion is restrained and respects reduced-motion preferences.

## 13. Technical Shape

- One route built with the Sites starter structure.
- Static structured data for stages, principles, prompts, recipes, standards, and skills.
- Small client-side components only where state is useful: prompt composer, copy feedback, filters, mobile navigation, and disclosure panels.
- No database, object storage, authentication-owned application state, uploads, connectors, or external API.
- The official logo is copied into site assets and not hotlinked.
- The skill data reflects the current repository at implementation time.
- Deployment is private by default.

## 14. Error and Empty States

- Missing required Prompt Lab input: inline explanation; copying remains disabled until resolved.
- Clipboard unavailable: select-all fallback with concise manual instruction.
- Skill search has no results: reset action plus links to recipes and standards.
- Local interaction state never blocks reading the underlying guidance.
- The site does not depend on the Vascon corporate site being online after the logo is bundled.

## 15. Verification

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
- the deployed private URL loads successfully.

## 16. Success Criteria

The site succeeds when a Vascon developer can:

1. understand the task-doc rule within the first viewport;
2. identify whether work needs a task doc;
3. copy a correct feature-intake prompt in under two minutes;
4. understand the human approval boundary;
5. find the relevant implementation or review standard without scanning the full catalog;
6. distinguish report-only review from remediation;
7. complete the Friday workshop using the same workflow presented for daily work.

## 17. Out of Scope

- AI chat or prompt refinement;
- OpenAI API usage;
- conversation or prompt history;
- user accounts or team analytics;
- private AlphaDigital skills;
- a third-party skill installation catalog;
- the old ten-stage lifecycle;
- full `SKILL.md` reproduction;
- publishing or merging from the site;
- live synchronization with GitHub in the first release.
