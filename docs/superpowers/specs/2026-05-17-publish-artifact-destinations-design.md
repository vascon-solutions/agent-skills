# Publish-Artifact Destinations Design

## Context

`publish-artifact` today is a single-destination tool. Every publish writes to a private S3 archive and optionally mirrors Markdown/HTML to secret GitHub gists. The current `When Not To Use` section explicitly forbids ClickUp and Google Drive.

The skill needs to broaden into a multi-destination publisher while keeping today's hardening: never publish secrets, never make the bucket public, never store credentials in the repo, never break a working dry-run, and never claim success before verification.

This spec expands `publish-artifact` to also publish to GitHub Wikis, ClickUp Docs, and Google Docs/Drive. It applies industry-standard transport, retry, and least-privilege practices, and it makes security an explicit non-negotiable.

## Decision

Expand `publish-artifact` along these lines:

- One skill, one CLI, one driver module per destination under `scripts/destinations/<name>.js`.
- Repeatable `--to <s3|wiki|clickup|google-docs>` flag selects destinations. No destination is mandatory.
- Default behavior with no `--to` flag preserves today's S3 + optional gist flow exactly.
- Cross-cutting code (workspace resolution, secret scan, metadata writers, Markdown rewriting) lives in `scripts/common/` and is single-source.
- Auth follows the standard credential mechanism for each destination; no secret is ever stored in the repo.
- HTTP destinations use native `fetch` with HTTPS-only, certificate validation, exponential backoff with jitter, and per-call timeouts.
- ClickUp and Google Docs ingest only Markdown in v1; HTML conversion to those destinations is out of scope. Wiki receives files as a git push, so its repo can include `markdown/`, `html/`, `images/`, and `assets/` as-is. For ClickUp and Google Docs, image references resolve only via S3 presigned URLs when `s3` is also in the `--to` set.

## Scope

In scope:

- `s3` driver: refactor existing behavior; no functional change.
- `wiki` driver: push workspace contents to `<owner>/<repo>.wiki.git`.
- `clickup` driver: create/update a ClickUp Doc per Markdown file.
- `google-docs` driver: create/update a Google Doc per Markdown file under a Drive folder.
- Common modules: workspace, secret scan, metadata, Markdown image-path rewriter.
- Tests: per-driver units with mocked subprocess/HTTP calls.
- Security section: explicit hardening rules, applied uniformly across drivers.

Out of scope for this spec:

- Notion, Confluence, generic HTTP webhooks (deferred).
- Uploading images via destination APIs (ClickUp attachments, Drive image uploads). Images still flow through S3 only.
- HTML conversion for ClickUp / Google Docs / Wiki.
- Automatic syncing, watching, or scheduling.
- Two-way sync (pulling changes back into the workspace).

## CLI Surface

```sh
publish-artifact <slug>
  [--to <s3|wiki|clickup|google-docs>]...
  [--share <target>]...                    # unchanged; requires 's3' (default when --to is absent, or when --to s3 is selected)
  [--ttl <duration>]                        # unchanged; S3 presigned URL TTL; max 7d
  [--no-gist]                               # unchanged
  [--gist-visibility <secret|public>]       # unchanged
  [--wiki-repo <owner/repo>]                # optional; defaults via `gh repo view`
  [--clickup-parent <type:id>]              # required for clickup; type in {workspace,space,folder,list}
  [--clickup-doc <name>]                    # optional; defaults to <slug>
  [--google-folder <drive-folder-id>]       # required for google-docs unless GOOGLE_DRIVE_PARENT_ID set
  [--google-doc <name>]                     # optional; defaults to <slug>
  [--force]                                 # override secret-scan and confirm doc/page overwrite
  [--dry-run]                               # show planned work; no local or remote writes
  [--workspace-root <path>]                 # advanced/test flag, unchanged
```

Default behavior (no `--to`) matches today: S3 + optional gist. Existing callers and tests see no change.

Example invocations:

```sh
publish-artifact my-feature                                  # current behavior
publish-artifact my-feature --to wiki                        # wiki only
publish-artifact my-feature --to s3 --to clickup             # S3 archive + ClickUp Doc, image refs rewritten
publish-artifact my-feature --to wiki --to google-docs --dry-run
```

