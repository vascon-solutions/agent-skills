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

- `--share <type>` — also create a share link for the named artifact type. Repeatable. Valid values: `markdown`, `html`, or a specific filename relative to the workspace (an explicit filename is required for any image share). Gist creation triggers automatically for any resolved target whose extension is `.md` or `.html`; images always share via S3 presigned URL only.
- `--ttl <duration>` — TTL for S3 presigned URLs. Grammar: `<integer><unit>` where unit is `s` (seconds), `m` (minutes), `h` (hours), or `d` (days). Examples: `30m`, `1h`, `24h`, `7d`. Default: `7d`. Maximum: `7d` (the SigV4 maximum without a session token).
- `--force` — proceed even if the pre-publish secret scan finds matches; allow gist re-creation when one already exists
- `--dry-run` — show what would be uploaded and shared without actually doing it
- `--gist-visibility <secret|public>` — override default gist visibility. Default: `secret`.
- `--no-gist` — generate only S3 presigned URLs for `--share` targets; skip gist creation

## Configuration

Read from environment:

- `ARTIFACTS_S3_BUCKET` — required for any S3 operation
- `ARTIFACTS_S3_REGION` — required for any S3 operation
- `ARTIFACTS_S3_PREFIX` — optional. Prepended to every S3 key. Default: empty.

At the start of the workflow, export `AWS_REGION="$ARTIFACTS_S3_REGION"` once so every subsequent `aws` invocation targets the intended region rather than falling through to the CLI's default profile. Do not rely on AWS commands to pick up `ARTIFACTS_S3_REGION` automatically — the AWS CLI only reads `AWS_REGION` / `AWS_DEFAULT_REGION` / config-file region / `--region`.

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
- `(?i)aws_secret_access_key\s*=\s*['"]?[A-Za-z0-9/+=]{40}['"]?` — AWS secret access key assignment (case-insensitive; AWS secret keys have no distinctive prefix, so the assignment form is the primary detection vector)
- `ghp_[A-Za-z0-9]{36}` — GitHub personal access token (classic)
- `github_pat_[A-Za-z0-9_]{82}` — GitHub fine-grained personal access token
- `ghs_[A-Za-z0-9]{36}` — GitHub server-to-server token
- `gho_[A-Za-z0-9]{36}` — GitHub OAuth token
- `ghu_[A-Za-z0-9]{36}` — GitHub user-to-server token
- `sk-ant-[A-Za-z0-9_-]{32,}` — Anthropic API key
- `sk-[A-Za-z0-9]{32,}` — OpenAI API key (and similar `sk-` prefixed provider keys)
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

Walk the entire workspace including `markdown/`, `html/`, `images/`, `assets/`. **Exclude `metadata.md` from this phase** — it is uploaded separately in a second phase after the State Tracking step has rewritten it for the current run (see Two-Phase Upload below). Skip:

- hidden files and directories (anything starting with `.`)
- any path containing `node_modules/` or `dist/`

For each file:

1. Compute the local MD5 of the file.
2. HEAD the existing S3 object: `aws s3api head-object --bucket "$ARTIFACTS_S3_BUCKET" --key "$key"`.
3. If the object does not exist, upload it.
4. If it exists, compare local file size to `ContentLength` and the local MD5 to `Metadata["content-md5"]` from the `head-object` JSON output. S3 stores this as the `x-amz-meta-content-md5` HTTP header, but the AWS CLI exposes user metadata under the top-level `Metadata` map. If either value differs, upload. If `Metadata["content-md5"]` is absent on the existing object (older upload, or first run against a pre-existing object), treat the file as changed and upload — this re-establishes the checksum metadata. **Do not rely on the S3 `ETag` for comparison.** ETag is only an MD5 for single-part uploads under the default 8 MB threshold; for multipart, SSE-KMS, SSE-C, or additional-checksum objects it is not an MD5, and naive comparison will trigger re-uploads on every run.
5. Set `--content-type` based on extension:
   - `.md` → `text/markdown; charset=utf-8`
   - `.html` → `text/html; charset=utf-8`
   - `.png` → `image/png`
   - `.jpg`, `.jpeg` → `image/jpeg`
   - `.svg` → `image/svg+xml`
   - anything else → `text/plain; charset=utf-8`
