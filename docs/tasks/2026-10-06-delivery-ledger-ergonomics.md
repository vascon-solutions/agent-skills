# Delivery ledger ergonomics

## Objective

In ledger-mode deliveries, cut the bookkeeping cost: helper writes per operation, schema-guess rejections and per-write revision reads. Keep every guarantee the ledger provides, with no ledger schema change and no external writes by the helper.

This is one feature-grade delivery in `vascon-solutions/agent-skills`, targeting `main`. It depends on `docs/tasks/2026-10-06-delivery-ledger-opt-in.md`.

## Source Context

BE-01-01-q2 in bolamark-erp (2026-10-06) was measured from its session transcript by an independent reviewer:

- ledger bookkeeping on the critical path: about 520s (range 350–640s);
- about 17% of agent working time and about 20% of output tokens;
- 72 of 389 tool calls;
- 18 failed write calls in the session's report, against 19 failure rows in the per-call table (the 19th is a read-only `check` mismatch).

By area:

| Area | Cost |
| --- | --- |
| Publication prepared/verified pairs | 126s |
| Freeze, measure, set-review-bound and begin-change across 6 candidates | 94s |
| Schema and doc reads | 77s |
| Reviews and role runs | 71s |
| Validation with content manifest | 71s |

The rejections came from:
- `role_runs /runtime_version: expected string, got null`;
- validation missing `content_manifest` and `input_fingerprint`;
- ancestor packages in the bound;
- a finding without a defect shape;
- successor-identity and publication-target rules.

One refused prepared record did not stop the script, and the push ran anyway.

Sources:
- session transcript `/Users/dee/.claude/projects/-Users-dee-Code-ALPHASKY-bolamark-erp/e895cee9-c247-477f-977a-cb3a87244630.jsonl`;
- the session's own delivery report (relayed in the 2026-10-06 skill-pack session);
- partial artefacts in `/Users/dee/agent-artifacts/delivery-ledger-cost-2026-10-06/`. Its per-call table has no category labels, so the per-area figures are not reproducible from the retained files alone.

This task was split out of a combined ledger task by an independent spec review.

## Design Reference

Current contracts:
- `skills/task-doc-delivery-loop/references/delivery-ledger.md`
- `delivery-ledger.schema.json`
- `review-policy.md`
- `skills/publish-branch/references/ledger-handoff.md`
- `skills/address-review-findings/SKILL.md`
- `skills/review-implementation/references/risk-classes.md`

## Architecture Summary

New helper commands and options build ledger records from minimal input and ledger state. They append the same records the current commands do, under the same invariants, with one history event per revision.

The changes:
- publication prepare/verify payload generation, with item batches;
- a freeze option that also measures and installs the bound from owner-attested fields;
- validated templates;
- atomic array appends, each item validated against the accumulating draft;
- a `hint` field on every failure envelope;
- examples that persist the revision between agent tool calls and stop on any helper failure.

The helper still never pushes or writes to GitHub.

## Code Evidence

Evidence from `main` at `7c09101`.

