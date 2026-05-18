---
name: artifact-workbench
description: Preview ~/agent-artifacts workspaces or single HTML artifacts through a read-only localhost Node server for variant comparison, browser QA, and pre-publish inspection.
---

# artifact-workbench

## Purpose

Serve an existing artifact workspace or a single HTML file through a local, read-only browser workbench.

This skill is preview tooling only. It must not create artifacts, publish artifacts, write metadata, upload files, expose a remote server, or weaken the single-file rule for generated HTML.

## When To Use

- The user asks to preview an artifact workspace locally.
- The user asks to serve an artifact, HTML artifact, or generated HTML locally.
- The user wants to compare multiple HTML variants or UI design choices.
- The user wants browser QA or screenshots from a stable localhost URL.
- The user wants to inspect an artifact workspace before running `publish-artifact`.

## When Not To Use

- Do not use this to generate Markdown, HTML, or images.
- Do not use this to publish, share, archive, or upload artifacts.
- Do not use this as proof that HTML is self-contained. Run `html-artifact` validation or direct file-open checks for that.
- Do not bind to a public interface or expose workspaces beyond localhost.

## Command

```bash
node <this-skill-dir>/scripts/serve-artifact-workbench.js <workspace-or-html-file> [--port <n>] [--open]
```

Examples:

```bash
node skills/artifact-workbench/scripts/serve-artifact-workbench.js my-slug
node skills/artifact-workbench/scripts/serve-artifact-workbench.js ~/agent-artifacts/my-slug --open
node skills/artifact-workbench/scripts/serve-artifact-workbench.js ~/agent-artifacts/my-slug/html/variant-a.html --open
```

## Behavior

Workspace mode:

- resolves slugs under `~/agent-artifacts/<slug>/`
- accepts absolute or `~` paths that still resolve under `~/agent-artifacts/`
- renders a runtime index for present `html/`, `markdown/`, `images/`, `assets/`, `metadata.md`, HTML checks, and the default publish upload set
- reuses `publish-artifact`'s shared workspace helper for default upload-set listing
- shows isolated preview links for HTML and secondary raw-file links

Single HTML file mode:

- accepts an explicit `.html` file
- may point outside `~/agent-artifacts/`
- opens that file directly
- does not render a workspace index
- serves asset requests from the file's parent directory by request

## Safety

- Bind to `127.0.0.1`.
- Use `server.listen(0, '127.0.0.1')` when no port is provided.
- Send `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.
- Reject path traversal and symlink escapes.
- Serve only `markdown/`, `html/`, `images/`, `assets/`, and `metadata.md` in workspace mode.
- Do not write files, update metadata, watch files, publish, create gists, upload files, or call external APIs.
- Label `metadata.md` as local-only operational metadata because it may contain destination IDs, presigned URLs, gist URLs, or internal references.

## HTML Checks

Workspace HTML previews must not mask non-self-contained files. The workbench should:

- serve validation previews through `/preview/html/<file>`
- return `404` for other `/preview/*` paths so cross-folder relative references fail
- warn on remote URLs, absolute workspace paths, and relative asset references in HTML
- allow `data:` URLs and hash-only links

## Validation

Before reporting complete:

- run `node --test skills/artifact-workbench/scripts/serve-artifact-workbench.test.js`
- run `node skills/artifact-workbench/scripts/serve-artifact-workbench.js <slug>` against a real or temporary workspace when a manual smoke check is useful

## Output

Report the local URL and mode:

```text
Artifact workbench
Workspace: ~/agent-artifacts/my-slug
URL: http://127.0.0.1:49152/
Mode: read-only local preview
```
