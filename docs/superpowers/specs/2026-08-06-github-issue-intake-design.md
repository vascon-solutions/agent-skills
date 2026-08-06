# GitHub Issue Intake — Skill Design

**Status:** Approved design

**Date:** 2026-08-06

**Audience:** Coding-agent skill maintainers and teams using GitHub issues as implementation handoffs

**Primary outcome:** Turn a reported bug or improvement into an approved, code-grounded GitHub issue that another teammate can execute directly or convert into a task doc without relying on hidden conversation context.

## 1. Context

The current skill pack has strong task discovery and delivery workflows:

- `task-doc-intake` turns loose notes, screenshots, and codebase findings into an approved change inventory and, for eligible work, a task doc;
- `task-doc` renders a durable implementation artifact from an issue or another bounded source;
- the GitHub plugin or authenticated `gh` fallback can inspect and create issues; and
- `publish-branch` and `isolated-worktree` can publish task-doc-only work safely when explicitly requested.

The missing workflow is issue-first intake. A user may notice a bug or improvement, want the repository inspected thoroughly, and then create a GitHub issue for another teammate without creating implementation artifacts. They may also want to deliberate on unresolved scope before issue creation or optionally create a task doc after the issue exists.

Two issues from `floatstar/ncdmb-procurement-ui` illustrate the intended quality bar:

- [#178 — Align vendor signup password fields with reset-password components](https://github.com/floatstar/ncdmb-procurement-ui/issues/178)
- [#181 — Add browser-history support for DataTable pagination](https://github.com/floatstar/ncdmb-procurement-ui/issues/181)

Both record the problem, code evidence, requested outcome, acceptance criteria, exclusions, and handoff context. The new skill should make that outcome repeatable without creating phantom task-doc or PR references.

## 2. Decision

Create a standalone `github-issue-intake` skill in the shared `agent-skills` repository.

The skill owns this lifecycle:

```text
raw report
  -> repository and issue-convention discovery
  -> duplicate search
  -> classification and focused code intake
  -> one-question-at-a-time deliberation where needed
  -> issue and metadata preview
  -> explicit approval
  -> GitHub issue creation
  -> task-doc creation, teammate handoff, or further deliberation
```

The skill borrows the classification and interview discipline of `task-doc-intake` but does not invoke that skill for the initial issue workflow. Direct composition would conflict with `task-doc-intake`'s task-doc-oriented terminal contract and would repeat discovery. After an eligible issue is created, the skill may invoke `task-doc` with the approved issue as the authoritative source.

## 3. Goals

- Make invocations such as `Use github-issue-intake`, `I found a bug that should become an issue`, and `Explore this improvement and create a GitHub issue` sufficient.
- Ask the user to state the issue or improvement and provide any screenshots, links, reproduction notes, or expected behavior.
- Ground issue claims in repository instructions, current code, existing tests, shared patterns, and supplied evidence.
- Adapt to useful repository issue templates and recent comparable issues while preserving a reliable fallback structure.
- Search for likely duplicate open and closed issues before creating a new one.
- Split independently assignable or verifiable outcomes into separate issue drafts.
- Require explicit approval of the exact issue and proposed metadata before any GitHub write.
- Produce issues that are complete enough for teammate handoff or later `task-doc` transformation.
- Preserve the existing size boundary that keeps task docs for improvement and feature-grade work rather than small/local fixes.
- Keep references truthful: only mention task docs, branches, or PRs that actually exist.

## 4. Non-Goals

- Do not implement or fix the reported work.
- Do not edit implementation files, run implementation generators, or create implementation branches or PRs.
- Do not turn every small bug into a task doc.
- Do not invent requirements, reproduction evidence, code evidence, labels, assignees, milestones, projects, task docs, branches, or PRs.
- Do not claim a bug was reproduced when it was only reported or inferred.
- Do not replace `task-doc-intake`, `task-doc`, `publish-branch`, or the GitHub plugin's general triage responsibilities.
- Do not require a heavyweight implementation map for focused issue intake.
- Do not silently create issue metadata or GitHub artifacts without approval.

## 5. Trigger and Routing Contract

The skill description should identify the triggering situation rather than summarize its workflow. A suitable shape is:

```yaml
description: Use when a reported bug or improvement needs code-grounded repository intake and an approved GitHub issue for teammate handoff before optional task-doc creation.
```

Typical triggers include:

```text
Use github-issue-intake.
I found a bug that should become an issue.
Explore this improvement and create a GitHub issue.
Document this for another teammate to take up.
Turn these screenshots and notes into a GitHub issue.
```

Requests to inspect or summarize an existing issue remain general GitHub triage. Requests to implement an issue route to the normal planning or task-doc delivery workflow. Requests to create only a task doc continue to route to `task-doc-intake` or `task-doc`.

## 6. Intake Workflow

### 6.1 Resolve context

1. Ask the user to describe the bug or improvement if no report has been supplied.
2. Collect available screenshots, URLs, reproduction notes, observed behavior, expected behavior, and constraints.
3. Resolve the target repository from an explicit URL or repository name, then the current checkout. Ask only when the repository remains ambiguous.
4. Read applicable repository instructions and identify the verified default or requested target branch.
5. Record the source revision or PR when evidence comes from a non-default branch so code claims are not presented as default-branch facts.

### 6.2 Check conventions and duplicates

Inspect in this order:

1. repository issue forms or templates;
2. repository contribution or issue-writing guidance;
3. recent comparable issues; and
4. the skill's fallback issue structure.

Repository conventions take precedence when they are useful. The skill maps its required evidence and scope fields into those conventions rather than discarding them.

Search open and closed issues for likely duplicates using the behavior, affected surface, error text, route, component, service, or domain terms. If a likely duplicate exists, stop before creation and present the relationship with grounded options:

- add new evidence to the existing issue;
- create a distinct follow-up because the scope or root cause differs; or
- abandon the new issue.

Commenting on an existing issue is also a GitHub write and requires explicit approval.

### 6.3 Classify and decompose

Classify the report on two axes.

**Report type:**

- `bug` — observed behavior violates expected or existing behavior;
- `improvement` — a bounded enhancement or behavior-preserving change is requested; or
- `unresolved` — the desired behavior or root problem still needs deliberation.

**Delivery size:**

- `small/fix` — local, bounded work without a contract, auth, migration, persistence, cross-module, or broad compatibility boundary;
- `improvement` — bounded multi-file or shared-surface change with a known desired outcome; or
- `feature-grade` — cross-module, contract, route, persistent-state, auth, migration, or broad workflow work.

The issue is valid at every size. The size classification only controls task-doc eligibility after issue creation.

When one report contains multiple outcomes, split them into separate issue drafts if they can be assigned, delivered, or verified independently. Combine symptoms only when they share one root cause and one delivery outcome. If work spans repositories, identify the primary owning repository and create separate issues when each repository has an independently shippable change.

### 6.4 Inspect the codebase

Inspect enough of the current implementation to establish:

- entry points and state or request ownership;
- current behavior and the source of the reported limitation;
- relevant shared components, services, helpers, or contracts;
- nearby reusable patterns or authoritative implementations;
- tests that protect current behavior or expose a coverage gap;
- behavior and compatibility guarantees that must remain unchanged; and
- likely files for implementation orientation.

Use focused repository search and symbol tracing. Invoke `implementation-map` only when the affected surface is independently large enough to justify a durable map; do not make it a routine dependency.

Maintain three evidence classes throughout the intake:

- **verified:** directly established from code, tests, runtime reproduction, or authoritative documentation;
- **reported:** supplied by the user, screenshot, QA note, or external report but not independently reproduced; and
- **inferred:** a reasoned conclusion from verified facts, labeled as an inference.

Never upgrade reported or inferred behavior to verified behavior silently.

### 6.5 Resolve gaps

Ask one focused question at a time only when the answer would materially change issue scope, acceptance criteria, ownership, or exclusions. Do not ask the user for facts that repository inspection can resolve safely.

For unresolved product or architecture choices, present two or three realistic options with implications and lead with a recommendation. Record unresolved choices in the issue rather than inventing a decision.

## 7. Issue Draft Contract

The title should describe the observable outcome or affected behavior concisely. Avoid speculative root causes and unnecessary implementation prescriptions.

When no suitable repository template exists, use this fallback body structure.

### Problem

Describe the user or system impact. For a bug, distinguish observed behavior from expected behavior.

### Evidence and reproduction

Include reproduction steps, screenshots, URLs, logs, or supplied reports. State explicitly whether the behavior was reproduced, reported, or inferred. Omit this section only when a repository template has an equivalent field or the improvement has no reproduction concept.

### Current code evidence

Name relevant symbols, files, tests, contracts, and patterns. Explain what each reference establishes instead of listing unexplained paths.

### Requested change

Define the desired outcome and system boundary without turning the issue into a line-by-line implementation plan.

### Acceptance criteria

List observable, verifiable outcomes. Include regression expectations where existing behavior must remain intact.

### Current behavior to preserve

Record existing contracts, workflows, permissions, API payloads, compatibility behavior, or other invariants that must not regress.

### Excluded

Define explicit boundaries that prevent adjacent work from entering the issue.

### Decisions or unknowns

Include only when unresolved choices remain. Each entry names realistic options, implications, and who or what should resolve the decision.

### References and handoff

Link supplied evidence, related issues, real PRs, real specs, or source notes. State task-doc eligibility and the selected handoff state truthfully.

For teammate handoff without a task doc, use wording equivalent to:

```text
Task doc not created. The assignee may create one from this issue after reviewing the scope.
```

Do not add a task-doc path, branch, or PR reference before that artifact exists.

## 8. Preview and Approval Gate

Before any issue creation or issue comment, show:

- target repository;
- exact title;
- exact body;
- duplicate-search result;
- proposed existing labels;
- proposed assignee, milestone, or project only when requested or supported by explicit user direction; and
- whether the issue will be one issue or part of a split set.

Require explicit approval before writing to GitHub. Approval of one draft does not approve sibling drafts unless the user clearly approves the full set.

The skill may suggest labels that already exist in the repository. It must not invent labels or apply labels, assignees, milestones, or project placement without explicit approval.

Use the GitHub connector when available. Use authenticated `gh` as a focused fallback when the connector cannot perform the required read or write. If authentication or write access is unavailable, preserve the exact copy-ready draft, report the blocker, and do not imply that the issue was created.

After a successful write, return the issue number and URL and verify that the created title, body, and approved metadata match the preview.

## 9. Task-Doc and Publishing Handoff

After issue creation, route by delivery size.

### Small/fix

Recommend direct teammate handoff from the issue. Do not offer task-doc creation by default. If the user challenges the classification, explain the boundary and reassess rather than bypassing it silently.

### Improvement or feature-grade

Offer exactly these next paths:

1. create the task doc now;
2. leave task-doc creation to the assignee; or
3. continue deliberating before deciding.

If the user chooses to create the task doc now:

- invoke `task-doc` with source mode `issue`;
- use `transform-only` because the approved issue is authoritative and bounded;
- carry forward code evidence, current behavior to preserve, exclusions, references, and unresolved decisions;
- do not repeat the completed intake unless new information exposes a material gap; and
- stop before implementation.

After writing the task doc, separately offer to publish it in a task-doc-only PR. Publishing is not implied by task-doc creation. It requires explicit approval and should use `isolated-worktree` and `publish-branch` from a clean branch based on the verified target branch.

Update the issue with a task-doc path or PR link only after the referenced artifact exists. If the task doc remains local, report that state without pretending it is accessible to the assignee.

## 10. Safety and Error Handling

Stop or pause with a concrete explanation when:

- the target repository cannot be resolved safely;
- repository access or GitHub authentication is unavailable;
- the reported behavior cannot be distinguished from expected behavior and that distinction changes the issue materially;
- a likely duplicate requires user disposition;
- cross-repository ownership remains ambiguous;
- evidence points to materially different root causes that require separate issues; or
- the issue preview has not been approved.

Do not block issue creation merely because runtime reproduction is unavailable. Preserve the distinction by labeling the behavior as reported and grounding the remaining claims in code evidence.

Never mutate implementation files during intake. Read-only diagnostics and runtime reproduction are allowed when they are safe, bounded, and relevant.

## 11. Skill Package

Add:

- `skills/github-issue-intake/SKILL.md` for the workflow, gates, classifications, and handoffs;
- `skills/github-issue-intake/references/issue-template.md` for the fallback structure and drafting rules; and
- `skills/github-issue-intake/agents/openai.yaml` for discoverability metadata and a concise default prompt.

Update:

- `bin/link-skills.sh` to register the skill;
- the `README.md` directory tree;
- the README skill-purpose table; and
- the README workflow guidance for issue-first intake.

No custom runtime script is required initially. The skill should compose available repository search, GitHub, task-doc, isolation, and publishing capabilities.

The finished skill must remain framework-agnostic and contain no repository-specific paths, domain enums, or product rules. The motivating issues may remain in this design spec but should not become hard-coded skill behavior.

## 12. Validation Strategy

Use the skill-writing RED/GREEN/REFACTOR discipline.

Before writing the skill, run representative prompts without the skill and record the failures or inconsistencies. After drafting, rerun the same scenarios with the skill loaded and refine only against observed gaps.

The scenario set should cover:

1. a screenshot-backed UI bug with an authoritative nearby implementation pattern;
2. an improvement that contains independently assignable outcomes and should split;
3. a likely duplicate issue;
4. a small fix that should not produce a task doc;
5. an eligible improvement that hands off to `task-doc` without repeating discovery;
6. a repository with a useful issue template;
7. metadata suggestions that require explicit approval;
8. code evidence that supports an inference but not confirmed reproduction;
9. unavailable GitHub authentication or write access;
10. a teammate handoff that must not include phantom task-doc or PR references; and
11. a request that attempts to broaden issue intake into implementation.

Validation should also confirm:

- frontmatter and metadata are valid;
- the skill is registered by `bin/link-skills.sh`;
- all five supported tool targets receive the canonical symlink after linking;
- README discovery information is complete; and
- only the intended skill-pack files change.

## 13. Visual Companion Decision

No visual companion is required. This is a linear operational workflow whose exact language, evidence classes, approval gates, and handoff boundaries are clearer in text than in a diagram.

## 14. Approved Decisions

- Use a standalone `github-issue-intake` skill.
- Preview and approve before creating an issue.
- Prefer repository issue conventions, with a standard fallback structure.
- Split independently assignable or verifiable outcomes by default.
- Keep task docs limited to improvement and feature-grade work.
- Suggest only existing metadata and require explicit approval before applying it.
- Treat the GitHub issue as the primary artifact and offer task-doc creation only after the issue exists.
- Never reference task docs, branches, or PRs that do not yet exist.
- Store the skill in the shared `/Users/dee/agent-skills` repository.

No product or architecture decisions remain unresolved for implementation planning.
