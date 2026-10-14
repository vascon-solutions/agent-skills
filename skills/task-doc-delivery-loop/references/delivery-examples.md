# Delivery Examples

The delivery owner runs these commands. The user's request can remain "deliver this task", "continue this delivery", or "address the current findings". Carry forward existing approval; generating input files does not require another approval question.

Use Node.js, Git and bash. These shell examples also use `jq` to fill `template` skeletons, never to hand-edit the ledger. Keep input files and logs in durable local storage outside the checkout. Use a new filename for each retained manifest. The [ledger reference](delivery-ledger.md) describes exceptional states and complete record shapes.

## Owned Writes

Shell variables and functions do not persist between agent tool calls, so the claim ID and the current revision live in files in the evidence directory. Save this block once as `$evidence/ledger.sh`, with `repo`, `helper`, `evidence`, `runtime` and `session` set to verified absolute paths, the runtime and the current session's stable label, and source it at the start of every tool call.

```sh
ledger() { node "$helper" "$@" --repo "$repo"; }

# Every owned write reads the claim and revision from files and saves the new
# revision. It retries once, only for stale_revision; any other failure, or a
# second stale revision, stops with the helper's exit status.
owned() {
  local input out status code attempt
  input=$(mktemp "$evidence/stdin.XXXXXX") || return 1
  case "$1" in append|update) cat > "$input" ;; esac
  for attempt in 1 2; do
    out=$(ledger "$@" --runtime "$runtime" --session "$session" \
      --claim-id "$(cat "$evidence/claim-id")" \
      --expected-revision "$(cat "$evidence/revision")" < "$input")
    status=$?
    if [ "$status" -eq 0 ]; then
      jq -er '.revision' <<<"$out" > "$evidence/revision" || status=1
      break
    fi
    code=$(jq -r '.code' <<<"$out" 2>/dev/null)
    if [ "$status" -ne 3 ] || [ "$code" != stale_revision ] || [ "$attempt" -eq 2 ]; then break; fi
    ledger show --field /revision </dev/null | jq -er '.data.value' > "$evidence/revision" || break
  done
  rm -f "$input"
  printf '%s\n' "$out"
  return "$status"
}
```

Stop on any non-zero exit from `ledger` or `owned`. Never run a guarded Git or GitHub write after a failed helper call, and never chain the two in a form that continues after a failure: `owned publication prepare --kind push > "$evidence/push.json" && git push origin "HEAD:refs/heads/$branch"` runs the push only when the prepared record was written.

## Complete A Local Delivery

This example assumes an explicitly requested local-only endpoint. The usual default remains a draft PR. Set `task_doc` and `base` as well; `evidence` is a new directory beneath an existing external directory.

```sh
. "$evidence/ledger.sh"
ledger prepare-init --endpoint local --brief 'Implement the approved task locally' \
  --no-remote --output-dir "$evidence" --same-session
```

Use `--remote NAME` when the delivery uses a configured remote. For a known GitHub Enterprise remote, add `--github-host HOST`; other hosts are not assumed to be GitHub. Add `--instruction PATH` for each applicable instruction file and `--skill-source PATH` for other loaded skills. The helper hashes those files and its own ledger sources.

Inspect the generated `authorization.json` and `bootstrap.json`. Fill any existing grants, decisions, dependencies, requested audit (including a task-doc runtime acceptance checkpoint) and supplied spec check. For a dirty checkout, classify every reported `dirty_paths` entry in the `dirty_scope` decision. Use quoted literal filenames, including extensions. For an existing remote branch or PR, record verified adoption before initializing. Do not accept generated null or empty defaults when the context says otherwise.

```sh
ledger init --runtime "$runtime" --session "$session" --task-doc "$task_doc" \
  --base "$base" --endpoint local \
  --authorization-file "$evidence/authorization.json" \
  --bootstrap-file "$evidence/bootstrap.json" || exit

ledger claim --runtime "$runtime" --session "$session" --phase delivery \
  --expected-revision 0 > "$evidence/claim.json" || exit
jq -er '.data.claim_id' "$evidence/claim.json" > "$evidence/claim-id"
jq -er '.revision' "$evidence/claim.json" > "$evidence/revision"
```

Implement the approved scope. Choose and run its required check, saving the real result and log. The command below is an example for a repository whose selected check is `node --test`.

```sh
if (cd "$repo" && node --test) > "$evidence/check.log" 2>&1; then
  check_exit=0
else
  check_exit=$?
fi

ledger content-manifest --output-file "$evidence/content.json" \
  > "$evidence/identity.json" || exit

ledger template validation </dev/null > "$evidence/validation-template.json" || exit
jq --slurpfile identity "$evidence/identity.json" \
  --arg cwd "$repo" --arg log "$evidence/check.log" --argjson code "$check_exit" '
  $identity[0].data as $i |
  .data.skeleton + {id:"local-gate", kind:"command", command:"node --test", cwd:$cwd,
   scope:"gate", content_id:$i.content_id, content_manifest:$i.manifest,
   result:(if $code == 0 then "pass" else "fail" end), exit_code:$code,
   at:(now|todateiso8601), log:$log, input_fingerprint:$i.input_fingerprint}' \
  "$evidence/validation-template.json" | owned append validation || exit
```

