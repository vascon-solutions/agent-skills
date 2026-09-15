---
name: ultracite-standard
description: Configure or troubleshoot Ultracite/Biome scripts, exclusions, and formatter integration. Not for merely running an existing check.
---

# Ultracite Standard

Apply the rules relevant to the requested boundary. Full template requirements apply to template creation or an explicit standards audit, not every ordinary edit. Reuse existing validation evidence; choose affected checks using [validation guidance](../task-doc-delivery-loop/references/validation.md).

## Core Rules

Use Ultracite as the project quality gate when the repo has chosen the Ultracite/Biome family. Keep the command surface small and make CI prove that files were actually checked.

- Prefer `pnpm check` for read-only validation and `pnpm fix` for formatting and safe autofixes.
- Wire scripts to Ultracite commands consistently across templates.
- Keep Biome/Ultracite configuration at the repo root unless a monorepo has a documented reason to scope it.
- Pin Ultracite and Biome-related dependencies. Do not use `latest` in template package specs.
- Keep editor settings and hooks aligned with the same formatter so Prettier, ESLint, and Biome do not fight each other.

## Migration Rules

- When replacing ESLint/Prettier, remove or neutralize conflicting scripts, configs, and editor defaults in the same change.
- Preserve TypeScript strictness; do not treat formatter migration as a reason to loosen compiler settings.
- If a repo still needs framework-specific ESLint rules, document why Ultracite/Biome is not the only gate.
- Run autofix once, review the diff, then address remaining diagnostics intentionally.

## Paths And Generated Files

- Include source, tests, config, JSON/JSONC, CSS, and TS/TSX files that should be checked.
- Exclude `node_modules`, build output, coverage, browser artifacts, cache folders, generated route trees when appropriate, lockfiles when the tool cannot safely format them, and copied external artifacts.
- Be careful with dogfood or generated output directories. A check that silently ignores the whole project is not validation.

## Verification

Run:

```bash
pnpm check
```

Then read the output. Treat these as failures or skipped validation:

- zero files processed
- parse errors caused by files that should be excluded
- diagnostics hidden by broad ignore patterns
- formatter conflicts that reappear after save

When fixing is expected, run:

```bash
pnpm fix
pnpm check
```

Review the diff before running build or test gates.