## File Layout

```
skills/publish-artifact/
  SKILL.md
  scripts/
    publish-artifact.js                # CLI entry, flag parse, dispatch, report
    publish-artifact.test.js
    common/
      workspace.js                     # slug -> workspace, path-traversal-safe
      secret-scan.js                   # extended pattern list
      metadata.js                      # local + redacted-S3 writers
      markdown-rewrite.js              # rewrite relative image paths to presigned URLs
      http.js                          # fetch wrapper: HTTPS, timeouts, retry, redacted errors
    destinations/
      s3.js
      wiki.js
      clickup.js
      google-docs.js
```

## Driver Contract

Every destination exports:

```js
export default {
  name: 'wiki' | 'clickup' | 'google-docs' | 's3',
  requiredEnv: () => string[],                    // env vars that must be present
  validateFlags: (flags) => void,                 // pre-flight; throws on missing required IDs
  plan:  ({ workspace, files, flags, ctx }) => DriverPlan,
                                                   // pure: declares actions; consumed by --dry-run and publish
  publish: (plan, ctx) => DriverResult,
  formatReport: (result) => string[],             // lines for the unified report
}
```

`ctx` carries shared utilities: HTTP client, logger (with redaction), markdown rewriter, dry-run flag, and force flag. Drivers must never read process.env directly outside `requiredEnv()` — credentials are loaded once and passed through `ctx`.

Dispatch order from the CLI:

1. Parse flags; reject invalid combinations early.
2. Resolve workspace once (path-traversal-safe).
3. Build the file set once. Run the secret scan once across the file set.
4. For each selected driver: `validateFlags()` then `plan()`. Aggregate plans.
5. On `--dry-run`, print the aggregated plan and exit.
6. Otherwise, execute each driver's `publish()` in the order the `--to` flags appear on the CLI (`--to s3 --to wiki` runs s3 then wiki). On any failure, stop and report the workspace-relative file or remote resource that failed. Drivers that already published are noted in the report; subsequent drivers are skipped.
7. Write local `metadata.md` with per-destination sections, then upload the redacted copy to S3 if `s3` was a destination.
8. Print the unified report.

## Per-Destination Specs

### s3 (refactor; no behavior change)

The existing 14-step workflow moves into `s3.js` verbatim. Output format, env variables (`ARTIFACTS_S3_BUCKET`, `ARTIFACTS_S3_REGION`, `ARTIFACTS_S3_PREFIX`, `AWS_PROFILE`), compatibility aliases, gist behavior, presigned URL minting, redacted-metadata upload, and existing tests are unchanged. The refactor only relocates code; behavioral tests must continue to pass without modification.

### wiki

Inputs:

- target repo from `--wiki-repo <owner/repo>`, else `gh repo view --json nameWithOwner` against cwd.
- workspace folders `markdown/`, `html/`, `images/`, `assets/`.

Auth: prefer `gh auth status` for HTTPS; fall back to local SSH agent for `git@github.com:`. The driver does not handle credentials directly.

Flow:

1. Shallow-clone (`--depth 1`) `git@github.com:<owner>/<repo>.wiki.git` to `os.tmpdir()/publish-artifact-wiki-<random>`.
2. GitHub does not provision the wiki git repo until the first wiki page is created in the UI. If the clone fails with "Repository not found", report a clear actionable error: "wiki not initialized — create the first page at https://github.com/<owner>/<repo>/wiki and retry." Do not attempt to provision the wiki automatically.
3. Mirror workspace `markdown/`, `html/`, `images/`, `assets/` into the clone, preserving relative paths. Skip hidden files, `node_modules`, `dist`.
4. `git add -A`, `git commit -m "publish-artifact: <slug> @ <iso-timestamp>"`. If no changes, report "wiki up to date" and skip the push.
5. `git push` once. On 403 or auth failure, report which credential source was tried and exit non-zero.
6. Remove the tmp clone on success and on failure.
7. Report the wiki page URL for each top-level `.md` pushed: `https://github.com/<owner>/<repo>/wiki/<page-name>`.

