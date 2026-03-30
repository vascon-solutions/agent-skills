---
name: rewrite-docs-from-code
description: Generate or repair repository documentation from actual code and current structure, preferring implementation reality over inherited or speculative docs. Use when docs are missing, stale, or untrustworthy.
---

# Rewrite Docs From Code

## Purpose

Write or repair repository docs by grounding them in the current codebase.

This skill produces trustworthy docs, not a restatement of legacy wording.

## When To Use

Use when:

- a repo has missing docs that need to be created
- existing docs are stale, speculative, or do not match current code
- the user wants docs rewritten from code reality
- a repo needs lean architecture, context, contributing, or feature docs

## When Not To Use

Do not use when:

- the target is only `AGENTS.md` or `CLAUDE.md`
  Use `repair-agent-files`
- the correct target doc set is still unclear
  Use `repo-docs-audit` first
- the task is a second-pass review of recent doc changes
  Use `review-doc-changes`

## Required Inputs

You need:

- access to code, config, routes, scripts, and representative feature modules
- the target doc set (from `repo-docs-audit` if already run; otherwise decide it here using the decision rules below)

Existing docs are inputs only — they are not trusted by default.

## Step-By-Step Instructions

1. **Decide which docs should exist.**
   If `repo-docs-audit` was already run, use its output directly — do not re-audit. Otherwise, apply the decision rules and repo shape guide below.

2. **Scan the codebase** using the repo-shape heuristics below for the relevant stack.

3. **Validate every claim from code and config before writing it.**
   If you cannot verify a claim, either omit it or mark it explicitly as unconfirmed.

4. **Draft each doc with a distinct, non-overlapping scope.**
   If two docs would cover the same ground, merge them or remove one.

5. **Remove or merge low-value docs** rather than rewriting them by inertia.

6. **Prefer explanation over inventory.**
   If a section is mostly a file listing or folder tree, cut it or replace it with a short orientation paragraph.

7. **Mark uncertainty explicitly.**
   Use phrases like "not confirmed from code" or "inferred from config" rather than asserting as fact.

8. **Update `AGENTS.md`** to reflect the final doc set — its doc hierarchy table should match what actually exists.

## Decision Rules

- **File placement and naming**: only `README.md`, `AGENTS.md`, and `CLAUDE.md` belong at the repo root. All other docs go in `docs/` with lowercase filenames (e.g., `docs/architecture.md`, `docs/context.md`, `docs/contributing.md`). Uppercase names are reserved for root-level repo meta-files that tools and platforms expect at the project root.
- If a claim is not evidenced in code or reliable config, omit it or clearly qualify it.
- Do not infer active integrations from env vars, references, or package names alone — verify from code paths.
- If two docs overlap heavily, merge them.
- If a doc mostly mirrors a folder tree, cut it sharply or remove it.
- Contributor docs should focus on repo-specific rules, not generic framework or Git advice.
- Feature docs should orient (what does this module do and why) rather than enumerate internals.
- If a doc category does not apply to this repo type, do not create it.

## Repo Shape Guide

Adapt what you scan and what docs you produce based on repo type.

---

### Frontend SPA (Vite, React, Vue, Svelte)

**Scan for:**
- Entry point and router setup (client-side, file-based, or hash routing)
- State management pattern (Zustand, Pinia, Redux, TanStack Query, etc.)
- API integration (fetch utility, React Query, tRPC, etc.)
- Auth approach (session, JWT, cookie, middleware)
- Env vars and what breaks when they are missing

**Typically useful docs:**
- Architecture: request flow, auth pattern, state boundaries
- Contributing: local setup, lint/build commands, import rules
- Context only if the domain has compliance or non-obvious constraints

**Usually not worth creating:**
- Component catalog if the component count is small
- Feature map if the module count is low

---

### Next.js

