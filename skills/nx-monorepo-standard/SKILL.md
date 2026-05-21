---
name: nx-monorepo-standard
description: Use when creating, reviewing, or hardening Nx monorepo templates with React/Vite apps, NestJS APIs, shared packages, workspace aliases, module boundaries, CI checks, or Docker-ready app layouts.
---

# Nx Monorepo Standard

## Purpose

Keep Nx workspaces predictable: clear deployable apps, reusable packages, enforced boundaries, neutral naming, and validation scripts that prove the graph still works after extraction or template generation.

## Workspace Contract

Document the chosen topology before editing. Common public-safe shapes:

- Full-stack: `apps/web`, `apps/admin`, `apps/api`, `libs/shared-types`.
- Frontend-only: multiple `apps/<app>` projects plus reusable `packages/ui`, `packages/shared`, and optional domain packages.

Do not mix `libs/` and `packages/` casually. Follow the template track or existing `nx.json` workspace layout and align package-manager workspaces, TypeScript paths, Vite aliases, and docs.

## App Standards

React/Vite apps should keep:

- TanStack Router route trees and app-owned router creation.
- TanStack Query providers and isolated request clients.
- Runtime env validation for every consumed env value.
- Auth/session bootstrap examples when auth is in scope.
- Real Vitest tests and Playwright smoke targets only when specs exist.
- Docker/runtime-env injection only when the app is deployable.

NestJS API apps in full-stack workspaces should follow `nestjs-api-standard`, including auth, audit, migrations, seed, Swagger, and e2e checks.

## Package Standards

- Shared contract libraries own schemas, exported types, roles/status primitives, and validation helpers used by multiple apps.
- UI packages own presentation primitives and styles, not app routing, product policy, request clients, or branding.
- Domain packages may own reusable workflow logic, but must import only through public entry points.
- Empty placeholder packages should be removed or implemented before publishing.

## Boundaries

Every Nx project needs tags. Enforce at least:

- Apps must not depend on apps.
- Libraries must not depend on apps.
- Shared libraries must not depend on domain or app-scoped libraries.
- Domain packages may depend on shared and UI packages through public exports.
- Shared request schemas used by both frontend and API must live in the shared contract package, not duplicated per app.

Keep any boundary script tied to current project names or derive names from config so renames cannot silently invalidate the check.

## Template Cleanup

Remove product names, demo assets, provider defaults, registry/image names, stale handoff docs, route copy, seed data, and package namespaces that belong to a source product. Replace them with neutral examples that still prove routing, auth, API calls, shared contracts, tests, and builds.

## Verification

Expected gates, adjusted to the repo:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```
