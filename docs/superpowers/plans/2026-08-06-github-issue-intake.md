# GitHub Issue Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable `github-issue-intake` skill that turns bug and improvement reports into approved, code-grounded GitHub issues with truthful teammate or task-doc handoffs.

**Architecture:** Keep the runtime workflow in a concise `SKILL.md`, move the fallback issue body and drafting rules into one reference file, and expose standard Codex metadata through `agents/openai.yaml`. Register the skill through the pack linker and README, and protect its critical approval, evidence, decomposition, and handoff contracts with the existing portability test suite.

**Tech Stack:** Markdown skills, YAML agent metadata, POSIX shell linker, Node.js `node:test`, Python skill-creator validation utilities.

---

## File Structure

- Create `skills/github-issue-intake/SKILL.md` — trigger, intake workflow, evidence classes, approval gate, GitHub write behavior, and task-doc handoff.
- Create `skills/github-issue-intake/references/issue-template.md` — fallback issue structure and section-level drafting rules.
- Create `skills/github-issue-intake/agents/openai.yaml` — user-facing name, description, and default invocation prompt.
- Modify `tests/skills-portability.test.mjs` — durable assertions for the new skill's safety and handoff contracts.
- Modify `bin/link-skills.sh` — include `github-issue-intake` in the canonical installed skill list.
- Modify `README.md` — add the skill to discovery lists and document the issue-first workflow.

### Task 1: Capture RED evidence and add the failing conformance test

**Files:**
- Modify: `tests/skills-portability.test.mjs`
- Reference: `docs/superpowers/specs/2026-08-06-github-issue-intake-design.md`

- [ ] **Step 1: Record the baseline behavior from the three no-skill pressure scenarios in the execution notes**

Use the completed baseline outputs:

- Phantom-reference pressure: the agent included a nonexistent task-doc path as a planned artifact instead of using a path-free truthful handoff.
- Multi-report pressure: the agent bundled three independently assignable outcomes because the user requested one issue, and added unverified requirements and label suggestions.
- Small-fix pressure: the agent correctly rejected a durable task doc for a one-line typo, showing that the size boundary is already intuitive and must be preserved rather than overexplained.

- [ ] **Step 2: Add a portability test before the skill exists**

Append this test to `tests/skills-portability.test.mjs`:

```js
test("GitHub issue intake preserves evidence, approval, and handoff contracts", () => {
  const skill = read("skills", "github-issue-intake", "SKILL.md");
  const template = read("skills", "github-issue-intake", "references", "issue-template.md");
  const metadata = read("skills", "github-issue-intake", "agents", "openai.yaml");

  assert.match(skill, /^description: Use when .*bug.*improvement.*GitHub issue/m);
  assert.match(skill, /open and closed issues/i);
  assert.match(skill, /verified[\s\S]*reported[\s\S]*inferred/i);
  assert.match(skill, /independently assignable[\s\S]*separate issue drafts/i);
  assert.match(skill, /exact title[\s\S]*exact body[\s\S]*explicit approval/i);
  assert.match(skill, /small\/fix[\s\S]*Do not offer task-doc creation/i);
  assert.match(skill, /task doc now[\s\S]*assignee[\s\S]*deliberat/i);
  assert.match(skill, /Do not mention a task-doc path, branch, or PR before it exists/i);
  assert.match(template, /^## Problem$/m);
  assert.match(template, /^## Current code evidence$/m);
  assert.match(template, /^## Acceptance criteria$/m);
  assert.match(template, /^## Excluded$/m);
  assert.match(metadata, /\$github-issue-intake/);
});
```

- [ ] **Step 3: Run the test and verify RED**

Run:

```bash
node --test tests/skills-portability.test.mjs
```

Expected: FAIL because `skills/github-issue-intake/SKILL.md` does not exist yet.

- [ ] **Step 4: Commit the failing contract test**

```bash
git add tests/skills-portability.test.mjs
git commit -m "test(skills): define github issue intake contracts"
```

### Task 2: Scaffold the skill package

**Files:**
- Create: `skills/github-issue-intake/SKILL.md`
- Create: `skills/github-issue-intake/references/issue-template.md`
- Create: `skills/github-issue-intake/agents/openai.yaml`

- [ ] **Step 1: Initialize the new skill with the official scaffold**

