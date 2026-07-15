# Audit UI Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and globally link a token-efficient `audit-ui` skill that performs audit-only browser journeys, captures bounded evidence, and emits durable verdict reports.

**Architecture:** Keep `SKILL.md` as a short orchestration workflow, move evidence/verdict detail to one reference, and copy brief/report templates into an isolated artifact workspace. Ship two dependency-free Node helpers for service probing and workspace initialization; verify them with Node's built-in test runner and a read-only Playwright smoke audit.

**Tech Stack:** Markdown agent skills, Node.js standard library, `node:test`, Playwright CLI, Python skill-creator scripts, POSIX shell linking.

---

### Task 1: Initialize the skill and define helper behavior with failing tests

**Files:**
- Create: `skills/audit-ui/` using the skill-creator initializer
- Create: `skills/audit-ui/scripts/probe-services.test.mjs`
- Create: `skills/audit-ui/scripts/init-audit-workspace.test.mjs`

- [ ] **Step 1: Initialize the generated skill skeleton**

Run:

```bash
python3 /Users/dee/.codex/skills/.system/skill-creator/scripts/init_skill.py audit-ui \
  --path /Users/dee/agent-skills/skills \
  --resources scripts,references,assets \
  --interface 'display_name=Audit UI' \
  --interface 'short_description=Audit running UI journeys with evidence' \
  --interface 'default_prompt=Use $audit-ui to audit this running web feature and produce an evidence-backed verdict.'
```

Expected: `skills/audit-ui/` exists with `SKILL.md`, `agents/openai.yaml`, and resource directories.

- [ ] **Step 2: Write probe tests before the implementation**

Cover these named cases with `node:test`: required and optional reachability, 200-399 success, 400-599 HTTP failure, timeout, malformed/duplicate definitions, redirect, redacted URL display, exact `ok` semantics, compact JSON stdout, and exit codes 0/1/2/3. Start temporary HTTP servers on loopback random ports inside tests.

- [ ] **Step 3: Run the probe tests and verify RED**

Run:

```bash
node --test skills/audit-ui/scripts/probe-services.test.mjs
```

Expected: FAIL because `probe-services.mjs` does not exist or has no required behavior.

- [ ] **Step 4: Write workspace initializer tests before implementation**

Cover mode validation, UTC timestamps, slug fallback, collision suffixes, template copying, output directories, compact JSON, exit codes, tested-repo overlap in both directions, ancestor-root/slug collision, and symlinked overlap. Use temporary `HOME`, artifact roots, repositories, and template fixtures.

- [ ] **Step 5: Run initializer tests and verify RED**

Run:

```bash
node --test skills/audit-ui/scripts/init-audit-workspace.test.mjs
```

Expected: FAIL because `init-audit-workspace.mjs` does not exist or has no required behavior.

### Task 2: Implement and verify the dependency-free helpers

**Files:**
- Create: `skills/audit-ui/scripts/probe-services.mjs`
- Create: `skills/audit-ui/scripts/init-audit-workspace.mjs`
- Test: `skills/audit-ui/scripts/probe-services.test.mjs`
- Test: `skills/audit-ui/scripts/init-audit-workspace.test.mjs`

- [ ] **Step 1: Implement `probe-services.mjs` minimally**

Expose pure `parseArgs`, `displayUrl`, `probeOne`, and `main` functions. Use manual timeout cancellation, concurrent probes, bounded HTTP(S) redirects, the exact error vocabulary, one compact JSON object for valid invocations, and stderr-only diagnostics for invalid input.

- [ ] **Step 2: Run probe tests and verify GREEN**

```bash
node --test skills/audit-ui/scripts/probe-services.test.mjs
```

Expected: all probe tests pass with no warnings.

- [ ] **Step 3: Implement `init-audit-workspace.mjs` minimally**

Expose pure argument, slug, timestamp, containment, and workspace-planning helpers plus `main`. Canonicalize the tested repo and nearest existing workspace ancestor before writing, copy installed templates, create `screenshots`, `traces`, `downloads`, and `logs`, and emit compact JSON.

