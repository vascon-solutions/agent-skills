# Delivery Ledger

One machine-readable record per delivery branch, so any phase can resume in a fresh Claude Code or Codex session. The phase owner writes it only through [`scripts/delivery-ledger.mjs`](../scripts/delivery-ledger.mjs); roles and reviewers never write it. Structure is [`delivery-ledger.schema.json`](delivery-ledger.schema.json), which the helper loads and enforces; this page states the behavior the schema cannot. Authority rules live in [authorization](authorization.md).

The ledger records decisions, identities and evidence paths. It never replaces reading the code, the current repository instructions, or remote state.

Start with the [worked examples](delivery-examples.md) for ordinary delivery, resuming, and one findings batch. This page is the command and state reference.

## Location

- `<worktree>/.agent/deliveries/<SHA256(branch)>.json`, never committed. `path` prints it. Hashing is the only filename encoding: `feat/a` and `feat__a` must not collide.
- `init` keeps the ledger out of commits with the anchored rule `/.agent/deliveries/`, appended to `info/exclude` in the common Git directory with the existing bytes preserved. It writes nothing when an effective rule already ignores the actual ledger path, whether from `info/exclude`, a `.gitignore`, or the configured global excludes file. It never edits `.gitignore`. A tracked ledger path, an overriding negation, or an unwritable `info/exclude` that needs the rule fails before any ledger exists. A rule left by a failed `init` is harmless and reused.
- Mutations require the delivery branch checked out in exactly one worktree. Detached HEAD, a mismatched `--branch`, a branch checked out twice, and symlinked `.agent`, `.agent/deliveries`, ledger or lock paths are refused.
- Resume means another runtime on the same registered worktree. Another clone, a deleted worktree or another host is not resumable from the ledger; the PR body's summary block supports manual reconstruction only.

## Invocation

```sh
node <skill-dir>/scripts/delivery-ledger.mjs <command> (--repo DIR [--branch NAME] | --ledger ABS_PATH) [flags]
```

- Every mutation after `init` takes `--runtime claude|codex|gemini --session LABEL --claim-id ID --expected-revision N` (`claim` takes no claim ID unless it is a same-owner reclaim). The session label is any stable identifier the session reuses for all its writes; it is coordination, not authentication.
- Flags ending in `-file` take absolute paths, never inline JSON. Input files hold one JSON value, except the Markdown files used by `summary-body`. `--output-file` creates a new manifest. Only `update` and `append FIELD` read stdin; every other command refuses stdin input. Parsing is strict: unknown or duplicate flags, missing values, extra positionals and invalid enums are argument errors.
- Output is exactly one JSON line. Success: `{ok:true, command, changed, revision, data}`. Failure: `{ok:false, command, code, message, path, id, expected, observed}`, with no `data`. Diagnostics go to stderr.

| Exit | Codes | Meaning |
| --- | --- | --- |
| 0 | none | success, including an exact no-op (`changed: false`) |
| 1 | `argument_error`, `environment_error`, `io_error`, `network_error` | bad invocation, missing tool or file, unreadable remote or GitHub; `check` uses this for **unverified** |
| 2 | `json_error`, `schema_error`, `invariant_error` | malformed input or ledger, or a refused transition |
| 3 | `mutex_held`, `owner_conflict`, `stale_revision`, `claim_mismatch`, `recovery_guard_held` | another writer, another owner, or a stale read: re-read, then decide |
| 4 | `identity_mismatch` | confirmed Git, GitHub, source or dependency drift |

## Commands

