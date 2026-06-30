# Task Doc Delivery Loop Skill Design

Date: 2026-06-30
Status: Proposed for deliberation
Target repository: `~/agent-skills`
Proposed skill name: `task-doc-delivery-loop`
Source mode: user brief + retrospective from service-request linked NEED currency delivery session

## Objective

Create a token-friendly orchestration skill that lets an approved task document become self-implementable end to end.

The skill should run a global goal for a task doc and carry it through implementation, validation, delegated review, finding remediation, branch publishing, PR creation, PR review comment handling, final review of fixes, final push, and goal closeout.

The default completion target is a pushed branch with an open PR and known review/check state. Local-only completion is allowed only when the user explicitly asks to stop before publishing.

## Problem Statement

Feature-grade task documents already capture the durable implementation contract: objective, scope, exclusions, architecture summary, code evidence, likely files, decisions, acceptance criteria, and validation. The missing piece is a repeatable delivery loop that agents can follow without the user restating the same multi-step prompt each time.

The service-request linked NEED currency session showed the desired loop:

1. pull/update the target branch
2. read the task doc and repo instructions
3. implement the change
4. run focused validation
5. use a subagent to review the implementation
6. fix valid findings
7. revalidate
8. publish branches and open PRs
9. wait for PR review/check state
10. inspect PR comments
11. fix valid PR findings
12. use a subagent to review the fixes
13. commit, push, and close the goal with evidence

Without a dedicated skill, the user has to repeat this choreography manually. That makes task docs less self-contained than they should be.

## Existing Skill Fit

This skill should be a conductor, not a mega-skill. It must invoke or defer to existing skills at the phase where they are needed, and it must not copy their full procedures into its own `SKILL.md`.

### `task-doc`

`task-doc` remains the source-of-truth format. This new skill consumes an approved task doc; it does not create or rewrite one unless the file is missing, stale, or blocked by unresolved decisions.

If the task doc has a non-empty `Decisions Required Before Implementation` section, the delivery loop must resolve those decisions before editing implementation files.

### `task-first-implementation`

Use this only when the user starts from an idea or partially formed task and the task doc does not exist yet. Once an approved task doc exists, `task-doc-delivery-loop` owns the execution lifecycle.

### `test-driven-development`

Use when adding or fixing behavior where a focused test can be written first or updated before implementation. The delivery skill should not force ceremony when the repo's practical test path is clearer, but it should prefer tests before code for behavior changes.

### `systematic-debugging`

Use when validation fails, behavior is unexpected, or the implementation does not match the task doc. The delivery loop should pause broad changes and isolate the failure before patching.

### `review-implementation`

Use for delegated or local report-only review of the finished implementation against the task doc.

For the default path, use a subagent or review agent when the runtime supports one. If unavailable, perform the same report-only review locally and state the fallback.

### `address-review-findings`

Use to evaluate and fix findings from implementation reviews, PR reviews, or explicit reviewer comments. Findings are evidence to verify, not commands to apply blindly.

### `publish-branch`

Use for commit, push, and PR creation. Publishing is part of the default completion path. The skill must not silently include unrelated dirty files.

### GitHub PR Comment Skills

Use GitHub review-comment tooling when available, such as `gh-address-comments`, to inspect and address unresolved review threads. If unavailable, fall back to `gh pr view`, `gh pr checks`, `gh api`, or the platform's equivalent.

### `verification-before-completion`

Use before closing the goal to ensure the final claim is supported by current validation, branch state, PR state, and known review comments.

### `executing-plans`

Do not use by default. Use only when the task doc is large or risky enough to need a separate implementation plan before coding. For normal task docs, keep a compact phase checklist inside the goal instead of creating another plan artifact.

## Proposed Skill Scope

Use this skill when:

- the user has an approved task doc and wants it implemented
- the user asks to make a task doc self-implementing
- the user wants a goal run from task doc to PR
- the user asks for implementation, delegated review, findings fixes, validation, PR publishing, and PR comment handling in one loop
- a prior implementation session should be resumed from a task doc and completed through PR readiness

Do not use this skill when:

- there is no task doc or the task doc is not approved
- the work is a tiny one-shot change with no need for a task-doc delivery loop
- the user only wants a report-only implementation review
- the user only wants to publish existing commits
- the user only wants to create or repair a task doc
- unresolved task-doc decisions still need product or architecture input

## Non-Goals

The skill does not:

- replace `task-doc`
- replace `task-first-implementation`
- duplicate dependent skill procedures
- create a new task document format
- guarantee that external PR reviewers or review bots are available
- merge PRs by default
- bypass repo hooks, checks, protected-branch rules, or approval gates
- force a separate implementation plan for every task doc
- wait indefinitely for PR review comments

## Token-Friendly Design Rules

The eventual `SKILL.md` should be intentionally short and procedural.

Rules:

- Load dependent skills only when their phase is reached.
- Do not paste or paraphrase full dependent skill instructions.
- Read the task doc once, extract a compact task brief, and then refer back to the path.
- Keep goal updates factual: phase, branch, PR URL, validation commands, findings, blockers.
- Use narrow subagent prompts with task doc path, diff scope, repo path, and exact output format.
- Avoid passing broad chat history to subagents unless it is required.
- Prefer focused validation after focused edits; run broader validation only when risk or repo policy requires it.
- Record assumptions once in the goal ledger instead of repeating them in every update.
- Define explicit stop conditions for unavailable review agents, failing external systems, missing credentials, and long-running CI.

## Goal Contract

The skill should require global goal tracking when the runtime supports it.

At start:

- create a goal if none exists for the task
- if a matching goal already exists, continue it rather than creating a duplicate
- record the task doc path and current phase

Goal ledger fields:

- `task_doc`: path
- `repos`: primary repo and dependent repos, when known
- `branch`: current branch or intended branch
- `phase`: intake, implementation, validation, delegated-review, remediation, publish, pr-review, final-review, complete, or blocked
- `validation`: commands run and status
- `findings`: open findings and disposition
- `prs`: PR URLs and check/review state
- `blockers`: external or decision blockers

Close the goal only when:

- the branch is pushed
- PRs are open by default, unless the user explicitly requested local-only completion
- required validation has passed or skipped commands are explicitly justified
- implementation review findings are resolved, rejected with evidence, or deferred with user approval
- PR review comments are checked and actionable comments are resolved
- final branch/PR state is verified

If the goal tool is unavailable, use the same ledger as a compact checklist and state the fallback.

## Workflow

### 1. Intake

Read:

- the task doc
- repo instructions such as `AGENTS.md`, `CLAUDE.md`, `README.md`, and contributor docs required by the repo
- current git status and branch
- dependent repo state if the task doc spans packages or sibling repos

Reject or pause when:

- the task doc cannot be found
- the task doc has unresolved decisions that need user input
- the worktree has unrelated dirty files that would make implementation or publish unsafe
- the current branch is a protected/default/integration branch and the user has not approved direct work there

Extract a compact task brief:

- objective
- included scope
- excluded scope
- behavior to preserve
- likely files
- validation plan
- publish/dependency assumptions

### 2. Goal Start

Create or continue the global goal. Initialize the ledger and a short phase checklist.

The checklist should stay high-level:

1. implement task doc
2. validate locally
3. delegated implementation review
4. fix valid findings
5. publish branch and PR
6. monitor PR checks/reviews
7. fix actionable PR comments
8. final review and push
9. close goal

### 3. Implementation

Implement against the task doc and repo instructions.

Use tests first when practical. Keep edits scoped to included task-doc work. Do not add excluded follow-up scope unless the user explicitly expands the task.

If the task spans multiple repos, sequence changes according to contract ownership, for example shared package first, then API, then UI. Refresh generated or vendored snapshots using repo-standard commands.

### 4. Local Validation

Run the task doc's validation plan and any repo-required commands that credibly cover the change.

If a command fails:

- invoke `systematic-debugging` when available
- identify whether the failure is related to the change
- fix related failures
- document unrelated or environmental failures without hiding them

### 5. Delegated Implementation Review

Use a subagent or review agent by default when supported.

Review prompt must be narrow:

- task doc path
- repo path or repos
- branch/diff scope
- instruction to report only
- output shape: verdict, critical findings, important findings, minor findings, missing validation, recommended fixes

If no subagent is available, perform a local report-only review and state that fallback.

### 6. Findings Remediation

Use `address-review-findings` when available.

For every finding:

- classify as valid, invalid, unclear, or out of scope
- fix valid findings
- ask before acting on unclear findings that affect implementation direction
- reject invalid findings with code, test, or task-doc evidence
- keep out-of-scope findings as follow-ups

Re-run focused validation after meaningful fixes.

If fixes were material, run another delegated or local implementation review before publishing.

