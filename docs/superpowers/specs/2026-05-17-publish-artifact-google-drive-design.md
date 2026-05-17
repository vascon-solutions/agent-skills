# Publish-Artifact Google Drive Folder Upload Design

## Context

`publish-artifact --to google-docs` creates native Google Docs from Markdown. That is useful for editable document review, but it does not publish the artifact workspace as a Drive folder containing the actual generated files. Users also need a raw Drive upload mode where PNG, HTML, Markdown, and asset files remain files.

## Decision

Add a separate `google-drive` destination instead of overloading `google-docs`.

- `--to google-docs` keeps converting Markdown into native Google Docs.
- `--to google-drive` creates or reuses a Drive folder named `<slug>` under `--google-folder` / `GOOGLE_DRIVE_PARENT_ID`.
- The raw Drive upload preserves workspace structure for `markdown/`, `html/`, `images/`, `assets/`, and any existing `metadata.md`.
- Existing Google auth behavior is shared by both destinations: ADC or `GOOGLE_APPLICATION_CREDENTIALS` outside the repo/workspace.

## CLI

```sh
publish-artifact <slug> --to google-drive --google-folder <drive-folder-id>
```

`GOOGLE_DRIVE_PARENT_ID` remains the environment fallback for `--google-folder`.

## Driver Behavior

The `google-drive` driver:

1. Finds or creates the root Drive folder named `<slug>` under the parent folder.
2. Finds or creates Drive subfolders that mirror workspace-relative directories.
3. Uploads files with their natural MIME types:
   - Markdown as `text/markdown`
   - HTML as `text/html`
   - PNG/JPEG/GIF/WebP/SVG as image types
   - JSON/text as structured text
   - unknown extensions as `application/octet-stream`
4. If a file with the same name already exists in the same Drive folder:
   - without `--force`, skip it and report the conflict
   - with `--force`, update the file bytes
5. Reports the Drive folder URL and per-file uploaded/updated/skipped lines.
6. Emits `metadata.md` destination lines like other explicit destinations.

## Out Of Scope

- Converting raw files into Google-native Docs in `google-drive`.
- Two-way sync from Drive back into the artifact workspace.
- Deleting remote Drive files that no longer exist locally.
- Changing `google-docs` behavior.

## Validation

```sh
node --test skills/publish-artifact/scripts/common/google-auth.test.js \
  skills/publish-artifact/scripts/destinations/google-drive.test.js \
  skills/publish-artifact/scripts/destinations/google-docs.test.js \
  skills/publish-artifact/scripts/publish-artifact.test.js
node --test skills/**/*.test.js
git diff --check
```
