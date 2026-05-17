---
name: publish-artifact
description: Publish a ~/agent-artifacts/<slug>/ workspace to one or more destinations (S3, GitHub Wikis, ClickUp Docs, Google Docs, Google Drive folders). Explicit command only — never auto-triggered, never makes any S3 bucket public.
---

# publish-artifact

## Purpose

Publish an existing artifact workspace from `~/agent-artifacts/<slug>/` to one or more destinations selected by repeatable `--to` flags. Default destination (no `--to`) is a private S3 archive plus optional presigned URLs and secret GitHub gists, which preserves prior behavior. Additional destinations are `wiki` (GitHub Wikis), `clickup` (ClickUp Docs), `google-docs` (native Google Docs), and `google-drive` (raw Drive folder/file upload).

This skill does not create artifacts. Use `markdown-artifact`, `html-artifact`, or `image-artifact` first.

The executable workflow lives in:

```sh
node skills/publish-artifact/scripts/publish-artifact.js <slug> [flags]
```

When invoked through a linked skill directory, run the script from that skill directory:

```sh
node ~/.codex/skills/publish-artifact/scripts/publish-artifact.js <slug> [flags]
```

The script resolves symlinks with `fs.realpathSync(__dirname)`, so local env-file discovery still points back to the canonical skill repo.

## When To Use

- An existing `~/agent-artifacts/<slug>/` workspace needs durable private S3 storage.
- You need a temporary presigned URL for a workspace file.
- You need a secret gist URL for a Markdown or HTML artifact.
- You want to mirror an artifact workspace as it changes.

## When Not To Use

- Do not use this to create artifacts.
- Do not use this for Notion, Confluence, or generic webhook destinations in v1.
- Do not use this for automatic syncing or filesystem watching.
- Do not use this unless the user explicitly asks to publish/share/archive an artifact workspace.

## Destinations

Select one or more with repeatable `--to <name>` flags. With no `--to`, the script runs the S3 + optional gist flow exactly as the previous version.

- `s3` — private S3 archive plus optional presigned URLs and secret gists. Required env: `ARTIFACTS_S3_BUCKET`, `ARTIFACTS_S3_REGION`.
- `wiki` — push workspace contents to `<owner>/<repo>.wiki.git` as a single atomic commit. Auth via `gh` or SSH agent. Required flag (optional if auto-detectable via `gh repo view`): `--wiki-repo <owner/repo>`.
- `clickup` — create or update a ClickUp Doc per Markdown file. Required env: `CLICKUP_API_TOKEN`. Required flag (or `CLICKUP_PARENT_TYPE` + `CLICKUP_PARENT_ID`): `--clickup-parent <type:id>` where type is `workspace`, `space`, `folder`, or `list`.
- `google-docs` — create or update a native Google Doc per Markdown file under a Drive folder. Required: active ADC (`gcloud auth application-default print-access-token`) or `GOOGLE_APPLICATION_CREDENTIALS` pointing to a service-account JSON outside the repo and workspace. Required flag (or `GOOGLE_DRIVE_PARENT_ID`): `--google-folder <drive-folder-id>`.
- `google-drive` — create or update a Drive folder named `<slug>` under a parent folder and upload workspace files as raw files, preserving `markdown/`, `html/`, `images/`, and `assets/` structure. Required auth is the same as `google-docs`. Required flag (or `GOOGLE_DRIVE_PARENT_ID`): `--google-folder <drive-folder-id>`.

Image references in Markdown files are rewritten to S3 presigned URLs only when `--to s3` is also selected for ClickUp or Google Docs. Without `s3`, image refs are left as-is and the report includes a warning. Wiki mirrors `markdown/`, `html/`, `images/`, and `assets/`; Google Drive uploads those files directly; ClickUp and Google Docs ingest Markdown only and report HTML files as skipped.

Manual smoke tests (each gated behind explicit env vars so they are never run accidentally in CI):