### 7. Publish By Default

Use `publish-branch` when available.

Default behavior:

- create a task-appropriate branch if needed
- stage only intended files
- commit with a scoped message
- push the branch
- open a PR by default

For multi-repo tasks, open coordinated PRs with dependency notes.

Do not:

- publish unrelated dirty files
- push directly to protected/default/integration branches without explicit instruction
- bypass hooks unless the user explicitly requests it
- create ready-for-review PRs when known checks are failing, unless the user confirms

### 8. PR Checks And Review Comments

After PR creation:

- wait for immediately triggered checks to finish when practical
- inspect PR reviews, issue comments, inline comments, and unresolved review threads
- distinguish bot/system notices from actionable review findings
- handle usage limits or unavailable review agents as external blockers, not code findings

Use GitHub tooling when available. Fallback to platform CLI/API commands.

Do not wait indefinitely. If review is unavailable, blocked by usage limits, or still pending after the configured/reasonable wait, record the state and ask or close as blocked only when the same external blocker prevents further progress.

### 9. PR Comment Remediation

For actionable PR comments:

- evaluate each comment like a review finding
- fix valid comments
- push changes
- re-run focused validation
- inspect updated PR state

If PR comment fixes are material, use a subagent or review agent to review the fixes before final push or closeout.

### 10. Completion

Before closing:

- invoke `verification-before-completion` when available
- verify git status, latest commit, upstream state, and PR URLs
- verify validation command outcomes
- verify PR checks/reviews/comments were inspected
- record skipped validation, blockers, risks, and unrelated dirty files

Close the goal as complete only when the delivery loop is actually complete. If the work is blocked by external state, missing credentials, review-agent limits, or unresolved product decisions, mark blocked only after the runtime's goal-blocking policy is satisfied.

## Subagent Review Prompt Template

```text
Review the implementation against:

{TASK_DOC_PATH}

Repo path(s):
{REPO_PATHS}

Branch/diff scope:
{BRANCH_OR_DIFF_SCOPE}

Report only. Do not modify files.

Check:
- every task-doc requirement is implemented
- excluded scope was not added
- current behavior to preserve remains intact
- repo instructions are followed
- tests and validation are adequate
- PR/dependency/package snapshot state is coherent
- actionable PR comments, if any, are addressed

Output:
- verdict: pass, pass-with-fixes, or fail
- critical findings
- important findings
- minor findings
- missing validation
- recommended fixes

For each finding include file:line or PR comment URL, requirement/risk, why it matters, and the smallest credible fix.
```

## PR Review Comment Handling

The skill should normalize PR feedback into the same finding model used for implementation review.

Comment classes:

- `actionable`: code, test, doc, validation, or PR description change is needed
- `non-actionable`: praise, question already answered by code, duplicate comment, or informational bot output
- `external-blocker`: usage limits, CI outage, missing credentials, unavailable reviewer, or required reviewer not present
- `unclear`: comment could imply several different fixes
- `out-of-scope`: valid idea that belongs outside the task doc

Only `actionable` findings are fixed automatically. Ask the user about unclear findings when the choice affects behavior or scope.

## Relationship To `executing-plans`

`executing-plans` executes a written implementation plan. `task-doc-delivery-loop` executes an approved task doc through the full delivery lifecycle.

Use `executing-plans` only when the task doc is too large or risky to execute directly and a separate step-by-step plan would reduce risk. Do not create a plan artifact just to satisfy process.

## Completion Report

The final report should include:

- task doc path
- branch names and commit hashes
- PR URLs
- implementation summary
- delegated reviews run and verdicts
- findings fixed, rejected, deferred, or blocked
- validation commands run and results
- validation commands skipped and why
- PR checks/review/comment state
- unrelated dirty files excluded from publish scope
- remaining risks or external blockers

The report should be concise. It should provide enough evidence for handoff without replaying the whole session.

## Open Questions

None. The design assumes:

- global goal tracking is normally available
- publishing/opening PRs is the default completion path
- dependent skill instructions are loaded lazily
- task docs already contain the execution contract needed by this skill

## Implementation Notes

The eventual `SKILL.md` should be compact. A suggested structure:

1. frontmatter with trigger language for task-doc goal delivery
2. short purpose and default behavior
3. phase checklist
4. dependency routing table
5. token-friendly rules
6. subagent review prompt template
7. completion report shape

Avoid long examples unless they cover an edge case not obvious from the workflow.