Run:

```bash
python3 /Users/dee/.codex/skills/.system/skill-creator/scripts/init_skill.py github-issue-intake \
  --path skills \
  --resources references \
  --interface 'display_name=GitHub Issue Intake' \
  --interface 'short_description=Turn code findings into teammate-ready issues' \
  --interface 'default_prompt=Use $github-issue-intake to investigate this bug or improvement and prepare an approved GitHub issue for teammate handoff.'
```

Expected: the three package files/directories exist and no example placeholders are created.

- [ ] **Step 2: Confirm scaffold scope**

Run:

```bash
find skills/github-issue-intake -maxdepth 3 -type f -print | sort
```

Expected:

```text
skills/github-issue-intake/SKILL.md
skills/github-issue-intake/agents/openai.yaml
```

The reference file is added in Task 3; the initializer creates the `references/` directory but no placeholder because `--examples` is omitted.

### Task 3: Write the fallback issue reference

**Files:**
- Create: `skills/github-issue-intake/references/issue-template.md`

- [ ] **Step 1: Add the fallback template and drafting rules**

Create the reference with these exact headings and contracts:

```markdown
# Fallback GitHub Issue Template

Use this only when the repository has no useful issue template. Adapt or omit a section only when the repository convention has an equivalent field or the section genuinely does not apply.

## Problem

Describe the user or system impact. For bugs, distinguish observed behavior from expected behavior.

## Evidence and reproduction

State whether the behavior was reproduced, reported, or inferred. Include only supplied or verified steps, screenshots, URLs, logs, and error text.

## Current code evidence

Name relevant symbols, files, tests, contracts, and patterns. Explain what each reference establishes.

## Requested change

Define the desired outcome and ownership boundary without prescribing an unverified implementation.

## Acceptance criteria

List observable outcomes and regressions that must remain prevented.

## Current behavior to preserve

Record existing contracts, workflows, permissions, payloads, and compatibility guarantees.

## Excluded

State adjacent work that is outside this issue.

## Decisions or unknowns

Include only unresolved choices. Give realistic options, implications, and the resolver.

## References and handoff

Link only artifacts that exist. For teammate handoff without a task doc, write: `Task doc not created. The assignee may create one from this issue after reviewing the scope.`

## Drafting checks

- Use an outcome-oriented title and avoid speculative root causes.
- Keep verified, reported, and inferred claims distinct.
- Do not invent requirements, reproduction, code evidence, or metadata.
- Do not mention a task-doc path, branch, or PR before it exists.
- Keep independently assignable outcomes in separate issue drafts.
```

- [ ] **Step 2: Confirm the reference has no placeholders or repository-specific paths**

Run:

```bash
rg -n 'TBD|TODO|floatstar|ncdmb|\.agent/tasks/' skills/github-issue-intake/references/issue-template.md
```

Expected: no matches.

### Task 4: Write the intake skill and metadata

**Files:**
- Modify: `skills/github-issue-intake/SKILL.md`
- Verify: `skills/github-issue-intake/agents/openai.yaml`

- [ ] **Step 1: Replace the scaffold with the minimal operational skill**

The skill must contain these sections and behaviors:

```markdown
---
name: github-issue-intake
description: Use when a reported bug or improvement needs code-grounded repository intake and an approved GitHub issue for teammate handoff before optional task-doc creation.
---

# GitHub Issue Intake

## Purpose

Turn a bug report, improvement, screenshot, or code finding into a truthful, code-grounded GitHub issue. The issue is the primary artifact. Do not implement the requested change.

## Hard Gates

- Do not modify implementation files or create implementation branches or PRs.
- Do not write to GitHub until the user approves the exact title, body, repository, and metadata.
- Do not claim reproduction or artifact existence without evidence.
- Treat issue approval as issue approval only, never implementation approval.

## Workflow

### 1. Resolve context

Collect the report and supplied evidence, resolve the repository, read repository instructions, and identify the evidence revision when it is not the default branch.

### 2. Check conventions and duplicates

Inspect issue templates, issue guidance, and recent comparable issues. Search open and closed issues for duplicates before drafting. If a likely duplicate exists, present the relationship and require approval before commenting or creating a distinct follow-up.

### 3. Classify and split

Classify report type as `bug`, `improvement`, or `unresolved`. Classify delivery size as `small/fix`, `improvement`, or `feature-grade`. Split independently assignable or verifiable outcomes into separate issue drafts even when the user initially asks for one; combine symptoms only when they share one root cause and delivery outcome.

### 4. Inspect the codebase

Trace focused entry points, ownership, current behavior, shared patterns, tests, preserved contracts, and likely implementation files. Keep three evidence classes explicit: `verified`, `reported`, and `inferred`. Never upgrade reported or inferred behavior to verified silently. Use `implementation-map` only when the affected surface independently justifies a durable map.

### 5. Resolve material gaps

Ask one focused question at a time only when the answer changes scope, ownership, acceptance criteria, or exclusions. For unresolved design choices, present two or three realistic options and lead with a recommendation.

### 6. Draft and preview

Map the required content into useful repository templates. Otherwise read and use `references/issue-template.md`. Show the repository, exact title, exact body, duplicate-search result, split set, and proposed existing metadata. Suggest only existing labels. Do not invent or apply labels, assignees, milestones, or project placement without explicit approval.

### 7. Create and verify

After explicit approval, prefer the available GitHub connector and use authenticated `gh` only as a focused fallback. Verify the created issue matches the preview and return its number and URL. If authentication or write access fails, preserve the exact copy-ready draft and report the blocker.

## Task-Doc Handoff

- `small/fix`: recommend direct teammate handoff. Do not offer task-doc creation unless the user challenges the classification.
- `improvement` or `feature-grade`: offer `create the task doc now`, `leave it to the assignee`, or `continue deliberating`.
- For create-now, invoke `task-doc` in `issue` / `transform-only` mode and stop before implementation.
- Offer a task-doc-only PR separately after the doc exists; publishing requires explicit approval and the `isolated-worktree` plus `publish-branch` skills.
- Do not mention a task-doc path, branch, or PR before it exists. Update the issue only after the referenced artifact is real.

## Completion

Report the classification, evidence limits, issue URL or write blocker, approved metadata, and selected handoff state. Never imply that a failed or unapproved write succeeded.

## Common Mistakes

| Mistake | Correction |
| --- | --- |
| Bundling unrelated reports because the user asked for one issue | Split independently deliverable outcomes and explain why. |
| Turning screenshots into verified reproduction | Label screenshot behavior as reported unless reproduced. |
| Adding a planned task-doc path | State that no task doc exists without inventing a path. |
| Applying plausible labels automatically | Suggest only existing labels and wait for approval. |
| Creating a task doc for a local fix | Hand off the approved issue directly. |
```

- [ ] **Step 2: Verify generated metadata matches the skill**

Expected `skills/github-issue-intake/agents/openai.yaml`:

```yaml
interface:
  display_name: "GitHub Issue Intake"
  short_description: "Turn code findings into teammate-ready issues"
  default_prompt: "Use $github-issue-intake to investigate this bug or improvement and prepare an approved GitHub issue for teammate handoff."
```

- [ ] **Step 3: Run GREEN against the focused conformance test**

Run:

```bash
node --test --test-name-pattern "GitHub issue intake" tests/skills-portability.test.mjs
```

Expected: the GitHub issue intake contract passes; unrelated tests are skipped. The full portability suite runs after linker registration in Task 5.

- [ ] **Step 4: Commit the skill package**

```bash
git add skills/github-issue-intake tests/skills-portability.test.mjs
git commit -m "feat(skills): add github issue intake workflow"
```

### Task 5: Register and document the skill pack integration

**Files:**
- Modify: `bin/link-skills.sh`
- Modify: `README.md`

- [ ] **Step 1: Register the skill in the linker**

Add `github-issue-intake` once to `SKILL_NAMES`, near the GitHub-oriented review and publishing skills.

- [ ] **Step 2: Add README discovery entries**

Add `github-issue-intake` to:

- the repository tree;
- the Skills table, described as code-grounded issue intake with approval and optional task-doc handoff; and
- a new `### Creating teammate-ready GitHub issues` usage section before task-doc planning workflows.

The usage section should state:

```markdown
1. `github-issue-intake` — turn bug reports, improvements, screenshots, or code findings into an approved, code-grounded GitHub issue; then hand off directly or create an eligible task doc.
2. `task-doc` — optionally transform an approved improvement or feature-grade issue into a durable implementation artifact.
```

