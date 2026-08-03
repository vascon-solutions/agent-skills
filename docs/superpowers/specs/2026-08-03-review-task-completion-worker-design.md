# Review Task Completion Worker Design

## Goal

Create a reusable personal skill that delegates an independent, read-only task-completion review to a `gpt-5.6-sol` subagent at medium reasoning effort. The parent agent remains responsible for deciding which findings are valid, applying fixes, validating the result, and requesting another review when needed.

## Invocation

The skill will be named `review-task-completion-worker` and installed through the existing personal-skill layout:

- source: `agent-skills/skills/review-task-completion-worker/`
- discovery symlink: `~/.codex/skills/review-task-completion-worker`

Users may invoke it explicitly with `$review-task-completion-worker` or ask for a reviewer worker, completion review, final implementation review, or ready-PR assessment.

## Worker Contract

The skill must spawn exactly one reviewer with:

- model: `gpt-5.6-sol`
- reasoning effort: `medium`
- context fork: minimal task-local context rather than the parent agent's conclusions
- permissions: read-only for source, documentation, git, and PR state

The worker may inspect files, diffs, history, tests, task documents, repository instructions, and remote PR metadata. It must not edit files, stage changes, commit, push, create or modify PRs, or dismiss findings on behalf of the parent.

## Review Inputs

Before delegation, the parent resolves and passes:

1. repository and worktree path;
2. task identity and authoritative requirements or task document;
3. comparison base and current branch/commit;
4. relevant validation evidence;
5. requested delivery state, such as ready PR suitability;
6. known external blockers, labeled as claims to verify rather than conclusions to inherit.

Missing optional context does not block review when it can be discovered read-only. A materially ambiguous comparison base or task scope must be reported rather than guessed.

## Review Standard

The worker reviews the actual diff and surrounding code against repository instructions and task requirements. It checks:

- requirement and task-doc completeness;
- correctness, regressions, edge cases, and contract alignment;
- architecture and repository convention fit;
- test quality and validation gaps;
- documentation accuracy;
- branch/base synchronization and PR readiness;
- whether claimed external blockers are genuinely outside the reviewed change.

Findings must be actionable, evidence-backed, prioritized, and include tight file/line references when possible. The worker must distinguish in-scope defects, external blockers, and optional improvements.

## Output Contract

The worker returns only a review report with:

1. `Verdict`: `pass`, `pass-with-fixes`, or `fail`;
2. `Actionable findings`: ordered by severity, or `None`;
3. `Missing validation`: commands or evidence still needed, or `None`;
4. `External blockers`: verified blockers outside the reviewed scope, or `None`;
5. `Ready-PR suitability`: a direct yes/no assessment with conditions.

A pass is not allowed when actionable correctness findings or required validation gaps remain. Style-only preferences do not block readiness unless a repository rule makes them mandatory.

## Parent Remediation Loop

The parent independently evaluates the report, applies valid fixes, reruns proportionate validation, and invokes the worker again with the updated commit. The loop ends only when the worker reports no actionable findings, or when a verified external blocker is explicitly accepted by the user. The reviewer never edits the implementation, preserving independence.

## Skill Packaging

The skill will contain only:

- `SKILL.md` with the delegation and review contract;
- `agents/openai.yaml` with the callable display name, description, and default prompt.

No script is required because model selection and delegation are runtime tool arguments, while repository discovery and review require judgment.

## Verification

Skill development follows RED–GREEN–REFACTOR:

1. Run a baseline completion-review scenario without the skill and record omissions or unsafe behavior.
2. Initialize and write the minimal skill addressing those observed gaps.
3. Validate skill structure with `quick_validate.py` and inspect generated UI metadata.
4. Forward-test the same scenario using a fresh `gpt-5.6-sol` medium subagent instructed to use the skill.
5. Confirm the worker remains read-only, checks the real diff and requirements, separates external blockers, and returns the required report fields.
6. Refine and repeat if the forward test exposes loopholes.

## Non-Goals

- Automatically editing or remediating findings.
- Replacing specialized security, API, UI, or documentation review skills.
- Automatically approving, merging, or publishing a PR.
- Monitoring PR comments after publication unless separately requested.
