# Runner lifecycle and audit handoff

Use the installed runner's documented invocation. The examples below use `node <runner>/src/cli.mjs` for a source installation. Paths, components, IDs and tokens come from discovery, documented configuration or emitted metadata.

## Select a supported candidate environment

1. Run help and `discover --ui <candidate-worktree>`. The current discovery interface uses `--ui` to select a repository checkout even for API-only verification. API/shared candidate inputs must also be resolved explicitly when relevant. An API-only repository without a supported mapping remains unsupported.
2. Compare required checkpoints with the installed executor's operation, authentication, mutation and verification support. Read selected adapter docs; broad capability flags are insufficient. Report unavailable prerequisites before starting unnecessary services.
3. Follow the adapter's documented routing to reuse a matching environment or start only required components. For an owned foreground start, retain the process handle and first environment ID, including queued or failed starts. Wait for ready, then verify URLs and source receipts against the candidate.
4. Adopt the emitted external evidence directory. Complete its brief once; do not initialize a competing audit workspace. If no directory is supplied, use the selected audit skill's initializer and record that directory in the handoff.

Never assume every installation supports the same components, data lifecycle or remote execution. Project recipes and supported capabilities belong to the runner, not to this generic skill. Absence or unsupported mapping permits the established execution path when Docker was optional. Ambiguous mappings, invalid configuration or a selected run's guard failure remain blockers until resolved.

## Supply a complete audit brief

| Field | Required content |
| --- | --- |
| Feature and coverage | Acceptance source, focused/journey/rollout mode, required UI/API checkpoints, expected terminal states and relevant negative cases |
| Candidate identity | Repository/worktree and revision or source digest for each relevant UI, API and shared input; observed served identity and any unverified upstream |
| Environment | Classification, environment ID, URLs reachable from each executor, readiness and exact documented startup invocation |
| Executor | Selected browser/API capability, supported operations, authentication and mutations, assertions, persistence/polling support, restrictions and any authorized alternative |
| Actors and data | Canonical nonsecret actor IDs, secure credential references, fixture identifiers, isolation or serialization boundary, permitted writes, reconciliation and cleanup |
| Evidence | One external directory, report names, source/image receipts, budget and required redaction |
| Ownership | Pre-existing versus created services, environment lifecycle owner, audit session/lease owner, exact handles or tokens and cleanup requirements |

Generated smoke scenarios are defaults, not the feature contract. Preserve environment restrictions while adding required feature checkpoints. If those restrictions prevent a checkpoint, record the gap rather than weakening the requirement. A borrowed API with unverified source may support a runtime observation, but cannot prove acceptance of a changed API candidate.

## Execute the selected audits

For a supported runner UI lease, use `audit-begin --id <environment> --kind ui` with the documented account reference when required. Use its returned token with `browser --id <environment> --audit <token> -- <observed-action>`. Enter credentials only through its supported secret-input mechanism. Do not export reusable authentication state.

For a supported runner API lease, use `audit-begin --id <environment> --kind api` and only the API checks documented by that installation. An unauthenticated schema or missing-route check proves only its selected checkpoint. It does not prove login, authorization, business mutations or persistence. Use Hurl/curl through another executor only when the brief explicitly selects a supported, authorized path compatible with the environment contract; never bypass a restricted runner executor silently.

When both audits are needed, complete dependent checks sequentially and correlate record identifiers. Keep UI setup and transitions in visible flows. Fixture/data preparation belongs to the authorized environment provider before the audit, not to UI automation or direct database writes by an auditor.

Keep separate `ui-report.md` and `api-report.md` when both run. The combined `report.md` links their checkpoint results and evidence. Apply verdict precedence across required checkpoints: proven failure means `FAIL`; all proven means `PASS`; no meaningful required coverage means `BLOCKED`; otherwise unverified required coverage means `PARTIAL`. Never average outcomes or substitute one audit's result for another's required coverage.

## Close exact owned resources

1. Preserve reports, receipts and compact sanitized observations, including failed or blocked runs. Record the source actually tested and any unsupported checks.
2. Follow the adapter's normal logout and evidence contract for authenticated sessions. End the exact lease with `audit-end --id <environment> --audit <token>` and any documented cleanup receipt. A closed browser alone does not prove backend logout.
3. The lifecycle owner calls `stop --id <environment>` only for environments created for this run. An audit-end failure does not skip owned environment cleanup. Borrowed persistent services remain running; an owned temporary view or lease may still need closing.
4. Wait for completed shutdown and inspect documented status, resource/data cleanup receipts and residue. A stop request alone is insufficient. Remove ephemeral credentials; preserve sanitized evidence.
5. If transport is lost, inspect ownership/status before using documented recovery. Recover only an exact verifiably dead owner. Preserve quarantine and admission limits; never manually free accounts, registry rows or data slots.

Data initialization and teardown follow the selected adapter's authorized isolated-data contract. Do not reset shared databases, rebuild fixture stores, refresh a borrowed persistent stack or change host budgets merely to complete an audit. Remote transfer, installation and exposure require their own established authorization.
