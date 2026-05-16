# publish-artifact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `publish-artifact` skill that publishes a `~/agent-artifacts/<slug>/` workspace to a private S3 archive and optionally produces shareable presigned URLs or secret GitHub gists for the Markdown and HTML contents. Explicit-command only — no auto-trigger from other skills.

**Architecture:** One new skill directory (`skills/publish-artifact/`) with a single `SKILL.md`. No runtime helpers; the skill describes behaviors and lets the agent call `aws` and `gh` CLIs directly, matching the prose-only pattern of `repo-design-context`, `markdown-artifact`, and `html-artifact`. The link script and README are updated to register the new skill.

**Tech Stack:** Markdown prose only — no runtime code. All "implementation" is writing SKILL.md content and wiring it into `bin/link-skills.sh` and `README.md`. Verification uses shell commands (grep, ls, symlink checks).

**Spec:** Brainstormed inline; design captured in this plan's task content.

---

### Task 1: Create `skills/publish-artifact/SKILL.md`

**Files:**
- Create: `skills/publish-artifact/SKILL.md`

- [ ] **Step 1: Create the skill directory**

```bash
mkdir -p /Users/dee/agent-skills/skills/publish-artifact
```

Expected: no output, directory exists.

- [ ] **Step 2: Write `SKILL.md` with full content**

Write the file at `/Users/dee/agent-skills/skills/publish-artifact/SKILL.md` with this exact content:

````markdown
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
````

- [ ] **Step 3: Verify the file exists and has expected sections**

```bash
ls -la /Users/dee/agent-skills/skills/publish-artifact/SKILL.md
grep -c "^## " /Users/dee/agent-skills/skills/publish-artifact/SKILL.md
```

Expected: file exists; section count is 13 or more (Purpose, When To Use, When Not To Use, Inputs, Configuration, Workspace Resolution, Pre-Publish Secret Scan, S3 Upload, Presigned URLs, Gist Publishing, State Tracking, Workflow, Validation, Output, Cautions).

- [ ] **Step 4: Commit**

```bash
git -C /Users/dee/agent-skills add skills/publish-artifact/SKILL.md
git -C /Users/dee/agent-skills commit -m "feat: add publish-artifact skill"
```

---

### Task 2: Register `publish-artifact` in `bin/link-skills.sh`

**Files:**
- Modify: `bin/link-skills.sh`

- [ ] **Step 1: Add `publish-artifact` to `SKILL_NAMES`**

In `/Users/dee/agent-skills/bin/link-skills.sh`, find the `SKILL_NAMES` variable. Add `publish-artifact` as a new line after `repo-design-context`:

```
repo-design-context
publish-artifact
```

The full `SKILL_NAMES` block becomes:

```sh
SKILL_NAMES="
prepare-frontend-handoff
prepare-qa-handoff
qa-triage-and-fix
publish-branch
repo-docs-audit
rewrite-docs-from-code
repair-agent-files
review-doc-changes
review-task-docs
repo-skill-scan
roadmap-todo
scaffold-repo-skill
task-doc
html-artifact
markdown-artifact
image-artifact
repo-design-context
publish-artifact
"
```

- [ ] **Step 2: Verify the entry is present**

```bash
grep "^publish-artifact$" /Users/dee/agent-skills/bin/link-skills.sh
```

Expected: `publish-artifact`

- [ ] **Step 3: Commit**

```bash
git -C /Users/dee/agent-skills add bin/link-skills.sh
git -C /Users/dee/agent-skills commit -m "feat: register publish-artifact in link-skills.sh"
```

---

### Task 3: Update `README.md`

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add `publish-artifact/` to the directory tree**

In `/Users/dee/agent-skills/README.md`, find the directory tree block. Add `├── publish-artifact/` after `├── repo-design-context/`:

```
    ├── repo-design-context/
    ├── publish-artifact/
    └── task-doc/
```

- [ ] **Step 2: Add a row to the Skills table**

Add this row to the skills table after the `repo-design-context` row:

```markdown
| `publish-artifact`         | Publish a `~/agent-artifacts/<slug>/` workspace to a private S3 archive; optionally produce presigned URLs and secret GitHub gists for Markdown and HTML. Explicit command only |
```

- [ ] **Step 3: Add a usage scenario**

Add this new section in the usage section of the README. Place it after the `### Applying repo design context to artifacts` section (or, if that section is absent, after `### Creating Markdown artifact workspaces`):

```markdown
### Publishing artifact workspaces externally

1. `publish-artifact` — push a `~/agent-artifacts/<slug>/` workspace to a private S3 archive. Use `--share markdown` or `--share html` to also generate a secret GitHub gist and an S3 presigned URL you can send to someone. Bucket access is never modified; sharing is link-based with a TTL.
```

- [ ] **Step 4: Verify the README mentions publish-artifact in all three places**

```bash
grep -c "publish-artifact" /Users/dee/agent-skills/README.md
```

Expected: 3 or more.

- [ ] **Step 5: Commit**

```bash
git -C /Users/dee/agent-skills add README.md
git -C /Users/dee/agent-skills commit -m "docs: add publish-artifact to README"
```

---

### Task 4: Run link script and verify discoverability

**Files:**
- Modify: none (operates on the symlink targets, not the repo)

- [ ] **Step 1: Run the link script**

```bash
/Users/dee/agent-skills/bin/link-skills.sh
```