- [ ] **Step 3: Run the pack registration test**

Run:

```bash
node --test tests/skills-portability.test.mjs
```

Expected: all tests pass, including `SKILL_NAMES must match skills/ directories`.

- [ ] **Step 4: Commit pack registration**

```bash
git add bin/link-skills.sh README.md
git commit -m "docs(skills): register github issue intake"
```

### Task 6: Validate and forward-test the completed skill

**Files:**
- Verify: `skills/github-issue-intake/SKILL.md`
- Verify: `skills/github-issue-intake/references/issue-template.md`
- Verify: `skills/github-issue-intake/agents/openai.yaml`
- Verify: `tests/skills-portability.test.mjs`
- Verify: `bin/link-skills.sh`
- Verify: `README.md`

- [ ] **Step 1: Run structural validation with an isolated PyYAML dependency**

Run:

```bash
validation_deps_dir=$(mktemp -d)
python3 -m pip install --quiet --target "$validation_deps_dir" PyYAML
PYTHONPATH="$validation_deps_dir" python3 /Users/dee/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/github-issue-intake
```

Expected: `Skill is valid!`

- [ ] **Step 2: Run the portability suite and whitespace checks**

Run:

```bash
node --test tests/skills-portability.test.mjs
git diff --check
```

Expected: all tests pass and `git diff --check` produces no output.

- [ ] **Step 3: Test linker installation in a temporary home**

Run:

```bash
link_test_home=$(mktemp -d)
HOME="$link_test_home" sh bin/link-skills.sh "$PWD"
for target in .codex .claude .cursor .agents .gemini/config; do
  test -L "$link_test_home/$target/skills/github-issue-intake"
done
```

Expected: the linker exits zero and all five symlinks exist.

- [ ] **Step 4: Run GREEN forward tests with fresh read-only subagents**

Repeat the three RED prompts with `Use $github-issue-intake at /Users/dee/agent-skills/.worktrees/codex/github-issue-intake-design/skills/github-issue-intake/SKILL.md` and no permission for GitHub or filesystem writes. Confirm that agents:

- avoid phantom task-doc paths;
- split independent outcomes despite bundling pressure;
- keep the small-fix task-doc boundary; and
- preview rather than claim a GitHub write.

- [ ] **Step 5: Refactor only against observed failures**

If a forward test exposes a loophole, patch the smallest relevant instruction or template rule, rerun that scenario, rerun the portability test, and commit with:

```bash
git add skills/github-issue-intake tests/skills-portability.test.mjs
git commit -m "fix(skills): tighten github issue intake safeguards"
```

Skip this commit when no refinement is needed.

### Task 7: Independent review, remediation, and local integration

**Files:**
- Review all files changed from the branch base through `HEAD`.

- [ ] **Step 1: Run a report-only implementation review subagent**

Give the subagent the approved design spec, implementation plan, branch diff, and validation evidence. Require a severity-ordered verdict and forbid mutations.

- [ ] **Step 2: Evaluate and address valid findings**

Use `address-review-findings`. Verify every finding against the spec and repository before editing, fix valid findings only, and push back on unsupported findings with evidence.

- [ ] **Step 3: Rerun final validation**

Run:

```bash
node --test tests/skills-portability.test.mjs
git diff --check main...HEAD
git status --short
```

Also rerun `quick_validate.py` and the temporary-home linker check from Task 6 after any review-driven change.

- [ ] **Step 4: Commit review remediation when needed**

```bash
git add skills/github-issue-intake tests/skills-portability.test.mjs bin/link-skills.sh README.md
git commit -m "fix(skills): address github issue intake review"
```

- [ ] **Step 5: Merge locally into `main`**

Verify the parent `main` checkout has no conflicting tracked changes. From `/Users/dee/agent-skills`, merge the reviewed branch without force, reset, or checkout-based file replacement:

```bash
git merge --no-ff codex/github-issue-intake-design
```

Expected: a local merge commit on `main`. Do not push unless separately requested.

- [ ] **Step 6: Verify the local merge and clean up the worktree**

Run the portability test from `main`, confirm the merge commit contains the intended files, remove the finished worktree, and prune worktree metadata.