**Scan for:**
- Pages router vs app router — this changes what is worth documenting
- `_app.tsx` or root `layout.tsx` for global providers, guards, auth gates
- Middleware (`middleware.ts`) if present
- Server vs client component split (app router)
- Auth pattern and session handling
- Env vars and what breaks when they are missing

**Pages router specific:**
- The layout/guard sequence in `_app.tsx` is often critical and non-obvious — worth documenting
- Public vs protected route pattern

**App router specific:**
- Route group and layout composition pattern
- Server action patterns if used

---

### TanStack Router / TanStack Start

**Scan for:**
- Route tree structure (generated or manual)
- Type-safe search param usage
- Route loaders and `beforeLoad` hooks
- SSR behavior if TanStack Start

**Typically useful docs:**
- Architecture: route-level data fetching, loader pattern, auth guards
- The route tree shape can be highly non-obvious — worth a short orientation

---

### NestJS

**Scan for:**
- Module topology (`app.module.ts` imports)
- Controller / service / guard / interceptor chain
- DI configuration and injection patterns
- Swagger / OpenAPI setup if present
- DB / ORM layer (TypeORM, Prisma, Drizzle, MikroORM)
- Validation layer (class-validator, Zod, Joi)
- Authentication strategy (Passport, JWT, session)

**Typically useful docs:**
- Architecture: module topology, request lifecycle, auth/guard chain, DB layer
- Contributing: setup, migration commands, test commands
- Context if the domain is complex or compliance-critical

**Usually not worth creating:**
- Flat feature map if the module topology is obvious from the folder structure

---

### Express / Fastify

**Scan for:**
- Middleware chain order (matters significantly)
- Route structure and grouping
- Validation layer and where it attaches
- Auth middleware placement and session handling
- Error handler placement

**Typically useful docs:**
- Architecture: middleware order, request path, auth behavior
- Contributing: setup and validation commands

---

### Monorepo (Turborepo, Nx, pnpm workspaces, Yarn workspaces)

**Scan for:**
- Package topology: which packages are apps, libs, or internal tools
- Cross-package dependency graph (key relationships, shared packages)
- Root-level tooling (lint, test, build) vs per-package tooling
- Workspace protocol and version management
- CI pipeline structure

**Typically useful docs:**
- Root architecture doc: workspace shape, package relationships, build topology
- Root contributing doc: setup, workspace commands, how to add a package
- Per-package docs only for packages with complex behavior that agents need to work safely in

**Usually not worth creating:**
- Duplicate contributing docs in every package if root already covers it
- Package-level feature maps for simple library packages

---

## Common Durable Doc Types

| Doc type | Keep when |
|---|---|
| Context / domain | Business rules, compliance constraints, or role model not evident from code |
| Architecture | Request flow, auth behavior, state management, or integration patterns span multiple non-obvious files |
| Feature / module map | Module count is high enough that orientation saves real time (roughly 10+ modules) |
| Contributing | Repo-specific setup, import rules, lint/build process, or PR standards |
| Workflow-specific | A subsystem is complex and risky enough that a dedicated checklist adds safety |
| Components | Shared component API is non-obvious and widely used across the codebase |

## Expected Outputs

Produce:

- new or repaired project docs grounded in code
- merged or deleted low-value docs where justified
- a lean doc set with clear, non-overlapping scopes
- brief rationale for major removals or consolidations
- updated doc hierarchy in `AGENTS.md` to match the final set

## Cautions / Common Failure Modes

- Treating inherited docs as authoritative
- Rewriting speculation into cleaner speculation
- Creating docs for every possible category instead of only the justified ones
- Turning docs into generated catalogs or folder listings
- Writing generic framework prose instead of repo-specific guidance
- Producing docs that will be stale quickly without a clear reason to maintain them

## Example Usage

Use this skill when a user says:

- "Regenerate the docs from the codebase."
- "The docs are stale. Rewrite them based on what the repo actually does."
- "Create lean docs for this repo."
- "We have no docs and need a starting set."
