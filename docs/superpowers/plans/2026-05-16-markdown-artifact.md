# markdown-artifact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `markdown-artifact` skill, wire it into the global skill pack, and document how it creates artifact workspaces from rough input.

**Architecture:** The implementation is documentation-only: a lean `SKILL.md` owns workflow, boundaries, workspace resolution, and output contract, while `references/doc-types.md` holds the heavier document-type template details. The existing link script and README register the new skill.

**Tech Stack:** Markdown skill docs, POSIX shell link script, repository documentation checks.

**Spec:** `docs/superpowers/specs/2026-05-16-markdown-artifact-design.md`

---

### Task 1: Add Skill Files

**Files:**
- Create: `skills/markdown-artifact/SKILL.md`
- Create: `skills/markdown-artifact/references/doc-types.md`

- [x] **Step 1: Write `SKILL.md`**

Create `skills/markdown-artifact/SKILL.md` with frontmatter, purpose, use boundaries, workspace resolution, workflow, validation, output, and companion-artifact rules from the design spec.

- [x] **Step 2: Write `references/doc-types.md`**

Create `skills/markdown-artifact/references/doc-types.md` with supported document types, audience handling, and required sections for each template.

- [x] **Step 3: Verify required files exist**

Run:

```bash
test -f skills/markdown-artifact/SKILL.md
test -f skills/markdown-artifact/references/doc-types.md
```

Expected: both commands exit 0.

### Task 2: Register Skill

**Files:**
- Modify: `bin/link-skills.sh`
- Modify: `README.md`

- [x] **Step 1: Add `markdown-artifact` to `SKILL_NAMES`**

Insert `markdown-artifact` next to `html-artifact` in `bin/link-skills.sh`.

- [x] **Step 2: Update README skill inventory**

Add `markdown-artifact/` to the tree and add a table row describing the skill as a Markdown artifact workspace generator.

- [x] **Step 3: Add README usage scenario**

Add a typical usage section for creating Markdown artifact workspaces under `~/agent-artifacts/<slug>/`.

### Task 3: Verify Implementation

**Files:**
- Validate repository files only.

- [x] **Step 1: Run syntax and whitespace checks**

Run:

```bash
sh -n bin/link-skills.sh
git diff --check
```

Expected: both commands exit 0.

- [x] **Step 2: Run content checks**

Run:

```bash
rg -n "markdown-artifact" README.md bin/link-skills.sh skills/markdown-artifact
rg -n "TBD|TODO|FIXME|\\?\\?" skills/markdown-artifact docs/superpowers/plans/2026-05-16-markdown-artifact.md
```

Expected: first command finds registration and skill content. Second command exits 1 with no matches.

- [x] **Step 3: Review spec coverage**

Compare `skills/markdown-artifact/SKILL.md` and `skills/markdown-artifact/references/doc-types.md` against the design spec for workspace model, doc types, audience handling, Superpowers boundary, fallback behavior, metadata, and companion output rules.