```sh
# Wiki (requires gh auth; reads repo from cwd if --wiki-repo absent)
node skills/publish-artifact/scripts/publish-artifact.js demo --to wiki --wiki-repo me/proj --dry-run

# ClickUp (requires CLICKUP_API_TOKEN and a parent id you control)
CLICKUP_API_TOKEN=$CLICKUP_API_TOKEN \
  node skills/publish-artifact/scripts/publish-artifact.js demo \
  --to clickup --clickup-parent workspace:$CLICKUP_WORKSPACE_ID --dry-run

# Google Docs (requires ADC; folder ID for the parent)
node skills/publish-artifact/scripts/publish-artifact.js demo \
  --to google-docs --google-folder $GOOGLE_DRIVE_PARENT_ID --dry-run

# Google Drive raw folder upload (requires ADC; folder ID for the parent)
node skills/publish-artifact/scripts/publish-artifact.js demo \
  --to google-drive --google-folder $GOOGLE_DRIVE_PARENT_ID --dry-run
```

## Inputs

Required:

- `<slug>` — workspace directory name under `~/agent-artifacts/`, or an absolute/`~` path that still resolves under the workspace root.

Flags:

- `--to <name>` — repeatable. Selects destinations: `s3`, `wiki`, `clickup`, `google-docs`, `google-drive`. With no `--to`, defaults to S3 + optional gist (legacy behavior).
- `--share <target>` — repeatable. Valid values: `markdown`, `html`, or a workspace-relative filename such as `markdown/report.md`, `html/report.html`, or `images/summary.png`. Requires S3 (default behavior or `--to s3`).
- `--ttl <duration>` — presigned URL TTL. Grammar: `<integer><unit>` where unit is `s`, `m`, `h`, or `d`. Default: `7d`. Maximum: `7d`.
- `--force` — override secret-scan blocks, update existing recorded gists instead of creating duplicates, and overwrite an existing ClickUp Doc or Google Doc when a name collision is detected.
- `--dry-run` — show planned work without local or remote writes.
- `--gist-visibility <secret|public>` — default: `secret`. `public` appends `--public` when creating new gists.
- `--no-gist` — generate only S3 presigned URLs for share targets.
- `--wiki-repo <owner/repo>` — explicit wiki target. Optional if `gh repo view` can detect the repo from cwd.
- `--clickup-parent <type:id>` — ClickUp Doc parent. `type` is `workspace`, `space`, `folder`, or `list`. Falls back to `CLICKUP_PARENT_TYPE` + `CLICKUP_PARENT_ID` envs.
- `--clickup-doc <name>` — Doc name. Defaults to `<slug>`.
- `--google-folder <drive-folder-id>` — Drive folder that hosts Google Docs or raw Google Drive uploads. Falls back to `GOOGLE_DRIVE_PARENT_ID`.
- `--google-doc <name>` — Doc name. Defaults to `<slug>`.
- `--workspace-root <path>` — advanced/test flag that overrides the default `~/agent-artifacts` root for slug resolution.

Invalid:

- `--share images` is not supported. Image sharing requires an explicit filename, for example `--share images/summary.png`.

## Configuration

The script shells out to the AWS CLI for S3 operations. Install and authenticate `aws` before any non-dry-run publish.

Required environment:

```sh
ARTIFACTS_S3_BUCKET=
ARTIFACTS_S3_REGION=
```

Optional:

```sh
ARTIFACTS_S3_PREFIX=
AWS_PROFILE=artifacts
```

The script reads shell environment first. Missing values may be filled from ignored local env files:

1. `<canonical skillDir>/.env`
2. `<canonical repoRoot>/.env.local`

Commit only `.env.example`. Never commit real `.env` values.

Recommended local `skills/publish-artifact/.env` shape:

```sh
ARTIFACTS_S3_BUCKET=<bucket-name>
ARTIFACTS_S3_REGION=<region>
AWS_PROFILE=artifacts
```

