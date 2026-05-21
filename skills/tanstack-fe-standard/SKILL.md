---
name: tanstack-fe-standard
description: Use when building or reviewing React SPA/admin frontends that use TanStack Router, TanStack Query, Vite, Tailwind, protected routes, route search state, feature folders, or browser smoke tests.
---

# TanStack FE Standard

## Core Rules

Use this standard for client-rendered TanStack Router frontends. Keep route files thin, keep business UI in feature folders, and keep API traffic behind a small request boundary.

- Use React, TypeScript, Vite, TanStack Router, TanStack Query, Tailwind, local UI primitives, Vitest, Playwright, and Ultracite/Biome when the project already follows that family.
- Keep `src/routes/` responsible for file routes, `beforeLoad`, `validateSearch`, loaders, pending/error boundaries, and composition.
- Keep feature UI, hooks, query options, schemas, and feature helpers under `src/features/<feature>/`.
- Keep shared primitives under `src/components/ui/`, form wrappers under `src/components/form/`, and page shells under `src/components/page-layout/` or `src/components/layout/`.
- Treat generated route tree files as generated output. Regenerate them instead of editing them manually.

## Routing

- Use `createFileRoute`, `Link`, `useNavigate`, and `redirect` from TanStack Router.
- Use `beforeLoad` for authentication, authorization redirects, and route-level access checks.
- Use `validateSearch` for URL state. Use a schema when search params are more than trivial.
- Redirect unauthenticated users to login with a return destination when the app has protected routes.
- Do not add React Router DOM, Next.js route conventions, Remix route exports, `src/pages`, `app/layout.tsx`, `getServerSideProps`, or `getStaticProps`.

## Data And Auth

- Create one app-level `QueryClient`; inject it into router context when route guards or loaders need it.
- Put reusable query and mutation definitions in feature or domain query modules.
- Keep query keys feature-local or centrally typed. Remove product-specific sample keys from templates.
- Reset or invalidate relevant queries on sign-in, sign-out, and session expiry.
- Use content-level protected-view helpers only for UI affordances. Data access and protected routes still need route guards and backend enforcement.
- Send app API calls through the project request helper or API layer. Avoid scattered `fetch()` calls for first-party API traffic.

## UI And Tests

- Compose screens from local primitives and layout components before inventing new one-off widgets.
- Provide loading, empty, error, and unauthorized states for admin workflows.
- Keep Tailwind tokens and CSS variables neutral in templates; avoid client or product branding.
- Test route guards, search validation, request headers/errors, query cache behavior, and important shell states with Vitest.
- Add Playwright smoke coverage for root, login or auth shell, and one protected-route redirect or protected dashboard path.

## Verification

Run the project checks the repo exposes, usually:

```bash
pnpm check
pnpm type-check
pnpm test
pnpm build
pnpm test:browser
```

Treat `pnpm check` reporting zero processed files as failed or skipped validation.
