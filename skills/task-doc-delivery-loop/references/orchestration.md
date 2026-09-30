# Orchestration

This is how a task-doc delivery owner, or an explicitly authorized monitoring owner, decides whether a checkpoint needs a support role. It applies to delivery checkpoints, their review rounds and authorized watching only. It adds no everyday routing, hooks or second workflow.

The four support roles are `auditor`, `reviewer`, `scout` and `watcher`. Their modes, owning skills, default tiers and extra brief fields are in the generated [role dispatch defaults](role-dispatch.md). `bin/link-agents.sh` in the skill pack installs them for Claude Code and Codex. Four installed roles do not imply four dispatches.

## Choose How To Satisfy A Checkpoint

A task doc, checkpoint transition or installed role does not by itself justify a dispatch. Apply this order within existing authorization:

1. **Reuse applicable evidence.** Check scope, candidate identity, source freshness and coverage as [validation](validation.md) describes. When existing evidence satisfies the requirement, consume it without repeating the job.
2. **Satisfy required independence.** When current evidence does not satisfy a required independent assessment, reuse a valid independent assessment or commission a bounded `reviewer`. Honor repository limits and existing grants. If no approved independent reviewer is available, the gate is blocked; self-review is only ever supplementary.
3. **Delegate optional support for a concrete benefit.** Useful independent judgment, substantial audit or investigation material to isolate, or a separately answerable question that can progress safely alongside other work. The role must return a bounded, useful result.
4. **Otherwise work directly.** Keep small reads, tightly dependent investigation and ordinary validation commands. Count briefing, startup, waiting and reconciliation when judging the benefit. Do not invent a savings estimate or fill a scoring form.

A required check does not automatically require a separate agent. Explicit user instructions and repository delegation rules still apply. Optional support never adds an approval stage or becomes a completion gate because a role exists.

| Work at a checkpoint | Execution choice |
| --- | --- |
| Short code trace, ordinary implementation, small status read | Owner, directly. |
| Required independent implementation review | Reuse a valid independent assessment, or dispatch `reviewer` in `implementation` mode. |
| Required or requested audit with substantial browser or API observations | Prefer `auditor` to isolate the evidence. Keep environment, identity, cleanup and fallback rules. |
| Substantial investigation with separately answerable questions | `scout`, selectively, with distinct questions and source boundaries. |
| Ordinary validation commands | Owner runs and records them. A command alone never justifies a role. |
| Authorized PR or CI observation | Read small results directly; use `watcher` when reducing or interpreting the material warrants it. Watching authorizes no remediation. |

Limits: one implementation owner; at most two independent read-only support jobs at once, fewer when the runtime or repository says so; no recursive delegation. Serialize audits that share an application, persona or fixture set, including across repositories that point at the same stack. Keep inputs stable while support work runs, or identify and recheck the conclusions a change affects.

## Brief

Send one brief per dispatch:

`{run_id, role, mode, goal, candidate: {branch, oid, content_id, content_manifest}, source_paths, questions_or_scenarios, writable_paths, forbidden_actions, stop_condition, timeout_seconds, requested_tier, requested_model, requested_effort, allow_escalation}`

- `candidate` names the frozen commit, or for local-only work the content identity and manifest described in the [ledger reference](delivery-ledger.md#evidence).
- A UI, API or accessibility brief also carries the proven candidate URL, the environment, actors with a secure credential source (never the credential), fixtures, allowed application mutations, startup commands if needed, cleanup requirements and the coverage level. Prove which URL serves the candidate before dispatch.
- Add the mode's extra fields from [role dispatch defaults](role-dispatch.md). Give facts the role would otherwise rediscover.
- The purpose of a delegated job lives in `goal`; no separate decision artifact is needed.

## Dispatch

Before dispatch, confirm the running client exposes the role and the tools the mode needs. Never infer a capability from a client's name or version. Resolve settings first, then dispatch.

**Model and effort.** Resolve model and effort independently: an explicit prompt setting, then the repository (`AGENTS.md`, then `.agent/delivery-policy.json` `role_overrides`; `AGENTS.md` wins a conflict, which you record), then the defaults, using the mode's coverage tier where one is listed. Record where each setting came from. An explicit model never authorizes a different model; an unavailable requested setting is a capability failure, not a reason to substitute.

- **Claude Code.** Call the Agent tool with `subagent_type` set to the role. The installed role carries its tier's default model, so pass `model` only for a resolved override or an escalation. The Agent tool has no effort parameter. An explicit effort override needs a session-local definition supplied when the owner session starts (the skill pack's `bin/link-agents.sh --claude-session-definition ROLE --effort LEVEL` prints the JSON for `claude --agents`); without one, report the effort override unavailable. Never edit installed role files during a delivery. Agents may run in the background; wait for the completion notification.
- **Codex.** Call `spawn_agent` with `agent_type` set to the role, `fork_context: false`, and the resolved `model` and `reasoning_effort` every time. Role files pin neither, so omitting them makes the child inherit the owner's own settings. A model or effort the client rejects is `model_unavailable`. Collect the result with `wait_agent` and close the child with `close_agent`.