6. Upload with no ACL flag. Always include `--metadata "content-md5=<local-md5>"` so future runs can compare reliably regardless of multipart or encryption settings. Never pass `--acl public-read`. Never call `put-bucket-acl`, `put-bucket-policy`, or `put-public-access-block`. Bucket access posture is the bucket owner's responsibility, not this skill's.

Either `aws s3 cp` or `aws s3api put-object` is acceptable for the upload.

If any upload fails, stop and report which file failed. Do not continue with partial state beyond what already succeeded.

## Two-Phase Upload

`metadata.md` is uploaded twice in a logical sense but only once physically: the first walk skips it, then after State Tracking rewrites it with the current run's `## Published` section, the redacted variant is uploaded as a single-file operation. This prevents the S3 copy of `metadata.md` from lagging by one run — without the split, the metadata in S3 would never reflect the publish that just produced it.

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

After the presign step resolves a `--share` target to a concrete file, also create a gist for any resolved target whose extension is `.md` or `.html` unless `--no-gist` is passed. **The gist trigger is the resolved file's extension, not the literal flag value** — so `--share markdown`, `--share html`, `--share markdown/foo.md`, and `--share html/foo.html` all produce a gist for their respective file types. An explicit filename pointing to a `.png` or `.svg` never produces a gist.

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
- Images: never create a gist for images, including when the user passes an explicit image filename such as `--share images/<file>.png`. They receive the S3 presigned URL only. The bare keyword `--share images` is not supported — require an explicit filename for image sharing.

If `--gist-visibility public` is passed, append `--public` to the `gh gist create` command.

If a gist for the same file has been published before (recorded in `metadata.md`), prompt before re-creating. With `--force`, update the existing gist instead of creating a duplicate:

```
gh gist edit <gist-id> --filename <gist-filename> <local-file>
```

Use the filename recorded in the gist, normally the basename of `<local-file>`, for `<gist-filename>`.

If `gh auth status` fails, do not attempt gist operations. Report what was uploaded to S3 and skip gist steps with a note.

## State Tracking

Update or append the `## Published` section in the workspace's `metadata.md`:

```markdown
## Published

- S3 archive: `s3://<bucket>/[<prefix>/]<slug>/`
- Last published: `<YYYY-MM-DD HH:MM>Z`
- Files uploaded: <count> (skipped <M> unchanged)

### Presigned share links

- `<relative/path>` — <url> (expires <YYYY-MM-DD HH:MM>Z)

### Gist share links

- `<relative/path>.md` — https://gist.github.com/<user>/<id>
- `<relative/path>.html` — https://gist.github.com/<user>/<id>
```

On each run, replace the existing `## Published` section. **Section boundaries:** the section starts at the literal line `## Published` and ends at the line immediately before the next `## ` heading or end-of-file, whichever comes first. Preserve everything before the section start line and after the section end line. If the workspace has no `metadata.md`, create one with only this section plus a minimal header (`# <slug> Metadata`).

Do not include `--force`d secret-scan match content in metadata. Note only that the scan was overridden.

### Redacted S3 Copy

The local `metadata.md` keeps the full presigned URLs and gist URLs — both are bearer tokens, so the *local file* is authoritative for sharing.

The copy uploaded to S3 must redact every bearer token in the `## Published` section before upload:

- replace each presigned URL value with the literal string `<presigned URL — see local metadata>`
- replace each gist URL value with `<gist URL — see local metadata>` (secret gists are also bearer-token-style; anyone with the URL can read)

The S3 copy still records that links were generated, when, and which files they cover; consumers of the S3 archive can re-run `publish-artifact <slug> --share ...` to mint fresh links. **Never upload the unredacted form.** Redaction happens in memory; do not write the redacted variant back to the local file.

## Workflow