| Command | Does |
| --- | --- |
| `path` | Resolve the ledger path; `data.exists` says whether it exists. Creates nothing. |
| `prepare-init --repo DIR --endpoint E --brief TEXT --output-dir DIR (--remote NAME \| --no-remote) [--github-host HOST] [--instruction PATH…] [--skill-source PATH…] [--same-session]` | Generate `authorization.json` and `bootstrap.json` in a new external directory. Hash supplied instructions and loaded ledger skill files; report dirty paths. Recognize github.com automatically; identify a known Enterprise host explicitly. Does not initialize, claim, inspect remote state or invent grants. Fill applicable decisions, dependencies, spec check, audit policy and verified PR adoption before `init`. |
| `init --runtime R --session S [--model M] --task-doc PATH… [--spec PATH…] --base REF --endpoint E --authorization-file F --bootstrap-file F` | Create revision 0, unowned, with the bootstrap `next`. Refuses any existing ledger, even an identical one; continue it with `show` and `claim`. |
| `show [--field /json/pointer]` | Read the validated ledger or one field. `~1` is `/`, `~0` is `~`; a missing field is an argument error, an existing `null` is a value. |
| `validate` | Structural and local invariant validation; no network. |
| `check --stage working\|frozen\|published [--pr]` | Read-only identity check (below). Never fetches or repairs refs. |
| `claim --phase delivery\|review_round\|watch [--grant-file F] [--force --reason TEXT] [--recovery]` | Take ownership; returns `claim_id` and the consumed `next`. |
| `update` (stdin) | Owner patch of `checkpoint` and `audit_policy` only. |
| `source-add --kind task_doc\|spec\|instruction --path P --reason TEXT` | Append a source's current hash; new sources invalidate current reviews, and changed sources invalidate reviews that used the old hash. |
| `append FIELD` (stdin) | Append one item to `validation`, `audits`, `reviews`, `defect_shapes`, `publications`, `role_runs`, `sessions`, `limitations` or `decisions`. Same ID and content is a no-op; same ID with other content fails. |
| `authorize --grant-file F` | Record one quoted user grant and apply only its declared effect. |
| `record-context --context-file F --reason TEXT` | Replace `sources.spec_check`, `policy`, `candidate.dependencies` or `pr` after verification. Nothing else. |
| `begin-change` | Return to `implement`; a frozen candidate becomes working at its OID. |
| `freeze --oid OID --evidence-file F` | Adopt the owner's commit as the frozen candidate. |
| `reconcile --evidence-file F` | One enumerated recovery case. |
| `content-manifest (--manifest-file F \| --output-file F [--exclude-path PATH…] [--inputs-file F])` | Verify an existing manifest, or generate one from all baseline-to-working changes, including committed, staged, unstaged and untracked paths. Compute modes, hashes and identities. Generation needs a new external file; exclusions need a recorded scope decision. `--inputs-file` supplies the array of relevant dependency, policy, tool and environment identities. |
| `measure` | Diff size of the frozen candidate against the recorded `diff_base_oid`. |
| `release --outcome complete\|handoff\|blocked --release-file F` | Clear ownership and set `phase`, `next`, `blocker`, `completion`. |
| `recover-lock --kind branch\|exclude (--operation-id ID \| --expected-lock-sha256 HASH) --reason TEXT` | Remove one confirmed-stale lock. Not a ledger mutation. |
| `summary-body --current-body-file F --summary-file F [--expected-current-sha256 H]` | Read-only, frozen candidate: return the PR body with this delivery's summary block appended or replaced. |
| `set-review-bound` | Refused in R1; `review_bound` stays `null` until R3. |

No command stages, commits, pushes, installs, starts a runtime, or writes to GitHub. `check` is the only command that reads the network: `git ls-remote` for the destination ref and `gh api --method GET` for the PR.

The two generators create input files only at explicit absolute destinations outside the worktree and common Git directory. They refuse existing destinations, including symlink aliases into those protected directories. Generated files are private (`0600`); the setup directory is `0700`. Keep evidence and input files in durable local storage for as long as the delivery can resume. Defaults describe a new delivery with no grants, dependencies, audit or prior PR; the owner must replace any default that conflicts with known context.

## Input Files

