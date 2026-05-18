# Local Artifact Workbench - Design Spec

**Date:** 2026-05-18  
**Status:** Approved - ready for implementation planning  
**Source:** Brainstorming session on local serving for HTML artifacts, variants, and UI design review

---

## Purpose

Add a lightweight local server for artifact workspaces so agents and users can preview generated artifacts in a browser before publishing or sharing them.

The feature is a read-only local workbench. It does not change the artifact contract: generated HTML files must remain self-contained, offline-capable, and directly openable from disk. The server is an authoring and review convenience for comparing variants, inspecting workspace contents, running browser QA, taking screenshots, and checking what would likely be published.

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

Add the script under `html-artifact` but name it for the broader workspace role:

```sh
node skills/html-artifact/scripts/serve-artifact-workbench.js <workspace-or-html-file> [--port <n>] [--open]
```

Placement rationale:

- `html-artifact` is the skill that most needs browser preview.
- The script understands the full artifact workspace shape created by `markdown-artifact` and enriched by `image-artifact`.
- The script does not belong under `publish-artifact` because previewing is useful before publishing and must not imply publish behavior.

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
- Port: choose an available ephemeral port when `--port` is absent.

---

## V1 Scope

V1 is a read-only artifact workbench with four primary use cases:

1. Compare multiple HTML variants during design.
2. Review a whole workspace before publishing.
3. Provide stable localhost URLs for browser QA and screenshots.
4. Inspect what `publish-artifact` would likely include, without publishing or writing metadata.

Workspace mode indexes:

- `html/` for generated companions, prototypes, variants, slide decks, and UI choice boards
- `markdown/` for source docs
- `images/` for image companions, variant boards, diagrams, and visual summaries
- `assets/` for local supporting files
- `metadata.md` when present

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
- `GET /html/<file>` serves HTML files inline.
- `GET /markdown/<file>` serves Markdown as `text/markdown; charset=utf-8`.
- `GET /images/<file>` serves images with correct content type.
- `GET /assets/<file>` serves assets with conservative content types.
- `GET /metadata.md` serves metadata as plain text when present.
- Unknown or unsafe paths return `404`.

Single HTML file mode:

- Resolve the file.
- Serve its parent directory as the root.
- Print and optionally open the direct URL for that file.
- Do not expose sibling paths through a generated workspace index unless they are required to display the selected HTML file.

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
Mode: read-only local preview
```

---

## Workbench Index

The generated index is runtime-only. It is not written to the workspace.

Index sections:

- HTML first, with direct open links.
- Markdown files, with direct links served as text.
- Images, with thumbnails and direct links.
- Assets, with filenames, sizes, and direct links.
- Metadata, with a link when present.
- Publish preview, listing files that would likely be included by `publish-artifact`.

The publish preview is informational only. It must be clearly labeled as a local estimate and must not call `publish-artifact`, mutate metadata, run secret scanning, or contact remote services.

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

Content types:

- `.html`: `text/html; charset=utf-8`
- `.md`: `text/markdown; charset=utf-8`
- `.txt`: `text/plain; charset=utf-8`
- `.json`: `application/json; charset=utf-8`
- `.css`: `text/css; charset=utf-8`
- `.js`: `text/javascript; charset=utf-8`
- `.svg`: `image/svg+xml`
- `.png`: `image/png`
- `.jpg`, `.jpeg`: `image/jpeg`
- `.gif`: `image/gif`
- `.webp`: `image/webp`
- unknown assets: `application/octet-stream`

---

## Documentation Updates

Update:

- `skills/html-artifact/SKILL.md`
  - Mention the local workbench as an optional post-generation preview command.
- `skills/markdown-artifact/SKILL.md`
  - Mention that completed workspaces can be previewed locally.
- `skills/image-artifact/SKILL.md`
  - Mention previewing image companions and variant boards inside the local workbench.
- `skills/publish-artifact/SKILL.md`
  - Mention the workbench as a pre-publish inspection tool with no publishing side effects.
- `README.md`
  - List the script and include an example command.

No skill should imply that local serving is required to consume an artifact. It is optional review tooling.

---

## Test Plan

Add focused Node tests for helper behavior and request handling.

Required coverage:

- Resolve a slug under `~/agent-artifacts`.
- Resolve absolute, `~`, relative, and single-HTML-file inputs.
- Detect workspace files in `markdown/`, `html/`, `images/`, `assets/`, and `metadata.md`.
- Generate an index containing HTML, Markdown, Images, Assets, Metadata, and Publish Preview sections when corresponding files exist.
- Serve single `.html` input directly.
- Reject path traversal such as `../`.
- Reject symlink escapes outside the workspace.
- Map content types for HTML, Markdown, PNG, SVG, and plain assets.
- Return `404` for unknown or disallowed paths.

Manual smoke test:

```sh
node skills/html-artifact/scripts/serve-artifact-workbench.js <slug> --open
```

Verify the printed URL opens locally, lists expected files, and serves representative HTML, Markdown, image, asset, and metadata files.

---

## Open Questions

None for v1.

Later candidates, explicitly out of scope for v1:

- live reload
- screenshot generation
- QR codes or non-local sharing
- editable annotations
- approval capture
- destination-specific publish simulation
