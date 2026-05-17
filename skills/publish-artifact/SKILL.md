---
name: publish-artifact
description: Publish a ~/agent-artifacts/<slug>/ workspace to a private S3 archive and optionally produce shareable presigned URLs or secret GitHub gists for Markdown and HTML. Explicit command only — never auto-triggered, never flips the S3 bucket public.
---

# publish-artifact

## Purpose

Publish an existing artifact workspace from `~/agent-artifacts/<slug>/` to a private S3 archive. When requested with `--share`, generate temporary S3 presigned URLs and, for Markdown/HTML targets, secret GitHub gists.

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
- Do not use this for Google Drive, ClickUp, Google Docs, or native-format conversion.
- Do not use this for automatic syncing or filesystem watching.
- Do not use this unless the user explicitly asks to publish/share/archive an artifact workspace.

## Inputs

Required:

- `<slug>` — workspace directory name under `~/agent-artifacts/`, or an absolute/`~` path to a workspace directory.

Flags:

- `--share <target>` — repeatable. Valid values: `markdown`, `html`, or a workspace-relative filename such as `markdown/report.md`, `html/report.html`, or `images/summary.png`.
- `--ttl <duration>` — presigned URL TTL. Grammar: `<integer><unit>` where unit is `s`, `m`, `h`, or `d`. Default: `7d`. Maximum: `7d`.
- `--force` — override secret-scan blocks and update existing recorded gists instead of creating duplicates.
- `--dry-run` — show planned work without local or remote writes.
- `--gist-visibility <secret|public>` — default: `secret`. `public` appends `--public` when creating new gists.
- `--no-gist` — generate only S3 presigned URLs for share targets.
- `--workspace-root <path>` — advanced/test flag that overrides the default `~/agent-artifacts` root for slug resolution.

Invalid:

- `--share images` is not supported. Image sharing requires an explicit filename, for example `--share images/summary.png`.

## Configuration

Required environment:

```sh
ARTIFACTS_S3_BUCKET=
ARTIFACTS_S3_REGION=
```

Optional:

```sh
ARTIFACTS_S3_PREFIX=
```

The script reads shell environment first. Missing values may be filled from ignored local env files:

1. `<canonical skillDir>/.env`
2. `<canonical repoRoot>/.env.local`

Commit only `.env.example`. Never commit real `.env` values.

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

On each publish, the script replaces the `## Published` section. The section starts at the literal line `## Published` and ends before the next `## ` heading or end-of-file.

The S3 copy of `metadata.md` is redacted in memory before upload:

- presigned URLs become `<presigned URL — see local metadata>`
- gist URLs become `<gist URL — see local metadata>`

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

## Cautions

- Presigned URLs are bearer tokens. Treat them as sensitive until they expire.
- Secret gists are unlisted, not access-controlled. Anyone with the URL can read them.
- Gists retain edit history. Delete a gist if an old revision contained sensitive data.
- The secret scan is a safety net, not a guarantee. Users remain responsible for what they publish.