- **Authorization** (`init`). The whole `authorization` object; its `endpoint` must equal `--endpoint`. Carry forward authority the user already gave instead of asking again.
- **Bootstrap** (`init`). `{brief, instructions, decisions, spec_check, policy, dependencies, remote_name, github, pr, remote_baseline, audit_policy}`, exactly. The helper verifies every `Source` hash, the dependency checkouts and outputs, the remote URL against `github`, and an adopted PR or remote ref against `HEAD`. A dirty checkout needs a decision with ID `dirty_scope` whose text names every changed path as included or excluded. With no pre-delivery spec check, record `spec_check.verdict` `not_run` or `skipped` with a reason; neither is acceptance. When the authorized endpoint needs a remote or GitHub that is missing, `init` records a `publication_unavailable` limitation and keeps the authorized endpoint.
- **Grant** (`claim`, `authorize`). Exactly one `Grant`, `{id, scope, endpoint, wording, source, at, additional_cycles}` with the user's quoted wording. `endpoint` is set only for `scope: endpoint`; `additional_cycles` stays `null` in R1.
- **Commit evidence** (`freeze`). `{prior_head, reason, source, intended_paths, excluded_paths}` with literal relative Git paths.
- **Release**. `{next, completion, blocker}`, exactly.
- **Reconcile**. `{case, reason, source, grant_id, expected: {candidate_oid, working_head_oid}, observed, evidence_paths}`; `observed` depends on the case (below).

R1 supports PRs whose base and head use the configured repository remote. It cannot record a separate authorized fork remote. `init`, `record-context` and remote-adoption recovery refuse fork PR adoption; existing fork records fail validation.

## Locks, Revisions And Ownership

- Every mutation takes a short exclusive-create lock at `<common-git-dir>/agent-delivery-locks/<branch-key>.lock` (and `exclude.lock` while writing `info/exclude`), holding PID, host, time, worktree and a random operation ID. A held lock fails at once with exit 3 and the holder's identity. Locks never expire and are never stolen by age.
- The lock protects cooperating helper users on one host. Another clone, another host, a non-cooperating process or a manual JSON edit is outside it. The helper detects the damage it can see, such as a broken revision history (exit 2), but cannot prevent it.
- `revision` increases by one with each byte-changing operation, and the helper appends exactly one `history` event. `--expected-revision` is checked before anything else. A stale value is exit 3 with nothing written: re-read, then retry with the current revision. An exact retry then returns `changed: false` and changes no bytes. After an uncertain write, re-read before retrying; never replay an `append` blindly.
- Writes go to an exclusive `0600` temp file in the ledger directory, then fsync, rename and read-back. A crash before the rename leaves the previous ledger; after the rename, the new one. Either way the lock stays behind until recovered.
- **Recovering a stale lock.** Take the holder identity from the exit-3 envelope, confirm with the user that the holder has stopped, and run `recover-lock` with that `--operation-id`. A lock whose metadata is incomplete is recovered only by `--expected-lock-sha256` of its exact bytes. The helper refuses a live holder on this host, a replaced lock, and a held recovery guard (`recovery_guard_held`). Remove a stuck guard by hand only after every helper for that Git directory has stopped. Recovery never grants ownership.
- **Ownership.** `claim` records `owner` with a new `claim_id` and consumes `next`. Every later write must present the same runtime, session and claim ID. The same session label under a different runtime is refused. Another session's claim stops you (exit 3): report it. Take over only on the user's word that the other session has stopped. Pass `--force --reason "<their words>"` with a `takeover` grant; the takeover resumes the interrupted phase and checkpoint, never a new phase, and both owners stay in `history`.

## Phases And Claims

`phase` is `delivery`, `review_round`, `watch`, `done` or `blocked`; `checkpoint` is `bootstrap`, `implement`, `validate`, `audit`, `review`, `publish` or `null`. One owner keeps a phase across its checkpoints. Delivery runs `bootstrap → implement → validate → [audit] → review → publish`, omitting `publish` for a non-publication endpoint. A review round starts at `review`: a code fix returns through `begin-change`, while a reply-only batch may go straight to `publish`. A watch observes at `null`. No checkpoint change satisfies an evidence gate.

