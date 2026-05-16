---
name: prepare-qa-handoff
description: Use when writing QA sign-off notes for a feature with state transitions, endpoints, role boundaries, or background jobs.
---

# Prepare QA Handoff

## Purpose

Create neutral, shareable QA handoff notes that describe what a feature does, how the main lifecycle behaves, which surfaces are available, and what outcomes are expected. The handoff should support QA's work without sounding like a tutorial.

## When To Use

Use this for:

- Feature handoffs to QA, ClickUp, release notes, or test planning.
- API or workflow features with state transitions, roles, reports, exports, queues, or background jobs.
- Updating an existing QA handoff after review feedback.
- Converting implementation details into QA-facing behavior.

Do not use this for:

- Fixing QA bugs. Use `qa-triage-and-fix`.
- Frontend implementation handoffs to developers. Use `prepare-frontend-handoff`.
- Writing user documentation or product help text.
- Internal engineering architecture docs.

## Workflow

1. Read the repo's source-of-truth instructions and relevant docs first.
   - Common bootstrap files include `AGENTS.md`, `CLAUDE.md`, README, architecture docs, and contributing docs.
2. Open the actual feature surfaces before writing: controllers/routes, services/business rules, DTOs/schemas, entities, tests, seed data, and any queue/export modules that affect QA behavior.
3. If shared contracts define routes or schemas, inspect the shared package source directly. Follow the host repo's shared-contract location or package manager links.
4. Ground every claim in implementation or tests. If behavior is inferred, label it as such or omit it.
5. Write for QA as peers: concise, neutral, and outcome-oriented.
6. Remove code-path tables, file references, and implementation internals unless QA explicitly asked for them.
7. Include endpoint touchpoints and representative payloads only where they reduce ambiguity.
8. Include positive behavior, negative coverage, role boundaries, state transitions, background-job states, and known scope rules.
9. If a handoff for the same feature already exists, update it in place rather than creating a parallel doc.
10. Write handoffs where the host repo keeps project docs; `docs/<feature>-handoff.md` is a good default when no convention exists.
11. Run `pnpm exec prettier --check <handoff.md>` after editing Markdown.

For ClickUp paste-in, keep headings short, avoid wide tables where bullets will read better, and keep code blocks limited to endpoint/payload references that QA will actually need.

## Tone Rules

Prefer:

- "Expected behavior"
- "Endpoint touchpoints"
- "Relevant negative coverage"
- "Completion criteria"
- "Supported filters"
- "Scope rule"
- "Visible states"

Avoid:

- "QA should..."
- "How to test..."
- "Try this..."
- "Why this matters..."
- Step-by-step coaching for ordinary QA practice.
- Internal phrasing such as "controller", "service", "repository", "entity", or file paths.
- Frontend implementation jargon such as hook names, component internals, or cache-key names.

## Recommended Structure

Use this shape unless the feature needs something smaller:

```markdown
# <Feature> Handoff

## Scope

Short summary of the feature and lifecycle covered.

## Access Context

Actor/role table with supported behavior.

## <Lifecycle Or State Model>

Describe each state, transition, and blocked behavior.

## End-To-End Flow Reference

List major flow stages with endpoint touchpoints, representative payloads, expected responses, and relevant negative coverage.

## Reporting / Background Jobs / Exports

Include filters, queue/poll/download states, retention, and empty-result behavior.

## Boundaries

Role boundaries, closed-state behavior, policy flags, feature flags, and read/write distinctions.

## Completion Criteria

Outcome checklist for sign-off.
```

## Accuracy Checklist

Before handing off, verify:

- State names match code/shared enums exactly.
- Endpoint names match route constants or controllers.
- Status codes match tests or controller behavior.
- Role access matches guards/decorators/tests.
- Filters match repository/service behavior.
- Reporting/export rows are not described as submitted-only unless code filters that way.
- Queue status names and retention behavior match implementation.
- Seed credentials are current if included.
- Negative coverage is phrased as behavior, not as instructions.
- Any skipped validation is called out in the final response.

## Output

When done, report:

- Handoff file path or pasted Markdown.
- Key behavioral clarifications made.
- Validation run.
- Validation not run and why.
- HTML companion available — run `html-artifact` on the handoff file for a browser-ready version with state timeline and endpoint tables. (yes / skip)