**Observed settings.** Record only what the runtime exposes. Claude Code: the model on the child's messages when the transcript shows it. Codex: `model` and `effort` in the child thread's `turn_context` in its session rollout under the Codex home. Otherwise record `null`; never copy the requested value into an observed field.

**Timeouts.** Defaults are 300 seconds for `reviewer`, `scout` and `watcher`, and 900 seconds for a requested audit; record a larger task-bound limit before dispatch. Check progress at least every 60 seconds with the runtime's waiting facilities. On timeout, stop the child (Claude Code: stop its task; Codex: `close_agent`) and confirm it ended before any inline work touches the same resources. If you cannot confirm termination, stop conflicting work and report the live handle.

**Escalation.** Escalate at most once, and only when the brief allows it, the first result is `block_reason: judgment` with a concrete unresolved question, and a higher tier exists (`deep` has none). Missing facts, access, tools, time or a genuine product failure never justify escalation. Keep both runs; the second names the first in `parent_run_id`. A failed escalation returns to you without another automatic rerun.

## Result Envelope

Each role replies with exactly one fenced JSON object:

`{run_id, status: complete|blocked|partial|error, verdict_or_answer, findings, unverified, artifacts, cleanup: {state: complete|not_needed|failed, detail}, heavy_commands, block_reason: null|missing_input|missing_capability|permission|model_unavailable|judgment|timeout|runtime_error}`

Each `heavy_commands` entry names the command category, working directory, result and an existing evidence path. A `watcher` puts `{head, state, observed_at, new_event_ids, changed_checks, changed_threads, removed_or_unreadable_items, errors}` in `verdict_or_answer`; an empty delta means a successful complete read, while an access or pagination failure is an error.

Consume the result:

- A reply without exactly one fenced, parseable envelope with valid values is malformed: treat it as `error` with `runtime_error` and accept nothing from it. Prose outside a single valid envelope is not evidence; ignore it and note the formatting deviation.
- Check the returned run ID, scope, candidate identity, coverage and limitations. Verify material findings against sources before fixing; resolve disagreements without repeating the whole job.
- `partial` coverage is usable only for what it covered; everything in `unverified` stays a gap.
- An audit `FAIL` is a product result and stays failing until fixed and rechecked. A role error never clears it and is never accepted as merely a role failure.
- Delivery-review roles run no heavy commands. A listed one is reported, with its evidence, as a boundary breach.
- Merge duplicate findings by source ID and behavior or location, keeping evidence and disagreements.
- Recheck only invalidated evidence and unresolved findings, with broader checks where existing policy requires them.

## Record What Happened

Use the ledger's existing records; selection needs no new schema.

- **Delegated work.** Append a `role_runs` record before dispatch (`execution: delegated`, `status: running`) with the brief's requested tier, model and effort, and update it through a successor with the observed settings, status, block reason, `result_summary` and any saved report. Take `enforcement` from the [role dispatch defaults](role-dispatch.md) for that role and runtime. Save a report yourself when one is needed; roles do not write reports except an auditor's workspace.
- **Delegated implementation review.** Dispatch only against the frozen candidate after `set-review-bound`. The helper reserves a cycle for the dispatch until a `delegated` review with that cycle records its result; a completed child does not release the reservation. Record the review with `source: delegated` and its `cycle_id`.
- **Direct work.** Use ordinary validation, audit and review records: an owner review is `source: inline`, commands are validation records. Add a material direct-execution choice to the checkpoint summary only when it explains coverage or a limitation. Direct work has no `role_runs` record and is never labelled `role_unavailable`.
- **Another approved independent agent.** A client discovers roles when its session starts, so a session that began before installation cannot select them. When you use another approved independent agent instead, record `execution: delegated`, `fallback_reason: role_unavailable` and that agent's own observed enforcement, not the role default.
- **Actual fallback.** When a role you chose to use is absent or unusable, do the same bounded work inline when permitted and record `role_runs` with `execution: inline` and the real `fallback_reason`, such as `role_unavailable`, `model_unavailable`, `timeout` or `malformed_result`. Browser or API capability, a safe environment, authentication or the candidate URL cannot be invented by falling back; record the audit `BLOCKED` with the unverified scenarios.
- **Independence unavailable.** Record `role_runs` with `execution: inline`, `status: blocked`, `block_reason: missing_capability` and `fallback_reason: independence_required`. Completion stays refused until an independent review of the final candidate is cited.

## Watching

An authorized monitoring owner applies the same order to each observation. Read small results directly with the monitoring skill's helper. Dispatch `watcher` for one bounded read when interpreting or reducing the material warrants it, passing the previous snapshot, the PR identity and the helper path. The owner keeps seen and pending IDs, timing, scheduling, ledger writes, fixes and every GitHub mutation. A watcher run is one read, not a polling loop, and never creates monitoring or remediation authority.