Required scope: `repo` (wiki push uses the same scope as repo push). The driver checks `gh auth status --show-token=false` and surfaces a clear error if the scope is insufficient.

### clickup

Inputs:

- `CLICKUP_API_TOKEN` env var. Mandatory.
- `--clickup-parent <type:id>` where type is `workspace`, `space`, `folder`, or `list`. Or environment defaults `CLICKUP_PARENT_TYPE` + `CLICKUP_PARENT_ID`.
- `--clickup-doc <name>` defaults to `<slug>`.

Flow (per Markdown file in `workspace/markdown/`):

1. Find existing Doc by name under the parent via `GET /api/v3/workspaces/{workspace_id}/docs?parent_id=...&parent_type=...`. Use the first exact-name match.
2. If found and `--force` is not set, prompt for overwrite. In non-interactive contexts, treat absence of `--force` as a refusal and skip the file with a clear message.
3. If image references exist and `s3` is also a selected destination, run the body through `markdown-rewrite.js` so relative image paths become S3 presigned URLs (TTL inherits `--ttl`). If `s3` is not selected, warn and send the body unmodified.
4. Create: `POST /api/v3/workspaces/{workspace_id}/docs` with body containing the Markdown content and the parent reference. Update: `PUT /api/v3/workspaces/{workspace_id}/docs/{doc_id}`.
5. Report the Doc URL.

HTML files in `workspace/html/` are skipped (`html/...skipped - clickup does not ingest HTML` in the report).

Required scope: ClickUp Personal API tokens grant full account access — this is a known limitation of the ClickUp model. The driver surfaces this in its first-run output and recommends a dedicated service account.

### google-docs

Inputs:

- Active ADC (`gcloud auth application-default print-access-token` succeeds) or `GOOGLE_APPLICATION_CREDENTIALS` pointing at a service-account JSON outside the repo.
- `--google-folder <drive-folder-id>` or `GOOGLE_DRIVE_PARENT_ID` env.
- `--google-doc <name>` defaults to `<slug>`.

Flow (per Markdown file):

1. Search for existing Doc by name in the parent folder: `GET /drive/v3/files?q=name='<name>' and '<parent>' in parents and mimeType='application/vnd.google-apps.document' and trashed=false&supportsAllDrives=true`.
2. If found and `--force` is not set, prompt for overwrite. Non-interactive contexts treat the absence of `--force` as a refusal.
3. If image references exist and `s3` is also a selected destination, run the body through `markdown-rewrite.js`. Otherwise warn and send unmodified.
4. Create: `POST /upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true` with `{ name, parents: [parent], mimeType: 'application/vnd.google-apps.document' }` and the Markdown body as `text/markdown`. Drive converts on upload.
5. Update: `PATCH /upload/drive/v3/files/{id}?uploadType=media&supportsAllDrives=true` with the Markdown body.
6. Report the Doc URL: `https://docs.google.com/document/d/<id>/edit`.

Required scope (service account): `https://www.googleapis.com/auth/drive.file`. This scope restricts the service account to files it created itself, which fits v1: the driver only updates Docs it previously published under the parent folder. Docs created outside this skill will not be found by the search step. ADC uses the user's existing scopes.

## Image Rewriting

`markdown-rewrite.js` is invoked only when a destination requests it (ClickUp, Google Docs). It transforms a Markdown body in memory:

- Matches Markdown image syntax `![alt](path)` and HTML `<img src="path">` where `path` is relative.
- For each match, looks up the file under the workspace. If the file exists and was uploaded by the `s3` driver in the current run, rewrite to the presigned URL produced for that upload.
- If `s3` is not in the current `--to` set, leave the path untouched and surface a single warning in the report listing the affected files.
- Never rewrites absolute URLs. Never inlines images as data URIs in v1 (data-URI inlining adds size and a CSP-incompatible foot-gun; revisit later).

The local Markdown file is never modified. Rewriting is applied only to the in-memory copy sent to the destination.

## Auth Surface Summary

