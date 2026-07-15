# Audit API Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and globally link a token-efficient `audit-api` skill that performs Hurl-first, OpenAPI-guided runtime API audits with safe curl fallback and durable verdict evidence.

**Architecture:** Keep the skill as a thin conductor over Hurl, curl, and bounded OpenAPI inspection. Duplicate the small runtime helpers so the skill remains standalone, but run them through a parameterized repository conformance suite; use a disposable Node fixture for deterministic executor and security checks.

**Tech Stack:** Markdown agent skills, Node.js standard library, `node:test`, Hurl 6.1+, curl, jq, optional recognized yq, Python skill-creator scripts, POSIX shell linking.

---

### Task 1: Install Hurl and initialize `audit-api`

**Files:**
- Create: `skills/audit-api/` using the skill-creator initializer

- [ ] **Step 1: Install the approved Hurl dependency**

```bash
brew install hurl
hurl --version
```

Expected: installed Hurl version is at least 6.1.

- [ ] **Step 2: Initialize the generated skill skeleton**

```bash
python3 /Users/dee/.codex/skills/.system/skill-creator/scripts/init_skill.py audit-api \
  --path /Users/dee/agent-skills/skills \
  --resources scripts,references,assets \
  --interface 'display_name=Audit API' \
  --interface 'short_description=Audit running APIs with direct evidence' \
  --interface 'default_prompt=Use $audit-api to audit this running API surface and produce an evidence-backed verdict.'
```

Expected: generated skill skeleton exists without modifying `audit-ui`.

### Task 2: Define API helpers with failing tests, then implement them

**Files:**
- Create: `skills/audit-api/scripts/probe-services.test.mjs`
- Create: `skills/audit-api/scripts/init-api-audit-workspace.test.mjs`
- Create: `skills/audit-api/scripts/probe-services.mjs`
- Create: `skills/audit-api/scripts/init-api-audit-workspace.mjs`

- [ ] **Step 1: Write probe tests and verify RED**

Cover UI-common probe behavior plus URL-userinfo rejection, default query rejection, repeatable `--allow-nonsecret-query`, unknown/duplicate opt-in rejection, redacted allowed queries, no original-URL echo, at most three same-origin redirects, and redirect-policy precedence.

```bash
node --test skills/audit-api/scripts/probe-services.test.mjs
```

Expected: FAIL because the API probe implementation is absent.

- [ ] **Step 2: Implement the API probe and verify GREEN**

Use Node standard-library APIs only. Manual redirect traversal must reject cross-origin or excessive redirects before classifying final 200-399 responses as reachable.

```bash
node --test skills/audit-api/scripts/probe-services.test.mjs
```

Expected: all API probe tests pass.

- [ ] **Step 3: Write initializer tests and verify RED**

Cover focused/journey/rollout modes, slug fallback `api-audit`, deterministic timestamps, collisions, template copying, canonical nearest-existing-ancestor reconstruction, both containment directions, symlinks, compact JSON, and exit codes.

```bash
node --test skills/audit-api/scripts/init-api-audit-workspace.test.mjs
```

Expected: FAIL because the initializer is absent.

- [ ] **Step 4: Implement the initializer and verify GREEN**

Create `contracts`, `scenarios`, `evidence`, and `logs`; keep the tested repo and final workspace disjoint through canonical-path checks.

```bash
node --test skills/audit-api/scripts/init-api-audit-workspace.test.mjs
```

Expected: all API initializer tests pass.

### Task 3: Add shared conformance and deterministic executor fixtures

**Files:**
- Create: `tests/audit-helper-conformance.test.mjs`
- Create: `tests/audit-executors.test.mjs`
- Create: `tests/fixtures/api-audit-fixture.mjs`
- Create: `tests/fixtures/contracts/swagger-2.json`
- Create: `tests/fixtures/contracts/swagger-2.expected.json`
- Create: `tests/fixtures/contracts/openapi-3.json`
- Create: `tests/fixtures/contracts/openapi-3.expected.json`
- Create: `tests/fixtures/contracts/openapi-3.1.yaml`
- Create: `tests/fixtures/contracts/openapi-3.1.expected.json`
- Create: `tests/fixtures/contracts/unresolved-external-ref.json`
- Create: `tests/fixtures/contracts/unresolved-external-ref.expected.json`

- [ ] **Step 1: Write conformance and executor tests before fixtures**

The helper suite must accept one skill path and run common reachability, optional-service, JSON, error, slug, collision, and path-safety expectations. The executor suite must expect loopback login/token, authenticated read, create/retrieve, 422 validation, async polling, redirect, transient read failure, and idempotency-key reconciliation behavior.

