# Task Doc Delivery Loop Calibration

## Objective

Improve the `task-doc-delivery-loop` skill so future single-repository goal sessions can deliver one approved task doc or a coherent ordered task-doc set while calibrating effort, validation depth, delegated review, and publish scope before implementation.

The outcome should preserve the skill's end-to-end delivery purpose while reducing unnecessary wall-clock time, duplicate validation, and overly broad review loops for ordinary task-doc work.

## Source Context

Source mode: brief.

This task comes from a retrospective on a task-doc delivery session that took about 50 minutes. The session completed successfully, but the user asked what could be improved for future task docs and clarified that the `task-doc` skill should not be changed. The improvement belongs in the delivery-loop skill that executes existing task docs.

## Design Reference

- Source Brief: user retrospective in the July 1, 2026 multicurrency aggregate delivery session.
- Current Skill: `skills/task-doc-delivery-loop/SKILL.md`
- Existing Design Spec: `docs/superpowers/specs/2026-06-30-task-doc-delivery-loop-design.md`
- Related Skill Boundary: `skills/task-doc/SKILL.md`
- Publishing Boundary: `skills/publish-branch/SKILL.md`

## Architecture Summary

`task-doc-delivery-loop` should remain an orchestration skill, not a replacement for task-doc creation, implementation review, publishing, or validation skills. Add a single-repository delivery-set mode plus an early calibration phase that classifies task risk and chooses effort, validation, review, and publish modes. Tighten delegated review defaults so review agents receive bounded scope, and add validation deduplication rules so full suites are not repeated after low-risk follow-up edits unless risk changes.

## Code Evidence

| Behavior                                                                                                                                                                  | Source                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Before this task, the delivery-loop skill accepted a singular `task_doc` ledger and defaulted completion to a draft PR.                                                   | Pre-change `skills/task-doc-delivery-loop/SKILL.md#Purpose`, `skills/task-doc-delivery-loop/SKILL.md#Delivery-Ledger` |
| The baseline workflow read one task doc, implemented, validated, delegated review, remediated, published, checked PR review state, and closed out.                        | Pre-change `skills/task-doc-delivery-loop/SKILL.md#Workflow`                                                          |
| The baseline delegated-review prompt was broad and did not include bounded or risk-calibrated review guidance.                                                            | Pre-change `skills/task-doc-delivery-loop/SKILL.md#Subagent-Review-Prompt`                                            |
| The existing design spec already calls for token-friendly rules, narrow subagent prompts, and broader validation only when risk or repo policy requires it.               | `docs/superpowers/specs/2026-06-30-task-doc-delivery-loop-design.md#Token-Friendly Design Rules`                      |
| The publish skill already owns commit, push, and PR safety checks, so delivery-loop changes should route publish work there rather than duplicating publishing procedure. | `skills/publish-branch/SKILL.md#Purpose`                                                                              |
| The task-doc skill is document creation only and explicitly says not to implement task work. This task should not alter task-doc generation behavior.                     | `skills/task-doc/SKILL.md#Purpose`                                                                                    |

## Current Behavior To Preserve

- `task-doc-delivery-loop` continues to require approval for every task doc before implementation.
- One goal execution remains scoped to one current repository, branch, and PR.
- Dependent skills continue to be loaded lazily at the phase where they are needed.
- Implementation remains scoped to the task doc's included work and exclusions.
- Publish work continues to use `publish-branch` instead of duplicating publish mechanics.
- Review findings still require classification before remediation.
- Final completion still requires current evidence for validation, branch state, PR state, and known blockers.

## Prerequisites

- The existing `task-doc-delivery-loop` skill remains the target skill.
- The task-doc creation skill remains out of scope.
- No new runtime tool or MCP capability is required.

## Scope

- Add an early delivery calibration step to `task-doc-delivery-loop` that records:
  - effort level: low, medium, high, or explicitly requested higher effort
  - validation level: focused, affected, full, or repo-required
  - review mode: none, local review, tight delegated review, or high-effort delegated review
  - publish mode: local-only, commit-only, pushed branch, draft PR, or ready PR
- Add delivery-set support that:
  - accepts one approved task doc or a coherent ordered set from the current repository
  - uses one goal, checkout/worktree, branch, and PR
  - records per-task status, validation, and checkpoint commits
  - rejects unrelated or independently shippable tasks that should use separate goals
  - runs focused validation at task boundaries and deduplicated integration validation for the full set
- Define risk-based defaults:
  - medium effort for ordinary feature-grade task docs
  - high effort for migrations, auth, permissions, security, finance, destructive data changes, unclear backend contracts, or broad refactors
  - low effort for docs-only or narrow mechanical updates
- Add validation deduplication guidance:
  - use focused tests during implementation
  - run full validation once when risk or repo policy warrants it
  - after doc-only, import-only, or formatting-only cleanup, rerun only targeted checks unless risk changed
  - account for publish hooks that repeat affected validation
