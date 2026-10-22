# Host adapters

The page, its `img/` folder, the PDF and the manifest are the same on every host. Only preview and publishing differ.

## Claude Code (direct path)

- Preview: `node <artifact-workbench>/scripts/serve-artifact-workbench.js <name>.html --open`. Single-file mode serves the page's folder, so `img/` loads.
- Publish, only when asked: the host Artifact tool with `file_path: <name>.html` and a `files` map that lists each image under its own path, `{"img/<file>.png": "<folder>/img/<file>.png", ...}`. Do not inline images as data URIs. Record the URL under `## Revisions`.
- The PDF is the single-file copy for email, attachments and hosts without file support.

Conformance for building: **supported (direct path)**, verified 2026-10-22 with Chrome 155 on two copies of hand-built client walkthroughs. A three-row walkthrough was rebuilt from the starter and its existing audit run: `check` passed with 24 pages and 21 images, every image traced to its raw capture, and `pdf` printed 24 pages. On the oldest walkthrough, `check` reported its manifest drift: 25 page images with no manifest line and 14 manifest lines naming files the page does not use.

Conformance for publishing: **unverified.** The page is a complete document with a doctype. Earlier hand-built walkthroughs were published as fragments, and whether the host accepts a complete document unchanged has not been tested. On the first publish, check that the published page renders with its styles and images. If it does not, publish a copy without the `<!DOCTYPE>`, `<html>`, `<head>` and `<body>` wrappers, and record the result here.

## Codex CLI (direct path)

- Preview: the same workbench command.
- Publishing: none built in. Share the PDF, or the folder through another publisher the user names.

Conformance: **unverified.**

## Any other host

A host with the filesystem and a shell uses the direct path. A host without them cannot run audit-ui or the scripts; build there only from an already curated folder and run `check` and `pdf` on a direct-path host before sharing. Add a section here before calling a host supported.
