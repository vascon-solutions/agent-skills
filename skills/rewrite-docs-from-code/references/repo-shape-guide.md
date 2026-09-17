# Repo Shape Guide

Adapt what you scan and what docs you produce based on repo type.

---

### Frontend SPA (Vite, React, Vue, Svelte)

#### Scan for
- Entry point and router setup (client-side, file-based, or hash routing)
- State management pattern (Zustand, Pinia, Redux, TanStack Query, etc.)
- API integration (fetch utility, React Query, tRPC, etc.)
- Auth approach (session, JWT, cookie, middleware)
- Env vars and what breaks when they are missing

#### Typically useful docs
- Architecture: request flow, auth pattern, state boundaries
- Contributing: local setup, lint/build commands, import rules
- Context only if the domain has compliance or non-obvious constraints

#### Usually not worth creating
- Component catalog if the component count is small
- Feature map if the module count is low

---

### Next.js

#### Scan for
- Pages router vs app router and its effect on the documented request flow
- `_app.tsx` or root `layout.tsx` for global providers, guards, auth gates
- Middleware (`middleware.ts`) if present
- Server vs client component split (app router)
- Auth pattern and session handling
- Env vars and what breaks when they are missing

#### Pages router specific
- The layout/guard sequence in `_app.tsx` when its behavior is non-obvious
- Public vs protected route pattern

#### App router specific
- Route group and layout composition pattern
- Server action patterns if used

---

### TanStack Router / TanStack Start

#### Scan for
- Route tree structure (generated or manual)
- Type-safe search param usage
- Route loaders and `beforeLoad` hooks
- SSR behavior if TanStack Start

#### Typically useful docs
- Architecture: route-level data fetching, loader pattern, auth guards
- A short orientation when the route tree shape is non-obvious

---

### NestJS

#### Scan for
- Module topology (`app.module.ts` imports)
- Controller / service / guard / interceptor chain
- DI configuration and injection patterns
- Swagger / OpenAPI setup if present
- DB / ORM layer (TypeORM, Prisma, Drizzle, MikroORM)
- Validation layer (class-validator, Zod, Joi)
- Authentication strategy (Passport, JWT, session)

#### Typically useful docs
- Architecture: module topology, request lifecycle, auth/guard chain, DB layer
- Contributing: setup, migration commands, test commands
- Context if the domain is complex or compliance-critical

#### Usually not worth creating
- Flat feature map if the module topology is obvious from the folder structure

---

### Express / Fastify

#### Scan for
- Middleware chain order (matters significantly)
- Route structure and grouping
- Validation layer and where it attaches
- Auth middleware placement and session handling
- Error handler placement

#### Typically useful docs
- Architecture: middleware order, request path, auth behavior
- Contributing: setup and validation commands

---

### Monorepo (Turborepo, Nx, pnpm workspaces, Yarn workspaces)

#### Scan for
- Package topology: which packages are apps, libs, or internal tools
- Cross-package dependency graph (key relationships, shared packages)
- Root-level tooling (lint, test, build) vs per-package tooling
- Workspace protocol and version management
- CI pipeline structure

#### Typically useful docs
- Root architecture doc: workspace shape, package relationships, build topology
- Root contributing doc: setup, workspace commands, how to add a package
- Per-package docs only for packages with complex behavior that agents need to work safely in

#### Usually not worth creating
- Duplicate contributing docs in every package if root already covers it
- Package-level feature maps for simple library packages

---
