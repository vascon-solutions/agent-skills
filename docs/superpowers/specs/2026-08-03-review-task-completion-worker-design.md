# Review Task Completion Worker Design

## Goal

Create a reusable Codex-only personal skill that delegates an independent, behaviorally read-only task-completion review to a `gpt-5.6-sol` subagent at medium reasoning effort. The parent agent remains responsible for deciding which findings are valid, applying fixes, validating the result, and requesting another review when needed.

## Invocation

The skill will be named `review-task-completion-worker` and installed directly at:

- `~/.codex/skills/review-task-completion-worker/`

This avoids advertising a Codex-specific model and delegation API through the portable `agent-skills` pack. The skill's `agents/openai.yaml` will set `policy.allow_implicit_invocation: false`.

Users must invoke it explicitly with `$review-task-completion-worker`. Generic completion and implementation review requests continue to use `review-implementation`.

## Worker Contract

The skill must spawn exactly one reviewer with:

- model: `gpt-5.6-sol`
- reasoning effort: `medium`
- context fork: `fork_turns: "none"`
- prompt: a self-contained task-local review brief rather than parent history or conclusions

The current subagent runtime has no permission or sandbox argument and shares the parent's filesystem and tools. Read-only is therefore a strict behavioral contract, not an enforceable security boundary. The prompt must state that limitation and prohibit:

- editing, creating, deleting, formatting, or generating files;
- running tests, builds, linters, formatters, or other commands that may write artifacts;
- staging, committing, fetching, rebasing, pushing, or changing branches;
- creating, editing, reviewing, approving, closing, or merging PRs;
- spawning child agents or invoking this worker skill recursively.

The worker may use non-mutating reads of files, diffs, local history, task documents, repository instructions, existing validation output, and remote PR metadata. Before dispatch and after completion, the parent snapshots and compares worktree status plus tracked, staged, untracked, ignored, and task-relevant generated paths. This detects ordinary mutation but is not represented as enforcement. If the user requires an enforced read-only sandbox, the skill reports that the runtime cannot satisfy the request and does not dispatch.

## Review Inputs

Before delegation, the parent resolves and passes:

1. repository and worktree path;
2. task identity and authoritative requirements or task document;
3. comparison base and current review target, including tracked, staged, and untracked worktree changes;
4. relevant validation evidence;
5. requested delivery state, such as ready PR suitability;
6. known external blockers, labeled as claims to verify rather than conclusions to inherit.

Missing optional context does not block review when it can be discovered through non-mutating inspection. A materially ambiguous comparison base or task scope must be reported rather than guessed.

## Review Standard

The parent resolves the installed `review-implementation` skill and directs the worker to apply it in direct, report-only mode without further delegation. If that dependency cannot be resolved, the worker invocation fails closed. The worker additionally checks:

- requirement and task-doc completeness;
- correctness, regressions, edge cases, and contract alignment;
- architecture and repository convention fit;
- test quality and validation gaps;
- documentation accuracy;
- branch/base synchronization and PR readiness;
- whether claimed external blockers are genuinely outside the reviewed change.

Findings must be actionable, evidence-backed, use the shared `Critical` / `Important` / `Minor` severity vocabulary, and include tight file/line references when possible. The worker must distinguish in-scope defects, verified external blockers, and optional improvements.

## Output Contract

The worker returns only a review report with:

1. `Verdict`: `pass`, `pass-with-fixes`, or `fail`;
2. `Critical`, `Important`, and `Minor`: actionable findings in the shared `review-implementation` format, or `None`;
3. `Missing validation`: commands or evidence still needed, or `None`;
4. `External blockers`: verified blockers outside the reviewed scope, or `None`;
5. `Ready-PR suitability`: a direct yes/no assessment with conditions;
6. `Read-only receipt`: commands used and confirmation that the worker intentionally made no mutations or child delegations.

A pass is not allowed when actionable correctness findings or required validation gaps remain. Style-only preferences do not block readiness unless a repository rule makes them mandatory.

## Parent Remediation Loop

The parent independently evaluates the report, applies valid fixes, reruns proportionate validation, and may invoke one final review against the updated target after material remediation. The loop ends successfully only when every in-scope finding is dispositioned and the worker reports no remaining actionable findings. A verified external blocker ends the loop only when it prevents further review or remediation; that outcome is reported as stopped/unmet, never as a pass or ready-PR result. Repeated unchanged findings stop the loop for user direction rather than spinning.

The parent waits at most five minutes by default, checking progress at least once per minute. On timeout or interruption it stops the worker and reports the review as unmet. If delegation or the exact model/effort override is unavailable, the skill fails closed; it does not silently substitute a local review, another model, or another effort level.

## Skill Packaging

The skill will contain only:

- `SKILL.md` with the delegation and review contract;
- `agents/openai.yaml` with the callable display name, description, and default prompt.

No script is required because model selection and delegation are runtime tool arguments, while repository discovery and review require judgment. The skill is intentionally not added to `agent-skills/bin/link-skills.sh`, its portable README inventory, or non-Codex skill directories.

## Verification

Skill development follows RED–GREEN–REFACTOR:

1. Run baseline completion-review scenarios without the skill and record omissions or unsafe behavior.
2. Initialize and write the minimal skill addressing those observed gaps.
3. Validate skill structure with `quick_validate.py`, inspect generated UI metadata, and confirm only explicit `$review-task-completion-worker` invocation activates it.
4. Exercise a real dispatch with the exact model, effort, and `fork_turns` combination, then confirm the child resolves `review-implementation` and uses its direct report-only mode without recursive delegation.
5. Forward-test disposable fixtures for a clean pass, seeded defects, missing validation, ambiguous base/task scope, and dirty worktree review.
6. Simulate unavailable delegation/model/dependent-skill handling and verify fail-closed behavior without fallback.
7. Compare before/after tracked, staged, untracked, ignored, and generated state in the disposable repository and verify the exact output schema plus recursive-delegation prohibition.
8. Run `node --test tests/*.test.mjs` in `agent-skills` to ensure the separate Codex-only install does not disturb the portable pack.
9. Refine and repeat if forward testing exposes loopholes.

## Non-Goals

- Automatically editing or remediating findings.
- Replacing specialized security, API, UI, or documentation review skills.
- Automatically approving, merging, or publishing a PR.
- Monitoring PR comments after publication unless separately requested.
- Providing an enforceable read-only sandbox with the current subagent runtime.
