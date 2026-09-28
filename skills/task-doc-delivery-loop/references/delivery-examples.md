# Delivery Examples

The delivery owner runs these commands. The user's request can remain "deliver this task", "continue this delivery", or "address the current findings". Carry forward existing approval; generating input files does not require another approval question.

Use Node.js and Git. These shell examples also use `jq` to serialize records, never to hand-edit the ledger. Keep input files and logs in durable local storage outside the checkout. Use a new filename for each retained manifest. The [ledger reference](delivery-ledger.md) describes exceptional states and complete record shapes.

## Complete A Local Delivery

This example assumes an explicitly requested local-only endpoint. The usual default remains a draft PR. Set `repo`, `helper`, `task_doc`, `base`, `evidence` and `session` to verified absolute paths and the current session's stable label. `evidence` is a new directory beneath an existing external directory.

```sh
ledger() { node "$helper" "$@" --repo "$repo"; }

ledger prepare-init --endpoint local --brief 'Implement the approved task locally' \
  --no-remote --output-dir "$evidence" --same-session
```

Use `--remote NAME` when the delivery uses a configured remote. For a known GitHub Enterprise remote, add `--github-host HOST`; other hosts are not assumed to be GitHub. Add `--instruction PATH` for each applicable instruction file and `--skill-source PATH` for other loaded skills. The helper hashes those files and its own ledger sources.

Inspect the generated `authorization.json` and `bootstrap.json`. Fill any existing grants, decisions, dependencies, requested audit and supplied spec check. For a dirty checkout, classify every reported `dirty_paths` entry in the `dirty_scope` decision. Use quoted literal filenames, including extensions. For an existing remote branch or PR, record verified adoption before initializing. Do not accept generated null or empty defaults when the context says otherwise.

```sh
ledger init --runtime codex --session "$session" --task-doc "$task_doc" \
  --base "$base" --endpoint local \
  --authorization-file "$evidence/authorization.json" \
  --bootstrap-file "$evidence/bootstrap.json"

ledger claim --runtime codex --session "$session" --phase delivery \
  --expected-revision 0 > "$evidence/claim.json"
claim_id=$(jq -er '.data.claim_id' "$evidence/claim.json")

owned() {
  revision=$(ledger show --field /revision </dev/null | jq -er '.data.value') || return
  ledger "$@" --runtime codex --session "$session" \
    --claim-id "$claim_id" --expected-revision "$revision"
}
```

Implement the approved scope. Choose and run its required check, saving the real result and log. The command below is an example for a repository whose selected check is `node --test`.

```sh
if (cd "$repo" && node --test) > "$evidence/check.log" 2>&1; then
  check_exit=0
else
  check_exit=$?
fi

ledger content-manifest --output-file "$evidence/content.json" \
  > "$evidence/identity.json"

jq -n --slurpfile identity "$evidence/identity.json" \
  --arg cwd "$repo" --arg log "$evidence/check.log" --argjson code "$check_exit" '
  $identity[0].data as $i |
  {id:"local-gate", kind:"command", command:"node --test", cwd:$cwd,
   scope:"gate", oid:null, content_id:$i.content_id, content_manifest:$i.manifest,
   result:(if $code == 0 then "pass" else "fail" end), exit_code:$code,
   at:(now|todateiso8601), log:$log, receipt:null, reason:null,
   reused_from:null, input_fingerprint:$i.input_fingerprint, reuse:null}' \
  | owned append validation
```

Ensure no tested input changed during the check. Supply relevant external input identities with `--inputs-file`. Use repeated `--exclude-path PATH` only for unrelated changes already explained in a scope decision. A failure needs investigation and a fresh record after remediation; do not turn it into a pass by editing its JSON.

Perform the implementation review against the task and this content. The following record is appropriate only after an actual passing review with no findings. Otherwise record the real verdict and findings using the schema's `Review` shape. Requested audits likewise need their actual result.

```sh
jq -n --slurpfile identity "$evidence/identity.json" '
  $identity[0].data as $i |
  {id:"local-review", round:null, mode:"implementation", candidate_oid:null,
   content_id:$i.content_id, content_manifest:$i.manifest, source_hashes:[],
   runtime:"codex", model:null, source:"inline", verdict:"pass", report:null,
   findings:[], batch:null, cycle_id:null, cycle_kind:null, at:(now|todateiso8601)}' \
  | owned append reviews

jq -n --slurpfile identity "$evidence/identity.json" '
  $identity[0].data as $i |
  {next:null, blocker:null, completion:{endpoint:"local", reached_at:(now|todateiso8601),
   candidate_oid:null, content_id:$i.content_id, content_manifest:$i.manifest,
   evidence_ids:["validation:local-gate","reviews:local-review"], limitations:[]}}' \
  > "$evidence/release.json"
owned release --outcome complete --release-file "$evidence/release.json"
```

Completion checks the current content again. No commit is needed for this endpoint. Include actual audit evidence and limitations when applicable. If the work cannot complete, use `handoff` or `blocked` with the real remaining step.

For a commit or PR endpoint, use the same preparation with the authorized endpoint and remote. Commit the intended scope with hooks, then `freeze` with commit evidence. Reuse the original review and audit records when their retained manifests match the commit. Record the committed validation gate or an explicit reuse of the precommit gate. Pass the ledger and current claim to [publication](../../publish-branch/references/ledger-handoff.md). Cite the verified publication events and applicable review at completion. A missing remote does not silently turn a PR request into local-only completion.

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

1. Fetch a complete, paginated PR snapshot. Save its frozen `Review.batch` file with paired thread and root-comment IDs. GitHub's numeric database IDs are accepted in the snapshot; use strings in publication targets. An incomplete read cannot establish an empty batch.
2. Classify and disposition each finding. Use `begin-change` before fixes; record a replacement review observation with `supersedes_id` to preserve finding identity and history. Failed or pending findings block completion even if left out of `evidence_ids`.
3. Validate affected inputs, commit only when the authorized endpoint calls for it, and freeze the replacement candidate. A reply-only round needs no empty commit or repeated implementation review.
4. Prepare each reply against its own thread/root pair, post it, read it back, and record verification. Resolve eligible findings only after verified fixes and replies. If resolution fails, retry only resolution. Use the existing [publication contract](delivery-ledger.md#publication) for event shapes and [GitHub transport](../../publish-branch/references/github-transport.md) for writes.
5. Cite the complete batch, applicable validation and verified publication events; take the final read-only snapshot and release. New findings belong to a later request unless monitoring was already authorized.

## Live Handoff Acceptance

Unit tests with runtime labels do not prove that another coding runtime can follow this workflow. Before claiming live handoff acceptance, run the two planned pilots: a real Claude-to-Codex findings batch and a disposable Codex-to-Claude resume with owner-conflict and drift refusals. Keep runtime versions, session identities, redacted ledger copies and results outside the repository. Record extra helper calls, elapsed time and user interventions. The pilots remain pending until those real runs exist; do not launch another runtime or create a task solely to clear this checklist without the required authorization.
