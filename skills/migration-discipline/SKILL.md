---
name: migration-discipline
description: Use when adding, reviewing, or hardening database migrations, TypeORM/PostgreSQL configuration, seed scripts, e2e database setup, schema changes, or template migration commands.
---

# Migration Discipline

## Purpose

Protect data and template repeatability. Schema changes should be explicit, reviewable, reversible when practical, and tested against isolated databases.

## Non-Negotiables

- Keep `synchronize: false` outside throwaway local experiments.
- Use a runtime database config and a CLI data source that resolve the same entities and migrations intentionally.
- Commit generated migrations that are part of the template or feature.
- Treat committed migrations as immutable. Add a follow-up migration instead of editing history after others may have run it.
- Separate production/dev database env from e2e database env.
- Refuse destructive e2e cleanup unless the database name clearly signals `test` or `e2e`.

## Expected Commands

Expose clear package scripts, adjusted to the ORM/tooling:

```bash
pnpm migration:create --name=<name>
pnpm migration:generate --name=<name>
pnpm migration:run
pnpm migration:revert
pnpm migration:show
pnpm seed
```

Script names must make mutation obvious. Avoid lint/check scripts that silently generate migrations or rewrite source.

## Reviewing A Schema Change

Check:

- Entity changes and migration SQL match.
- Down migration is safe or the limitation is documented.
- Indexes, unique constraints, foreign keys, nullability, and defaults are intentional.
- Existing data can survive the change, or there is an explicit backfill.
- Generated names are stable enough for repeatable runs.
- Tests and seed data use the new shape.
- Docs and env examples mention any required new database settings.

## Seed Rules

Seeds are for local development, demos, and isolated tests:

- Make seeds idempotent.
- Use neutral demo users and records in templates.
- Never require product assets, private storage buckets, or third-party providers for a fresh seed.
- Keep passwords, tokens, and API keys fake and clearly local-only.
- Ensure seed scripts can run after migrations on an empty database.

## Verification

Before calling migration work complete, run the strongest available set:

```bash
pnpm migration:run
pnpm migration:show
pnpm seed
pnpm test:e2e
pnpm typecheck
```

If no database is available, validate static migration contents and report that runtime migration/e2e verification was not run.