- `init` sets `next = {phase: delivery, checkpoint: bootstrap, …}`.
- A claim resumes the recorded `next` for the unfinished phase (same-phase handoff), the blocker's `resume_phase` for a blocked ledger, or, from `done`, a newly authorized phase. Wrong-phase reentry is refused.
- Resume an unowned unfinished phase without `--grant-file`. Supplying a phase grant on resume is refused without recording or consuming it, preserving authorization for the later batch or watch.
- A new `review_round` needs a `review_round` grant, and a new `watch` needs a `monitor_observe` or `monitor_remediate` grant (it sets `authorization.monitoring`). Supply the grant with `--grant-file` so it commits in the same revision as the claim, or record it earlier with `authorize`. A `delivery` claim takes no grant; record endpoint, merge and monitoring authority with `authorize`. A grant starts one batch or one watch: once a claim consumes it, it cannot start another. A suggested `next` with `authorization_required: true` is advice, never authority.
- Drift refuses a normal claim or takeover. `--recovery` claims anyway and sets `candidate.recovery_required`. During recovery the owner may read, record evidence, `reconcile`, authorize a `reconcile` grant, and release as `handoff` or `blocked`. It cannot progress, freeze, `record-context`, `measure`, publish or complete.

## Release

- **complete** needs a `completion` and no blocker, and sets `phase: done`. For delivery, `completion.endpoint` must equal `authorization.endpoint`; when publication is unavailable, hand off or block, unless the user authorizes a narrower endpoint (an `endpoint` grant). A later review round or watch completes at the endpoint already reached.
- **handoff** needs a `next` for the same phase and current checkpoint, with `authorization_required: false`.
- **blocked** needs a `blocker` for the same phase and a `next` at its `resume_checkpoint`.
- An authorized but unstarted watch, or a same-session continuation, stays as `next` with `authorization_required: false`; a completion that drops it is refused.
- Every release keeps the earlier completion in `history`.

**Completion evidence.** Cite `completion.evidence_ids` as `<collection>:<id>`, splitting on the first colon, from `validation`, `audits`, `reviews`, `publications`, `role_runs` or `sessions`. Each reference is evaluated at the current end of its successor chain. `complete` checks:

- Local endpoint: `content_id` plus `content_manifest`, re-checked against the working tree, and a passing validation for that same content. No commit is required or created.
- Committed endpoints: the frozen, clean candidate, and a passing `scope: gate` validation for exactly that OID. The gate is a command whose manifest matches the committed tree, a receipt the adapter accepts, or an explicit reuse record. `skipped`, `unavailable`, `pending` and invalidated evidence never pass.
- `push`, `draft_pr`, `ready_pr`: a verified push of the candidate to `refs/heads/<branch>`. PR endpoints also need an open PR recorded at that candidate, with draft state matching the endpoint. During delivery, cite a verified `pr_create` or `pr_body` operation carrying the summary block with `candidate_oid` equal to the final candidate. A body write for an earlier candidate does not satisfy this gate.
- Observe-only watch: cite a `sessions` record with `phase: watch`, first appended during the current watch by the matching runtime and session label. Other fresh evidence and successors of earlier watches cannot establish that this watch ran. Session updates, handoffs, blocked resumes and takeovers retain observations within the unfinished watch.
- Audits: a cited audit must be `PASS` for the final identity; a required audit also needs `audit_policy.state: complete`. A failed audit stays `FAIL` until a new audit passes, and an erroring role never turns it into a role failure. `update` cannot waive a required audit.
- Reviews: every current non-spec review must have no `fail` verdict or pending findings, even when omitted from completion evidence. Record dispositions through successors. PR delivery also needs a cited applicable review, unless repository policy permits an explicit `review_waiver` grant. A waiver never clears recorded failures or required independence. A review of earlier content applies when its retained manifest matches the final commit, or through fixed findings whose `fix_oid` or `fix_content_id` reaches the final candidate. A review round must cite a complete batch first recorded after the claim that started that round. An earlier batch, including a successor or another review using its batch ID, cannot satisfy a new round. Handoffs, blocked resumes and takeovers preserve the unfinished round. A failed or incomplete snapshot cannot establish an empty round.
- Independence: a current `role_runs` record with `fallback_reason: independence_required` and `status: blocked` refuses completion until an independent (`delegated`, `codex-bot` or `human`) implementation review of the final candidate is cited. Self-review never substitutes for it, and a successor cannot change that run's `fallback_reason` or mark it complete.