| Destination | Source of credentials | Where they live |
|---|---|---|
| `s3` | AWS credential chain (env, profile, SSO, role) | Outside the repo |
| `wiki` | `gh auth status` (HTTPS) or SSH agent (git@) | Outside the repo |
| `clickup` | `CLICKUP_API_TOKEN` | Shell env or local ignored `.env`; never committed |
| `google-docs` | ADC or `GOOGLE_APPLICATION_CREDENTIALS` JSON | Outside the repo |

No driver reads credentials from CLI flags. No driver writes credentials to disk, logs, or `metadata.md`. Errors are redacted before printing.

## Security Priorities

These rules are non-negotiable. Tests enforce the ones that can be enforced statically; documentation and code review enforce the rest.

### Credential hygiene

- No credential ever appears in CLI flags, `metadata.md`, logs, or error output.
- The script masks any string that looks like a token before printing an error.
- The repo never commits real `.env` values; only `.env.example`.
- Service-account JSON for Google must live outside the repo and workspace. The driver refuses to start if `GOOGLE_APPLICATION_CREDENTIALS` resolves inside the repo or workspace.
- ClickUp Personal API tokens grant full account access; the driver surfaces this in the first-run output.

### Transport

- All HTTP calls use HTTPS only. The shared `http.js` wrapper rejects `http://` URLs and never sets `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- Native `fetch` (Node 18+). No new HTTP library dependencies.
- Per-call timeout (default 30s). Bodies that exceed a configured size cap (default 25 MB) are rejected before the request is built.
- Exponential backoff with jitter on `429` and `5xx` responses, up to 3 retries. `4xx` other than `429` fails fast.

### Input validation

- Workspace slug must match `^[A-Za-z0-9._-]+$` and must not resolve outside `~/agent-artifacts/`. Path traversal attempts fail at slug resolution.
- `--wiki-repo` must match `^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$`.
- ClickUp / Google IDs match a documented regex per type. Invalid IDs fail at `validateFlags()`.

### Secret scan extensions

The existing pattern list grows to detect:

- ClickUp Personal API tokens (`pk_<digits>_<chars>`)
- Google API keys (`AIza[0-9A-Za-z\-_]{35}`)
- Google OAuth client secrets and ID-token JWTs (already covered by JWT pattern)
- Service-account JSON markers (`"type": "service_account"` literal)

A scan block stops all destinations. `--force` is reportable-only and never echoes match contents.

### Idempotency

- Wiki commits are atomic per-run: one commit, one push. On failure, the tmp clone is removed.
- ClickUp and Google Doc updates require a matching existing Doc by name. Without `--force`, an update is refused in non-interactive contexts and prompted otherwise.
- Existing tests for S3's content-md5 path stay green; the refactor does not weaken idempotency on S3.

### Output redaction

- Local `metadata.md` retains full URLs for the user.
- The S3-uploaded copy redacts presigned URLs and gist URLs as today, and additionally redacts Google Doc and ClickUp Doc URLs when those URLs include workspace or folder IDs that the user has not chosen to expose. Default: redact in the S3 copy, keep locally.

### Dependency posture

- No new runtime dependencies. Use built-in `fetch`, `https`, `child_process`, `fs`, `crypto`.
- Subprocess invocations (`gh`, `git`, `aws`, `gcloud`) use arg arrays, never shell strings. No string interpolation into shell commands.

## Cross-Cutting Concerns

### Metadata

Local `metadata.md` gains one `## Published — <destination>` section per destination that ran. Each section is rewritten on each publish. The redacted S3 copy concatenates them into a single `## Published` section with sensitive URLs redacted as described above.

### Secret scan

Runs once, before any driver publishes, against the unified file set. A block stops everything.

### Dry-run

`--dry-run` runs every driver's `plan()` and prints the aggregated result with each line prefixed `[dry-run]`. No HTTP, no git push, no S3 upload, no local file writes. Tests must verify zero local-file mutation under dry-run.

### `--share` semantics

In v1, `--share` remains tied to S3 + gist. When `--to` is absent, the default behavior runs S3, so `--share` works exactly as today. When `--to` is passed explicitly and does not include `s3`, the CLI errors clearly and suggests adding `--to s3`. This avoids reinterpreting `--share` to mean wiki URL / Doc URL, which would silently change semantics for existing users.

## Backward Compatibility

