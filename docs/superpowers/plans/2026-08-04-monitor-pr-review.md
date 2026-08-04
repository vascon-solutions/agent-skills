# Monitor PR Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a portable `monitor-pr-review` skill that repeatedly handles GitHub PR review activity until a configurable quiet window expires, and integrate it with explicitly ready task-doc deliveries.

**Architecture:** Keep finding judgment in `address-review-findings` and publishing safety in `publish-branch`. Add one read-only Node helper that resolves complete paginated PR review state through `gh api graphql`; the current agent session owns the ledger, mutations, timer, and delivery-loop result mapping.

**Tech Stack:** Markdown Agent Skills, Node.js ESM, `node:test`, GitHub CLI REST/GraphQL, POSIX shell.

---

### Task 1: Lock the reviewed routing and lifecycle contract

**Files:**
- Modify: `docs/superpowers/specs/2026-08-04-monitor-pr-review-design.md`
- Modify: `tests/skills-portability.test.mjs`

- [ ] **Step 1: Add failing integration assertions**

Add assertions that require:

```js
assert.match(monitor, /^description: Use when .*monitoring.*babysitting.*keep watching.*quiet/m);
assert.match(address, /current batch/);
assert.match(address, /monitor-pr-review/);
assert.match(loop, /ready PR[\s\S]*monitor-pr-review/i);
assert.match(loop, /draft PR[\s\S]*explicit/i);
assert.match(monitor, /quiet_complete[\s\S]*not.*review.*finished/i);
```

- [ ] **Step 2: Run the portability test and confirm RED**

Run: `node --test tests/skills-portability.test.mjs`

Expected: FAIL because `skills/monitor-pr-review/SKILL.md` does not exist and the existing routing skills do not mention it.

- [ ] **Step 3: Finalize the reviewed spec corrections**

Ensure the spec says:

- ready PRs delegate automatically; explicit draft invocations are accepted;
- continuation wording overrides one-shot wording;
- the quiet window defaults to ten minutes but accepts a positive explicit override;
- `quiet_complete` means observed quiet, not permanent review completion;
- runtime wait primitives are preferred without idle conversational turns;
- every non-success monitor result has a delivery-loop disposition; and
- the paginated helper remains v1 scope.

- [ ] **Step 4: Validate and commit the reviewed contract**

Run: `git diff --check && rg -n "TBD|TODO|FIXME" docs/superpowers/specs/2026-08-04-monitor-pr-review-design.md`

Expected: `git diff --check` exits 0 and the placeholder scan returns no matches.

Commit:

```bash
git add docs/superpowers/specs/2026-08-04-monitor-pr-review-design.md tests/skills-portability.test.mjs
git commit -m "docs: address PR monitor design review"
```

### Task 2: Build the read-only paginated PR snapshot helper

**Files:**
- Create: `skills/monitor-pr-review/scripts/fetch-pr-review-state.mjs`
- Create: `skills/monitor-pr-review/scripts/fetch-pr-review-state.test.mjs`

- [ ] **Step 1: Write failing unit tests for the public API**

The test imports:

```js
import {
  fetchPrReviewState,
  parseCliArgs,
  parsePullRequestUrl,
  redactSensitive,
} from "./fetch-pr-review-state.mjs";
```

Use a fake client with `graphql(query, variables)` and assert this normalized shape:

```js
{
  schemaVersion: 1,
  capturedAt: "2026-08-04T12:00:00.000Z",
  repository: "vascon-solutions/agent-skills",
  pullRequest: {
    number: 5,
    url: "https://github.com/vascon-solutions/agent-skills/pull/5",
    title: "Example",
    state: "OPEN",
    isDraft: true,
    headRefName: "example",
    headRefOid: "abc123",
    reviewDecision: null,
  },
  conversationComments: [],
  reviews: [],
  reviewThreads: [],
}
```

Cover separate pagination for conversation comments, reviews, review threads, and more than 100 replies in one thread. Also cover deterministic sorting, duplicate IDs, nullable line anchors, GraphQL errors, a missing end cursor, URL parsing, CLI parsing, and token redaction.

- [ ] **Step 2: Run helper tests and confirm RED**

Run: `node --test skills/monitor-pr-review/scripts/fetch-pr-review-state.test.mjs`

Expected: FAIL with module-not-found or missing export errors.

- [ ] **Step 3: Implement GraphQL queries and pagination**

Export these units:

```js
export const fetchPrReviewState = async ({ client, repository, prNumber, capturedAt }) => {};
export const parsePullRequestUrl = (value) => {};
export const parseCliArgs = (argv) => {};
export const redactSensitive = (value) => {};
```

Use separate named GraphQL operations so an exhausted connection never restarts while another paginates:

```graphql
query PullRequestMeta($owner: String!, $repo: String!, $number: Int!) { ... }
query PullRequestComments($owner: String!, $repo: String!, $number: Int!, $cursor: String) { ... }
query PullRequestReviews($owner: String!, $repo: String!, $number: Int!, $cursor: String) { ... }
query PullRequestThreads($owner: String!, $repo: String!, $number: Int!, $cursor: String) { ... }
query ReviewThreadComments($threadId: ID!, $cursor: String) { ... }
```

Deduplicate every connection by GraphQL node ID and sort events by event timestamp then ID. Fetch nested thread-reply pages when the first thread page reports `hasNextPage`.

- [ ] **Step 4: Implement the CLI adapter**

Support:

```text
node fetch-pr-review-state.mjs [--repo OWNER/REPO] [--pr NUMBER|URL] [--captured-at ISO]
```

The adapter must:

1. run `gh auth status`;
2. resolve the current repository through `gh repo view --json nameWithOwner` when `--repo` is absent;
3. resolve the current branch PR through `gh pr view --json number` when `--pr` is absent;
4. call `gh api graphql` with the query on stdin and typed `-F` variables;
5. print only normalized JSON on stdout; and
6. print redacted actionable errors on stderr.

- [ ] **Step 5: Run helper tests and confirm GREEN**

Run: `node --test skills/monitor-pr-review/scripts/fetch-pr-review-state.test.mjs`

Expected: all helper tests pass.

- [ ] **Step 6: Smoke-test the read-only helper against PR #5**

Run:

```bash
node skills/monitor-pr-review/scripts/fetch-pr-review-state.mjs \
  --repo vascon-solutions/agent-skills \
  --pr 5 > /tmp/monitor-pr-review-state.json
node -e 'const s=require("/tmp/monitor-pr-review-state.json"); if(s.pullRequest.number!==5||!s.pullRequest.isDraft) process.exit(1)'
```

Expected: both commands exit 0; no GitHub state is mutated.

- [ ] **Step 7: Commit the helper**

```bash
git add skills/monitor-pr-review/scripts
git commit -m "feat: add PR review state snapshot helper"
```

### Task 3: Add the monitor skill and metadata

**Files:**
- Create: `skills/monitor-pr-review/SKILL.md`
- Create: `skills/monitor-pr-review/agents/openai.yaml`

- [ ] **Step 1: Record the RED routing baseline**

Run a report-only fresh-agent scenario with the original repeated prompt and no future skill loaded. Record whether broad `address-review-findings` metadata selects a one-shot route or reconstructs the loop ad hoc.

- [ ] **Step 2: Write the minimal orchestration skill**

Use frontmatter:

```yaml
---
name: monitor-pr-review
description: Use when an open GitHub pull request needs ongoing monitoring or babysitting for new review comments, including requests to keep watching, loop, or wait until quiet.
---
```

The body must define:

- explicit authorization for scoped fixes, focused validation, commits, pushes, thread replies, and resolution;
- no authorization for merge, close, rebase, force-push, or unrelated changes;
- current-session ownership and no mutation-capable monitor subagent;
- direct explicit draft support and ready-only automatic delivery delegation;
- the helper command and compact event-ID ledger;
- classification through `address-review-findings`;
- coherent remediation batches through `publish-branch` commit-and-push mode;
- original-thread reply and GraphQL `resolveReviewThread` mutation ordering;
- configurable quiet-window reset and race-safe final refresh;
- preferred runtime wait primitive and bounded foreground polling fallback;
- repeated-blocker protection; and
- the five terminal results and report fields from the spec.

- [ ] **Step 3: Add Codex UI metadata**

Create:

```yaml
interface:
  display_name: "Monitor PR Review"
  short_description: "Handle PR review feedback until the configured quiet window"
  default_prompt: "Use $monitor-pr-review to monitor the current branch GitHub PR, address new review findings, and stop after the default ten-minute quiet window unless I specify another duration."
```

- [ ] **Step 4: Validate the skill folder**

Run the available skill validator against `skills/monitor-pr-review`, then run:

```bash
node --test skills/monitor-pr-review/scripts/fetch-pr-review-state.test.mjs
```

