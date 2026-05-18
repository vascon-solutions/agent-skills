# Local Artifact Workbench - Design Spec

**Date:** 2026-05-18  
**Status:** Approved - ready for implementation planning  
**Source:** Brainstorming session on local serving for HTML artifacts, variants, and UI design review

---

## Purpose

Add a lightweight local server for artifact workspaces so agents and users can preview generated artifacts in a browser before publishing or sharing them.

The feature is a read-only local workbench. It does not change the artifact contract: generated HTML files must remain self-contained, offline-capable, and directly openable from disk. The server is an authoring and review convenience for comparing variants, inspecting workspace contents, running browser QA, taking screenshots, and checking the workspace before publishing.

---

## Background

Artifact workflows now commonly produce workspaces with this shape:

```text
~/agent-artifacts/<slug>/
|-- markdown/
|-- html/
|-- images/
|-- assets/
`-- metadata.md
```

`html-artifact` creates browser-ready companions and interactive artifacts. `markdown-artifact` creates source documents. `image-artifact` creates diagrams, image companions, and variant boards. `publish-artifact` later publishes the workspace to destinations such as S3, GitHub Wikis, ClickUp, Google Docs, or Google Drive.

Opening a single HTML file directly works, but it is awkward for variant-heavy artifacts and review workflows. A stable localhost URL with an artifact-aware index makes browser inspection and design comparison easier without introducing publishing side effects.

The workbench must not hide broken artifact invariants. In particular, previewing an HTML artifact from localhost must not make a non-self-contained HTML file look correct by resolving sibling workspace assets that would fail when the HTML is opened directly from disk.

---

## Design Goals

- Provide a simple local browser workbench for existing artifact workspaces.
- Support variant-heavy HTML artifacts and UI design choices.
- Let users inspect Markdown, HTML, images, assets, and metadata from one local index.
- Make pre-publish inspection easier without invoking publish behavior.
- Keep the server read-only, localhost-only, and dependency-free.
- Preserve the single-file rule for generated HTML artifacts.

---

## Non-Goals

- No remote sharing or non-local network exposure in v1.
- No auth, sessions, or write APIs.
- No metadata mutation.
- No file watching or live reload.
- No screenshot automation.
- No editable annotations, approvals, or review comments.
- No publishing, uploading, gist creation, or destination-specific side effects.

---

## Command

Create a dedicated micro-skill for the broader workspace role:

```sh
node skills/artifact-workbench/scripts/serve-artifact-workbench.js <workspace-or-html-file> [--port <n>] [--open]
```

Placement rationale:

- The behavior is useful across `markdown-artifact`, `html-artifact`, `image-artifact`, and `publish-artifact`.
- The script understands the full artifact workspace shape, not only HTML outputs.
- The script does not belong under `publish-artifact` because previewing is useful before publishing and must not imply publish behavior.
- A dedicated `artifact-workbench/SKILL.md` gives agents a stable invocation surface and avoids cross-skill references to a deep script path.

Inputs:

- Workspace path: `~/agent-artifacts/<slug>/`
- Workspace slug: `<slug>` resolves under `~/agent-artifacts/<slug>/`
- Single HTML file: serves the parent directory and opens the file directly
- Absolute, `~`, or relative paths

Flags:

- `--port <n>` binds to the requested port and fails clearly if unavailable.
- `--open` launches the local URL in the default browser.

Defaults:

- Host: `127.0.0.1`
- Port: call `server.listen(0, '127.0.0.1')` and report the assigned port when `--port` is absent.

`--open` behavior:

- macOS: `open <url>`
- Linux: `xdg-open <url>`
- Windows: `cmd /c start "" <url>`
- Unsupported platforms: print the URL and continue without failing the server.

Agent invocation surface:

- Add `skills/artifact-workbench/SKILL.md`.
- Trigger on requests such as "preview artifact workspace", "serve artifact locally", "open artifact workbench", "compare HTML variants", "inspect artifact before publishing", or "serve this HTML artifact".
- Other artifact skills should reference the `artifact-workbench` skill by name, not the script path.

---

## V1 Scope

V1 is a read-only artifact workbench with four primary use cases:

1. Compare multiple HTML variants during design.
2. Review a whole workspace before publishing.
3. Provide stable localhost URLs for browser QA and screenshots.
4. Inspect the default `publish-artifact` upload set, without publishing or writing metadata.

Workspace mode indexes:

- `html/` for generated companions, prototypes, variants, slide decks, and UI choice boards
- `markdown/` for source docs
- `images/` for image companions, variant boards, diagrams, and visual summaries
- `assets/` for local supporting files
- `metadata.md` when present

---

## Workspace Resolution

Workspace mode:

- Reuse `skills/publish-artifact/scripts/common/workspace.js` for slug/path resolution where possible.
- A slug resolves under `~/agent-artifacts/<slug>/`.
- For workspace inputs, absolute and `~` paths must still resolve under `~/agent-artifacts/` unless an explicit future flag broadens this.
- If the workspace does not exist, is not a directory, or has none of `metadata.md`, `markdown/`, `html/`, `images/`, or `assets/`, exit non-zero with a clear error.
- Missing subdirectories are allowed. The index renders only sections that exist and shows zero counts for absent sections in the startup report.

Single HTML file mode:

- The input must resolve to an existing `.html` file.
- A single explicit `.html` file may live outside `~/agent-artifacts/`.
- No workspace index is generated.
- The server opens the selected file route directly.
- Asset requests are served from the selected file's parent root by request, with traversal and symlink guardrails. This mode is a convenience preview, not a self-contained validation pass.

---

## Server Behavior

Use only Node built-ins:

- `http`
- `fs`
- `path`
- `url`
- `net`
- `child_process` for `--open`

Routes in workspace mode:

- `GET /` returns the generated workbench index.
- `GET /preview/html/<file>` serves an HTML file through an isolated preview route used by the index.
- `GET /preview/*` returns `404` for every request other than the selected HTML document, so cross-folder relative references fail loudly.
- `GET /html/<file>` serves raw HTML files for direct inspection and download links, but the index must label these as raw routes, not validation previews.
- `GET /markdown/<file>` serves Markdown as `text/markdown; charset=utf-8`.
- `GET /images/<file>` serves images with correct content type.
- `GET /assets/<file>` serves assets with conservative content types.
- `GET /metadata.md` serves metadata as plain text when present.
- Unknown or unsafe paths return `404`.

Response headers:

- `Cache-Control: no-store` on every response.
- `X-Content-Type-Options: nosniff` on every response.

Startup report:

```text
Artifact workbench
Workspace: /Users/dee/agent-artifacts/<slug>
URL: http://127.0.0.1:<port>/
HTML: 3
Markdown: 1
Images: 4
Assets: 0
Metadata: yes
HTML checks: 1 warning
Mode: read-only local preview
```

---

## Workbench Index

The generated index is runtime-only. It is not written to the workspace.

Index sections:

- HTML first, with isolated preview links and secondary raw-file links.
- Markdown files, with direct links served as text.
- Images, with thumbnails and direct links.
- Assets, with filenames, sizes, and direct links.
- Metadata, with a link when present.
- Default publish upload set, using the shared `publish-artifact` workspace helper.
- HTML self-contained checks, showing warnings next to affected HTML files.

The default publish upload set is informational only. It must:

- call the shared `listUploadFiles(workspacePath)` helper from `skills/publish-artifact/scripts/common/workspace.js`;
- state that destination drivers may add, skip, transform, or rewrite files later;
- not call `publish-artifact`;
- not mutate metadata;
- not run secret scanning;
- not contact remote services.

The HTML self-contained check scans each HTML file for references that would violate the `html-artifact` single-file rule or be masked by workspace serving:

- `<script src=...>`
- `<link href=...>`
- `<img src=...>`
- `<source src=...>`
- `<video poster=...>`
- `srcset=...`
- CSS `url(...)`

Allowed values:

- `data:` URLs
- hash-only links such as `#section`
- internal page navigation links

Warn on:

- `http:` and `https:` URLs
- absolute workspace paths such as `/images/foo.png`
- relative paths to local files such as `../images/foo.png`, `./asset.css`, or `images/foo.png`

The check is deliberately conservative. It should flag possible invariant violations but not rewrite or block files.

---

## Safety Model

The server is intentionally not a generic file server.

Guardrails:

- Bind to `127.0.0.1` by default.
- Resolve every request under the allowed root.
- Reject path traversal such as `../`.
- Reject symlink escapes outside the workspace or single-file parent root.
- In workspace mode, serve only `markdown/`, `html/`, `images/`, `assets/`, and `metadata.md`.
- Do not write files.
- Do not update metadata.
- Do not watch files.
- Do not publish, upload, create gists, or call external APIs.
- Do not make network requests from the generated index.
- Do not serve workspace HTML through the same route used for validation previews if that would allow sibling workspace assets to mask non-self-contained HTML.
- Treat `metadata.md` as local-only operational metadata. It may contain destination IDs, presigned URLs, gist URLs, or internal references; serving it on localhost is allowed, but the index must label it accordingly.

Content types:

- `.html`: `text/html; charset=utf-8`
- `.md`: `text/markdown; charset=utf-8`
- `.txt`: `text/plain; charset=utf-8`
- `.json`: `application/json; charset=utf-8`
- `.css`: `text/css; charset=utf-8`
- `.js`: `application/javascript; charset=utf-8`
- `.mjs`: `application/javascript; charset=utf-8`
- `.wasm`: `application/wasm`
- `.woff`: `font/woff`
- `.woff2`: `font/woff2`
- `.svg`: `image/svg+xml`
- `.png`: `image/png`
- `.jpg`, `.jpeg`: `image/jpeg`
- `.gif`: `image/gif`
- `.webp`: `image/webp`
- unknown assets: `application/octet-stream`

---

## Documentation Updates

Update:

- `skills/artifact-workbench/SKILL.md`
  - Document the workbench purpose, triggers, command, guardrails, and validation limits.
- `skills/html-artifact/SKILL.md`
  - Mention the local workbench as an optional post-generation preview skill and preserve the `file://`/self-contained validation requirement.
- `skills/markdown-artifact/SKILL.md`
  - Mention that completed workspaces can be previewed locally through `artifact-workbench`.
- `skills/image-artifact/SKILL.md`
  - Mention previewing image companions and variant boards inside `artifact-workbench`.
- `skills/publish-artifact/SKILL.md`
  - Mention `artifact-workbench` as a pre-publish inspection tool with no publishing side effects.
- `README.md`
  - List the skill/script and include an example command.

No skill should imply that local serving is required to consume an artifact. It is optional review tooling. HTML-producing docs must continue to require direct file-open or self-contained verification because localhost preview can never replace the single-file rule.

---

## Test Plan

Add focused Node tests for helper behavior and request handling.

Required coverage:

- Resolve a slug under `~/agent-artifacts`.
- Resolve absolute, `~`, relative, and single-HTML-file inputs.
- Exit non-zero for a missing workspace, non-directory workspace, or directory that is not an artifact workspace.
- Render a partial index when one or more workspace subdirectories are missing.
- Detect workspace files in `markdown/`, `html/`, `images/`, `assets/`, and `metadata.md`.
- Generate an index containing HTML, Markdown, Images, Assets, Metadata, and Default Publish Upload Set sections when corresponding files exist.
- Generate an index without sections for absent folders.
- Serve `metadata.md` when present and omit it cleanly when absent.
- Serve single `.html` input directly without a workbench index.
- Reject path traversal such as `../`.
- Reject symlink escapes outside the workspace.
- Map content types for HTML, Markdown, PNG, SVG, JavaScript, WOFF2, WASM, and plain assets.
- Send `Cache-Control: no-store`.
- Return `404` for unknown or disallowed paths.
- Use `server.listen(0)` when no port is provided.
- Reuse `listUploadFiles()` for the default publish upload set.
- Flag HTML containing `../images/foo.png`, `/images/foo.png`, remote URLs, or other non-`data:` asset references.
- Serve workspace HTML validation previews through `/preview/html/<file>` so relative cross-folder references request `/preview/*` and fail with `404`.

Manual smoke test:

```sh
node skills/artifact-workbench/scripts/serve-artifact-workbench.js <slug> --open
```

Verify the printed URL opens locally, lists expected files, serves representative Markdown, image, asset, and metadata files, opens HTML through isolated preview links, and warns when an HTML file contains non-self-contained references.

---

## Open Questions

None for v1 after the review resolutions above.

Later candidates, explicitly out of scope for v1:

- live reload
- screenshot generation
- QR codes or non-local sharing
- editable annotations
- approval capture
- destination-specific publish simulation
