# Runner lifecycle

Commands below use `node <runner>/src/cli.mjs`. Paths/IDs come from discovery or emitted metadata, never invented values. Keep one controllable foreground `up` session through the audit. Do not use nohup or a detached shell.

1. `discover --ui <worktree>`; inspect the selected protected config without printing secret sources. Optional explicit `--config <file>` and `--shared <checkout>` must match the task.
2. `up --ui <worktree>` for a UI audit, or `up --ui <worktree> --component api` for a supported NCDMB API-only gateway; retain the process handle and first emitted environment ID even if startup fails or queues. Wait for `ready` and record URLs/artifacts. Stop/cancel the exact environment when the task ends, including queued starts.
3. Initialize an external audit workspace using the selected audit skill's helper. Complete the generated brief with the real acceptance scope; use the runner artifact directory for Docker browser files. Link the audit report from both locations, or copy the final sanitized report into the runner directory.
4. UI: `audit-begin --id <id> --kind ui [--account <canonical-nonsecret-id>]`. Record its audit token and use `browser --id <id> --audit <token> -- snapshot`, followed by observed refs/actions. Supply `secret-fill <ref>` only over stdin from a protected source. Tokens here fence ownership; they are not application auth credentials. Do not export cookies, storage state, raw traces, or secret responses.
5. API: `audit-begin --id <id> --kind api`, then `api-read --id <id> --audit <token> --check schema` and `--check missing-route`. Compare status **and fields** with the known contract. The runner retains compact JSON evidence, applies a deadline/body limit, and does not follow redirects. No API credentials or arbitrary endpoints are supported. These checks use the environment gateway. NCDMB `--component api` skips frontend/shared builds and reuses the existing API and Node image. It provides no frontend, rejects UI audit leases and source export, and records no verified API source digest. It does not start the API or initialize data. Check capabilities first; do not assume an older VPS runner supports this component.

## NCDMB managed API (local only)

`up --ui <worktree> --component managed-api` builds the selected API (`--api-source <api-worktree>`, default from config) with the selected shared checkout, creates one disposable audit database and claims the configured empty Redis logical DB (one managed environment per host; a second start is refused), runs the API's migrations and base seed only, and serves the API behind the gateway. `--component managed-stack` also builds the frontend for UI audits. Discovery must report `apiRuntime: true` and `databaseProvisioning: "disposable"`; otherwise the component is unavailable. The protected config names separate 0600 infrastructure credentials; never print or copy them. Writes affect only that environment's disposable data, but keep to the brief's scenario; mail goes to local Mailpit only. Accounts come from the API's development seed personas and are scoped to the environment. Stop drops/flushes the data only under matching ownership markers; confirm `data-cleanup.json` and `cleanup.json`, and report any residue warning to the user instead of deleting it. A slot-held or `cleanup_failed` environment is not freed manually. Not available on VPS runners.
6. Finish the report with tested source, behavior/reload checks, result, limitations and resource observations. For authenticated UI runs, observe normal application logout and provide the runner's documented receipt for this exact audit; otherwise omit the receipt and report quarantine.
7. `audit-end --id <id> --audit <token> [--logout-evidence <file>]`, then `stop --id <id>`. Even if audit-end fails, stop the environment and report any cleanup failure. Wait on the foreground handle; `stop: requested` alone does not prove cleanup. Check `status --id <id>` and retained `cleanup.json`. If transport is lost, inspect status and use `recover --id <id>` only for a verifiably dead owner. Never manually delete registry rows or globally prune Docker.

All projects share the normal host registry and admission limits. Account exclusivity is distinct from data safety: separate accounts do not make shared mutations, migrations or fixtures safe. Keep audits read-only unless the brief supplies an authorized isolated/serialized data contract.

## Verified Storybook bundle input

For an explicitly authorized received runtime snapshot, replace discovery and Git startup with `up --config <protected-storybook-config> --bundle <absolute-directory> --digest <independently-retained-sha256>`. Review the inventory for secrets before transfer. Do not supply `--ui` or `--shared`. The receiver checks source identity and copies verified bytes into its own workspace; follow the same audit and cleanup steps above. NCDMB bundle execution is unsupported.

This supports runtime verification, not transfer of Git history, staging state or an ongoing editable task. Native VPS worktrees remain preferred for remote coding tasks. Full remote delivery must separately prove agent resume, owned sessions, native heavy-command admission, remote API reachability and disconnect/reconnect. Existing sessions are not disposable because they are unattached.

Linux admission also checks host memory pressure and swap activity. Missing probes or a conflicting registered host policy fail closed. Do not lower headroom, increase capacity or create another registry to get a run admitted. Local consumer tests do not prove that a remote build fits.

## NCDMB base stack and routing (local only)

When the protected config has a `base` block, a persistent base stack may already be running. It serves the API and the procurement, vendor and DDD apps on golden-derived data. Check it with `base-status --ui <worktree>`; start it with `base-up`. Never refresh, reset or stop it unless the user asked: it is Dee's manual-QA environment.

1. Run `route --ui <ui-worktree> --api-source <api-worktree> --shared <shared-worktree>` and follow its `recommendation`. Always pass the API and shared worktrees your change touches; otherwise `route` compares Dee's own checkouts and misses your change. Check the `compared` field:
   - `base` → `up --ui <worktree> --component base` (browser only, shared base data);
   - frontend changes → `up --ui <worktree> --component procurement-ui --apps <apps>` (built against the base API);
   - any API code, migration or shared-package change → `managed-api`/`managed-stack` on a golden copy.
   - For bounded API checks against the base, use `up --component api` (the `base` view is browser-only).
2. Never point a changed API at base data: one API process per database, because the API's workers and schedulers act on it.
3. On base, ordinary UI writes are allowed:
   - label every record you create with the environment ID;
   - assert only on your own records, never on totals or single global state such as the open procurement cycle;
   - list your writes in the report.
4. Use fixture personas and vendors from the golden fixture state. Lease accounts as usual; quarantine rules apply.
5. With `proxy` configured, environments get `https://<env>.<name>.test` names and the audit browser opens them automatically. The secure origin is required by UI features that call `crypto.randomUUID()`. The loopback URLs remain available.
6. If a `managed-*` start fails because the base leaves no room, report it. Do not stop the base or change the budget yourself.
7. If a copy fails with "Redis audit database is not empty", an interrupted golden build still holds the copy slot. Report it; Dee (or an authorized run) clears it with `golden-build`.
