# Unslop Skill Design

**Status:** Accepted design

**Date:** 2026-09-15

**Audience:** Coding-agent skill maintainers

**Primary outcome:** Coding-agent output that a reader who did not watch the session understands on the first read, without narration, padding, or AI tells.

## 1. Context

Cursor's pstack ships two related skills. `unslop` is a catalog of 33 numbered AI tells: vocabulary, filler, hedging, formatting habits, and chatbot phrases. It runs as a manual edit pass on a target such as a PR body or readme. `technical-writing` carries the writing method (Diátaxis document modes, Google developer style, STE one-thought-per-sentence rules, Global English disambiguation) and delegates the tell list to `unslop`. Both are manual-invocation only.

Neither addresses the problem this pack has. Agent reports, findings, PR bodies, and commit messages can pass every sentence rule and still bury the outcome under process narration, restate the diff, and run several hundred words. Upstream has no rule about leading with the outcome, no length budget per surface, nothing about what to omit, and no mechanical check.

Per the pack's authorship rule, upstream skills are idea sources only. The owned skill absorbs the rules it wants inline and does not depend on either upstream skill.

## 2. Decision

Create a standalone `unslop` skill in this pack with three parts:

- `SKILL.md`: a short reader-first core (outcome first, no narration, evidence not adjectives, omit the derivable, sentence rules) plus two modes. Write mode applies while producing any user-facing output. Edit mode rewrites a named target on request and reports what changed.
- `references/surfaces.md`: one shape and length budget per output surface (chat reply and completion report, mid-task status, review findings, PR description, commit message, handoff and task documents, project docs).
- `references/catalog.md`: the tell catalog with stable kebab-case ids, absorbed from both upstream skills and extended with the structure and evidence rules. Other skills cite ids from here.
- `scripts/scan.mjs`: a dependency-free Node scanner that flags the mechanical subset of the catalog with file and line numbers, over files, stdin, or the staged diff. It exits non-zero on hits so an agent can use it as a check before writing a PR body or commit.

The upstream numbered ids are not preserved. Nothing in this pack cites them, and the gaps in that sequence add nothing.

## 3. Goals

- An agent reading only `SKILL.md` produces a report that leads with the outcome, states unverified items first, and fits the surface budget.
- `unslop <target>` rewrites without adding or dropping facts, flags unsupported claims instead of silently deleting them, and shows before and after.
- The scanner has zero false positives on fenced code, inline code, and URLs, and its rule ids match the catalog. Staged mode scans each staged text file in full and reports only added lines, so an edit inside an existing fence is not scanned as prose.
- `publish-branch` and `task-doc-delivery-loop` cite the surfaces for PR bodies, commit messages, and final reports. Other cross-skill wiring is deferred.

## 4. Non-goals

- Detecting or hiding that text was machine-written. The goal is reader load, not provenance.
- Rewriting code comments or product UI strings. Those belong to other skills.
- Enforcing sentence-case headings in this pack's own skill files, which use title case by convention. The scanner does not check heading case.

## 5. Validation

- `node --test tests/*.test.mjs skills/unslop/scripts/scan.test.mjs` passes. The runner needs file paths, not directories.
- Scanning the new `SKILL.md` and `references/surfaces.md` reports no hits. The catalog lists the tells and is not scanned.
