# Discovery Checklist

Use this checklist after stack-profile detection. Skip categories that don't apply to the profile.

## All Profiles — Bootstrap

- Read `AGENTS.md` and `CLAUDE.md` if present.
- Read `README.md` and any `docs/architecture*`, `docs/contributing*`, or `docs/conventions*` files.
- Check for a feature-specific task doc, design doc, or PR description if supplied.

## Frontend Profile

Locate entry points:

- Route or page files matching the feature path (`app/`, `pages/`, `routes/`, file-based routers).
- Loader, action, or data-fetching files paired with the route.
- Feature folder `index.ts`/`index.tsx` or barrel exports.

Collect evidence:

- Components — visual leaves, container components, dialogs, forms, tables, filters.
- Hooks — query hooks, mutation hooks, custom logic hooks, derived state hooks.
- Client state — Zustand/Redux/Jotai stores, context providers, URL/search state.
- Request layer — API helper modules, request client, generated SDK, contracts.
- Cache behavior — query keys, invalidation calls, refetch triggers, optimistic updates.
- Assets and templates — uploads, exports, downloads, copy.
- Tests — feature tests, hook tests, integration tests, MSW handlers or test fixtures.

## Backend Profile

Locate entry points:

- Route registration, controllers, resolvers, gRPC handlers, or message subscribers.
- Module or feature folder root.
- Job, queue, or cron registration files.

Collect evidence:

- Services or use cases — orchestration of repositories, external calls, validators.
- Repositories or data access layer — models, queries, transactions.
- DTOs, schemas, contracts, shared types.
- Guards, policies, middleware, validators.
- Background jobs — queues, schedulers, workers, retry policies.
- Events — emitted, consumed, payload contracts.
- External integrations — third-party clients, webhooks, file storage.
- Database migrations relevant to the feature.
- Tests — unit, integration, contract, e2e.

## Full-Stack Profile

Do both frontend and backend checklists, then add:

- Shared contract source — package, schema file, generated SDK, OpenAPI/GraphQL doc.
- Cross-boundary failure handling — frontend retries, backend error responses, alignment of status codes.
- Lifecycle events that span the boundary — uploads, jobs, polling.

## Library / Package Profile

- Public exports from `index.ts` / `package.json` `exports` field.
- Factories, providers, configuration helpers.
- Domain helpers, utilities, types.
- Consumers — workspaces that import this package.
- Test contract — what the test suite locks in.
- Compatibility surface — peer deps, version constraints, breaking-change risk.

## Mixed / Unknown

Pick the strongest signal first:

- If routes exist → start as frontend or backend depending on which side the routes live on.
- If a package has both `dist/` and consumer code in the same repo → start as library and follow consumers.
- If evidence is contradictory, write the map with what you have and label uncertain boundaries as inference.

## Grouping Rule

Group collected files by **workflow**, not folder. Workflow groups commonly include:

- entry / route / page
- composition / page shell
- form / input
- list / table / filtering
- mutation / submission
- upload / download / export
- background job / queue
- contract / DTO / schema
- guard / permission
- state / store / cache
- tests

## When To Stop

Stop discovery when:

- you can fill all 9 mandatory sections from evidence
- additional file reading is producing diminishing returns
- you can defensibly explain what *isn't* covered and why

Do not exhaust the repo. The map should be comprehensive about the feature, not the codebase.