Expected output mentions `publish-artifact` being linked into each target directory. No errors.

- [ ] **Step 2: Verify the symlink resolves in each target directory**

```bash
for dir in \
  "$HOME/.codex/skills/publish-artifact" \
  "$HOME/.claude/skills/publish-artifact" \
  "$HOME/.cursor/skills/publish-artifact" \
  "$HOME/.agents/skills/publish-artifact"; do
  if [ -L "$dir" ] || [ -d "$dir" ]; then
    echo "OK: $dir -> $(readlink "$dir" 2>/dev/null || echo "(directory)")"
  else
    echo "MISSING: $dir"
  fi
done
```

Expected: every line begins with `OK:` and the symlink targets `/Users/dee/agent-skills/skills/publish-artifact`. `MISSING:` lines are acceptable only for target tools the user has not installed (e.g., Cursor).

- [ ] **Step 3: Verify the SKILL.md is readable through the symlink**

```bash
head -n 5 "$HOME/.claude/skills/publish-artifact/SKILL.md"
```

Expected: first five lines of the new SKILL.md, including the `name: publish-artifact` frontmatter.

- [ ] **Step 4: No commit for this task** — it operates on user home directories, not the repo.

---

### Task 5: Final spec-coverage check

**Files:**
- Read: `skills/publish-artifact/SKILL.md`

- [ ] **Step 1: Verify all brainstormed design points are present in the SKILL.md**

Run each grep and confirm a match exists:

```bash
SKILL=/Users/dee/agent-skills/skills/publish-artifact/SKILL.md

grep -q "ARTIFACTS_S3_BUCKET"        "$SKILL" && echo "OK: bucket env"        || echo "MISSING: bucket env"
grep -q "ARTIFACTS_S3_REGION"        "$SKILL" && echo "OK: region env"        || echo "MISSING: region env"
grep -q "ARTIFACTS_S3_PREFIX"        "$SKILL" && echo "OK: prefix env"        || echo "MISSING: prefix env"
grep -q "\-\-share"                  "$SKILL" && echo "OK: --share flag"      || echo "MISSING: --share flag"
grep -q "\-\-ttl"                    "$SKILL" && echo "OK: --ttl flag"        || echo "MISSING: --ttl flag"
grep -q "\-\-force"                  "$SKILL" && echo "OK: --force flag"      || echo "MISSING: --force flag"
grep -q "\-\-dry-run"                "$SKILL" && echo "OK: --dry-run flag"    || echo "MISSING: --dry-run flag"
grep -q "AKIA"                       "$SKILL" && echo "OK: AWS key pattern"   || echo "MISSING: AWS key pattern"
grep -q "ghp_"                       "$SKILL" && echo "OK: GitHub token"      || echo "MISSING: GitHub token"
grep -q "put-bucket-acl"             "$SKILL" && echo "OK: never-public note" || echo "MISSING: never-public note"
grep -q "presign"                    "$SKILL" && echo "OK: presign behavior"  || echo "MISSING: presign behavior"
grep -q "gh gist create"             "$SKILL" && echo "OK: gist create"       || echo "MISSING: gist create"
grep -q "Published"                  "$SKILL" && echo "OK: metadata section"  || echo "MISSING: metadata section"
grep -q "604800"                     "$SKILL" && echo "OK: TTL cap"           || echo "MISSING: TTL cap"
grep -q "Out of scope"               "$SKILL" && echo "OK: out-of-scope list" || echo "MISSING: out-of-scope list"
```

Expected: every line starts with `OK:`. Any `MISSING:` line means re-open Task 1 and add the missing content.

- [ ] **Step 2: Verify there are no placeholder strings**

```bash
grep -nE "TBD|TODO|FIXME|\\?\\?" /Users/dee/agent-skills/skills/publish-artifact/SKILL.md || echo "OK: no placeholders"
```

Expected: `OK: no placeholders`.

- [ ] **Step 3: No commit for this task** — verification only.

---

## Self-Review

After the plan was written:

**1. Spec coverage:** Every brainstormed item is covered by a task —
- new skill file: Task 1
- S3 archive layer, never-public, content-types, skip-if-unchanged, presigned: Task 1 (S3 Upload, Presigned URLs sections)
- Gist on demand, secret by default, image exclusion, gh auth dependency: Task 1 (Gist Publishing section)
- Pre-publish secret scan with --force override: Task 1 (Pre-Publish Secret Scan section)
- Env-var configuration, AWS credential chain, no key management: Task 1 (Configuration section)
- metadata.md Published section, idempotent re-publish: Task 1 (State Tracking section)
- bin/link-skills.sh wiring: Task 2
- README directory tree + table + usage scenario: Task 3
- Discoverability check: Task 4
- Coverage check itself: Task 5

**2. Placeholder scan:** No TBD/TODO/FIXME inside step content; Task 5 Step 2 explicitly grep-checks the produced SKILL.md.

**3. Type consistency:** Env var names (`ARTIFACTS_S3_BUCKET`, `ARTIFACTS_S3_REGION`, `ARTIFACTS_S3_PREFIX`) are used identically in the SKILL.md and in the verification task. Flag names (`--share`, `--ttl`, `--force`, `--dry-run`, `--gist-visibility`, `--no-gist`) are listed in the Inputs section and referenced consistently in subsequent sections.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-16-publish-artifact.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using `executing-plans`, batch execution with checkpoints.

Which approach?
