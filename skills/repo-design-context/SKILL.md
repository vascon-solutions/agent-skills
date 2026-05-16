---
name: repo-design-context
description: Use when an artifact skill explicitly requests repo styling, design-token, brand, or architecture vocabulary discovery before generating HTML, image, diagram, or visual companion outputs.
---

# repo-design-context

## Purpose

Discover whether local repo styling or architecture vocabulary can safely inform a generated artifact. Return a compact context summary with confidence; never force branding when signals are ambiguous.

Default artifact behavior remains neutral. No opt-out flag is needed because consuming skills should only invoke this when the user explicitly passes `--use-repo-design`.

Do not invoke this skill on its own just because a user mentions design tokens, themes, branding, or architecture. It is a helper for artifact skills that explicitly request repo-design discovery.

## Inputs

Consumers should pass:

- source Markdown path, workspace path, or captured source title
- optional explicit repo path
- optional doc-type or output-kind hint
- optional artifact target, such as HTML companion, image companion, architecture diagram, or API flow
- current working directory

## Scan Root

Resolve the scan root in this order:

1. If the user provided an explicit repo path, scan that repo.
2. If the Markdown source is inside a Git repo, scan that repo.
3. If the current working directory is inside a Git repo, scan that repo.
4. If no Git repo is found, do not scan and return neutral with confidence `low`.

Find the repo root with `git rev-parse --show-toplevel`. If the source is under `~/agent-artifacts/<slug>/`, do not infer a repo from the artifact workspace slug; use the explicit repo path or current working directory repo only.

## Discovery Order

Search shallowly first; avoid broad generated/vendor directories such as `node_modules`, `dist`, `build`, `.next`, `.nuxt`, `coverage`, and lockfile-only evidence.

Use this precedence for frontend visual context:

1. Design-system or token files explicitly referenced by the source Markdown or workspace metadata.
2. App-local theme files in the source-matching app/package.
3. CSS variables in app/global styles.
4. Tailwind config and theme extensions.
5. shadcn registry or component theme conventions.
6. MUI, Chakra, or similar theme files.
7. Local logo or font assets.

Use this precedence for backend and diagram vocabulary:

1. Names explicitly present in the source Markdown.
2. Existing diagrams or architecture docs that mention the same feature/module.
3. App-local service/module/controller/route names.
4. ORM/entity/DTO/schema names.
5. Repo-wide architecture conventions only when one convention dominates.

When two high-priority sources conflict, confidence is not high. Prefer neutral output or ask one focused question.

## Confidence

Return exactly one confidence level.

**High** requires all of:

- one clear repo root
- one source-matching app/package or one repo-wide convention
- concrete token or naming files found
- no conflicting brand/theme/architecture source at the same priority

**Medium** means useful signals exist but should not be applied automatically, for example:

- one source-matching app is likely but not certain
- source docs mention one feature, but repo has multiple apps using similar names
- tokens are present but dark/light or brand variants are unclear

**Low** means keep neutral output, for example:

- source lives only in `~/agent-artifacts/` and no current Git repo is available
- monorepo has `apps/admin` with Tailwind and `apps/marketing` with MUI, with no source hint
- multiple Tailwind configs exist and none clearly matches the source
- both CSS variables and a component-library theme define conflicting palettes
- only remote font/logo URLs exist
- architecture docs are stale or contradict current service names
- discovery mostly hits generated code or vendor folders

## Output Contract

Return a compact summary:

```text
Repo design context:
- scan root: <path or none>
- found: <signals>
- applied: <tokens/vocabulary or neutral default>
- confidence: high|medium|low
- reason: <one sentence>
```

Consuming skills may apply only high-confidence results. Medium and low confidence results must be reported but not applied unless the user explicitly chooses a specific source after being asked.

## Cautions

- Do not treat repo context as source-of-truth content; it only informs presentation.
- Do not use remote assets or anything that would create a network request.
- Do not make generated artifacts look officially branded unless confidence is high.
- Do not scan huge generated directories.
- Do not invent token values or service names.