- Calling `publish-artifact <slug>` with no `--to` flag must produce byte-identical behavior to the current script: S3 archive, optional gist, identical output shape, identical metadata format.
- All existing tests in `publish-artifact.test.js` must continue to pass without modification.
- The current `When Not To Use` line forbidding ClickUp / Google Drive is removed.
- The current `Configuration` and `S3 Safety` sections in SKILL.md become subsections under a new `S3 Destination` section. Their content is unchanged.

## Validation

Before reporting completion:

```sh
node --test skills/publish-artifact/scripts/publish-artifact.test.js
```

The suite must cover:

- All existing S3 + gist behavior (regression).
- Each new driver's `validateFlags`, `plan`, and `publish` with mocked subprocess and HTTP layers.
- The secret scan extensions (positive and negative cases for the new patterns).
- The shared `http.js` wrapper: HTTPS-only enforcement, timeout, backoff with jitter, error redaction.
- `markdown-rewrite.js`: relative-path rewriting only when S3 is in `--to`, untouched local file, warning when `--to s3` is absent.
- Workspace slug validation rejects path-traversal attempts.
- `--dry-run` is side-effect free across drivers.
- No driver makes a live network call in tests.

Manual smoke tests per destination are documented in the updated SKILL.md, each gated behind explicit environment variables so they are never run accidentally in CI.

## Expected Skill Changes

These edits are confined to `skills/publish-artifact/`. No other skill is touched.

### `SKILL.md`

- Update the front-matter `description` to reflect multi-destination scope without naming a single archive layer.
- Add a `## Destinations` section listing s3, wiki, clickup, google-docs, each with a one-paragraph summary, required env, and required flags.
- Move existing `Configuration`, `Script Behavior`, `Secret Scan`, `S3 Safety`, `Metadata`, `Gists` content under a `## S3 Destination` heading; content is unchanged.
- Replace `## When Not To Use` line "Do not use this for Google Drive, ClickUp, Google Docs, or native-format conversion" with a narrower line: "Do not use this for Notion, Confluence, or generic webhook destinations in v1."
- Add a `## Security` section consolidating the rules in this spec's "Security Priorities".
- Add manual smoke-test invocations per destination, each guarded behind explicit env vars.

### Scripts

- New: `scripts/common/{workspace.js, secret-scan.js, metadata.js, markdown-rewrite.js, http.js}` (extracted from existing logic where applicable).
- New: `scripts/destinations/{s3.js, wiki.js, clickup.js, google-docs.js}`.
- Refactor: `scripts/publish-artifact.js` becomes the CLI dispatcher; existing logic moves into `common/` and `destinations/s3.js`.
- Extended: `scripts/publish-artifact.test.js` (or split into per-driver test files alongside the existing one).

### `.env.example`

Add the new optional env vars with placeholder values:

```sh
CLICKUP_API_TOKEN=
CLICKUP_PARENT_TYPE=
CLICKUP_PARENT_ID=
GOOGLE_DRIVE_PARENT_ID=
GOOGLE_APPLICATION_CREDENTIALS=
```

`GOOGLE_APPLICATION_CREDENTIALS` is documented as a file path; never put credential bytes in `.env`.

## Phased Implementation Order

The implementation plan should land in this order to keep the existing S3 path safe:

1. Refactor `publish-artifact.js` into the driver pattern. Move existing logic into `common/` and `destinations/s3.js`. All existing tests must pass without modification. No new destinations yet.
2. Add `wiki` driver and tests.
3. Add `clickup` driver, `markdown-rewrite.js`, and tests. Update secret-scan patterns.
4. Add `google-docs` driver and tests.
5. Update SKILL.md, `.env.example`, and `README.md` if it references the skill.

Each phase is independently testable. A failure in step 3 does not regress steps 1–2.

## Out-of-Scope Follow-Ups

- Notion, Confluence, generic webhook destinations.
- Image upload via destination APIs (ClickUp attachments, Drive image uploads).
- HTML conversion for non-S3 destinations.
- OS-keychain credential source (1Password CLI, macOS Keychain) as a `.env` alternative.
- Per-destination rate-limit budgeting beyond simple per-call backoff.
- Two-way sync.
