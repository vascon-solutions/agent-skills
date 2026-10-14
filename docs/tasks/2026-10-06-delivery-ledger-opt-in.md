# Delivery ledger opt-in

## Objective

Make the delivery ledger opt-in. A teammate who never asks for it gets a lightweight task-doc delivery that keeps the important gates as owner rules and records them in the PR body or completion report. Anyone who wants the ledger, including Dee through a standing instruction, gets today's ledger behaviour unchanged.

This is one improvement-grade delivery in `vascon-solutions/agent-skills`, targeting `main`. It changes skill text only.

## Source Context

Dee's direction (2026-10-06): "My teammates shouldn't be forced to use this; it should be something you opt into."

An independent assessment of the trigger, the dependent skills, the lost guarantees and the tests found:

- The ledger is unconditional today.
- Most dependent skills already have ledger-free paths.
- No test makes the ledger mandatory.
- Neither the helper nor the schema needs to change.

An independent spec review then split the original combined task. Helper ergonomics moved to `docs/tasks/2026-10-06-delivery-ledger-ergonomics.md`, which depends on this task.

The measured cost behind the request: BE-01-01-q2 spent about 520s of critical-path time (about 17% of agent working time, about 20% of output tokens) on ledger bookkeeping. Measurement artefacts are in `/Users/dee/agent-artifacts/delivery-ledger-cost-2026-10-06/`.

## Design Reference

None external. Current contracts:

- `skills/task-doc-delivery-loop/references/delivery-ledger.md`
- `references/authorization.md`
- `references/review-policy.md`

## Architecture Summary

A trigger rule in the delivery loop decides between ledger mode and lightweight mode, using fixed precedence. The pack default is lightweight.

**Ledger mode** is exactly today's behaviour.

**Lightweight mode:**
- Keeps the same gates as owner rules. Each gate is recorded in a plain PR-body section, or in the completion report for endpoints without a PR.
- States which guarantees are no longer enforced by the helper.
- Stays in one session.
- Has a defined interruption path.

Abandoning an existing ledger is a recorded state change, not a silent bypass.

## Code Evidence

Evidence from `main` at `7c09101`.

| Behavior | Source |
| --- | --- |
| Ledger use is unconditional ("Keep the delivery in a delivery ledger…"; `prepare-init` → `init` → `claim`). The only condition is resuming an existing ledger. | `skills/task-doc-delivery-loop/SKILL.md:24`, `:26` |
| Ledger-specific steps assume a ledger | `SKILL.md:30`, `:36`, `:48`, `:52`, `:58` |
| Phases split into fresh sessions by default | `SKILL.md:58` |
| The review bound is enforced inline for local-only work, with an "unmeasured limitation" | `SKILL.md:30`; `review-policy.md:65-67` |
| Skills that already work without a ledger: publish-branch, address-review-findings, validation | `publish-branch/references/ledger-handoff.md:3`; `address-review-findings/SKILL.md:20`, `:30`; `references/validation.md:15` |
| Unconditional ledger wording outside the loop | `address-review-findings/SKILL.md:39`; `references/orchestration.md:35`, `:75-82`; `monitor-pr-review/SKILL.md:16`, `:50`; `review-implementation/references/risk-classes.md:18-20`; `review-policy.md:80`; `README.md:112`; `audit-ui/SKILL.md:32`; `audit-api/SKILL.md:32-33` |
| What a repository may override; the list has no ledger requirement | `references/authorization.md:25` |
| Repository overrides read `AGENTS.md`, then `.agent/delivery-policy.json`; `AGENTS.md` wins | `orchestration.md:44` |
| Editing `ncdmb-procurement-ui/.agent/delivery-policy.json` invalidates existing validation receipts once | `ncdmb-procurement-ui/scripts/run-affected-validation.mjs:182-186`; `delivery-ledger.mjs:2385` |
| Guarantees the helper enforces only in ledger mode: lock and claim (`:77-82`); prepared-event idempotency (`:150-151`); review invalidation when a source changes (`:136`); evidence bound to the final candidate, with pending findings and FAIL audits blocking (`:104-110`); required audits that cannot be waived (`:108`); shape-sweep refusal before a push (`review-policy.md:70-79`); fresh-session resume (`:14`) | `references/delivery-ledger.md` |
| A ledger left behind cannot resume after another session pushes: moved ref → mismatch (`:118`); `remote_adoption` never replaces a baseline (`:128`); drift refuses claim (`:92`). Takeover needs the user's word (`:82`). The ledger is per-worktree and uncommitted (`:11`, `:14`). | `references/delivery-ledger.md` |
| A PR body carrying another delivery's `agent-delivery-summary` marker makes `summary-body` refuse | `delivery-ledger.mjs:1488-1492` |
| No test asserts the ledger is mandatory; F15 shows `path` creates nothing | `tests/skills-portability.test.mjs:306-338`; `tests/delivery-ledger.test.mjs:3197-3207` |

## Current Behavior To Preserve