## Candidate Identity

- `init` records `baseline_oid = HEAD`, `working_head_oid = baseline_oid`, `oid: null`, `state: working`.
- `freeze` needs HEAD equal to `--oid` on the recorded branch, no tracked or index changes, no untracked files inside `intended_paths`, and dependencies that match. A new OID must descend from `prior_head` (the recorded working head) and change only intended, non-excluded paths; an unexplained advance is refused. Freezing the same OID again while frozen is a no-op. From working at `candidate.oid`, it flips to frozen without a new generation. A different OID sets `previous_oid` and increments `generation`. Run commit hooks before `freeze`, and revalidate if they changed tested inputs.
- `begin-change` from frozen keeps `oid` and `previous_oid` as history, sets `state: working` and `working_head_oid = oid`, and sets checkpoint `implement`. It needs existing authority; it grants none.
- `check --stage working` verifies worktree, common directory, branch, single checkout, `HEAD = working_head_oid`, no unresolved conflicts, remote URL, base objects, sources and dependencies, and allows intended uncommitted changes. `frozen` also requires `HEAD = oid` and a clean tracked tree. `published` requires the live destination ref at `oid`, plus the PR for PR endpoints.
- **Expected remote state** for `<remote_name> refs/heads/<branch>` comes from the last verified push to that exact ref, else `candidate.remote_baseline`, else absence. No other ref (the helper refuses pushes elsewhere) and no tracking ref ever counts. During `working` and `frozen`, the live ref must equal that expectation. An unexpected ref needs `remote_adoption`, and a vanished or moved ref is a mismatch. A local candidate ahead of the PR is normal until `published`.
- `--pr` (and `published` for PR endpoints) reads the stored PR by host, repository and number. It then compares URL, base repository, head repository and branch, base, state, draft and head OID. A network or authentication failure is unverified (exit 1); a difference is a mismatch (exit 4). A push-only or non-GitHub remote needs no PR and never gains a fabricated GitHub identity.
- A closed or merged PR (recorded through `record-context`) stops all further publication.