- [ ] **Step 2: Run repository tests and verify RED**

```bash
node --test tests/audit-helper-conformance.test.mjs tests/audit-executors.test.mjs
```

Expected: FAIL because the disposable fixture and contract fixtures are absent.

- [ ] **Step 3: Implement the fixture and contract artifacts**

Use a random loopback port and in-memory maps only. Emit a dynamic token, require bearer auth on protected reads, create each idempotency key once, return deterministic 422 and polling states, and expose controlled same-origin/cross-origin redirects. Pair each OpenAPI fixture with the bounded effective inventory expected from a correct agent audit.

- [ ] **Step 4: Verify Hurl and curl behavior**

The executor test must generate task-scoped Hurl with `redact` captures and no global retry, run `hurl --test --jobs 1`, and assert the dynamic secret is absent from stdout/stderr/scenario/durable files. Curl commands must begin with `--disable`, restrict protocols, avoid automatic redirects, and keep secrets out of argv.

```bash
node --test tests/audit-helper-conformance.test.mjs tests/audit-executors.test.mjs
```

Expected: all shared helper and executor tests pass.

### Task 4: Write the API skill resources

**Files:**
- Modify: `skills/audit-api/SKILL.md`
- Modify: `skills/audit-api/agents/openai.yaml`
- Create: `skills/audit-api/references/evidence-and-verdicts.md`
- Create: `skills/audit-api/references/hurl-execution.md`
- Create: `skills/audit-api/assets/templates/audit-brief.md`
- Create: `skills/audit-api/assets/templates/report.md`

- [ ] **Step 1: Replace generated placeholders with a 100-150 line workflow**

Include focused/journey/rollout calibration, production semantic read-only gate, contract-source order, effective OpenAPI inheritance, recognized yq detection, Hurl 6.1 capability selection, curl fallback, explicit service startup, primary plus negative coverage, persistence verification, mutation reconciliation, compact evidence, verdict, and cleanup.

- [ ] **Step 2: Write detailed references**

The verdict reference defines evidence, failure classes, severity, and strict verdict precedence. The Hurl reference defines secret injection, dynamic `redact`, test mode, sequential stateful execution, retry/idempotency rules, TLS, curl `--disable`, protocol restriction, manual redirects, and bounded temporary evidence.

- [ ] **Step 3: Write brief and report templates**

Capture contract source/hash/version, selected operations, environment, services, actors, credentials source, mutations, polling, checkpoint matrix, record IDs, findings, evidence, regression recommendations, and cleanup without secret values.

- [ ] **Step 4: Regenerate optional UI metadata**

```bash
python3 /Users/dee/.codex/skills/.system/skill-creator/scripts/generate_openai_yaml.py \
  skills/audit-api \
  --interface 'display_name=Audit API' \
  --interface 'short_description=Audit running APIs with direct evidence' \
  --interface 'default_prompt=Use $audit-api to audit this running API surface and produce an evidence-backed verdict.'
```

### Task 5: Wire, validate, forward-test, and commit `audit-api`

**Files:**
- Modify: `README.md`
- Modify: `bin/link-skills.sh`

- [ ] **Step 1: Add repository wiring**

Add `audit-api` to the link list, README tree/table, and a usage example that distinguishes direct API auditing from Swagger UI and one-off curl.

- [ ] **Step 2: Run complete local validation**

```bash
sh -n bin/link-skills.sh
/tmp/agent-skills-validator/bin/python /Users/dee/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/audit-ui
/tmp/agent-skills-validator/bin/python /Users/dee/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/audit-api
node --test skills/audit-ui/scripts/*.test.mjs
node --test skills/audit-api/scripts/*.test.mjs
node --test tests/audit-helper-conformance.test.mjs tests/audit-executors.test.mjs
```

Expected: all validations and tests pass.

- [ ] **Step 3: Link both skills globally and verify targets**

```bash
bin/link-skills.sh
```

Expected: both skills resolve from all five configured global skill directories.

- [ ] **Step 4: Run bounded forward tests**

Use the contract fixtures to verify version/inheritance/unresolved-reference guidance, run a focused Hurl audit and curl fallback against the disposable API fixture, verify production mutation refusal from the instructions, and confirm no repository or credential residue remains.

- [ ] **Step 5: Commit the verified API skill and shared tests**

```bash
git add skills/audit-api tests README.md bin/link-skills.sh docs/superpowers/plans/2026-07-15-audit-api-implementation.md
git commit -m 'feat: add audit api skill'
```
