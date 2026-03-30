---
name: repo-docs-audit
description: Audit a repository's documentation and instruction files, decide what should exist, what should be merged or removed, and produce the smallest useful doc set. Use before rewriting docs or when a repo has missing, stale, bloated, or conflicting docs.
---

# Repo Docs Audit

## Purpose

Define the right documentation set for the repository before rewriting or preserving anything.

This skill decides:

- what docs should exist
- what should be merged
- what should be removed
- what the minimum trustworthy doc set looks like

It is an audit and planning skill, not a writing skill.

## When To Use

Use when:

- the repo already has docs that may be stale, bloated, or overlapping
- the repo has both agent instruction files and general project docs
- the repo has no docs and you need to define the target set before creating anything
- the user asks for a documentation audit, cleanup, consolidation, or reduction
- you need a target doc set before running `rewrite-docs-from-code`

## When Not To Use

Do not use when:

- the task is only to create or repair `AGENTS.md` / `CLAUDE.md`
  Use `repair-agent-files`
- the target doc set is already clear and the task is to write the docs
  Use `rewrite-docs-from-code`
- the task is a second-pass review of recent doc changes
  Use `review-doc-changes`

## Required Inputs

You need:

- access to the repository tree
- current docs and instruction files (if any exist)
- ability to inspect representative code paths

Useful sources:

- `AGENTS.md`, `CLAUDE.md`, `README.md`
- `docs/` or equivalent doc directories
- contributor, deploy, and setup guides
- feature folders, routes, config, scripts

Do not assume existing docs are correct. Do not assume every current file should survive.

## Step-By-Step Instructions

1. Inventory current doc and instruction files. If there are none, skip to step 4.
2. Classify each file by role:
   - agent instructions (`AGENTS.md`, `CLAUDE.md`)
   - product / domain context
   - architecture / integration reference
   - feature or module map
   - contribution / process guide
   - generated inventory or folder listing
   - low-value duplication
3. Scan enough code to verify whether the docs match implementation reality.
4. Identify:
   - stale or incorrect claims
   - speculative claims without code backing
   - overlap between files
   - low-value files (folder listings, generic framework advice, snapshot inventories)
   - missing high-value context that code cannot convey on its own
5. Assign one verdict per file:
   - **keep** — accurate, earns its place, adds value code inspection cannot provide
   - **trim** — mostly good but over-specified or too long
   - **merge** — overlaps with another file; combine them
   - **remove** — low value or easily derivable from code inspection
   - **create** — important context is missing and should be written
6. Produce the audit output — a doc-by-doc verdict table with rationale and the proposed target doc set.
7. **Gate on approval before any edits.** Present the full output and explicitly state: "No files will be modified until you approve." Do not create, edit, delete, or merge any file until the user confirms. If the user approves only part of the plan, apply only the approved subset.
8. Recommend the next skill to run (e.g. `rewrite-docs-from-code`, `repair-agent-files`).

## Decision Rules

- **File placement and naming**: only `README.md`, `AGENTS.md`, and `CLAUDE.md` belong at the repo root. All other docs go in `docs/` with lowercase filenames (e.g., `docs/architecture.md`, `docs/context.md`, `docs/contributing.md`). Uppercase names are reserved for root-level repo meta-files. Flag violations during audits.
- Keep a doc only if it adds durable value beyond what is quickly discoverable from code.
- **Default to remove** for files that are primarily folder listings, generated inventory, or generic framework advice. Do not trim what should be deleted.
- Prefer one strong doc over two overlapping docs.
- Keep domain docs when code alone cannot explain business meaning, compliance constraints, or regulated behavior.
- Keep architecture docs when behavior spans multiple files or subsystems in ways that are not obvious.
- Keep contributor docs only for repo-specific rules — not generic Git or framework advice.
- Keep `AGENTS.md` separate from project docs.
- If `CLAUDE.md` exists alongside `AGENTS.md`, it should not be a second instruction system.
- If a claim is not code-backed and is not domain knowledge, mark it trim or remove.
- A doc that would take more effort to keep accurate than to discover from code inspection is a candidate for removal.

## Minimum Viable Doc Set by Repo Type

The right set differs by repo shape. These are starting points, not templates.

**Single-package frontend app (SPA, Next.js, TanStack Start)**
- `AGENTS.md`
- Architecture doc if auth, layout guards, or data flow is non-trivial
- Context doc if the domain has compliance or business constraints not inferable from code
- Contributing doc if the repo has non-obvious setup or enforced standards

**API / backend service (NestJS, Express, Fastify)**
- `AGENTS.md`
- Architecture doc for module structure, request flow, DB layer, middleware chain
- Context doc if the domain is compliance-critical
- Contributing doc for setup, migration, test commands

**Monorepo**
- Root `AGENTS.md` for cross-package conventions
- Per-package `AGENTS.md` only when a package has distinct agent-relevant constraints
- Root architecture doc for workspace topology and tooling
- Per-package docs for packages with complex behavior

**Simple utility or library**
- `AGENTS.md`
- `README.md` often already covers what a dedicated architecture doc would
- Contributing doc only if contribution is non-trivial

## Repo Shape Guidance for Scanning

**Next.js** — distinguish pages router vs app router early; they produce different doc needs. Auth middleware, global layout guards, and server components add complexity worth documenting.

**Vite / SPA** — focus on router type, state management pattern, API integration shape, and env vars. Docs here are often simpler.

**TanStack Router / Start** — the route tree and loader pattern are frequently non-obvious. Worth a short orientation doc.

**NestJS** — module topology, controller/service/guard chain, and DI patterns matter more than a feature map. Module-level docs are often more useful.

**Express / Fastify** — middleware chain order and auth middleware placement are the high-risk areas. These are hard to reconstruct quickly from code.

**Monorepos** — the workspace shape and cross-package dependency graph are rarely obvious from the filesystem. A topology doc is often high-value.

## Expected Outputs

Produce:

- a doc-by-doc audit with verdicts and rationale
- the recommended target doc set
- rationale for consolidations and deletions
- recommended next skill
- an explicit approval prompt before any file is touched

## Cautions / Common Failure Modes

- Preserving files because they already exist
- Mistaking folder structure dumps for valuable documentation
- Letting `AGENTS.md` absorb general project documentation
- Keeping multiple weak docs instead of one strong doc
- Recommending speculative docs because they sound complete
- Trimming when the right call is to delete entirely
- Applying changes before waiting for explicit user approval

## Example Usage

Use this skill when a user says:

- "Audit the docs and tell me what should stay."
- "This repo has too many docs. Reduce them."
- "Decide what docs should exist before rewriting anything."
- "We have no docs. Where do we start?"