`template FIELD` prints every required field, with nullable fields already null, and the cross-field rules in `data.rules`; a placeholder left in angle brackets fails the write.

Ensure no tested input changed during the check. Supply relevant external input identities with `--inputs-file`. Use repeated `--exclude-path PATH` only for unrelated changes already explained in a scope decision. A failure needs investigation and a fresh record after remediation; do not turn it into a pass by editing its JSON.

Local-only work records its provisional size and cycle allowance in source decisions, with an unmeasured limitation. Do not create a commit to use the frozen-candidate bound helper. Apply the same [review policy](review-policy.md) inline.

Perform the implementation review against the task and this content. The following record is appropriate only after an actual passing review with no findings. Otherwise record the real verdict and findings using the schema's `Review` shape. Requested audits likewise need their actual result.

```sh
ledger template reviews </dev/null |
  jq --slurpfile identity "$evidence/identity.json" --arg runtime "$runtime" '
  $identity[0].data as $i |
  .data.skeleton + {id:"local-review", mode:"implementation",
   content_id:$i.content_id, content_manifest:$i.manifest,
   runtime:$runtime, source:"inline", verdict:"pass", at:(now|todateiso8601)}' |
  owned append reviews || exit

jq -n --slurpfile identity "$evidence/identity.json" '
  $identity[0].data as $i |
  {next:null, blocker:null, completion:{endpoint:"local", reached_at:(now|todateiso8601),
   candidate_oid:null, content_id:$i.content_id, content_manifest:$i.manifest,
   evidence_ids:["validation:local-gate","reviews:local-review"], limitations:[]}}' \
  > "$evidence/release.json"
owned release --outcome complete --release-file "$evidence/release.json" || exit
```

Completion checks the current content again. No commit is needed for this endpoint. Include actual audit evidence and limitations when applicable. If the work cannot complete, use `handoff` or `blocked` with the real remaining step.

For a commit or PR endpoint, use the same preparation with the authorized endpoint and remote. Commit the intended scope with hooks, then `freeze` with commit evidence. Before the first implementation assessment, finalize the bound using the [review policy](review-policy.md): `freeze --review-bound "$evidence/bound.json"` freezes, measures and installs it in one write from the attested fields (`template review-bound-partial`), and `--review-bound reuse` does the same for a replacement candidate whose attested fields have not changed. Record the assessment cycle and any delegated dispatch. Reuse applicable earlier review and audit records when their retained manifests match the commit; local verification of remediation adds no cycle. Record the committed validation gate or an explicit reuse of the precommit gate. Pass the ledger and current claim to [publication](../../publish-branch/references/ledger-handoff.md), which records each write with `publication prepare` before it and `publication verify` after its read-back. Cite the verified publication events and applicable review at completion. A missing remote does not silently turn a PR request into local-only completion.

## Record A Support Dispatch

Use this only after [orchestration](orchestration.md) selects a role. Direct work needs no role run. The example records a delegated implementation review after `freeze` and `set-review-bound`; `run.json` is the brief's identity plus the resolved settings, and `enforcement` comes from the [role dispatch defaults](role-dispatch.md).

```sh
ledger template role_runs </dev/null |
  jq --arg oid "$oid" --arg session "$session" --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --slurpfile enforcement "$evidence/reviewer-enforcement.json" '
  .data.skeleton + {id:"review-1-run", role:"reviewer", mode:"implementation", phase:"delivery",
   candidate_oid:$oid, execution:"delegated", runtime:"claude", runtime_version:"2.1.285",
   client:"claude-code", session_label:$session, requested_tier:"deep",
   enforcement:$enforcement[0], status:"running", started_at:$at}' \
  > "$evidence/review-1-run.json" || exit
owned append role_runs < "$evidence/review-1-run.json" || exit
```

The helper refuses the dispatch record when the bound has no cycle left; outstanding delegated runs reserve their cycles. After the role returns and its envelope checks out, append a successor with `supersedes_id: "review-1-run"`, the observed settings, `status`, `ended_at` and a `result_summary`, then the `reviews` record with `source: "delegated"` and the cycle it consumed. A role that is missing or returns a malformed result gets the successor with its real status, and any permitted inline replacement gets its own `execution: "inline"` run with the actual `fallback_reason`. When no child ran, keep that successor's `result_summary` empty and `result_report` null: the helper counts any failed dispatch that carries a result toward the delegate limit.

## Resume An Interrupted Delivery

Resolve `ledger_path` from the prior continuation brief. A different session uses its own runtime and stable session label.

```sh
node "$helper" show --ledger "$ledger_path" > "$evidence/resume.json"
node "$helper" validate --ledger "$ledger_path"
stage=$(jq -er '.data.value.candidate.state' "$evidence/resume.json")
node "$helper" check --ledger "$ledger_path" --stage "$stage"
```

