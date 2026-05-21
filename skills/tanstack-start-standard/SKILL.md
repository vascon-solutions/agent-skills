---
name: tanstack-start-standard
description: Use when building or reviewing TanStack Start apps with SSR, server functions, server routes, streaming, server/client env boundaries, route loaders, or full-stack React behavior.
---

# TanStack Start Standard

## Core Rules

Use TanStack Start only when the frontend app needs server-side execution: SSR, server functions, server routes, streaming, request-time env reads, or frontend-owned server behavior. Prefer a plain TanStack Router SPA when the app is only an authenticated client dashboard backed by a separate API.

- Pin Start, Router, React, TypeScript, and Vite-compatible versions. Do not use `latest` dependency specs in templates.
- Keep routes in `src/routes/` and generated route tree files generated.
- Keep feature-specific server functions near the feature in `server/`; keep shared server-only helpers under `src/server/`.
- Do not import server-only modules from client components.
- Do not use Next.js, Remix, React Router DOM, `src/pages`, app-router files, loader/action exports from other frameworks, `getServerSideProps`, or `getStaticProps`.

## Server Functions

- Use the current Start `createServerFn` API for server functions.
- Validate inputs with Zod or an equivalent schema before doing work.
- Return typed, serializable data only.
- Enforce authorization inside protected server functions before reading or mutating protected data.
- Never return secrets, raw provider payloads, or database records with sensitive columns.
- Keep same-origin and CSRF protections active when the runtime requires explicit setup.

## Env And Data Ownership

- Client-readable env vars must use the required public prefix for the stack, commonly `VITE_`.
- Server secrets must not use a client prefix.
- Read server env inside request-time handlers, middleware, server routes, or server function handlers. Avoid module-scope secret reads.
- Use server functions for light server-owned frontend workflows, request-time computation, and server-only reads.
- Use a dedicated backend API for durable domains that need migrations, audit logs, queues, external integrations, or cross-client contracts.
- Use route loaders for route-specific orchestration and TanStack Query for repeated client interactions, mutations, invalidation, and cache coordination.

## Routing And SSR

- Document which routes SSR, stream, or behave like client-only routes.
- Keep loaders typed and serializable.
- Avoid browser-only imports in server-rendered paths.
- Provide pending, error, and not-found boundaries where users can hit network or auth failures.
- For streaming or deferred data, test the fallback state as well as the resolved state.

## Verification

Cover at least server env validation, server-function input validation, auth rejection, root/auth/protected route behavior, and one SSR or server-backed browser smoke path.

```bash
pnpm check
pnpm type-check
pnpm test
pnpm build
pnpm test:browser
```

Treat `pnpm check` reporting zero processed files as failed or skipped validation.
