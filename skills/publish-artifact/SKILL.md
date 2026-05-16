---
name: publish-artifact
description: Publish a ~/agent-artifacts/<slug>/ workspace to a private S3 archive and optionally produce shareable presigned URLs or secret GitHub gists for the Markdown and HTML contents. Explicit command only — never auto-triggered, never flips the S3 bucket public.
---

# publish-artifact

## Purpose

Move a portable artifact workspace from "only on my laptop" to "archived in S3 and, when requested, accessible via a private link." This skill does not create artifacts — it ships ones that already exist under `~/agent-artifacts/<slug>/`.

S3 is the archive layer; uploads happen on every run. GitHub gists are the share-link layer; they are only created when the user passes `--share`.

## When To Use

- An existing `~/agent-artifacts/<slug>/` workspace needs durable storage off the local machine
- You want a presigned URL or secret gist URL to send to someone
- You want to keep a remote mirror of a workspace as you iterate on it

## When Not To Use

- To create the artifacts themselves — use `markdown-artifact`, `html-artifact`, or `image-artifact` first
- To collaborate in Google Drive or ClickUp — those destinations are out of scope
- To convert Markdown into Google Docs or ClickUp blocks — only raw-file upload is supported
- To set up automatic syncing — this skill is explicit, command-driven only

## Inputs

Required:

- `<slug>` — the workspace directory name under `~/agent-artifacts/`, or an absolute path to a workspace directory

Optional flags:

- `--share <type>` — also create a share link for the named artifact type. Repeatable. Valid values: `markdown`, `html`, or a specific filename relative to the workspace. Images are always shared via S3 presigned URLs, never via gist.
- `--ttl <duration>` — TTL for S3 presigned URLs. Examples: `1h`, `24h`, `7d`. Default: `7d`. Maximum: `7d` (the SigV4 maximum without a session token).
- `--force` — proceed even if the pre-publish secret scan finds matches; allow gist re-creation when one already exists
- `--dry-run` — show what would be uploaded and shared without actually doing it
- `--gist-visibility <secret|public>` — override default gist visibility. Default: `secret`.
- `--no-gist` — generate only S3 presigned URLs for `--share` targets; skip gist creation

## Configuration

Read from environment:

- `ARTIFACTS_S3_BUCKET` — required for any S3 operation
- `ARTIFACTS_S3_REGION` — required for any S3 operation
- `ARTIFACTS_S3_PREFIX` — optional. Prepended to every S3 key. Default: empty.