Read the current scoped instructions and `next.inputs`. If another owner is still recorded, report the conflict; do not invent a takeover grant. For an unowned, unfinished phase, use the phase from `next` and the revision from the snapshot.

```sh
phase=$(jq -er '.data.value.next.phase' "$evidence/resume.json")
revision=$(jq -er '.revision' "$evidence/resume.json")
node "$helper" claim --ledger "$ledger_path" --runtime codex --session "$session" \
  --phase "$phase" --expected-revision "$revision" > "$evidence/resumed-claim.json"
```

Continue from `data.consumed_next`, using the returned claim ID and fresh revisions for subsequent writes. A completed delivery needs a new authorized phase; a drift refusal needs the documented recovery path. Do not rerun unchanged checks merely because the runtime or session changed. Retain the existing claim during nested skill calls, and release only at the owner's actual boundary.

## Address One Findings Batch

Validate and check the supplied ledger. When continuing an owner's active phase, use its claim. When starting a new review round, serialize the user's actual request as one `Grant` with `scope: review_round`, `endpoint: null` and `additional_cycles: null`. Claim `review_round` with `--grant-file` so grant and ownership commit together.

1. Fetch a complete, paginated PR snapshot. Save its frozen `Review.batch` file with `pr: {repository, number}` identifying the recorded PR and paired thread/root-comment IDs. Set the review's `candidate_oid` and batch `head` to the recorded PR head. A new round needs a new batch recorded under that round; handoffs within an unfinished round keep the existing batch. GitHub's numeric database IDs are accepted in the snapshot; use strings in publication targets. An incomplete read cannot establish an empty batch.
2. Classify and disposition each finding. Use `begin-change` before fixes; record a replacement review observation with `supersedes_id` to preserve finding identity and history. Failed or pending findings block completion even if left out of `evidence_ids`.
3. Validate affected inputs, commit only when the authorized endpoint calls for it, and freeze the replacement candidate. A reply-only round needs no empty commit or repeated implementation review.
4. Prepare each reply against its own thread/root pair, post it, read it back, and record verification. `publication prepare --kind reply --batch "$evidence/replies.json"` prepares every reply in one write from `[{thread, body_file}]`; after posting and reading each back, `publication verify --batch "$evidence/read-backs.json"` records each item's own outcome from `[{id, observed_file}]`. Resolve eligible findings only after verified fixes and replies, in a later batch (`--kind resolve`). If resolution fails, retry only resolution. Use the existing [publication contract](delivery-ledger.md#publication) for event shapes and [GitHub transport](../../publish-branch/references/github-transport.md) for writes.
5. Cite the complete batch, applicable validation and verified publication events; take the final read-only snapshot and release. New findings belong to a later request unless monitoring was already authorized.

## Abandon A Ledger

Use this only when the user says "no ledger" while this branch has an unfinished ledger, under a claim obtained as the [ledger reference](delivery-ledger.md#abandoning-a-ledger) describes. `wording` holds the user's quoted words.

```sh
snapshot=$(ledger show </dev/null)
revision=$(jq -er '.revision' <<<"$snapshot")
phase=$(jq -er '.data.value.owner.phase' <<<"$snapshot")
checkpoint=$(jq -er '.data.value.checkpoint' <<<"$snapshot")

ledger template limitations </dev/null |
  jq --arg phase "$phase" --arg wording "$wording" '
  .data.skeleton + {id:"ledger-abandoned", kind:"ledger_abandoned", phase:$phase,
   reason:("abandoned on user wording: " + $wording), affects:["delivery ledger"],
   at:(now|todateiso8601)}' | owned append limitations || exit

jq -n --arg phase "$phase" --arg checkpoint "$checkpoint" --arg wording "$wording" \
  --argjson revision "$revision" '
  {completion:null,
   blocker:{reason:("abandoned: revision \($revision); " + $wording),
            resume_phase:$phase, resume_checkpoint:$checkpoint,
            required_action:"resume only on explicit user wording to use the ledger"},
   next:{phase:$phase, checkpoint:$checkpoint, suggested_runtime:null,
         brief:"Abandoned ledger; resume only on explicit user wording to use the ledger",
         inputs:[], authorization_required:true}}' > "$evidence/abandon.json"
owned release --outcome blocked --release-file "$evidence/abandon.json" || exit
```

`revision` is the ledger revision the user's wording abandoned. Leave the file in place, then remove or annotate its summary block in the PR body.

## Live Handoff Acceptance

Unit tests with runtime labels do not prove that another coding runtime can follow this workflow. Before claiming live handoff acceptance, run the two planned pilots: a real Claude-to-Codex findings batch and a disposable Codex-to-Claude resume with owner-conflict and drift refusals. Keep runtime versions, session identities, redacted ledger copies and results outside the repository. Record extra helper calls, elapsed time and user interventions. The pilots remain pending until those real runs exist; do not launch another runtime or create a task solely to clear this checklist without the required authorization.
