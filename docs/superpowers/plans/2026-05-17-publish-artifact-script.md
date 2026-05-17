# publish-artifact Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the script-backed `publish-artifact` workflow described in `docs/superpowers/specs/2026-05-17-publish-artifact-script-design.md`.

**Architecture:** Add a CommonJS Node helper at `skills/publish-artifact/scripts/publish-artifact.js` with exported pure helpers and an injectable command runner. Keep `SKILL.md` as the user-facing policy and delegate execution to the script. Use `node --test` tests with mocked AWS/GitHub command execution so no live network credentials are required.

**Tech Stack:** Node.js CommonJS, built-in `node:test`, built-in `assert`, `fs`, `path`, `crypto`, `child_process`.

---

### Task 1: Script Helper And Tests

**Files:**
- Create: `skills/publish-artifact/scripts/publish-artifact.js`
- Create: `skills/publish-artifact/scripts/publish-artifact.test.js`

- [ ] **Step 1: Write failing tests**

Create `publish-artifact.test.js` with tests for TTL parsing, workspace resolution, upload filtering, secret scan, metadata replacement, redaction, share resolution, gist command shape, dry-run output, upload failure handling, and env-file loading through canonical script paths.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test skills/publish-artifact/scripts/publish-artifact.test.js`
Expected: fails because `publish-artifact.js` does not exist.

- [ ] **Step 3: Implement script**

Create `publish-artifact.js` with a CLI entrypoint, exported helpers, injectable runner, AWS/GitHub subprocess orchestration, two-phase metadata handling, and dry-run reporting.

- [ ] **Step 4: Run tests and verify pass**

Run: `node --test skills/publish-artifact/scripts/publish-artifact.test.js`
Expected: all tests pass.

### Task 2: Env Files And Skill Instructions

**Files:**
- Create: `skills/publish-artifact/.env.example`
- Modify: `.gitignore`
- Modify: `skills/publish-artifact/SKILL.md`

- [ ] **Step 1: Add env example and ignore rules**

Add non-secret env keys to `.env.example`. Add `.env`, `.env.local`, `*.env.local`, and `skills/publish-artifact/.env` to `.gitignore` if absent.

- [ ] **Step 2: Update SKILL.md**

Preserve policy, safety, inputs, and output guidance, but add the primary instruction to run `node skills/publish-artifact/scripts/publish-artifact.js ...`. Document env-file behavior, script-backed execution, and tests.

- [ ] **Step 3: Verify docs**

Run: `rg -n "publish-artifact.js|.env.example|node --test|Metadata\\[\\\"content-md5\\\"\\]|--share images" skills/publish-artifact/SKILL.md docs/superpowers/specs/2026-05-17-publish-artifact-script-design.md`
Expected: relevant references are present.

### Task 3: End-To-End Verification

**Files:**
- Test-only temp workspace under `/private/tmp` or `.worktrees` as needed.

- [ ] **Step 1: Run script tests**

Run: `node --test skills/publish-artifact/scripts/publish-artifact.test.js`
Expected: all tests pass.

- [ ] **Step 2: Run dry-run fixture**

Run the script against a temporary artifact workspace with `ARTIFACTS_S3_BUCKET`, `ARTIFACTS_S3_REGION`, and `--dry-run`.
Expected: output is prefixed with `[dry-run]`, no metadata file is modified, no AWS/GitHub commands perform remote writes.

- [ ] **Step 3: Run diff checks**

Run: `git diff --check -- .gitignore skills/publish-artifact docs/superpowers/plans/2026-05-17-publish-artifact-script.md`
Expected: no whitespace errors.