- Ledger mode: every helper command, invariant, gate, claim, lock and resume behaves as today.
- Gates in lightweight mode:
  - required independent review blocks when unavailable, and self-review is only supplementary;
  - a FAIL or BLOCKED audit is never reported as success;
  - pending findings block completion;
  - pushes and the PR are read back after writing.
- No helper or schema changes.

## Prerequisites

Current `main`, after `docs/tasks/2026-10-06-delivery-audit-and-review-defaults.md` has landed. That task writes the required-audit rule and the `null` delegate-limit default for ledger mode; this task adds their lightweight equivalents on top of its wording, so it does not start before it.

**Landing order for the four 2026-10-06 tasks:** delivery-audit-and-review-defaults, then this task, then agent-script-contract-and-delivery-hygiene (which edits `orchestration.md` and `SKILL.md:60` after this task's conditional wording is in), then delivery-ledger-ergonomics.

## Scope

### Trigger rule

Replace the unconditional sentence at `SKILL.md:24` with this precedence:

1. **The current prompt's explicit wording**, in either direction ("use the delivery ledger" / "no ledger").
2. **A user-level standing instruction** counts as user wording, below the current prompt. Examples: a line in `~/.claude/CLAUDE.md` or `~/.codex/AGENTS.md`.
3. **An unfinished ledger for this branch** means ledger mode. Detect it in two reads: `path` reports `data.exists`; when true, `show` supplies `phase` and `blocker`. Unfinished means `phase` is not `done` and there is no blocker whose `reason` starts with `abandoned:`. Unfinished covers owned, unowned and blocked ledgers. A `done` ledger, or one abandoned this way, is reported, and the user's choice is followed. A `done` ledger needs no abandonment write.
4. **A repository rule**: an `AGENTS.md` line, then `.agent/delivery-policy.json` `delivery_ledger: "required" | "optional"`, with `AGENTS.md` winning. `required` is a floor that only the **current prompt's** explicit wording overrides. A standing user-level "no ledger" instruction does not override it. A prompt override is recorded as a limitation.
5. **Pack default: lightweight.**

**Suggestion, not switching.** When the agent sees risk signals, it recommends the ledger in one line and never enables it without user wording. The signals are: multi-session work, a requested phase split, an expected handoff to another runtime, or concurrent sessions on one branch.

### Abandoning a ledger

When the user says "no ledger" while an unfinished ledger exists:

1. Obtain the claim:
   - Use the existing owner claim if this session holds it.
   - If another session owns the ledger, get a takeover grant, which needs the user's word that the other session has stopped.
   - If the ledger is unowned and healthy, use a normal claim.
   - If it is unowned and has drifted (for example, another session pushed), use `claim --recovery`, which may release it only as handoff or blocked.
   - If it is already `blocked`, claim it in its recorded `blocker.resume_phase` (the helper refuses any other phase) and continue below; the new blocked release replaces the old blocker.
2. Append a limitation describing the abandonment.
3. `release --outcome blocked` with a full `Blocker` (`reason`, `resume_phase`, `resume_checkpoint`, `required_action`) and a matching `next`. The helper requires `resume_phase` to equal the owner's phase and `next` to name that same phase and checkpoint; `required_action` says "resume only on explicit user wording to use the ledger". `reason` begins `abandoned: revision <N>; <user wording>`; rule 3 matches this prefix. The shapes are `Blocker` and `Next` in `delivery-ledger.schema.json`; `delivery-examples.md` has no blocked-release example, so add one as part of the Conditional wording work.
4. Leave the file in place.
5. Remove or annotate its PR-body summary block through the normal body update.

The ledger-free session doesn't change the branch before this release.

### Lightweight path

State this once in `SKILL.md`, as owner rules.

**Record.** Use a plain `## Delivery summary` section in the PR body, with no `agent-delivery-*` markers, or the completion report when there is no PR. It contains:

- the endpoint, and authorization in the user's quoted wording;
- the spec-check verdict for feature-grade docs;
- validation: commands, results and the tested commit;
- the review bound: measured files and packages from `git diff --numstat -z --no-renames <merge-base of the verified target base> <candidate> --` for committed candidates, the same invocation as the helper's `measure` (`delivery-ledger.mjs:3189`), so a rename counts as two files in both modes and the size class cannot differ by mode; plus the effective delegate limit. Local-only work states "unmeasured";
- the independent review and its finding dispositions, recorded before publishing;
- the required-audit verdict for each required mode;
- the defect-shape sweep;
- the push and PR read-back;
- limitations.

**Owner rules:**

- Pending findings and FAIL/BLOCKED audits block completion.
- Revalidate when hooks change tested inputs.
- One reply per thread. Never repeat a reply after an uncertain read-back; inspect the remote instead.
- One owner per branch. A second session doesn't change the branch without the user's word that the first has stopped.

**Stated limitation.** Every lightweight delivery records, in its summary, the guarantees it doesn't enforce mechanically:

- lock and claim;
- prepared-event idempotency;
- source-change review invalidation;
- candidate-bound evidence checks;
- the non-waivable audit gate;
- the push-time sweep refusal;
- fresh-session resume.

**Session.** The delivery stays in one session; `SKILL.md:58` applies only in ledger mode. On interruption, give a continuation brief built from the PR summary and the Git state. Or recommend switching to ledger mode, which adopts the existing branch or PR at bootstrap (`delivery-ledger.md:67`).

### Conditional wording

Add "in ledger mode" or a lightweight equivalent at:

- `SKILL.md:26`, `:30`, `:36`, `:48`, `:52`, `:58`
- `delivery-ledger.md:3`
- `orchestration.md:35`, `:75-82`. Without a ledger, dispatch and fallback records go in the delivery summary.
- `review-policy.md:65-67` (lightweight bound, as above) and `:80`. Without a ledger, keep proposals in the delivery summary.
- `review-implementation/references/risk-classes.md:18-20`, the same rule.
- `address-review-findings/SKILL.md:39`
- `monitor-pr-review/SKILL.md:16`, `:50`
- `README.md:112`
- `audit-ui/SKILL.md:32`, `audit-api/SKILL.md:32-33` ("a delivery role brief", with no ledger dependency)

**Reviewed and kept unchanged** (they hold without a ledger or use "ledger" in another sense; the acceptance `rg` below excludes them):

- `agents/auditor.md:47`, `agents/reviewer.md:38`, `agents/scout.md:34`, `agents/watcher.md:32`: "never write the delivery ledger" is a prohibition that remains true when none exists.
- `publish-branch/SKILL.md:16`, `:19`: already conditional ("when the caller supplies a delivery ledger"; "the approved task/ledger").
- `monitor-pr-review/references/state-and-timing.md:3` and `test-audit/SKILL.md:87`, `:101`: a session or report "ledger", not the delivery ledger.
- `html-artifact/fixtures/repo-doc.md`: fixture text.

### Authorization table

Add `delivery_ledger: required | optional` to what a repository may set (`authorization.md:25`).

### Audit coordination

In lightweight mode, a required task-doc audit is an owner rule. No completion claim is made without a cited PASS for each required mode, recorded in the summary.

## Excluded

- Helper and schema changes, including the ergonomics work, which is the dependent task.
- An `off` repository value.
- Automatic enabling on risk signals.
- Adding the policy key to any repository.
- Dee's standing instruction itself (a follow-up).

## Pre-Implementation Verification

- Recheck the evidence lines on current `main`, especially where the two coordinated tasks edit the same text.
- Confirm the abandonment procedure runs for each unfinished state: an owned ledger in `delivery` and in `review_round`, an unowned healthy ledger, an unowned drifted ledger (via `claim --recovery`), and an already `blocked` ledger. Confirm `blocker.reason` accepts the `abandoned:` prefix.

## Likely Files To Touch

- `skills/task-doc-delivery-loop/SKILL.md`, `references/delivery-ledger.md`, `references/orchestration.md`, `references/review-policy.md`, `references/authorization.md`
- `skills/review-implementation/references/risk-classes.md`
- `skills/address-review-findings/SKILL.md`
- `skills/monitor-pr-review/SKILL.md`
- `skills/audit-ui/SKILL.md`, `skills/audit-api/SKILL.md`
- `README.md`
- `tests/skills-portability.test.mjs`

## Decisions Required Before Implementation

None. Settled with Dee: opt-in, default off. Implementation defaults:

- repository values are `required | optional`;
- lightweight deliveries stay in one session.

## Execution Rules

- State each rule once in `SKILL.md` and link to it from the other files.
- Run `node --test tests/*.test.mjs`.

## Deliverables

- The trigger rule and abandonment procedure.
- The lightweight path with its record, owner rules, stated limitation and interruption path.
- Conditional wording across the listed files.
- The authorization-table entry.

## Completion Verification

| Risk | Evidence | Owner |
| --- | --- | --- |
| A future edit brings back the unconditional trigger | Assertion on the trigger precedence and default sentence | `tests/skills-portability.test.mjs:306` (extend) |
| No-ledger requests create a ledger | Existing F15 | `tests/delivery-ledger.test.mjs:3197` (unchanged) |
| Leftover unconditional wording | `rg -n "ledger" skills/ README.md agents/`: every remaining hit is conditional, ledger-mode-only, or on the reviewed-and-kept list above | reviewer |
| The lightweight summary collides with ledger markers | Diff review: the plain heading carries no `agent-delivery-*` markers | reviewer |
| Pack regressions | `node --test tests/*.test.mjs` | owner |

**Runtime acceptance:** one small lightweight delivery. It creates no ledger file, and its PR body carries the `## Delivery summary` section, including the stated limitation.

**Test admission:** the trigger assertion guards the one durable regression: the default silently becoming mandatory again. Everything else is wording that review covers.

## Approval Gates

None beyond the delivery endpoint.

## Completion Criteria

- The scope is in place and the pack suite passes.
- The lightweight runtime acceptance passes.
- An independent review has no unresolved blocking findings.

## Follow-ups

- Dee's user-level standing instruction ("use the delivery ledger for task-doc deliveries") in `~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md`.
- `docs/tasks/2026-10-06-delivery-ledger-ergonomics.md`.
- Per-repository `delivery_ledger: required` where a team wants it.