**Reconcile cases** (`expected` must equal the ledger's current `candidate_oid` and `working_head_oid`; `grant_id` names a recorded `reconcile` grant or is `null` with `reason`/`source` naming the already-authorized operation):

| Case | `observed` | Effect |
| --- | --- | --- |
| `interrupted_commit` | `{oid, commit_evidence}` | freeze's transition and checks; no Git change |
| `interrupted_push` | `{event}` | append the verified or failed outcome of an unresolved push operation; the event ID makes retries idempotent |
| `remote_adoption` | `{remote_baseline, pr}` | set a previously null baseline (and PR) at the baseline or current candidate; never replaces one |
| `source_refresh` | `{kind, source}` | as `source-add` |
| `dependency_refresh` | `{dependencies}` | frozen becomes working, dependencies are replaced, current validation and audits are invalidated |

`recovery_required` clears only when the stage recheck after the case passes. Reconcile never resets Git, adopts an unexplained commit, retargets a PR, or changes authorization.

## Evidence

- **Requirements sources.** A newly added task doc, spec or instruction invalidates all current reviews, including reviews that never listed that path. This applies to `source-add` and `source_refresh` recovery. Obtain a fresh review against the expanded requirements; unchanged validation can remain applicable. Adding an identical source again is a no-op.
- **Content identity.** A `ContentManifest` is `{version: 1, baseline_oid, files, excluded_paths, inputs}`. It lists every path that differs between `candidate.baseline_oid` and the current content: committed since bootstrap, staged, unstaged or untracked. Each entry is `{path, mode, state, sha256}`; a symlink hashes its target bytes, and a deletion has `sha256: null` and its baseline mode. Unrelated working-tree changes go in `excluded_paths` explicitly, backed by a recorded scope decision. An excluded path must not differ from the baseline in a committed candidate; otherwise its validation, review and audit evidence cannot apply. `inputs` names relevant dependency, lockfile, policy, tool or environment identities. `content_id` is `sha256:` plus the SHA-256 of the canonical form (the displayed key order, paths and input names sorted by UTF-8 bytes, compact `JSON.stringify`); reformatting the file changes its `Source.sha256` but not its `content_id`. Use `content-manifest` to check a manifest against the working tree.
- **Validation.** A completed command execution records `exit_code`, `log`, the manifest, and `input_fingerprint` (the canonical digest). Focused and local-only runs carry `content_id`, and their manifest must describe the working content when recorded. Committed gates carry `oid` for the frozen candidate, run from a clean checkout. `skipped` and `unavailable` need a reason.
- **Precommit reviews and audits.** Cite the original record after committing identical content. Completion verifies the retained manifest against the final commit without changing the record's original identity. Changed content, missing manifests or invalidated inputs refuse reuse. A recorded dependency refresh invalidates validation, review and audit evidence; obtain fresh evidence for the affected checks.
- **Receipts.** Point at an existing receipt instead of restating it: `receipt: {path, sha256, adapter, identity}`. The `ncdmb-validation-receipt-v1` adapter reads the ncdmb UI receipt unchanged (`candidateOid, lane, lockfileHash, policyHash, baseOid, dependency, exitCode`). At completion it accepts only the current candidate, an `affected` or `required` lane, the current `pnpm-lock.yaml` and `.agent/delivery-policy.json` hashes, this delivery's base, and `dependency: null`. Anything else is unavailable evidence, never a pass.
- **Reuse.** A new OID does not require rerunning unchanged checks. Append a reuse record: `reused_from` names the original passing execution, `reuse` holds `{source_id, source_oid, target_oid, unchanged_inputs, reason}`, and the target manifest is included. The record keeps the original command, log and exit code, and `input_fingerprint: null`. R1 accepts reuse only when the target manifest's canonical digest equals the original fingerprint and every `unchanged_inputs` hash still matches. Reuse is not an execution, and an old receipt never passes for a new OID.
- **Counters.** `review_rounds` counts distinct non-null `cycle_id`s among current reviews. `validation_reruns` sums `executions − 1` per `(cwd, command, scope, input_fingerprint)` over current completed executions that are not reuse records. Retries, successors, receipts and reuse add nothing.
- **Successors.** Replace an observation by appending a new ID with `supersedes_id`: same collection, same subject (candidate, batch, run, session, operation), at most one successor each. A known `native_session_id` cannot change, and a `FAIL` audit cannot be superseded by a better verdict.
- **Roles before R2.** Record inline review or audit with `role_runs.execution: inline` and a `fallback_reason` such as `role_unavailable`, and give `enforcement` as `{tools, filesystem, github, delegation}`. Record a missing heavy-command wrapper as a limitation instead of installing one.

## Publication

`publications` holds one event per step of an intended action, joined by `operation_id`: `prepared`, then any `uncertain`, `mismatch` or `failed` observations, ending in `verified` or `failed`. Every step keeps the prepared `candidate_oid`, `kind`, `target`, `intended`, `precondition` and `batch_id`. `verified` means the specific remote object was read back and matched, not that a request returned success.

- **Prepared** is recorded before the external write and requires the frozen candidate, a passing frozen-stage local identity check, and the authorized endpoint. A push goes only to the delivery branch ref. `push` needs `push` or a PR endpoint; `pr_create`/`pr_body`/`pr_state` need a PR endpoint; `draft: false` needs `ready_pr`; `reply` and `resolve` need a `review_round` or a remediating watch. The target must be this delivery's remote, repository and PR. For a push to the destination, `precondition.head_oid` is the expected remote state: `null` only when the ref is expected absent, the adopted OID before the first recorded push. Other GitHub writes take the expected PR head, so an incoming push stops them. While the same action has an unresolved operation, a new one is refused: inspect remote state and finish the existing operation.
- **Replies** name the frozen batch (`Review.batch`). The snapshot is an external JSON file whose `threads` pair each `thread_graphql_id` with its `root_comment_database_id`. Its `head` must equal the review's `candidate_oid` and, for a new review, the recorded PR head. Disposition successors retain the original reviewed head after fixes are pushed. Positive safe-integer database IDs from GitHub are normalized to strings in memory; snapshot bytes and hashes remain unchanged. Publication targets use strings. The reply's root and thread must be one entry of a complete snapshot, paired with a dispositioned finding. A thread with a verified reply in that batch never gets a second one. A resolution needs that reply verified, and a `fixed`, `duplicate` or `already_resolved` disposition. A fixed finding also needs its `fix_oid` at or behind the verified remote head. When resolution fails, retry only the resolution.
- **Verified** checks per kind:
  - `push`: remote URL, ref and OID.
  - `pr_create`: repository, head repository and branch, base, head OID, draft, and body hash.
  - `pr_body`: PR, head, and body hash.
  - `pr_state`: draft state and head.
  - `reply`: the returned ID and URL, the root and thread, and the body hash.
  - `resolve`: the thread's resolved state.

  An observation that differs is recorded as `mismatch`, which a retry cannot erase. Hash UTF-8 body bytes before transport encoding. Send bodies file-backed per [GitHub transport](../../publish-branch/references/github-transport.md).
- **PR-body summary.** One block per delivery between `<!-- agent-delivery-summary:<delivery_id>:start -->` and `<!-- agent-delivery-summary:<delivery_id>:end -->`. It holds task and spec references, `delivery_id`, the candidate, the authorized endpoint, material decisions, validation and reuse, review dispositions, the audit verdict or its `not_requested` reason, and limitations. Link or state repository-safe facts only, never private paths or credentials. After freezing, `summary-body` inserts `<!-- agent-delivery-candidate:<full_oid> -->` and the supplied summary prose into the block, preserving every byte outside it. Supply prose without a retained candidate marker. Preparation and completion require exactly one candidate marker inside the block matching the final commit, and verify the retained body file's hash. The helper stops on duplicate or unmatched summary markers or another delivery's block. Pass the hash of the body you read as `--expected-current-sha256`, compare it again in `precondition.body_sha256`, and read back after writing. A concurrent edit can still race after that read, because GitHub offers no compare-and-swap.

## Resume And Handoff

1. `show` and `validate` the ledger; keep `next` and `revision`.
2. Read the current scoped repository instructions and the sources in `next.inputs`, plus any other evidence the phase needs.
3. `check` the stage that fits `candidate.state`; stop and report drift.
4. `claim` the recorded `next` (or a newly granted phase) at that revision, and work from the returned `consumed_next`.
5. At the session boundary, append the ending `sessions` observation, `release` with a precise `next`, and give the user the ledger path plus a copy-ready continuation brief. Do not launch another CLI, create a task, or schedule a monitor to get a fresh session.

## Test Hooks

`DELIVERY_LEDGER_TEST_HOOKS=1` enables fault injection for the pack's suite only: `DELIVERY_LEDGER_TEST_BARRIER`, `DELIVERY_LEDGER_TEST_HOLD_MS`, and `DELIVERY_LEDGER_TEST_CRASH=before-rename|after-rename`. Never set them in a delivery.