1. Receive `<slug>` and optional flags.
2. Resolve the workspace path; verify it exists and looks like a workspace.
3. Read `ARTIFACTS_S3_BUCKET` and `ARTIFACTS_S3_REGION`. Stop if either is missing. Export `AWS_REGION="$ARTIFACTS_S3_REGION"` for the rest of the workflow.
4. Run the pre-publish secret scan. Stop on findings unless `--force`.
5. If `--dry-run`, list what would be uploaded and shared, then stop without writing remote or local state.
6. **Upload phase 1:** walk the workspace; HEAD each S3 key; upload changed and missing files. Exclude `metadata.md` from this phase.
7. For each `--share` target, resolve the file, generate an S3 presigned URL, and (for any resolved `.md` or `.html` file, unless `--no-gist`) create or update a gist.
8. Rewrite the `## Published` section of the local `metadata.md` with this run's results.
9. **Upload phase 2:** upload the redacted variant of `metadata.md` to S3 (presigned and gist URLs replaced with placeholders per the State Tracking section).
10. Report the outcome in the format below.

## Validation

Before reporting complete, verify:

- every file in the upload set returned a successful `aws` exit code
- if `--share` was requested, every requested type produced at least one URL
- `metadata.md` `## Published` section is present in the local file and updated for this run
- the version of `metadata.md` uploaded to S3 contains placeholders (not real URLs) in the Published section
- every `aws` call ran with `AWS_REGION` matching `ARTIFACTS_S3_REGION`
- the bucket's public-access state was not modified (this skill never calls those APIs)
- no AWS credentials appear anywhere in the report, in `metadata.md`, or in any uploaded file

## Output

Report in this shape, using the actual workspace-relative paths for every requested share target. Omit a subsection only when it has no applicable rows; when a requested target does not produce a gist, include a short reason instead of pretending it was shared as a gist.

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
- images/<file>.png — not created (images are S3-only)

Metadata updated: ~/agent-artifacts/<slug>/metadata.md
```

If `gh auth status` fails, keep the S3 share links and report `Gists: skipped (gh auth status failed)`.

On a blocked secret scan:

```text
Secret scan: <N> matches in <files>
Publish blocked. Use --force to override.
```

On a dry run, prefix every line with `[dry-run]` and write no remote or local state. Example:

```text
[dry-run] Workspace: ~/agent-artifacts/<slug>/
[dry-run] S3 archive: s3://<bucket>/[<prefix>/]<slug>/ (region: <ARTIFACTS_S3_REGION>)
[dry-run] Would upload (changed or new):
[dry-run]   markdown/<file>.md (12 KB)
[dry-run]   html/<file>.html (45 KB)
[dry-run]   images/<file>.png (220 KB)
[dry-run] Would skip (unchanged): 2 files
[dry-run] Would resolve --share markdown to: markdown/<file>.md (would create gist)
[dry-run] Would resolve --share html to: html/<file>.html (would create gist)
[dry-run] metadata.md would be uploaded after state tracking (redacted variant)
[dry-run] No state will be written. No URLs minted.
```

## Cautions

- **Never flip the bucket public.** The skill must not call `put-bucket-acl`, `put-bucket-policy`, or `put-public-access-block`. Share via presigned URLs only.
- **Never embed AWS credentials in metadata, output, or gists.** They live in the user's environment; the skill never echoes them.
- **Do not auto-publish.** This skill runs only on explicit invocation. Other artifact skills do not invoke it.
- **Treat the secret scan as a safety net, not a guarantee.** It catches common token patterns; it will miss novel or custom secrets. Users remain responsible for what they publish.
- **Presigned URLs are bearer tokens.** Anyone with the URL can read until the TTL expires. Treat them as sensitive; do not paste them in public channels.
- **Gists retain full edit history.** Even a secret gist's full revision history is fetchable by anyone with the gist ID. Editing does not erase prior content. Delete the gist if a previous revision contained anything sensitive.
- **Never upload unredacted bearer tokens to S3.** The local `metadata.md` is the only place full presigned and gist URLs live; the S3 copy must always carry placeholders. Anyone with bucket read access would otherwise inherit usable share links.
- **Out of scope:** Google Drive, ClickUp, native-format conversion (Docs/Blocks), filesystem watchers, automatic syncing.