| Behavior | Source |
| --- | --- |
| Helper boundary: no stage, commit, push or GitHub write. `check` is the only network reader (`git ls-remote`, `gh api --method GET`). | `references/delivery-ledger.md:60` |
| Failure envelope keys are exactly `{ok:false, command, code, message, path, id, expected, observed}`, and a test pins them | `delivery-ledger.md:24`; `tests/delivery-ledger.test.mjs:1542-1555` |
| Success envelope is `{ok, command, changed, revision, data}`. A stale `--expected-revision` exits 3 with nothing written. | `delivery-ledger.mjs:994-1031`; `delivery-ledger.md:79` |
| The `owned()` example runs `show --field /revision` before every write, as a shell function | `references/delivery-examples.md:32-36` |
| `commandAppend` validates each item against the pre-mutation ledger | `delivery-ledger.mjs:2785` |
| Checks that read the pre-mutation ledger: unresolved action (`2627-2631`), one reply per thread (`2647-2648`), resolve needs a verified reply (`2651-2654`), role-run reservation (`2740-2747`). The final invariant pass (`1249-1340`) doesn't catch two open operations on one target. | `delivery-ledger.mjs` |
| `pr_create` requires a verified push of the candidate. Replies and resolves are allowed only in `review_round` or a remediating watch. | `delivery-ledger.mjs:2593`, `:2560-2562` |
| Reply verification compares `thread_graphql_id` and `root_comment_database_id`. Resolve checks resolved state. Both values are GraphQL-sourced. | `delivery-ledger.mjs:2691-2698` |
| Per-item publication rules: "Finish each item before starting the next" and "one item at a time" | `publish-branch/references/ledger-handoff.md:8`; `address-review-findings/SKILL.md:37` |
| Risk class `batch-publication-verification` covers per-item identity and read-back | `review-implementation/references/risk-classes.md:16` |
| The only reconcile case for an unresolved operation is `interrupted_push` | `delivery-ledger.md:127` |
| ReviewBound requires `measured_oid, size, max_rounds, rounds_used, delegated_used, delegated_limit, extension_rounds, overrides` | `delivery-ledger.schema.json:77-89` |
| `set-review-bound` refuses unless `measurements.files == basis.files`. Prior grants are kept, and the delegate limit is monotonic. Measurement covers `diff_base_oid..oid`. | `delivery-ledger.mjs:3131`, `:3153-3156`, `:3189`; `review-policy.md:58` |
| History `detail` is a free object, so batch writes fit one history event | `delivery-ledger.schema.json:504-516` |
| Per-item checks behind the q2 rejections live in `itemProblems` and `appendChecks`, not in the schema | `delivery-ledger.mjs:2730-2777` |
| The helper has 373 `fail("` sites | `delivery-ledger.mjs` |

## Current Behavior To Preserve

- Every existing command, record shape, invariant, completion gate, claim, lock and revision rule.
- Existing ledgers stay readable and resumable.
- Prepared-before-write: no external write is started without a prepared record. A verified record exists only after a matching read-back.
- One verified reply per thread, and resolve only after a verified reply.
- The helper performs no external writes. Network reads stay read-only.
- No ledger schema version change. If an item turns out to need one, stop and report.

## Prerequisites

- `docs/tasks/2026-10-06-delivery-ledger-opt-in.md` has landed. That task makes ledger mode opt-in. This one optimises ledger mode. The dependency is an ordering decision from the spec-review split, not a technical one: the helper changes here stand alone, but the examples and handoff wording in B6 build on the opt-in task's "in ledger mode" framing.
- **Landing order for the four 2026-10-06 tasks:** delivery-audit-and-review-defaults, then delivery-ledger-opt-in, then agent-script-contract-and-delivery-hygiene, then this task.

## Scope

### B1. Publication payload generation

- **`publication prepare --kind push|pr-create|pr-body|pr-state|reply|resolve [kind flags]`** builds the prepared event (ID, target, precondition) from ledger state and flags.
- **`publication verify --id ID --observed-file F`** builds the matching event (`verified`, `mismatch` or `uncertain`) from a read-back.
  - `--from-check` is accepted only for `push` and `pr-state`, where the existing GET readers already observe everything the verifier compares. Use the raw readers, not the identity comparators: `lsRemote` for the ref and `readGitHubPr` for an already recorded PR's `number`, `url`, `head`, `draft` and `state`. `remoteIdentity` and `prIdentity` compare live state with the ledger's current expectation (the old head, the stored draft state), so they would report a mismatch for the very write being verified. Build `Observed` from the raw output, then run the existing verified-observation checks. It stays inside the GET-only boundary.
  - `pr-create` and `pr-body` take `--observed-file` only. The current PR reader requires a PR already recorded in the ledger (`commandCheck` refuses `--pr` without one) and does not return the body, while verification of these kinds compares the new PR's identity and `body_sha256` (`delivery-ledger.mjs:2689-2691`). Widening `check` to fetch an arbitrary PR number and its body is excluded here; it would be a follow-up with its own boundary review. publish-branch already reads the created PR and its body back, so the observed file costs no extra request.
  - Reply and resolve read-back always comes from `--observed-file`. The owner gathers it through publish-branch's GraphQL reads.
- **`--batch FILE`** prepares, or verifies, several items of one kind in one revision.
  - The sequence is prepare the batch → perform the writes → read back each item → verify the batch. Each item keeps its own identity and read-back.
  - The batch identity is recorded only in the history event's `detail`. The publication field `batch_id` keeps its existing meaning, the frozen review batch (non-null for reply and resolve, null otherwise).
  - A prepare batch holds only `prepared` steps, and a verify batch never contains an operation prepared in the same call: the prepared record must land in an earlier revision than its write's read-back.
  - A reply and its resolve can never be in the same prepare batch, because resolve requires a verified reply.