- [ ] **Step 4: Run initializer tests and verify GREEN**

```bash
node --test skills/audit-ui/scripts/init-audit-workspace.test.mjs
```

Expected: all initializer tests pass with no filesystem residue outside temporary roots.

- [ ] **Step 5: Run both helper suites together**

```bash
node --test skills/audit-ui/scripts/*.test.mjs
```

Expected: all UI helper tests pass.

### Task 3: Write the token-efficient skill resources

**Files:**
- Modify: `skills/audit-ui/SKILL.md`
- Modify: `skills/audit-ui/agents/openai.yaml`
- Create: `skills/audit-ui/references/evidence-and-verdicts.md`
- Create: `skills/audit-ui/assets/templates/audit-brief.md`
- Create: `skills/audit-ui/assets/templates/report.md`

- [ ] **Step 1: Replace generated placeholders with a 100-150 line workflow**

Use imperative instructions. Include focused/journey/rollout calibration, audit-only and production-read-only gates, explicit service startup, Playwright-first capability selection, isolated workspace/session rules, primary plus risk variation coverage, reload verification, bounded screenshots, targeted UI/UX review, failure handling, cleanup, and report handoff. Link the evidence reference and helper `--help` rather than duplicating their details.

- [ ] **Step 2: Write the evidence and verdict reference**

Define evidence selection, screenshot maximum 12, failure classes, blocker/major/moderate/minor severity, and strict verdict precedence: `FAIL`, then `PASS`, then `BLOCKED`, then `PARTIAL`.

- [ ] **Step 3: Write copy-only templates**

The brief template must capture scope, mode, environment, services, actors, scenarios, success criteria, evidence budget, and cleanup. The report template must capture verdict, assumptions, service/browser state, checkpoint matrix, functional findings, UI/UX recommendations, evidence, unverified areas, and cleanup.

- [ ] **Step 4: Regenerate optional UI metadata**

```bash
python3 /Users/dee/.codex/skills/.system/skill-creator/scripts/generate_openai_yaml.py \
  skills/audit-ui \
  --interface 'display_name=Audit UI' \
  --interface 'short_description=Audit running UI journeys with evidence' \
  --interface 'default_prompt=Use $audit-ui to audit this running web feature and produce an evidence-backed verdict.'
```

Expected: quoted strings under `interface` only, with no runtime dependency declaration.

### Task 4: Wire, validate, and smoke-test `audit-ui`

**Files:**
- Modify: `README.md`
- Modify: `bin/link-skills.sh`

- [ ] **Step 1: Add repository wiring**

Add `audit-ui` to `SKILL_NAMES`, the README tree, the Skills table, and a concise runtime-audit usage example that distinguishes it from one-off browser operations.

- [ ] **Step 2: Validate syntax and skill metadata**

```bash
sh -n bin/link-skills.sh
python3 -m venv /tmp/agent-skills-validator
/tmp/agent-skills-validator/bin/pip install PyYAML
/tmp/agent-skills-validator/bin/python /Users/dee/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/audit-ui
node --test skills/audit-ui/scripts/*.test.mjs
```

Expected: shell syntax valid, skill validation successful, all helper tests pass.

- [ ] **Step 3: Link the skill globally**

```bash
bin/link-skills.sh
```

Expected: `audit-ui` resolves from all five configured global skill directories.

- [ ] **Step 4: Run a read-only focused smoke audit**

Serve a temporary static HTML feature outside the repository, initialize a UI audit workspace in a temporary artifact root, run Playwright CLI from that workspace, capture one critical screenshot, verify visible state and reload persistence, finish a `PASS` report, close the session, and confirm the served repository/directory baseline is unchanged.

- [ ] **Step 5: Commit the verified UI skill**

```bash
git add skills/audit-ui README.md bin/link-skills.sh docs/superpowers/plans/2026-07-15-audit-ui-implementation.md
git commit -m 'feat: add audit ui skill'
```