Do not put `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, or `S3_SECRET_ACCESS_KEY` in repo-local env files, even when those files are ignored. Configure a named AWS profile outside the repo, for example:

```sh
aws configure --profile artifacts
```

Rotate or revoke exposed keys in AWS IAM first; `aws configure` only stores the replacement credentials locally.

If reusing an existing S3 config, the script accepts these compatibility aliases only when the canonical variable is missing. Use credential aliases only from a shell environment or external secret source, not from `skills/publish-artifact/.env`:

```text
S3_BUCKET_NAME       -> ARTIFACTS_S3_BUCKET
S3_REGION            -> ARTIFACTS_S3_REGION
S3_ACCESS_KEY_ID     -> AWS_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY -> AWS_SECRET_ACCESS_KEY
S3_BASE_URL          -> not used
```

AWS credentials come from the standard AWS credential chain outside this repo: shell env, AWS profiles, SSO, IAM role, or container/instance credentials. GitHub credentials come from `gh auth login`. This skill does not manage or print credential values.

## Script Behavior

The script performs the workflow end to end:

1. Parse flags and validate invalid combinations.
2. Load env files without overriding shell env.
3. Require bucket and region, then set `AWS_REGION="$ARTIFACTS_S3_REGION"` for every AWS subprocess.
4. Resolve the workspace.
5. Verify it exists and has `metadata.md` or at least one of `markdown/`, `html/`, `images/`, or `assets/`.
6. Build the upload set, skipping hidden paths, `node_modules`, `dist`, and phase-1 `metadata.md`.
7. Secret-scan uploadable non-image files.
8. Upload changed files to S3 with `content-md5=<local-md5>` user metadata.
9. Compare existing S3 objects by `ContentLength` and `Metadata["content-md5"]`; never compare local MD5 to S3 `ETag`.
10. Resolve share targets and generate presigned URLs.
11. Create or update gists for resolved `.md` and `.html` targets unless `--no-gist`.
12. Rewrite local `metadata.md` with full local share links.
13. Upload an in-memory redacted `metadata.md` copy to S3.
14. Print the final report.

If an upload fails, the script stops and reports the workspace-relative file that failed.

## Secret Scan

The script blocks before upload when it finds common secrets, unless `--force` is passed. It scans for:

- AWS access key IDs and `aws_secret_access_key` assignments
- GitHub classic, server, OAuth, user-to-server, and fine-grained PATs
- Anthropic and OpenAI style API keys
- Slack tokens
- JWTs
- private key blocks

Image binaries with extensions `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, and `.ico` are skipped to avoid binary false positives.

With `--force`, report filenames and pattern names only. Do not write match contents to metadata.

## S3 Safety

The script must never make the bucket public. It must not call:

- `put-bucket-acl`
- `put-bucket-policy`
- `put-public-access-block`

It must not pass upload ACL flags such as `--acl public-read`.

S3 is the archive layer. Sharing is only through presigned URLs with a capped TTL.

## Metadata

Local `metadata.md` is authoritative and keeps full presigned and gist URLs. If it does not exist, the script creates:

```markdown
# <slug> Metadata

## Published
```

Default S3 publishes preserve the legacy `## Published` section. Explicit multi-destination and non-S3 publishes write one `## Published — <destination>` section per destination that ran, replacing prior publish sections while preserving other metadata headings.

The S3 copy of `metadata.md` is redacted in memory before upload:

- presigned URLs become `<presigned URL — see local metadata>`
- gist URLs become `<gist URL — see local metadata>`
- destination Doc/wiki URLs in explicit destination sections are redacted from the S3-uploaded copy when S3 is selected

Do not write the redacted copy back to the local workspace.

## Gists

Markdown and HTML share targets create secret gists by default:

```sh
gh gist create <local-file> --desc "<slug>: <type>"
```

With `--gist-visibility public`, append `--public`.

When a gist for the same file is already recorded in `metadata.md`:

- without `--force`, prompt before creating a duplicate
- with `--force`, update the existing gist:

```sh
gh gist edit <gist-id> --filename <gist-filename> <local-file>
```

Images and other non-Markdown/HTML files are S3-only. If `gh auth status` fails, S3 upload and presigned URLs still proceed and gist actions are skipped.

## Output

The script reports in this shape, omitting empty sections:

```text
Workspace: ~/agent-artifacts/<slug>/
S3 archive: s3://<bucket>/[<prefix>/]<slug>/
Files uploaded: <N> (skipped <M> unchanged)

Share links (TTL: <ttl>):
- <relative/path> — <presigned-url>
- images/<file>.png — <presigned-url> (S3 only; no gist)

Gists:
- <relative/path>.md — https://gist.github.com/<user>/<id>
- <relative/path>.html — https://gist.github.com/<user>/<id>

Metadata updated: ~/agent-artifacts/<slug>/metadata.md
```

If GitHub auth fails:

```text
Gists: skipped (gh auth status failed)
```

On blocked secret scan:

```text
Secret scan: <N> matches in <files>
Publish blocked. Use --force to override.
```

On dry run, every line starts with `[dry-run]`, no URLs are minted, and no local or remote state is written.

## Validation

Before reporting completion:

```sh
node --test skills/publish-artifact/scripts/publish-artifact.test.js
node --test skills/publish-artifact/scripts/common/*.test.js skills/publish-artifact/scripts/destinations/*.test.js
```

For manual smoke checks, create a temporary workspace and run:

```sh
ARTIFACTS_S3_BUCKET=test-bucket \
ARTIFACTS_S3_REGION=us-east-1 \
node skills/publish-artifact/scripts/publish-artifact.js <slug> --workspace-root <tmp-root> --share markdown --dry-run
```

Expected:

- test suite passes
- dry-run output is fully `[dry-run]` prefixed
- dry-run does not modify local `metadata.md`
- no live AWS or GitHub command is required for tests
- no AWS credentials appear in output or metadata

## Security

These rules are non-negotiable. Tests enforce the ones that can be enforced statically; reviewers enforce the rest.

- No credential is ever read from a CLI flag, written to `metadata.md`, or printed in logs or error output. Token-shaped strings are redacted before any error is surfaced.
- All HTTP calls are HTTPS-only. The shared `common/http.js` wrapper rejects `http://` URLs and never sets `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- HTTP requests use native `fetch` (Node 18+), a per-call timeout, a 25 MB request-body cap, and exponential backoff with jitter on 429 and 5xx responses. Other 4xx responses fail fast.
- Workspace slugs must match `^[A-Za-z0-9._-]+$` and resolve under `~/agent-artifacts/`. Path-traversal attempts fail at slug resolution.
- `--wiki-repo` must match `^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$`.
- The secret scan blocks before any destination publishes when it sees AWS, GitHub, Anthropic/OpenAI, Slack, JWT, private-key, ClickUp, Google API, or service-account JSON markers.
- `GOOGLE_APPLICATION_CREDENTIALS` must point to a file outside the repo and the workspace. The driver refuses to start otherwise.
- Subprocess calls (`aws`, `gh`, `git`, `gcloud`) use argv arrays, never shell strings.
- No new runtime dependency is introduced. The skill relies only on Node built-ins and the installed CLIs above.

## Cautions

- Presigned URLs are bearer tokens. Treat them as sensitive until they expire.
- Secret gists are unlisted, not access-controlled. Anyone with the URL can read them.
- Gists retain edit history. Delete a gist if an old revision contained sensitive data.
- The secret scan is a safety net, not a guarantee. Users remain responsible for what they publish.
- ClickUp Personal API tokens grant full account access; rotate them like any production secret and avoid binding them to your primary user when a service account works.
- Google `drive.file` scope means the skill only sees Docs it created itself; Docs created outside this skill will not be found by name search and will not be updated.