AWS credentials come from the standard AWS credential chain in this order: env (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`), `~/.aws/credentials`, IAM role, container/instance credentials. This skill does not write or read keys.

GitHub credentials come from the `gh` CLI. Verify with `gh auth status`. This skill does not manage tokens.

If either `ARTIFACTS_S3_BUCKET` or `ARTIFACTS_S3_REGION` is missing, do not fall back to defaults. Stop and tell the user which variable is missing.

## Workspace Resolution

1. If `<slug>` is an absolute path or starts with `~`, expand and use it directly. Verify it is a directory.
2. Otherwise treat `<slug>` as a directory name under `~/agent-artifacts/`.
3. If the resolved directory does not exist, stop and report the resolved path.
4. If the directory has no `metadata.md` and contains no `markdown/`, `html/`, `images/`, or `assets/` subdirectory, stop and ask the user to confirm — this may not be an artifact workspace.

## Pre-Publish Secret Scan

Before any upload, scan every file that would be uploaded for common secret patterns. Block the publish on any match unless the user passes `--force`.

Patterns to detect (case-sensitive where shown):

- `AKIA[0-9A-Z]{16}` — AWS access key ID
- `aws_secret_access_key\s*=\s*['"]?[A-Za-z0-9/+=]{40}['"]?` — AWS secret access key assignment
- `ghp_[A-Za-z0-9]{36}` — GitHub personal access token
- `ghs_[A-Za-z0-9]{36}` — GitHub server-to-server token
- `gho_[A-Za-z0-9]{36}` — GitHub OAuth token
- `ghu_[A-Za-z0-9]{36}` — GitHub user-to-server token
- `xox[abpr]-[A-Za-z0-9-]+` — Slack tokens
- `eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+` — JWTs (three-part dot-delimited base64url)
- `-----BEGIN (RSA |EC |DSA |OPENSSH |ENCRYPTED |)PRIVATE KEY-----` — private keys

If any pattern matches, do not upload. Report:

```text
Secret scan: <N> matches in <files>. Publish blocked.
Use --force only if you have confirmed these are false positives or intentionally public.
```

If `--force` is provided, list the matches in the report and proceed.

Do not run the secret scan against image binaries — they will almost always produce false positives. Skip files with extensions `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.ico`.

## S3 Upload

For each non-skipped file under the workspace, compute the S3 key as:

```
[<ARTIFACTS_S3_PREFIX>/]<slug>/<relative-path-from-workspace-root>
```

Walk the entire workspace including `markdown/`, `html/`, `images/`, `assets/`, and `metadata.md`. Skip:

- hidden files and directories (anything starting with `.`)
- any path containing `node_modules/` or `dist/`

For each file:

1. HEAD the existing S3 object: `aws s3api head-object --bucket "$ARTIFACTS_S3_BUCKET" --key "$key"`.
2. If the object does not exist, upload it.
3. If it exists, compare `ContentLength` to the local size and `ETag` (after stripping surrounding quotes) to a local MD5 of the file. If either differs, upload. Otherwise skip.
4. Set `--content-type` based on extension:
   - `.md` → `text/markdown; charset=utf-8`
   - `.html` → `text/html; charset=utf-8`
   - `.png` → `image/png`
   - `.jpg`, `.jpeg` → `image/jpeg`
   - `.svg` → `image/svg+xml`
   - anything else → `text/plain; charset=utf-8`
5. Upload with no ACL flag. Never pass `--acl public-read`. Never call `put-bucket-acl`, `put-bucket-policy`, or `put-public-access-block`. Bucket access posture is the bucket owner's responsibility, not this skill's.

Either `aws s3 cp` or `aws s3api put-object` is acceptable for the upload.

If any upload fails, stop and report which file failed. Do not continue with partial state beyond what already succeeded.

## Presigned URLs

When `--share <type>` is provided:

1. Resolve the type to a concrete S3 key:
   - `markdown` → first `.md` file under `<slug>/markdown/`
   - `html` → first `.html` file under `<slug>/html/`
   - explicit filename → exact relative path inside the workspace
2. If multiple `.md` or `.html` files exist and no filename was provided, list them and ask once which one to share.
3. Generate the presigned URL:
   ```
   aws s3 presign "s3://$ARTIFACTS_S3_BUCKET/$key" --expires-in <seconds>
   ```
   Compute `<seconds>` from `--ttl`. Cap at `604800` (7 days, the SigV4 maximum without a session token).
4. Include the URL and human-readable TTL in the report and in the `metadata.md` Published section.

## Gist Publishing

When `--share markdown` or `--share html` is provided, also create a gist for that file unless `--no-gist` is passed.

- Markdown gist:
  ```
  gh gist create <md-file> --desc "<slug>: <doc-type>"
  ```
  Default visibility is secret (`gh gist create` defaults to secret unless `--public` is added).
- HTML gist:
  ```
  gh gist create <html-file> --desc "<slug>: html"
  ```
  Raw, browser-renderable URL: `https://gist.githubusercontent.com/<user>/<gist-id>/raw/<filename>`.
- Images: never create a gist for images. State this in the report when the user asked for `--share images` — they receive the S3 presigned URL only.

If `--gist-visibility public` is passed, append `--public` to the `gh gist create` command.

If a gist for the same file has been published before (recorded in `metadata.md`), prompt before re-creating. With `--force`, update the existing gist via `gh gist edit <gist-id> <file>` instead of creating a duplicate.

If `gh auth status` fails, do not attempt gist operations. Report what was uploaded to S3 and skip gist steps with a note.

## State Tracking

Update or append the `## Published` section in the workspace's `metadata.md`:

```markdown
## Published

- S3 archive: `s3://<bucket>/[<prefix>/]<slug>/`
- Last published: `<YYYY-MM-DD HH:MM>Z`
- Files uploaded: <count> (skipped <M> unchanged)

### Presigned share links

- `markdown/<file>.md` — <url> (expires <YYYY-MM-DD HH:MM>Z)
- `html/<file>.html` — <url> (expires <YYYY-MM-DD HH:MM>Z)

### Gist share links

- `markdown/<file>.md` — https://gist.github.com/<user>/<id>
- `html/<file>.html` — https://gist.github.com/<user>/<id>
```

On each run, replace the existing `## Published` section. Preserve everything before and after it. If the workspace has no `metadata.md`, create one with only this section plus a minimal header (`# <slug> Metadata`).

Do not include `--force`d secret-scan match content in metadata. Note only that the scan was overridden.

## Workflow

1. Receive `<slug>` and optional flags.
2. Resolve the workspace path; verify it exists and looks like a workspace.
3. Read `ARTIFACTS_S3_BUCKET` and `ARTIFACTS_S3_REGION`. Stop if either is missing.
4. Run the pre-publish secret scan. Stop on findings unless `--force`.
5. If `--dry-run`, list what would be uploaded and shared, then stop.
6. Walk the workspace; HEAD each S3 key; upload changed and missing files.
7. For each `--share` target, generate a presigned URL and (for markdown/html, unless `--no-gist`) a gist.
8. Update the `## Published` section of `metadata.md`.
9. Report the outcome in the format below.

## Validation

Before reporting complete, verify:

- every file in the upload set returned a successful `aws` exit code
- if `--share` was requested, every requested type produced at least one URL
- `metadata.md` `## Published` section is present and updated
- the bucket's public-access state was not modified (this skill never calls those APIs)
- no AWS credentials appear anywhere in the report, in `metadata.md`, or in any uploaded file

## Output

Report exactly:

```text
Workspace: ~/agent-artifacts/<slug>/
S3 archive: s3://<bucket>/[<prefix>/]<slug>/
Files uploaded: <N> (skipped <M> unchanged)

Share links (TTL: <ttl>):
- markdown/<file>.md — <presigned-url>
- html/<file>.html — <presigned-url>

Gists:
- markdown/<file>.md — https://gist.github.com/<user>/<id>
- html/<file>.html — https://gist.github.com/<user>/<id>

Metadata updated: ~/agent-artifacts/<slug>/metadata.md
```

On a blocked secret scan:

```text
Secret scan: <N> matches in <files>
Publish blocked. Use --force to override.
```

On a dry run, prefix every line with `[dry-run]`.

## Cautions

- **Never flip the bucket public.** The skill must not call `put-bucket-acl`, `put-bucket-policy`, or `put-public-access-block`. Share via presigned URLs only.
- **Never embed AWS credentials in metadata, output, or gists.** They live in the user's environment; the skill never echoes them.
- **Do not auto-publish.** This skill runs only on explicit invocation. Other artifact skills do not invoke it.
- **Treat the secret scan as a safety net, not a guarantee.** It catches common token patterns; it will miss novel or custom secrets. Users remain responsible for what they publish.
- **Presigned URLs are bearer tokens.** Anyone with the URL can read until the TTL expires. Treat them as sensitive; do not paste them in public channels.
- **Gists retain full edit history.** Even a secret gist's full revision history is fetchable by anyone with the gist ID. Editing does not erase prior content. Delete the gist if a previous revision contained anything sensitive.
- **Out of scope:** Google Drive, ClickUp, native-format conversion (Docs/Blocks), filesystem watchers, automatic syncing.