- **Recovery for a batch item that was prepared but never written:** inspect the remote. If the object exists, record `verified`; otherwise record `failed` with reason "not attempted". Never write again blindly.
- **Docs and rules:**
  - `delivery-ledger.md:60` is amended: `check` and `publication verify --from-check` are the only network readers, and both are GET-only.
  - `ledger-handoff.md:8` and `address-review-findings/SKILL.md:37` are amended to allow this batch order.
  - `risk-classes.md:16` is reconciled with it.
  - A test asserts that `--from-check` issues no mutating request.

### B2. Freeze with review bound

- **`freeze --oid OID --evidence-file F --review-bound FILE`** freezes, measures and installs the bound in one revision.
  - `FILE` is a partial bound with only the owner-attested fields, nested as in `ReviewBound`: `{basis: {packages, workspace_decision, delegated_decision}, delegated_limit, overrides}`.
  - The helper derives the rest: `measured_oid`, `basis.files`, `size`, `max_rounds` (keeping the larger prior allowance), `extension_rounds` (the sum of the overrides) and the counters.
- **`--review-bound reuse`** copies `packages`, `workspace_decision`, `delegated_limit`, `delegated_decision`, `overrides` and `extension_rounds` from the prior bound.
  - It works only when every path in `diff_base_oid..oid` lies under the recorded package roots.
  - It refuses when there is no prior bound, when `packages` is null, or when a new extension grant has been recorded since the prior bound. Those cases require the file form.
- `measure` and `set-review-bound` stay unchanged.

### B3. Templates

- `template <append-field|input-kind>` prints a skeleton for the record or input file. It includes required fields, allowed enums, and the cross-field rules behind the q2 rejections, wherever they are enforced: a string `runtime_version` (schema, via `requireShape`), `content_manifest` with `input_fingerprint` (`itemProblems`), a defect shape for each finding, successor identity (`subjectProblem`), and leaf packages for a bound (`set-review-bound`).
- `delivery-examples.md` uses templates instead of hand-built JSON.

### B4. Atomic array append

- `append FIELD` also accepts a JSON array, validated item by item, in order, against the **accumulating draft**. That means the unresolved-operation, reply-once, resolve-after-verified-reply and role-run reservation checks see the earlier items in the same call.
- The whole array is written, or nothing is, in one revision with one history event.
- A `publications` array follows the B1 rule: a non-prepared step whose operation was prepared in the same call is refused.
- Duplicate IDs inside the array are refused.
- Items identical to existing records are no-ops, as in today's single-item append. The rest are validated normally.

### B5. Failure hints

- Every failure envelope gains `hint`: a string, or `null` when there is no hint.
- `delivery-ledger.md:24` and the key-pinning test are updated as intended contract maintenance.
- Hints are defined in a table keyed by **failure site**, not by failure code, because most q2 refusals share `invariant_error`. A site is a short stable identifier passed as an optional extra argument to `fail()` only at the calls that have a hint; the other `fail()` calls are untouched and produce `hint: null`. The table covers at least the q2 rejection list, the sweep-before-push precondition and the stale revision. The test iterates the table and triggers each site on a fixture ledger, asserting the envelope carries that site's hint.

### B6. Example and handoff discipline

- `delivery-examples.md` saves each envelope's `revision` to a file in the evidence directory and reads it before the next write. Shell state does not persist between agent tool calls, so the revision can't live in a shell variable.
- The write wrapper lives in one fenced `sh` block of `delivery-examples.md` under a stable heading. `tests/delivery-ledger.test.mjs` extracts that block and runs it against a stub helper with scripted exits, so the stop and retry rules below are executable.
- The examples stop on any non-zero helper exit, with one named exception: on exit 3 with code `stale_revision`, the example re-reads the revision with `show` once and retries the same write once. Any other exit 3 code (`claim_mismatch`, `mutex_held`, `owner_conflict`) and any second stale revision stop the script.
- `ledger-handoff.md` and `SKILL.md` state the rule: never run a guarded git or GitHub write when the preceding helper call failed. Never chain the two in a form that continues after a failure.

## Excluded

- External writes by the helper.
- Read-only GraphQL inside the helper.
- Schema version changes.
- Removing commands.
- The opt-in trigger (prerequisite task).
- Measurement tooling in the pack.

