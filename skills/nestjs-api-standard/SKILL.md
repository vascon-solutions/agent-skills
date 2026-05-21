---
name: nestjs-api-standard
description: Use when creating, reviewing, or hardening NestJS REST API templates or services that need PostgreSQL, TypeORM, JWT auth, Swagger, validation, auditability, and production-ready checks.
---

# NestJS API Standard

## Purpose

Keep NestJS API starters generic, secure by default, testable, and ready for production adaptation. Prefer existing repo patterns, but do not preserve product-specific fields, copy, seeds, provider assumptions, or local-only shortcuts.

## Baseline

Require a clear backend stack contract before changing code:

- Runtime: current Node LTS line used by the repo, pnpm when already present.
- Framework: NestJS REST API with modular `src/` structure.
- Database: PostgreSQL through TypeORM with `synchronize: false`.
- Auth: Passport JWT, `@Public()` opt-out, current-user decorator, global guards where appropriate.
- Validation: DTO validation or shared schema validation with a predictable error shape.
- Docs: Swagger/OpenAPI with bearer auth and generic title/description.
- Quality: non-mutating lint/check, typecheck, unit tests, e2e tests, and build.

## Required Shape

Use generic modules unless the host repo has a stronger convention:

- `auth`: login, register, refresh, logout, current user, password-change/reset placeholders, hashed passwords and refresh tokens.
- `users`: safe CRUD, normalized email, role/status fields, no domain-specific profile residue.
- `roles` and `permissions`: central role constants plus either a real permission model or an honest placeholder.
- `audit-log`: protected reads and at least one documented or implemented write integration.
- `database`: runtime config, CLI data source, migrations, seed support, isolated e2e database safety.
- `logger`, `core`, and `bootstrap`: shared response, pagination, errors, decorators, security, and startup behavior.

## Security Rules

- Fail fast for production-like runs when secrets or database settings are missing.
- Never fall back to `"secret"` or other throwaway secrets outside local tests.
- Validate audit encryption keys before encrypt/decrypt operations.
- Protect routes by default; mark public routes explicitly.
- Keep Helmet, CORS, JSON body limits, and safe headers visible in bootstrap.
- Never return password hashes, refresh tokens, JWT secrets, reset tokens, or internal audit payload secrets.

## Verification

Expect these checks, adjusted to repo scripts:

```bash
pnpm install
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run test:e2e
pnpm run build
```

If a check is absent, add the script when within scope or call out the gap. Do not claim template readiness while typecheck, e2e, migration, or build gaps remain unexplained.