- Add bounded delegated-review guidance:
  - default review prompt checks only task-doc compliance, excluded-scope creep, contract drift, preserved behavior, validation adequacy, and obvious repo-instruction violations
  - include a review timeout or maximum wait expectation
  - use high-effort review only when explicitly requested or risk classification requires it
- Add a post-goal retrospective trigger for unusually long delivery runs, such as sessions over 30 minutes, repeated validation cycles, or multiple review/remediation loops.
- Update the final report guidance to include calibration choices when they materially affected delivery time or confidence.

## Excluded

- Do not change `skills/task-doc/SKILL.md`.
- Do not change the task-doc template or task-doc generation requirements.
- Do not coordinate independent task-doc delivery across multiple primary repositories in one goal.
- Do not weaken publish safety gates, repo-hook compliance, validation evidence, or final verification requirements.
- Do not add tool-specific or repo-specific rules to this framework-agnostic skill pack.
- Do not create a new skill for calibration; this belongs inside `task-doc-delivery-loop`.
- Do not implement automatic timing instrumentation unless it can be done with existing goal or ledger fields and no new runtime dependency.

## Pre-Implementation Verification

- Re-read `skills/task-doc-delivery-loop/SKILL.md` and confirm the workflow structure has not changed since this task doc was written.
- Re-read `docs/superpowers/specs/2026-06-30-task-doc-delivery-loop-design.md` and preserve any design intent still applicable.
- Confirm `skills/task-doc/SKILL.md` still treats task-doc creation as document-only work.
- Confirm `skills/publish-branch/SKILL.md` still owns publish safety gates and supports an explicitly requested ready PR.
- Check current repository status before editing and avoid including unrelated skill changes.

## Likely Files To Touch

- `skills/task-doc-delivery-loop/SKILL.md` — primary skill update.
- `skills/task-doc-delivery-loop/agents/openai.yaml` — pluralize the reusable default prompt.
- `docs/superpowers/specs/2026-06-30-task-doc-delivery-loop-design.md` — record the combined delivery-set and calibration refinement.
- `README.md` — update the user-facing skill summary and approved-delivery example.

## Decisions Required Before Implementation

None. The user has already decided that future task-doc generation should not change and that the improvement belongs in `task-doc-delivery-loop`.

## Execution Rules

- Keep the skill concise and procedural.
- Make ready-for-review PR the default completion target; narrower publish modes require explicit user wording.
- Add calibration guidance without duplicating full procedures from `review-implementation`, `publish-branch`, `verification-before-completion`, or other dependent skills.
- Use defaults that improve speed without hiding risk:
  - medium is the normal implementation effort default
  - high is risk-triggered or explicitly requested
  - full validation is risk-triggered, repo-required, or final-confidence driven
- Do not instruct agents to skip required repo validation.
- Do not turn review time-boxes into hard failure conditions when the user explicitly asks for deep review.
- Permit review mode `none` only when the agent classifies the work as low risk, the user explicitly requests no review and non-PR delivery, and repository rules allow review to be skipped; every PR-bound delivery still requires local or delegated review.
- Preserve the loop's ability to continue when new critical findings appear.

## Deliverables

- Updated `task-doc-delivery-loop` skill with an explicit delivery calibration phase.
- Updated delivery ledger and workflow for one or multiple ordered task docs in one repository.
- Updated delegated-review prompt or review guidance that supports tighter, time-bounded reviews.
- Updated validation guidance that avoids unnecessary duplicate full validation while preserving evidence.
- Updated final report guidance that records calibration choices and notable time sinks when relevant.

## Completion Verification

- The skill tells agents to choose and record effort, validation, review, and publish modes before implementation.
- The skill defaults ordinary feature-grade delivery to medium effort unless risk or user instruction escalates it.
- The skill gives clear escalation criteria for high effort.
- The skill tells agents how to avoid duplicate full validation after low-risk follow-up edits.
- The skill defines a numeric default maximum wait for delegated review and a safe local-review fallback.
- Review mode `none` is explicit, constrained to low-risk non-PR delivery, and never the ready-PR default.
- The skill defaults to a ready-for-review PR and routes publish work through `publish-branch`.
- The skill groups only coherent task docs and tells agents to split unrelated or independently shippable work.
- The skill still requires evidence before final completion.
- Required checks and required reviewer decisions cannot remain pending at completion.
- The task-doc skill remains unchanged.
- Any changed Markdown passes a spelling/format sanity check appropriate for this repo.

## Completion Criteria

This task is complete when the delivery-loop skill includes the calibration, validation deduplication, bounded review, and retrospective guidance described above, without changing task-doc creation behavior or weakening delivery safety.

## Follow-ups

- Consider adding a small example calibration block to the delivery-loop design spec if future agents still misclassify effort or validation depth.
- Consider a separate task only if runtime goal tooling should expose structured elapsed-time or validation-cycle counters automatically.