## Pre-Implementation Verification

Spec check (2026-10-14, independent reviewer): the helper can express every item without a schema change or an external write. `failed` with an `error` text exists in the publication event shape; B2's fields are all derivable with the current functions; `appendChecks` reads only the ledger argument it is given, so a draft can stand in. The corrections above (raw readers for `--from-check`, batch identity in history `detail`, no prepared-and-verified pair in one call, an executable B6 block, the partial-bound nesting) came from that check. Several code-evidence line numbers have drifted by a few lines; re-pin while implementing.

- Recheck the evidence on current `main`.
- Confirm that B4's draft-sequential validation can reuse `itemProblems`/`appendChecks` with the draft passed in place of the ledger, for each named check.
- Confirm B2's derivation matches `set-review-bound`'s computed fields exactly for the same inputs.
- Confirm B1's batch records can express per-item outcomes using the existing publication event shape.

## Likely Files To Touch

- `skills/task-doc-delivery-loop/scripts/delivery-ledger.mjs`
- `references/delivery-ledger.md`, `references/delivery-examples.md`, `SKILL.md`
- `skills/publish-branch/references/ledger-handoff.md`
- `skills/address-review-findings/SKILL.md`
- `skills/review-implementation/references/risk-classes.md`
- `tests/delivery-ledger.test.mjs`

## Decisions Required Before Implementation

None blocking. These are settled: the helper boundary stays as it is, and the schema does not change. Defaults: `hint` is always present, and `--from-check` is limited to the GET readers.

## Execution Rules

- Each item (B1–B6) is a reviewable commit.
- The existing conformance and invariant suites stay green, except for the B5 key-test update, which is intended.
- Run `node --test tests/*.test.mjs`.

## Deliverables

- B1–B5 helper commands and options, with tests.
- B6 examples and handoff rules.
- Amended per-item publication rules and the risk class.

## Completion Verification

| Risk | Evidence | Owner |
| --- | --- | --- |
| B1 events differ from hand-built ones | Generated events equal the existing fixtures for each kind, after normalising generated IDs and timestamps | `tests/delivery-ledger.test.mjs` |
| B1 batch breaks per-item identity or recovery | A batch with one mismatched read-back leaves the other items verified and that one `mismatch`. A prepared-but-unwritten item records `failed`/"not attempted". A reply and resolve in one prepare batch is refused. A verify step for an operation prepared in the same call is refused. | same |
| `--from-check` mutates or reaches beyond GET | A stubbed `gh` and `git` record only read requests | same |
| B2 derives a different bound, or reuse over-attests | The result matches the three separate commands in one revision. Reuse is refused for a path outside the roots, no prior bound, null packages, or a new grant. | same |
| B3 templates still trip helper checks | Each filled template is accepted by `append` on a fixture ledger | same |
| B4 bypasses same-call checks | Each of these writes nothing, keeping one history event per revision: two prepared operations on one target, two replies to one thread, two delegated dispatches that together exceed the bound, duplicate IDs, a prepared step and its verified step in one array. Mixed identical and new items behave as defined. | same |
| B5 hint missing or contract drift | The hint table is tested per site: each listed site is triggered once and its hint asserted; an unlisted site yields `hint: null`. The envelope key test is updated. | same |
| B6 examples continue after a failure | The example script under test stops at a failing helper call, retries exactly once on `stale_revision`, and stops on a second stale revision or any other exit 3 code | same |
| Pack regressions | `node --test tests/*.test.mjs` | owner |

**Measured acceptance.** This is post-merge and does not gate completion. On the next ledger-mode delivery with a review round, count helper **write invocations**, not tool calls:
- push, PR create and three reply/resolve pairs take **8 or fewer**, against 16 today. That is the dependency-chain minimum with batches;
- each candidate freeze is 1;
- there are no schema-guess rejections.

Record the categories used: publication, freeze/bound, record append, read.

**Test admission.** Each test guards an invariant the ledger guarantees, or a new command contract that deliveries in four repositories rely on. No presentation tests.

## Approval Gates

None beyond the delivery endpoint.

## Completion Criteria

- B1–B6 are in place with passing tests.
- An independent review has no unresolved blocking findings.

## Follow-ups

- Read-only GraphQL read-back inside the helper, if reply and resolve observed files prove error-prone. This needs an explicit widening of the network boundary.
- A retained measurement script with labelled categories, if measurement becomes routine.
