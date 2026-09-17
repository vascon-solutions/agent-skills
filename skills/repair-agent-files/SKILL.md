---
name: repair-agent-files
description: Create or repair repository agent instructions, choosing AGENTS.md or CLAUDE.md ownership from actual tool use and preserving scoped rules without duplication.
---

# Repair Agent Files

Keep agent instructions concise, consistent, and appropriate for the tools the repository uses. Establish one owner for shared rules at each scope while preserving legitimate tool-specific and nested guidance.

Use this skill for instruction-file creation, cleanup, or conflicting authority. Project documentation belongs to `rewrite-docs-from-code`; an unclear repository-wide doc set belongs to `repo-docs-audit`; a report-only assessment of recent edits belongs to `review-doc-changes`.

## Discover Ownership

Read existing repository instructions, their imports or symlink targets, applicable parent and nested rules, and relevant project docs. Infer tool use and established authority from the user's request and repository evidence. The current host establishes a need for a usable entry point, but does not prove which other tools the team uses.

Explicit user choices take precedence. Otherwise use these defaults:

| Repository evidence | Ownership and files |
| --- | --- |
| AGENTS-based tools; no Claude Code requirement | Create or repair `AGENTS.md`; do not create `CLAUDE.md` merely for symmetry |
| Claude Code only | Keep or create `CLAUDE.md` as the authority; do not introduce `AGENTS.md` without a cross-tool need |
| Both Claude Code and AGENTS-based tools | Use `AGENTS.md` for shared rules and a small `CLAUDE.md` import; preserve necessary Claude-specific additions |
| Tool use uncertain | Preserve existing coherent ownership and make it readable by the current host. With no files, use the known host's native entry point, such as `CLAUDE.md` for Claude Code. If the host is also unknown, default to `AGENTS.md` and state the assumption |

If both files conflict, preserve unique rules and resolve ownership from the evidence above. Ask only when an unresolved tool or policy choice materially changes the result. Do not delete an existing tool entry point just because its current use is uncertain.

If existing shared rules live in `AGENTS.md` and the current host is Claude Code, add the applicable imports as part of the authorized repair. If the user explicitly limits output to `AGENTS.md`, honor that limit and disclose that Claude Code needs a `CLAUDE.md` import to load it automatically.

A root authority declaration does not erase directory-specific rules. Keep local constraints scoped to the packages they govern and preserve applicable parent or managed rules. Do not flatten nested instructions into a root file merely to achieve "one file."

## Edit The Instructions

Use [documentation policy](../repo-docs-audit/references/documentation-policy.md) when moving project knowledge, handling uncommitted content, or validating links and commands.

Include only guidance that changes an agent's decisions in this repo. Depending on need, this can include:

- Applicable instruction ownership and links to project context.
- Non-obvious constraints, protected boundaries, and common change locations.
- Verified setup and validation commands with required prerequisites.
- Repository-specific operating or documentation update rules.

Use headings that earn their place. There is no minimum section count or target line count. Do not add a boilerplate completion report, session ritual, or doc hierarchy table when the repository does not need one.

Keep operational commands and compact examples that clarify a real constraint. Remove duplicated project narratives, transient task details, generic advice, and patterns already enforced by formatting tools. Point to maintained project docs for substantial context instead of copying them. Do not erase accepted requirements just because current code fails to enforce them.

## Claude Code Import

When `AGENTS.md` owns shared rules and Claude Code is used, the root `CLAUDE.md` can contain:

```markdown
@AGENTS.md
```

Write the import as literal file content outside a code fence in the generated `CLAUDE.md`. Relative imports resolve from the containing file, so adjust the path for a `.claude/CLAUDE.md` or other established location. Add only necessary Claude-specific instructions after it and avoid circular imports. Preserve a working symlink when no separate tool-specific content is needed.

Within the requested repair scope, each nested `AGENTS.md` whose rules Claude Code must honor needs a corresponding scoped Claude entry point. For example, `packages/api/CLAUDE.md` can contain `@AGENTS.md` to import `packages/api/AGENTS.md`. Preserve an equivalent working scoped import or symlink. A root import alone does not load nested `AGENTS.md` files. Do not import every package's rules at the root; keep them scoped so Claude Code can load the nested entry points on demand.

This import behavior is documented in [Claude Code memory guidance](https://code.claude.com/docs/en/memory#agents-md). It is a Claude Code mechanism, not a claim that every agent discovers every instruction filename. Do not replace an intentional import or symlink setup with a prose-only pointer.

## Verify And Report

Verify that the selected tools have the required entry points at the root and each relevant nested scope. Trace Claude imports to the intended local rules, check resolution and cycles, and confirm unique rules survive with a clear owner at each scope. Check referenced docs, paths, and commands; distinguish inspecting a loader configuration from testing it in the actual host.

Report the ownership choice, files changed or deliberately retained, material content moved or removed, and validation limits. The output may be one file or several scoped files; a matched root pair is not required. Publication is outside this skill unless separately authorized.