Expected: validation succeeds and all helper tests pass.

- [ ] **Step 5: Commit the new skill**

```bash
git add skills/monitor-pr-review/SKILL.md skills/monitor-pr-review/agents/openai.yaml
git commit -m "feat: add PR review monitoring skill"
```

### Task 4: Integrate one-shot remediation and task delivery

**Files:**
- Modify: `skills/address-review-findings/SKILL.md`
- Modify: `skills/task-doc-delivery-loop/SKILL.md`
- Modify: `tests/skills-portability.test.mjs`

- [ ] **Step 1: Narrow one-shot routing metadata**

Change the address skill description to identify a current findings batch, and add an early route:

```text
If the request asks to monitor, babysit, keep watching, continue in a loop, or wait until quiet after the current batch, use `monitor-pr-review` instead.
```

- [ ] **Step 2: Add ready-only delivery delegation**

Update dependency routing, PR Review, PR Remediation, Loop Bounds, and Final Report so:

- draft delivery keeps bounded inspection;
- explicitly ready delivery invokes `monitor-pr-review` inline;
- the monitor owns ready-PR review remediation without duplicate cycles; and
- every terminal result maps to continue, pause, ask, block-policy handling, or external-state verification.

- [ ] **Step 3: Make integration tests GREEN**

Run: `node --test tests/skills-portability.test.mjs`

Expected: all portability tests pass, including draft-default preservation and ready-monitor delegation.

- [ ] **Step 4: Commit routing integration**

```bash
git add skills/address-review-findings/SKILL.md skills/task-doc-delivery-loop/SKILL.md tests/skills-portability.test.mjs
git commit -m "feat: route ongoing PR review monitoring"
```

### Task 5: Register and document the portable skill

**Files:**
- Modify: `bin/link-skills.sh`
- Modify: `README.md`
- Modify: `tests/skills-portability.test.mjs`

- [ ] **Step 1: Add the skill to pack registration**

Add `monitor-pr-review` exactly once to `SKILL_NAMES` adjacent to the review/remediation skills.

- [ ] **Step 2: Add README inventory and usage guidance**

Add the directory to the tree, add one purpose row to the skill table, and state that explicit monitor/babysit wording runs the loop while task-doc delivery delegates only for explicitly ready PRs.

- [ ] **Step 3: Run registration tests**

Run: `node --test tests/skills-portability.test.mjs`

Expected: the link-script skill list exactly matches skill directories and all assertions pass.

- [ ] **Step 4: Commit pack registration**

```bash
git add bin/link-skills.sh README.md tests/skills-portability.test.mjs
git commit -m "docs: register PR review monitor skill"
```

### Task 6: Review, remediate, validate, and link

**Files:**
- Modify: only files required by verified review findings

- [ ] **Step 1: Run the full local validation set**

Run:

```bash
node --test skills/monitor-pr-review/scripts/fetch-pr-review-state.test.mjs
node --test tests/*.test.mjs
git diff --check main...HEAD
```

Expected: every command exits 0.

- [ ] **Step 2: Dispatch the required report-only subagent review**

Review against:

```text
docs/superpowers/specs/2026-08-04-monitor-pr-review-design.md
docs/superpowers/plans/2026-08-04-monitor-pr-review.md
```

The reviewer reads the full `main...HEAD` diff, reports only, and returns verdict plus critical, important, minor, and missing-validation findings with file:line evidence.

- [ ] **Step 3: Evaluate and address review findings**

Use `address-review-findings`: verify every item, fix valid findings, reject invalid findings with evidence, and rerun affected tests after each meaningful correction.

- [ ] **Step 4: Run final verification**

Run fresh:

```bash
node --test skills/monitor-pr-review/scripts/fetch-pr-review-state.test.mjs
node --test tests/*.test.mjs
git diff --check main...HEAD
git status --short
```

Expected: tests pass, diff check exits 0, and status contains only intended files or is clean after the final commit.

- [ ] **Step 5: Commit review remediation if needed**

```bash
git add <only-reviewed-intended-files>
git commit -m "fix: address PR monitor review findings"
```

Skip the commit when no files changed; never create an empty commit.

- [ ] **Step 6: Run the requested Bash linker**

Run:

```bash
./bin/link-skills.sh /Users/dee/agent-skills/.worktrees/monitor-pr-review
```

Expected: every target reports `monitor-pr-review` as linked or already pointing at the isolated checkout, with no missing skill errors.
