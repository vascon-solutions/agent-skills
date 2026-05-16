---
name: prepare-frontend-handoff
description: Use when writing frontend-dev handoffs for API contracts, screen behavior, route state, form mapping, query/cache behavior, or migration steps.
---

# Prepare Frontend Handoff

## Purpose

Create frontend-dev handoffs that translate backend/API delivery or product workflow changes into actionable UI implementation guidance. Unlike QA handoffs, these can include implementation details, helper names, route state, query keys, file paths, migration notes, and suggested checklists when they help the frontend team avoid ambiguity.

## When To Use

Use this for:

- Backend-to-frontend handoffs after API delivery.
- Frontend migration notes when endpoints, contracts, route state, or workflow ownership change.
- Cross-app handoffs for procurement, DDD, vendor, or shared UI packages.
- Notes covering screens, forms, tables, filters, uploads, exports, cache invalidation, templates, assets, and retired API calls.

Do not use this for:

- QA sign-off notes. Use `prepare-qa-handoff`.
- Fixing QA bugs. Use `qa-triage-and-fix`.
- End-user product documentation.

## Workflow

1. Read the source repo instructions and relevant architecture/contributing docs.
   - Common bootstrap files include `AGENTS.md`, `CLAUDE.md`, README, architecture docs, and contributing docs.
2. Inspect the backend/API source or contract source that defines the feature: route constants, controllers/routes, DTOs/schemas, enums, services, tests, seed data, queues, exports, and feature flags.
   - Inspect the host repo's shared-contract package or linked workspace package when routes, schemas, or enums are shared.
3. Inspect the frontend implementation surfaces: routes/screens, API helper modules, request client, shared types, form state, table/filter state, route search params, query keys, invalidation/refetch behavior, assets/templates, and tests.
   - If the frontend repo is not available in the workspace, ask for its path or scope the handoff to verified API/contracts only. Do not invent frontend routes, hooks, helpers, components, or query keys.
4. Identify the model shift or implementation contract: what the UI should create, resolve, mutate, read, disable, poll, refresh, or stop calling.
5. Ground every instruction in code, tests, or an explicit product/API decision.
6. Include implementation detail where useful, but keep the handoff concise and scoped to the feature.
7. Call out retired endpoints/helpers explicitly when migration risk exists.
8. If a handoff for the same feature already exists, update it in place rather than creating a parallel doc.
9. Write handoffs where the host repo keeps project docs; `docs/<feature>-handoff.md` is a good default when no convention exists.
10. Run `pnpm exec prettier --check <handoff.md>` after editing Markdown.

## Recommended Structure

Always include:

- `Purpose`
- `API Surface`
- `Retired Dependencies` when replacing any existing UI path
- `Implementation Checklist`

Include the other sections only when they fit the feature:

```markdown
# <Feature> Frontend Handoff

## Purpose

What changed and why this handoff exists.

## Delivery Confirmation

Backend/API items delivered and their frontend meaning.

## Core Model Shift

Old UI model vs new UI model, including source of truth.

## Identifiers And Statuses

ID types, status values, ownership semantics, and read/write distinctions.

## API Surface

Endpoint table, helper names, representative payloads/responses, and errors the UI should handle.

## Screen / Route Guidance

Entry points, route search state, screen states, CTA enablement, disabled states, and navigation behavior.

## Data Flow

Query keys, cache invalidation, refetch timing, optimistic behavior if relevant, and list/detail refresh expectations.

## Uploads / Downloads / Background Jobs

FormData fields, templates/assets, queue/poll states, retry/failure display, and completion refreshes.

## Retired Dependencies

Endpoints, helpers, props, route params, query keys, or assets to remove or avoid.

## Implementation Checklist

Concise task list for frontend developers.

## Explicit Exclusions

What not to build in this slice.
```

## Accuracy Checklist

Before handing off, verify:

- Endpoint names and payloads match the current API/shared contracts.
- All IDs are typed according to the API contract, especially UUID strings.
- Status names and transitions match backend enums and service behavior.
- UI source of truth is clear: selected filters, active record, parent package, route state, or backend workflow state.
- Forms send only fields accepted by the target endpoint.
- Read/report routes are separated from mutation routes when the API distinguishes them.
- Cache invalidation/refetch guidance matches the frontend query/data flow.
- Upload templates, FormData fields, file limits, and poll endpoints match implementation.
- Retired endpoints/helpers are called out when old UI paths must be removed.
- Suggested file paths or helper names match existing frontend conventions.
- Any inferred frontend behavior is marked as recommended rather than delivered.

## Tone Rules

Prefer precise implementation guidance:

- "Use"
- "Keep"
- "Replace"
- "Remove"
- "Resolve before create"
- "Invalidate after"
- "Disable when"

Avoid vague handoff language:

- "Frontend should just..."
- "Probably..."
- "Maybe..."
- Unverified product policy.
- Routes, components, hooks, helpers, or query keys that do not exist in the frontend repo.

## Output

When done, report:

- Handoff file path or pasted Markdown.
- Backend/API and frontend surfaces checked.
- Key model or contract shifts.
- Validation run.
- Validation not run and why.
- HTML companion available — run `html-artifact` on the handoff file for a tabbed browser-ready version with API surface, checklist, and retired dependencies. (yes / skip)
