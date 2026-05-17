# publish-artifact CLI-Free S3 Design

## Goal

Remove the `publish-artifact` script's runtime dependency on the external `aws` CLI while keeping the skill portable and dependency-free inside `agent-skills`.

The script should publish artifact workspaces to private S3, compare remote object state, upload changed files, and generate presigned URLs using Node built-ins only. This avoids Homebrew, AWS CLI, Python, and package-manager failures while matching the way local application code can already use AWS without a global CLI.

## Non-Goals

- Do not add `node_modules/` to `agent-skills`.
- Do not add a `package.json`, lockfile, or npm install step just for this skill.
- Do not vendor the AWS SDK into the repo.
- Do not implement the full AWS SDK credential chain.
- Do not support AWS SSO, process credentials, MFA prompting, or automatic credential refresh in this task.
- Do not change gist behavior beyond keeping the current `gh` CLI integration.
- Do not make buckets public or manage bucket ACLs, policies, or public access blocks.

## Recommendation

Do not allow `node_modules` in `agent-skills` for this feature.

This repo is a portable skills repository, not an application workspace. A skill script may be invoked through symlinks from `~/.codex/skills`, `~/.agents/skills`, or other agent runtimes. Adding package dependencies creates questions about install location, lockfile ownership, symlink resolution, offline behavior, and stale dependency state. For a narrow S3 workflow, that complexity is larger than the code it replaces.

The recommended approach is a small internal S3 client implemented with Node's built-in `https`, `crypto`, `fs`, and `url` modules. It should implement only the S3 operations this script needs:

- `HeadObject`
- `PutObject`
- presigned `GET` URL generation

## Alternatives Considered

### Option 1: Keep using AWS CLI

This preserves the current implementation shape but keeps the external binary as a hard runtime dependency. It also ties the script to local package-manager health. On this machine, the Homebrew AWS CLI installed but failed before startup due to a Python `pyexpat`/`libexpat` mismatch, which is unrelated to S3 or credentials.

Verdict: reject.

### Option 2: Use AWS SDK packages

This is the normal application-code path and would use `@aws-sdk/client-s3` plus `@aws-sdk/s3-request-presigner`. It is robust in an app that already owns dependencies, such as a NestJS service.

In this repo, it would require adding dependency management where none currently exists. Installing dependencies beside a skill also makes symlinked invocation and future skill distribution less predictable.

Verdict: reject for `agent-skills`.

### Option 3: Implement the required S3 calls with Node built-ins

This removes the CLI dependency without adding npm dependencies. The implementation is narrower than the AWS SDK, but the script's S3 surface is small and testable.

Verdict: accept.

## Configuration And Credentials

The script keeps the existing env-file behavior:

1. Shell environment values win.
2. `<canonical skillDir>/.env` fills missing values.
3. `<canonical repoRoot>/.env.local` fills remaining missing values.
4. Compatibility aliases are normalized after env loading.

Required:

```sh
ARTIFACTS_S3_BUCKET=
ARTIFACTS_S3_REGION=
```

Optional:

```sh
ARTIFACTS_S3_PREFIX=
AWS_PROFILE=artifacts
AWS_SESSION_TOKEN=
```

Credential sources supported in this task:

1. `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and optional `AWS_SESSION_TOKEN` from the loaded environment.
2. Compatibility aliases `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`, mapped into the AWS env names only when canonical values are missing.
3. A static named profile from `~/.aws/credentials` when `AWS_PROFILE` is set, or `default` when profile files exist and no profile is set.

The profile parser only needs INI-style static keys:

```ini
[artifacts]
aws_access_key_id = ...
aws_secret_access_key = ...
aws_session_token = ...
```

`~/.aws/config`, SSO sections, `credential_process`, role assumption, and MFA are excluded from this task. If a user needs those flows, they should use exported temporary environment credentials before running the script.

Do not write credentials to metadata, output, S3, gists, or committed docs. Tests must keep using fake credential values.

## Internal S3 Client

Create a small internal boundary inside `publish-artifact.js`, or split into `scripts/s3-client.js` only if the main file becomes hard to read. The client should expose:

```js
async function headObject({ bucket, region, key, credentials, httpRequest })
async function putObject({ bucket, region, key, body, contentType, metadata, credentials, httpRequest })
function presignGetObject({ bucket, region, key, credentials, expiresIn, now })
```

`httpRequest` is injectable for tests. Production uses `https.request`.

### Endpoint Shape

Use virtual-hosted S3 endpoints for normal DNS-compatible bucket names:

```text
https://<bucket>.s3.<region>.amazonaws.com/<encoded-key>
```

If the bucket name contains a dot, use path-style addressing to avoid TLS wildcard certificate mismatch:

```text
https://s3.<region>.amazonaws.com/<bucket>/<encoded-key>
```

Keys must be URL-encoded segment by segment so slashes remain path separators and spaces or reserved characters are encoded consistently.

### Signing

Implement AWS Signature Version 4 for service `s3`:

- canonical request
- canonical headers
- signed headers
- SHA-256 payload hash for `PUT`
- empty payload hash for `HEAD`
- query-string signing for presigned `GET`
- `X-Amz-Security-Token` when session credentials are present

Presigned URLs continue to enforce the existing TTL cap of seven days.

## Workflow Changes

The high-level workflow stays the same:

1. Parse arguments.
2. Load env files and normalize aliases.
3. Resolve credentials.
4. Resolve and validate the workspace.
5. Build upload set.
6. Run secret scan.
7. Dry-run exits before credential resolution that would read external files or perform network work.
8. For each uploadable file:
   - call internal `headObject`
   - skip when `ContentLength` and `x-amz-meta-content-md5` match local state
   - otherwise call internal `putObject`
9. Generate presigned URLs with internal signing.
10. Keep existing `gh` CLI calls for gist creation/update.
11. Rewrite local metadata.
12. Upload redacted metadata with internal `putObject`.
13. Print final output.

No AWS subprocess should be invoked after this change. `validateAttemptedCommands` remains useful for the `gh` path and for defense in depth, but AWS command validation becomes obsolete or test-only.

## Error Handling

Map S3 responses into existing user-facing errors:

- `HEAD` 404 or 403 during comparison means "upload needed"; do not fail the publish at this stage.
- Any non-2xx `PUT` response fails with `Upload failed for <relativePath>`.
- Presign generation errors fail with `Presign failed for <relativePath>`.
- Missing credentials fail before any upload with a message naming the missing credential source, not the credential value.

Do not print AWS response bodies if they could include signed request details. Include status code, S3 error code when parseable, and workspace-relative file.

## Testing

Keep using `node --test`.

Add tests before implementation for:

- no `aws` command is spawned for upload, head, metadata upload, or presign paths
- `headObject` sends a signed `HEAD` request and parses `ContentLength` and `x-amz-meta-content-md5`
- `putObject` sends metadata, content type, payload hash, and body
- presigned URLs include SigV4 query parameters and cap TTL at seven days
- session tokens are included in signed requests and presigned URLs
- static credentials load from environment aliases
- static credentials load from `~/.aws/credentials` with `AWS_PROFILE`
- dry-run does not resolve credentials or touch profile files
- upload failure still reports the workspace-relative filename
- final output and metadata do not contain credential values

Existing tests around workspace resolution, secret scanning, metadata redaction, gist command shape, and dry-run output should remain.

## Documentation Updates

Update `skills/publish-artifact/SKILL.md` to remove the AWS CLI requirement and replace it with:

- Node built-ins handle S3 operations directly.
- AWS credentials may come from loaded env values or static shared credentials profiles.
- SSO and automatic role assumption are not implemented by this skill; use exported temporary credentials for those flows.
- `gh` remains required only when gist sharing is enabled.

Update `.env.example` to keep repo-local values non-secret:

```sh
ARTIFACTS_S3_BUCKET=
ARTIFACTS_S3_REGION=
ARTIFACTS_S3_PREFIX=
AWS_PROFILE=artifacts
```

## Migration Notes

The broken Homebrew AWS CLI can remain installed or be removed separately; the script should no longer depend on it.

The downloaded AWS CLI package files in `/private/tmp` are not part of the repo and are not needed after the script is changed.

Users with working application-level AWS credentials can reuse the same env values for this script, but they should still rotate/revoke any key that was pasted into chat.

## Acceptance Criteria

- The publish script performs S3 head, upload, and presign without spawning `aws`.
- No npm dependencies, `package.json`, lockfile, or `node_modules` are added.
- Existing safety constraints remain: private bucket only, no ACL or policy changes, redacted remote metadata, local full metadata.
- Tests pass with mocked HTTP and no live AWS access.
- Dry-run remains side-effect free.
- Documentation no longer instructs users to install AWS CLI for S3 operations.
