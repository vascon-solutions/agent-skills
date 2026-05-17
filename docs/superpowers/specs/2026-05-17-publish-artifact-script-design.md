# publish-artifact Script-Backed Skill Design

## Goal

Convert `publish-artifact` from a prose-only operational skill into a script-backed skill. The skill remains the policy and usage guide; the script owns the deterministic workflow for publishing `~/agent-artifacts/<slug>/` workspaces to private S3 and optionally generating share links.

The change should reduce agent interpretation errors around AWS metadata fields, redacted metadata upload, gist update syntax, dry-run behavior, and secret scanning.

## Non-Goals

- Do not make the S3 bucket public or manage bucket policies.
- Do not store AWS or GitHub credentials in this repository.
- Do not create artifacts; this only publishes workspaces created by other artifact skills.
- Do not add Google Drive, ClickUp, native document conversion, filesystem watching, or automatic syncing.
- Do not require live AWS or GitHub access in tests.

## Proposed Structure

```text
skills/publish-artifact/
├── SKILL.md
├── .env.example
└── scripts/
    └── publish-artifact.js
```

`SKILL.md` keeps the human and agent contract: when to use the skill, required inputs, safety cautions, credential policy, and the instruction to run the script. It should stop duplicating low-level implementation details that the script enforces.

`publish-artifact.js` implements the workflow using the same CommonJS `.js` style as the existing artifact helpers (`skills/html-artifact/scripts/render-html-artifact.js` and `skills/image-artifact/scripts/image-artifact-helper.js`). JavaScript is preferred over shell because this workflow needs argument parsing, file walking, regex scanning, metadata section replacement, JSON parsing from AWS CLI output, in-memory redaction, and subprocess handling. A single Node script is still portable in this repo and easier to test than a shell script of equivalent complexity.

`.env.example` documents non-secret configuration only:

```sh
ARTIFACTS_S3_BUCKET=
ARTIFACTS_S3_REGION=
ARTIFACTS_S3_PREFIX=
```

The real `.env` file is not committed.

## Configuration And Secrets

The script reads configuration from process environment and optionally from local ignored env files. Shell environment values have highest priority; env files only fill variables that are not already set.

The script may be invoked through symlinked skill directories such as `~/.codex/skills/publish-artifact/scripts/publish-artifact.js`. To keep env discovery deterministic, it must resolve the canonical script directory with `fs.realpathSync(__dirname)` before deriving paths:

```text
scriptDir = realpath(dirname of running script)
skillDir = parent of scriptDir
repoRoot = parent of parent of skillDir
```

Supported env file locations, in load order:

1. `<canonical skillDir>/.env`
2. `<canonical repoRoot>/.env.local`

The script must not print loaded secret values. The only expected publish configuration values are bucket, region, and prefix. AWS credentials remain in the standard AWS credential chain: environment variables outside the repo, AWS profiles, SSO, or instance/container credentials. GitHub credentials remain managed by `gh auth login`.

The repo should ignore:

```gitignore
.env
.env.local
*.env.local
skills/publish-artifact/.env
```

If ignore rules already exist elsewhere, update only the smallest relevant file.

## Script Inputs

Required:

- `<slug>`: workspace slug under `~/agent-artifacts/`, or an absolute or `~` path.

Flags:

- `--share <target>`: repeatable. Supports `markdown`, `html`, or an explicit workspace-relative file path.
- `--ttl <duration>`: `<integer><unit>` with units `s`, `m`, `h`, `d`; default `7d`; max `604800` seconds.
- `--force`: override secret-scan block and update existing gists instead of creating duplicates.
- `--dry-run`: compute and report actions without changing local or remote state.
- `--gist-visibility <secret|public>`: default `secret`.
- `--no-gist`: generate S3 presigned URLs only.

Advanced and testing flag:

- `--workspace-root <path>`: override the default `~/agent-artifacts` root. This is mainly for tests and unusual local layouts; normal users should pass a slug or absolute workspace path.

Invalid share targets:

- Reject bare `--share images`. Image sharing requires an explicit workspace-relative filename such as `--share images/summary.png`.

## Workflow

1. Parse arguments and validate incompatible or invalid flags.
2. Load optional env files, then validate `ARTIFACTS_S3_BUCKET` and `ARTIFACTS_S3_REGION`.
3. Set `AWS_REGION` to `ARTIFACTS_S3_REGION` for all AWS subprocesses.
4. Resolve and validate the workspace.
5. Build the upload set, excluding hidden files, `node_modules`, `dist`, and `metadata.md` for phase 1.
6. Run the secret scan against uploadable non-image files. Block unless `--force`.
7. In dry-run mode, print the planned uploads, skipped files if discoverable, share target resolutions, gist actions, and metadata behavior; then exit without local or remote writes.
8. Upload phase 1: for each uploadable file, compare local size and MD5 against S3 `ContentLength` and `Metadata["content-md5"]` from `aws s3api head-object`.
9. Resolve `--share` targets, generate S3 presigned URLs, and create or update gists for resolved `.md` and `.html` files unless `--no-gist`.
10. Rewrite the local `metadata.md` `## Published` section with full local URLs.
11. Upload phase 2: upload an in-memory redacted copy of `metadata.md` to S3. Redact presigned URLs and gist URLs before upload.
12. Print the final report.

## Workspace Validation

Workspace resolution follows the current skill contract:

1. If `<slug>` is an absolute path or starts with `~`, expand and use it directly.
2. Otherwise treat `<slug>` as a directory name under `~/agent-artifacts/`, or under `--workspace-root` when that advanced flag is provided.
3. If the resolved path is not a directory, stop and report the resolved path.
4. If the directory has no `metadata.md` and contains none of `markdown/`, `html/`, `images/`, or `assets/`, stop and ask for confirmation; this may not be an artifact workspace.

## AWS Behavior

Each upload includes user metadata:

```text
content-md5=<local-md5>
```

The script compares this value through the AWS CLI `head-object` JSON output at `Metadata["content-md5"]`. It must not compare local MD5 to S3 `ETag`.

Uploads must not pass ACL flags. The script must never call:

- `put-bucket-acl`
- `put-bucket-policy`
- `put-public-access-block`

## Gist Behavior

For new Markdown and HTML share targets, the script uses:

```sh
gh gist create <local-file> --desc "<slug>: <type>"
```

If `--gist-visibility public` is passed, append `--public` to `gh gist create`. The flag only affects newly created gists; updating an existing gist preserves that gist's current visibility.

For existing gists recorded in metadata:

- Without `--force`, prompt before creating a new gist.
- With `--force`, update the existing gist:

```sh
gh gist edit <gist-id> --filename <gist-filename> <local-file>
```

Images and other non-Markdown/HTML files never create gists. They get S3 presigned URLs only.

If `gh auth status` fails, S3 upload and presigned links still proceed, while gist actions are skipped and reported.

## Metadata Handling

The local `metadata.md` is authoritative for full share URLs. The script replaces the `## Published` section on every publish. The section starts at the literal line `## Published` and ends before the next `## ` heading or end-of-file. If `metadata.md` does not exist, create it with a minimal `# <slug> Metadata` heading followed by the `## Published` section.

The S3 copy of `metadata.md` is redacted in memory before upload:

- presigned URLs become `<presigned URL — see local metadata>`
- gist URLs become `<gist URL — see local metadata>`

The redacted copy must not be written back to the local workspace.

## Secret Scan

The script scans all uploadable non-image files for the existing `SKILL.md` secret patterns, including:

- AWS access key IDs and `aws_secret_access_key` assignments
- GitHub classic, server, OAuth, user-to-server, and fine-grained PATs
- Anthropic and OpenAI style API keys
- Slack tokens
- JWTs
- private key blocks

On match, block before any upload unless `--force`. With `--force`, report filenames and pattern names, but do not write match contents to metadata.

## Runtime Validation

Before printing the final non-dry-run report, the script verifies:

- every attempted upload returned a successful `aws` exit code
- if any upload fails, execution stops immediately and reports the workspace-relative file that failed
- every requested share target produced a presigned URL
- local `metadata.md` contains a `## Published` section updated for the current run
- the in-memory `metadata.md` copy uploaded to S3 contains redaction placeholders, not real presigned or gist URLs
- every AWS subprocess receives `AWS_REGION` equal to `ARTIFACTS_S3_REGION`
- no output or metadata text contains AWS credential environment values
- the command runner did not invoke `put-bucket-acl`, `put-bucket-policy`, `put-public-access-block`, or any upload ACL flag

## Output

The script prints the same report shape currently documented by the skill, using actual workspace-relative paths. It omits empty sections. Image shares explicitly say they are S3-only. Gist auth failures are reported as:

```text
Gists: skipped (gh auth status failed)
```

Dry-run output is prefixed with `[dry-run]` on every line and mints no URLs. The script should keep this shape stable so tests can assert it:

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
[dry-run] Would resolve --share images/<file>.png to: images/<file>.png (S3 only; no gist)
[dry-run] metadata.md would be uploaded after state tracking (redacted variant)
[dry-run] No state will be written. No URLs minted.
```

## Testing

Use the built-in `node --test` runner to match the repo's zero-dependency helper-script posture. Tests should not call live AWS or GitHub. Inject a command runner into the script so tests can mock `aws` and `gh`.

Minimum test cases:

- TTL parsing and max cap.
- Workspace resolution from slug, absolute path, and `~` path.
- Symlinked invocation resolves env files through the canonical script path.
- Upload set filtering.
- Secret scan blocks and `--force` override reporting.
- `Metadata["content-md5"]` comparison causes skip/upload correctly.
- `metadata.md` section replacement preserves surrounding sections.
- S3 redaction removes URLs while local metadata keeps full URLs.
- Share target resolution for `markdown`, `html`, explicit Markdown, explicit HTML, and explicit image.
- Bare `--share images` is rejected.
- Gist create/update/skip decisions.
- `--gist-visibility public` appends `--public` for newly created gists.
- Missing `metadata.md` is created with a minimal heading and `## Published`.
- Runtime validation stops on upload failure and reports the failed file.
- Dry-run output matches the documented shape and performs no local or remote writes.

## Migration

1. Add the script and `.env.example`.
2. Add ignore rules for local env files.
3. Update `SKILL.md` to delegate execution to the script while keeping policy and safety constraints.
4. Add tests for deterministic behavior.
5. Run tests and a dry-run against a temporary fixture workspace.

## Acceptance Criteria

- Agents can publish by following one primary instruction: run the script with the requested flags.
- The script refuses to run without bucket and region configuration.
- No real credentials are committed or documented as committed.
- Secret scanning, two-phase metadata upload, S3 checksum comparison, gist behavior, dry-run behavior, and output formatting are enforced by executable code.
- Tests cover the behavior without requiring AWS or GitHub network access.
