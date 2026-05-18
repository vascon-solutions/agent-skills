# Artifact Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated `artifact-workbench` skill that serves artifact workspaces through a local read-only Node server for variant review, browser QA, and pre-publish inspection.

**Architecture:** Add a new `skills/artifact-workbench/` skill with one dependency-free Node CLI at `scripts/serve-artifact-workbench.js` and a focused `node:test` suite beside it. The CLI reuses `publish-artifact`'s shared workspace helper for workspace resolution and default upload-set listing, serves a generated runtime index for workspace mode, and serves a direct file route for single HTML mode.

**Tech Stack:** Node.js built-ins only (`http`, `fs`, `path`, `url`, `net`, `child_process`, `os`, `node:test`, `assert`). No npm package dependencies.

**Spec:** `docs/superpowers/specs/2026-05-18-artifact-workbench-design.md`

---

## File Structure

Create:

- `skills/artifact-workbench/SKILL.md` - agent invocation surface, guardrails, workflow, validation, and output shape.
- `skills/artifact-workbench/scripts/serve-artifact-workbench.js` - CLI, exported helpers, server factory, index generation, static serving.
- `skills/artifact-workbench/scripts/serve-artifact-workbench.test.js` - `node:test` coverage for resolution, discovery, HTML reference scans, content types, index generation, request handling, and server routes.

Modify:

- `bin/link-skills.sh` - add `artifact-workbench` to `SKILL_NAMES`.
- `README.md` - add the skill to the tree, table, usage sections, and artifact workflow notes.
- `skills/html-artifact/SKILL.md` - mention optional `artifact-workbench` preview and keep direct self-contained HTML verification mandatory.
- `skills/markdown-artifact/SKILL.md` - mention completed workspaces can be previewed through `artifact-workbench`.
- `skills/image-artifact/SKILL.md` - mention image companions and variant boards can be previewed through `artifact-workbench`.
- `skills/publish-artifact/SKILL.md` - mention `artifact-workbench` as pre-publish inspection with no publishing side effects.

Do not modify unrelated current worktree changes.

---

### Task 1: Scaffold The `artifact-workbench` Skill

**Files:**
- Create: `skills/artifact-workbench/SKILL.md`
- Create: `skills/artifact-workbench/scripts/serve-artifact-workbench.js`
- Create: `skills/artifact-workbench/scripts/serve-artifact-workbench.test.js`
- Modify: `bin/link-skills.sh`
- Modify: `README.md`

- [ ] **Step 1: Create the new skill directories**

Run:

```bash
mkdir -p skills/artifact-workbench/scripts
```

Expected: command exits 0 and `skills/artifact-workbench/scripts` exists.

- [ ] **Step 2: Write the initial `SKILL.md`**

Create `skills/artifact-workbench/SKILL.md` with:

```markdown
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
- renders a runtime index for `html/`, `markdown/`, `images/`, `assets/`, `metadata.md`, HTML checks, and the default publish upload set
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
```

- [ ] **Step 3: Create a minimal CLI module shell**

Create `skills/artifact-workbench/scripts/serve-artifact-workbench.js` with:

```javascript
#!/usr/bin/env node

const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { URL } = require('url');

const publishWorkspace = require('../../publish-artifact/scripts/common/workspace.js');

const ARTIFACT_DIRS = ['html', 'markdown', 'images', 'assets'];

function usage(exitCode = 0) {
  const stream = exitCode === 0 ? process.stdout : process.stderr;
  stream.write('Usage: serve-artifact-workbench.js <workspace-or-html-file> [--port <n>] [--open]\n');
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = { target: null, port: null, open: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') usage(0);
    if (arg === '--open') {
      args.open = true;
    } else if (arg === '--port') {
      const raw = argv[++i];
      const port = Number(raw);
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid --port: ${raw}`);
      args.port = port;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!args.target) {
      args.target = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }
  if (!args.target) usage(1);
  return args;
}

function main() {
  try {
    parseArgs(process.argv.slice(2));
    process.stdout.write('artifact-workbench shell\n');
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  ARTIFACT_DIRS,
  parseArgs,
};

if (require.main === module) main();
```

- [ ] **Step 4: Create the initial test file**

Create `skills/artifact-workbench/scripts/serve-artifact-workbench.test.js` with:

```javascript
const assert = require('assert');
const test = require('node:test');

const workbench = require('./serve-artifact-workbench.js');

test('parseArgs accepts target, --port, and --open', () => {
  assert.deepEqual(workbench.parseArgs(['demo', '--port', '54321', '--open']), {
    target: 'demo',
    port: 54321,
    open: true,
  });
});

test('parseArgs rejects invalid port values', () => {
  assert.throws(() => workbench.parseArgs(['demo', '--port', 'abc']), /Invalid --port/);
  assert.throws(() => workbench.parseArgs(['demo', '--port', '70000']), /Invalid --port/);
});
```

- [ ] **Step 5: Run the initial tests**

Run:

```bash
node --test skills/artifact-workbench/scripts/serve-artifact-workbench.test.js
```

Expected: two tests pass.

- [ ] **Step 6: Register the skill in the link script**

In `bin/link-skills.sh`, add `artifact-workbench` after `image-artifact`:

```sh
html-artifact
markdown-artifact
image-artifact
artifact-workbench
repo-design-context
```

- [ ] **Step 7: Add README entries**

In `README.md`, add `artifact-workbench/` to the tree after `image-artifact/`:

```text
    |-- image-artifact/
    |-- artifact-workbench/
    |-- repo-design-context/
```

Add a skill table row after `image-artifact`:

```markdown
| `artifact-workbench`      | Serve an artifact workspace or single HTML artifact through a read-only localhost workbench for variant comparison, browser QA, and pre-publish inspection |
```

Add a usage section after "Generating image artifact companions":

```markdown
### Previewing artifact workspaces locally

1. `artifact-workbench` - serve a `~/agent-artifacts/<slug>/` workspace or single HTML artifact through a read-only localhost workbench. Use it to compare HTML variants, inspect Markdown/images/assets/metadata, and review the default publish upload set before running `publish-artifact`.
```

- [ ] **Step 8: Run scaffold checks**

Run:

```bash
node --test skills/artifact-workbench/scripts/serve-artifact-workbench.test.js
rg -n "artifact-workbench" bin/link-skills.sh README.md skills/artifact-workbench/SKILL.md
```

Expected: tests pass and `rg` shows the new skill in all three files.

- [ ] **Step 9: Commit**

Run:

```bash
git add skills/artifact-workbench/SKILL.md \
  skills/artifact-workbench/scripts/serve-artifact-workbench.js \
  skills/artifact-workbench/scripts/serve-artifact-workbench.test.js \
  bin/link-skills.sh README.md
git commit -m "feat: scaffold artifact-workbench skill"
```

---

### Task 2: Implement Workspace Resolution, Discovery, Content Types, And HTML Checks

**Files:**
- Modify: `skills/artifact-workbench/scripts/serve-artifact-workbench.js`
- Modify: `skills/artifact-workbench/scripts/serve-artifact-workbench.test.js`

- [ ] **Step 1: Extend tests for helper behavior**

Replace `skills/artifact-workbench/scripts/serve-artifact-workbench.test.js` with:

```javascript
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const workbench = require('./serve-artifact-workbench.js');

function tempDir(prefix = 'artifact-workbench-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function write(file, content = '') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

test('parseArgs accepts target, --port, and --open', () => {
  assert.deepEqual(workbench.parseArgs(['demo', '--port', '54321', '--open']), {
    target: 'demo',
    port: 54321,
    open: true,
  });
});

test('parseArgs rejects invalid port values', () => {
  assert.throws(() => workbench.parseArgs(['demo', '--port', 'abc']), /Invalid --port/);
  assert.throws(() => workbench.parseArgs(['demo', '--port', '70000']), /Invalid --port/);
});

test('contentTypeFor maps known artifact types', () => {
  assert.equal(workbench.contentTypeFor('demo.html'), 'text/html; charset=utf-8');
  assert.equal(workbench.contentTypeFor('demo.md'), 'text/markdown; charset=utf-8');
  assert.equal(workbench.contentTypeFor('demo.png'), 'image/png');
  assert.equal(workbench.contentTypeFor('demo.svg'), 'image/svg+xml');
  assert.equal(workbench.contentTypeFor('demo.js'), 'application/javascript; charset=utf-8');
  assert.equal(workbench.contentTypeFor('demo.mjs'), 'application/javascript; charset=utf-8');
  assert.equal(workbench.contentTypeFor('demo.woff2'), 'font/woff2');
  assert.equal(workbench.contentTypeFor('demo.wasm'), 'application/wasm');
  assert.equal(workbench.contentTypeFor('demo.bin'), 'application/octet-stream');
});

test('resolveTarget resolves a workspace slug under workspace root', () => {
  const root = tempDir();
  const ws = path.join(root, 'demo');
  write(path.join(ws, 'markdown', 'doc.md'), '# Doc\n');

  const result = workbench.resolveTarget('demo', { workspaceRoot: root, homeDir: root });

  assert.equal(result.mode, 'workspace');
  assert.equal(result.workspacePath, ws);
  assert.equal(result.slug, 'demo');
});

test('resolveTarget rejects a workspace path outside workspace root', () => {
  const root = tempDir();
  const outside = tempDir();
  write(path.join(outside, 'markdown', 'doc.md'), '# Doc\n');

  assert.throws(() => workbench.resolveTarget(outside, { workspaceRoot: root, homeDir: root }), /outside workspace root/);
});

test('resolveTarget accepts a single explicit html file outside workspace root', () => {
  const root = tempDir();
  const outside = tempDir();
  const html = path.join(outside, 'demo.html');
  write(html, '<!doctype html><h1>Demo</h1>');

  const result = workbench.resolveTarget(html, { workspaceRoot: root, homeDir: root });

  assert.equal(result.mode, 'single-html');
  assert.equal(result.filePath, html);
  assert.equal(result.rootPath, outside);
});

test('resolveTarget rejects a missing workspace', () => {
  const root = tempDir();
  assert.throws(() => workbench.resolveTarget('missing', { workspaceRoot: root, homeDir: root }), /Workspace not found/);
});

test('discoverWorkspace returns partial sections and default upload files', () => {
  const ws = tempDir();
  write(path.join(ws, 'html', 'a.html'), '<!doctype html><h1>A</h1>');
  write(path.join(ws, 'images', 'pic.png'), 'png');
  write(path.join(ws, 'metadata.md'), '# Metadata\n');
  write(path.join(ws, '.hidden', 'secret.txt'), 'hidden');
  write(path.join(ws, 'dist', 'bundle.js'), 'ignored');

  const info = workbench.discoverWorkspace(ws);

  assert.deepEqual(info.files.html.map((f) => f.relativePath), ['html/a.html']);
  assert.deepEqual(info.files.markdown, []);
  assert.deepEqual(info.files.images.map((f) => f.relativePath), ['images/pic.png']);
  assert.equal(info.metadata.relativePath, 'metadata.md');
  assert.deepEqual(info.uploadFiles.map((f) => f.relativePath), ['html/a.html', 'images/pic.png']);
});

test('scanHtmlReferences flags non-self-contained references', () => {
  const html = [
    '<!doctype html>',
    '<link rel="stylesheet" href="./style.css">',
    '<img src="../images/pic.png">',
    '<script src="https://cdn.example/app.js"></script>',
    '<div style="background-image:url(/images/bg.png)"></div>',
    '<a href="#local">Local</a>',
    '<img src="data:image/png;base64,abc">',
  ].join('\n');

  const warnings = workbench.scanHtmlReferences(html, 'html/demo.html');

  assert.deepEqual(
    warnings.map((warning) => warning.value).sort(),
    ['./style.css', '/images/bg.png', '../images/pic.png', 'https://cdn.example/app.js'].sort(),
  );
});

test('safeResolve rejects traversal and symlink escapes', () => {
  const root = tempDir();
  const outside = tempDir();
  write(path.join(root, 'assets', 'ok.txt'), 'ok');
  write(path.join(outside, 'secret.txt'), 'secret');
  fs.symlinkSync(path.join(outside, 'secret.txt'), path.join(root, 'assets', 'secret-link.txt'));

  assert.equal(workbench.safeResolve(root, 'assets/ok.txt'), path.join(root, 'assets', 'ok.txt'));
  assert.throws(() => workbench.safeResolve(root, '../escape.txt'), /Unsafe path/);
  assert.throws(() => workbench.safeResolve(root, 'assets/secret-link.txt'), /Unsafe path/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test skills/artifact-workbench/scripts/serve-artifact-workbench.test.js
```

Expected: failures mention missing exported functions such as `contentTypeFor`, `resolveTarget`, `discoverWorkspace`, `scanHtmlReferences`, or `safeResolve`.

- [ ] **Step 3: Replace the CLI module with helper implementations**

Replace `skills/artifact-workbench/scripts/serve-artifact-workbench.js` with:

```javascript
#!/usr/bin/env node

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const publishWorkspace = require('../../publish-artifact/scripts/common/workspace.js');

const ARTIFACT_DIRS = ['html', 'markdown', 'images', 'assets'];
const HOST = '127.0.0.1';

function usage(exitCode = 0) {
  const stream = exitCode === 0 ? process.stdout : process.stderr;
  stream.write('Usage: serve-artifact-workbench.js <workspace-or-html-file> [--port <n>] [--open]\n');
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = { target: null, port: null, open: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') usage(0);
    if (arg === '--open') {
      args.open = true;
    } else if (arg === '--port') {
      const raw = argv[++i];
      const port = Number(raw);
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid --port: ${raw}`);
      args.port = port;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!args.target) {
      args.target = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }
  if (!args.target) usage(1);
  return args;
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.md') return 'text/markdown; charset=utf-8';
  if (ext === '.txt') return 'text/plain; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js' || ext === '.mjs') return 'application/javascript; charset=utf-8';
  if (ext === '.wasm') return 'application/wasm';
  if (ext === '.woff') return 'font/woff';
  if (ext === '.woff2') return 'font/woff2';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

function listFiles(root, dirName) {
  const dirPath = path.join(root, dirName);
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) return [];
  const files = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        files.push({
          fullPath,
          relativePath: publishWorkspace.normalizeRelative(path.relative(root, fullPath)),
          size: fs.statSync(fullPath).size,
        });
      }
    }
  }
  walk(dirPath);
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function resolveTarget(target, options = {}) {
  const homeDir = options.homeDir || process.env.HOME;
  const workspaceRoot = path.resolve(publishWorkspace.expandHome(options.workspaceRoot || path.join(homeDir, 'agent-artifacts'), homeDir));
  const expanded = publishWorkspace.expandHome(target, homeDir);
  const targetPath = path.resolve(expanded);
  if (path.extname(targetPath).toLowerCase() === '.html') {
    if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) throw new Error(`HTML file not found: ${targetPath}`);
    return {
      mode: 'single-html',
      filePath: targetPath,
      rootPath: path.dirname(targetPath),
      fileName: path.basename(targetPath),
    };
  }
  const workspace = publishWorkspace.resolveWorkspace(target, { workspaceRoot, homeDir });
  return { mode: 'workspace', ...workspace };
}

function discoverWorkspace(workspacePath) {
  const files = {
    html: listFiles(workspacePath, 'html'),
    markdown: listFiles(workspacePath, 'markdown'),
    images: listFiles(workspacePath, 'images'),
    assets: listFiles(workspacePath, 'assets'),
  };
  const metadataPath = path.join(workspacePath, 'metadata.md');
  const metadata = fs.existsSync(metadataPath) && fs.statSync(metadataPath).isFile()
    ? { fullPath: metadataPath, relativePath: 'metadata.md', size: fs.statSync(metadataPath).size }
    : null;
  const uploadFiles = publishWorkspace.listUploadFiles(workspacePath);
  const htmlChecks = files.html.map((file) => ({
    file,
    warnings: scanHtmlReferences(fs.readFileSync(file.fullPath, 'utf8'), file.relativePath),
  }));
  return { files, metadata, uploadFiles, htmlChecks };
}

function isAllowedReference(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('data:')) return true;
  if (trimmed.startsWith('#')) return true;
  if (/^(mailto|tel):/i.test(trimmed)) return true;
  return false;
}

function pushWarning(warnings, relativePath, kind, value) {
  if (isAllowedReference(value)) return;
  warnings.push({ relativePath, kind, value });
}

function scanHtmlReferences(html, relativePath) {
  const warnings = [];
  const attrRe = /\b(src|href|poster)\s*=\s*["']([^"']+)["']/gi;
  let attrMatch;
  while ((attrMatch = attrRe.exec(html)) !== null) {
    pushWarning(warnings, relativePath, attrMatch[1].toLowerCase(), attrMatch[2]);
  }
  const srcsetRe = /\bsrcset\s*=\s*["']([^"']+)["']/gi;
  let srcsetMatch;
  while ((srcsetMatch = srcsetRe.exec(html)) !== null) {
    for (const item of srcsetMatch[1].split(',')) {
      pushWarning(warnings, relativePath, 'srcset', item.trim().split(/\s+/)[0]);
    }
  }
  const cssUrlRe = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
  let cssMatch;
  while ((cssMatch = cssUrlRe.exec(html)) !== null) {
    pushWarning(warnings, relativePath, 'css-url', cssMatch[1]);
  }
  return warnings;
}

function safeResolve(root, requestPath) {
  const clean = decodeURIComponent(String(requestPath || '').replace(/^\/+/, ''));
  if (!clean || clean.split(/[\\/]+/).includes('..')) throw new Error(`Unsafe path: ${requestPath}`);
  const rootReal = fs.realpathSync(root);
  const fullPath = path.resolve(root, clean);
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) throw new Error(`File not found: ${requestPath}`);
  const fileReal = fs.realpathSync(fullPath);
  if (fileReal !== rootReal && !fileReal.startsWith(rootReal + path.sep)) throw new Error(`Unsafe path: ${requestPath}`);
  return fullPath;
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const target = resolveTarget(args.target);
    process.stdout.write(`Artifact workbench target resolved: ${target.mode}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  ARTIFACT_DIRS,
  HOST,
  contentTypeFor,
  discoverWorkspace,
  parseArgs,
  resolveTarget,
  safeResolve,
  scanHtmlReferences,
};

if (require.main === module) main();
```

- [ ] **Step 4: Run helper tests**

Run:

```bash
node --test skills/artifact-workbench/scripts/serve-artifact-workbench.test.js
```

Expected: helper tests pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add skills/artifact-workbench/scripts/serve-artifact-workbench.js \
  skills/artifact-workbench/scripts/serve-artifact-workbench.test.js
git commit -m "feat: add artifact workbench helpers"
```

---

### Task 3: Implement Index Generation And HTTP Request Handling

**Files:**
- Modify: `skills/artifact-workbench/scripts/serve-artifact-workbench.js`
- Modify: `skills/artifact-workbench/scripts/serve-artifact-workbench.test.js`

- [ ] **Step 1: Add tests for index HTML and route behavior**

Append these tests to `skills/artifact-workbench/scripts/serve-artifact-workbench.test.js`:

```javascript
async function withServer(server, fn) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test('buildIndexHtml includes artifact sections, upload set, and html warnings', () => {
  const ws = tempDir();
  write(path.join(ws, 'html', 'a.html'), '<!doctype html><img src="../images/pic.png">');
  write(path.join(ws, 'markdown', 'doc.md'), '# Doc\n');
  write(path.join(ws, 'images', 'pic.png'), 'png');
  write(path.join(ws, 'assets', 'data.json'), '{}');
  write(path.join(ws, 'metadata.md'), '# Metadata\n');
  const info = workbench.discoverWorkspace(ws);

  const html = workbench.buildIndexHtml({ workspacePath: ws, slug: 'demo', info });

  assert.match(html, /Artifact Workbench/);
  assert.match(html, /HTML/);
  assert.match(html, /Markdown/);
  assert.match(html, /Images/);
  assert.match(html, /Assets/);
  assert.match(html, /Metadata/);
  assert.match(html, /Default Publish Upload Set/);
  assert.match(html, /HTML Self-Contained Checks/);
  assert.match(html, /\.\.\/images\/pic\.png/);
  assert.match(html, /\/preview\/html\/a\.html/);
  assert.match(html, /\/html\/a\.html/);
});

test('createRequestHandler serves workspace index and files with no-store', async () => {
  const ws = tempDir();
  write(path.join(ws, 'html', 'a.html'), '<!doctype html><h1>A</h1>');
  write(path.join(ws, 'markdown', 'doc.md'), '# Doc\n');
  write(path.join(ws, 'images', 'pic.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  write(path.join(ws, 'metadata.md'), '# Metadata\n');
  const target = { mode: 'workspace', workspacePath: ws, slug: 'demo' };
  const server = workbench.createServer(target);

  await withServer(server, async (baseUrl) => {
    const index = await fetch(`${baseUrl}/`);
    assert.equal(index.status, 200);
    assert.equal(index.headers.get('cache-control'), 'no-store');
    assert.match(await index.text(), /Artifact Workbench/);

    const md = await fetch(`${baseUrl}/markdown/doc.md`);
    assert.equal(md.status, 200);
    assert.match(md.headers.get('content-type'), /text\/markdown/);
    assert.equal(await md.text(), '# Doc\n');

    const metadata = await fetch(`${baseUrl}/metadata.md`);
    assert.equal(metadata.status, 200);
    assert.match(await metadata.text(), /Metadata/);

    const svg = await fetch(`${baseUrl}/images/pic.svg`);
    assert.equal(svg.status, 200);
    assert.match(svg.headers.get('content-type'), /image\/svg\+xml/);
  });
});

test('workspace preview route isolates html asset requests', async () => {
  const ws = tempDir();
  write(path.join(ws, 'html', 'a.html'), '<!doctype html><img src="../images/pic.png">');
  write(path.join(ws, 'images', 'pic.png'), 'png');
  const target = { mode: 'workspace', workspacePath: ws, slug: 'demo' };
  const server = workbench.createServer(target);

  await withServer(server, async (baseUrl) => {
    const html = await fetch(`${baseUrl}/preview/html/a.html`);
    assert.equal(html.status, 200);
    assert.match(await html.text(), /pic\.png/);

    const maskedAsset = await fetch(`${baseUrl}/preview/images/pic.png`);
    assert.equal(maskedAsset.status, 404);

    const rawAsset = await fetch(`${baseUrl}/images/pic.png`);
    assert.equal(rawAsset.status, 200);
  });
});

test('single html mode serves direct file without workspace index', async () => {
  const root = tempDir();
  const htmlPath = path.join(root, 'demo.html');
  write(htmlPath, '<!doctype html><h1>Demo</h1>');
  write(path.join(root, 'style.css'), 'body { color: red; }');
  const target = { mode: 'single-html', rootPath: root, filePath: htmlPath, fileName: 'demo.html' };
  const server = workbench.createServer(target);

  await withServer(server, async (baseUrl) => {
    const rootResponse = await fetch(`${baseUrl}/`);
    assert.equal(rootResponse.status, 302);
    assert.equal(rootResponse.headers.get('location'), '/demo.html');

    const html = await fetch(`${baseUrl}/demo.html`);
    assert.equal(html.status, 200);
    assert.match(await html.text(), /Demo/);

    const css = await fetch(`${baseUrl}/style.css`);
    assert.equal(css.status, 200);
    assert.match(css.headers.get('content-type'), /text\/css/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test skills/artifact-workbench/scripts/serve-artifact-workbench.test.js
```

Expected: failures mention missing `buildIndexHtml` and `createServer`.

- [ ] **Step 3: Add HTML escaping and index generation**

In `skills/artifact-workbench/scripts/serve-artifact-workbench.js`, add these functions after `safeResolve`:

```javascript
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fileLink(file, baseRoute, labelPrefix = '') {
  const href = `/${baseRoute}/${encodeURI(file.relativePath.replace(/^[^/]+\//, ''))}`;
  const label = `${labelPrefix}${file.relativePath}`;
  return `<li><a href="${href}">${escapeHtml(label)}</a> <span>${file.size} bytes</span></li>`;
}

function section(title, body) {
  return `<section><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

function listSection(title, files, baseRoute, emptyLabel) {
  if (!files || files.length === 0) return section(title, `<p>${escapeHtml(emptyLabel)}</p>`);
  return section(title, `<ul>${files.map((file) => fileLink(file, baseRoute)).join('\n')}</ul>`);
}

function htmlSection(files, checks) {
  if (!files || files.length === 0) return section('HTML', '<p>No HTML files found.</p>');
  const warningsByFile = new Map(checks.map((check) => [check.file.relativePath, check.warnings]));
  const items = files.map((file) => {
    const relativeName = file.relativePath.replace(/^html\//, '');
    const warningCount = (warningsByFile.get(file.relativePath) || []).length;
    const warningLabel = warningCount > 0 ? ` <strong>${warningCount} warning(s)</strong>` : ' <span>clean</span>';
    return [
      '<li>',
      `<a href="/preview/html/${encodeURI(relativeName)}">Preview isolated</a>`,
      ' | ',
      `<a href="/html/${encodeURI(relativeName)}">Raw file</a>`,
      ` <span>${escapeHtml(file.relativePath)}</span>`,
      warningLabel,
      '</li>',
    ].join('');
  });
  return section('HTML', `<ul>${items.join('\n')}</ul>`);
}

function imageSection(files) {
  if (!files || files.length === 0) return section('Images', '<p>No image files found.</p>');
  const items = files.map((file) => {
    const relativeName = file.relativePath.replace(/^images\//, '');
    const href = `/images/${encodeURI(relativeName)}`;
    return [
      '<li>',
      `<a href="${href}">${escapeHtml(file.relativePath)}</a>`,
      `<br><img src="${href}" alt="${escapeHtml(file.relativePath)}" loading="lazy">`,
      '</li>',
    ].join('');
  });
  return section('Images', `<ul class="image-grid">${items.join('\n')}</ul>`);
}

function metadataSection(metadata) {
  if (!metadata) return section('Metadata', '<p>No metadata.md file found.</p>');
  return section(
    'Metadata',
    '<p>Local-only operational metadata. It may contain destination IDs, presigned URLs, gist URLs, or internal references.</p><ul><li><a href="/metadata.md">metadata.md</a></li></ul>',
  );
}

function uploadSetSection(files) {
  if (!files || files.length === 0) return section('Default Publish Upload Set', '<p>No default upload files found.</p>');
  const items = files.map((file) => `<li>${escapeHtml(file.relativePath)} <span>${file.size} bytes</span></li>`);
  return section(
    'Default Publish Upload Set',
    '<p>Informational only. Destination drivers may add, skip, transform, or rewrite files later.</p>' +
      `<ul>${items.join('\n')}</ul>`,
  );
}

function htmlChecksSection(checks) {
  const warnings = checks.flatMap((check) => check.warnings);
  if (warnings.length === 0) return section('HTML Self-Contained Checks', '<p>No non-self-contained references detected.</p>');
  const items = warnings.map((warning) => (
    `<li><strong>${escapeHtml(warning.relativePath)}</strong>: ${escapeHtml(warning.kind)} = <code>${escapeHtml(warning.value)}</code></li>`
  ));
  return section('HTML Self-Contained Checks', `<ul>${items.join('\n')}</ul>`);
}

function buildIndexHtml({ workspacePath, slug, info }) {
  const title = `Artifact Workbench - ${slug}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #172033; background: #f6f8fb; }
    header { padding: 24px 28px; background: #172033; color: #fff; }
    main { max-width: 1100px; margin: 0 auto; padding: 24px; }
    section { margin: 0 0 18px; padding: 18px; background: #fff; border: 1px solid #d9e0ea; border-radius: 8px; }
    h1, h2 { margin: 0 0 10px; }
    p { line-height: 1.5; }
    a { color: #0b5cad; }
    span { color: #64748b; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; }
    ul { margin: 0; padding-left: 20px; }
    li { margin: 6px 0; }
    img { max-width: 180px; max-height: 120px; margin-top: 6px; border: 1px solid #d9e0ea; border-radius: 6px; background: #fff; }
    .workspace { color: #cbd5e1; }
  </style>
</head>
<body>
  <header>
    <h1>Artifact Workbench</h1>
    <p class="workspace">${escapeHtml(workspacePath)}</p>
  </header>
  <main>
    ${htmlSection(info.files.html, info.htmlChecks)}
    ${listSection('Markdown', info.files.markdown, 'markdown', 'No Markdown files found.')}
    ${imageSection(info.files.images)}
    ${listSection('Assets', info.files.assets, 'assets', 'No asset files found.')}
    ${metadataSection(info.metadata)}
    ${uploadSetSection(info.uploadFiles)}
    ${htmlChecksSection(info.htmlChecks)}
  </main>
</body>
</html>`;
}
```

- [ ] **Step 4: Add HTTP server functions**

In `skills/artifact-workbench/scripts/serve-artifact-workbench.js`, add these functions after `buildIndexHtml`:

```javascript
function send(res, statusCode, body, contentType = 'text/plain; charset=utf-8', headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(body);
}

function sendFile(res, filePath) {
  send(res, 200, fs.readFileSync(filePath), contentTypeFor(filePath));
}

function notFound(res) {
  send(res, 404, 'Not found\n');
}

function routeWorkspaceRequest(target, req, res) {
  const requestUrl = new URL(req.url, 'http://127.0.0.1');
  const pathname = decodeURIComponent(requestUrl.pathname);
  const info = discoverWorkspace(target.workspacePath);
  if (pathname === '/') {
    return send(res, 200, buildIndexHtml({ workspacePath: target.workspacePath, slug: target.slug, info }), 'text/html; charset=utf-8');
  }
  if (pathname.startsWith('/preview/html/')) {
    try {
      return sendFile(res, safeResolve(path.join(target.workspacePath, 'html'), pathname.replace(/^\/preview\/html\//, '')));
    } catch {
      return notFound(res);
    }
  }
  if (pathname.startsWith('/preview/')) return notFound(res);
  const routes = [
    { prefix: '/html/', root: path.join(target.workspacePath, 'html') },
    { prefix: '/markdown/', root: path.join(target.workspacePath, 'markdown') },
    { prefix: '/images/', root: path.join(target.workspacePath, 'images') },
    { prefix: '/assets/', root: path.join(target.workspacePath, 'assets') },
  ];
  for (const route of routes) {
    if (pathname.startsWith(route.prefix)) {
      try {
        return sendFile(res, safeResolve(route.root, pathname.slice(route.prefix.length)));
      } catch {
        return notFound(res);
      }
    }
  }
  if (pathname === '/metadata.md') {
    try {
      return sendFile(res, safeResolve(target.workspacePath, 'metadata.md'));
    } catch {
      return notFound(res);
    }
  }
  return notFound(res);
}

function routeSingleHtmlRequest(target, req, res) {
  const requestUrl = new URL(req.url, 'http://127.0.0.1');
  const pathname = decodeURIComponent(requestUrl.pathname);
  if (pathname === '/') {
    return send(res, 302, '', 'text/plain; charset=utf-8', { Location: `/${encodeURI(target.fileName)}` });
  }
  try {
    return sendFile(res, safeResolve(target.rootPath, pathname));
  } catch {
    return notFound(res);
  }
}

function createServer(target) {
  return http.createServer((req, res) => {
    if (req.method !== 'GET') return send(res, 405, 'Method not allowed\n');
    if (target.mode === 'workspace') return routeWorkspaceRequest(target, req, res);
    return routeSingleHtmlRequest(target, req, res);
  });
}
```

- [ ] **Step 5: Export new functions**

Update the `module.exports` block in `skills/artifact-workbench/scripts/serve-artifact-workbench.js` to:

```javascript
module.exports = {
  ARTIFACT_DIRS,
  HOST,
  buildIndexHtml,
  contentTypeFor,
  createServer,
  discoverWorkspace,
  parseArgs,
  resolveTarget,
  safeResolve,
  scanHtmlReferences,
};
```

- [ ] **Step 6: Run route tests**

Run:

```bash
node --test skills/artifact-workbench/scripts/serve-artifact-workbench.test.js
```

Expected: tests pass, including isolated preview and single HTML mode tests.

- [ ] **Step 7: Commit**

Run:

```bash
git add skills/artifact-workbench/scripts/serve-artifact-workbench.js \
  skills/artifact-workbench/scripts/serve-artifact-workbench.test.js
git commit -m "feat: serve artifact workbench locally"
```

---

### Task 4: Wire CLI Startup, Startup Report, And `--open`

**Files:**
- Modify: `skills/artifact-workbench/scripts/serve-artifact-workbench.js`
- Modify: `skills/artifact-workbench/scripts/serve-artifact-workbench.test.js`

- [ ] **Step 1: Add tests for startup report and open command selection**

Append these tests to `skills/artifact-workbench/scripts/serve-artifact-workbench.test.js`:

```javascript
test('startupReport prints workspace counts and warnings', () => {
  const ws = tempDir();
  write(path.join(ws, 'html', 'a.html'), '<!doctype html><img src="../images/pic.png">');
  write(path.join(ws, 'markdown', 'doc.md'), '# Doc\n');
  write(path.join(ws, 'images', 'pic.png'), 'png');
  write(path.join(ws, 'metadata.md'), '# Metadata\n');
  const target = { mode: 'workspace', workspacePath: ws, slug: 'demo' };
  const report = workbench.startupReport(target, 'http://127.0.0.1:49152/');

  assert.match(report, /Artifact workbench/);
  assert.match(report, /Workspace:/);
  assert.match(report, /URL: http:\/\/127\.0\.0\.1:49152\//);
  assert.match(report, /HTML: 1/);
  assert.match(report, /Markdown: 1/);
  assert.match(report, /Images: 1/);
  assert.match(report, /Assets: 0/);
  assert.match(report, /Metadata: yes/);
  assert.match(report, /HTML checks: 1 warning/);
});

test('openUrl selects platform commands and ignores unsupported platforms', async () => {
  const calls = [];
  const runner = (cmd, args, cb) => {
    calls.push({ cmd, args });
    cb(null);
  };

  await workbench.openUrl('http://127.0.0.1:1/', { platform: 'darwin', runner });
  await workbench.openUrl('http://127.0.0.1:1/', { platform: 'linux', runner });
  await workbench.openUrl('http://127.0.0.1:1/', { platform: 'win32', runner });
  await workbench.openUrl('http://127.0.0.1:1/', { platform: 'freebsd', runner });

  assert.deepEqual(calls, [
    { cmd: 'open', args: ['http://127.0.0.1:1/'] },
    { cmd: 'xdg-open', args: ['http://127.0.0.1:1/'] },
    { cmd: 'cmd', args: ['/c', 'start', '""', 'http://127.0.0.1:1/'] },
  ]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test skills/artifact-workbench/scripts/serve-artifact-workbench.test.js
```

Expected: failures mention missing `startupReport` and `openUrl`.

- [ ] **Step 3: Add startup and open helpers**

In `skills/artifact-workbench/scripts/serve-artifact-workbench.js`, add these functions before `main`:

```javascript
function warningCount(info) {
  return info.htmlChecks.reduce((count, check) => count + check.warnings.length, 0);
}

function startupReport(target, url) {
  if (target.mode === 'single-html') {
    return [
      'Artifact workbench',
      `File: ${target.filePath}`,
      `URL: ${url}`,
      'Mode: read-only single HTML preview',
      '',
    ].join('\n');
  }
  const info = discoverWorkspace(target.workspacePath);
  const warnings = warningCount(info);
  return [
    'Artifact workbench',
    `Workspace: ${target.workspacePath}`,
    `URL: ${url}`,
    `HTML: ${info.files.html.length}`,
    `Markdown: ${info.files.markdown.length}`,
    `Images: ${info.files.images.length}`,
    `Assets: ${info.files.assets.length}`,
    `Metadata: ${info.metadata ? 'yes' : 'no'}`,
    `HTML checks: ${warnings} warning${warnings === 1 ? '' : 's'}`,
    'Mode: read-only local preview',
    '',
  ].join('\n');
}

function openUrl(url, options = {}) {
  const platform = options.platform || process.platform;
  const runner = options.runner || execFile;
  let cmd = null;
  let args = [];
  if (platform === 'darwin') {
    cmd = 'open';
    args = [url];
  } else if (platform === 'linux') {
    cmd = 'xdg-open';
    args = [url];
  } else if (platform === 'win32') {
    cmd = 'cmd';
    args = ['/c', 'start', '""', url];
  } else {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    runner(cmd, args, () => resolve(true));
  });
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port || 0, HOST, () => {
      server.off('error', reject);
      resolve(server.address().port);
    });
  });
}
```

- [ ] **Step 4: Replace `main` with real server startup**

Replace the existing `main` function with:

```javascript
async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const target = resolveTarget(args.target);
    const server = createServer(target);
    const port = await listen(server, args.port);
    const url = target.mode === 'single-html'
      ? `http://${HOST}:${port}/${encodeURI(target.fileName)}`
      : `http://${HOST}:${port}/`;
    process.stdout.write(startupReport(target, url));
    if (args.open) await openUrl(url);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}
```

- [ ] **Step 5: Export startup helpers**

Update the `module.exports` block to include:

```javascript
  listen,
  openUrl,
  startupReport,
```

The final `module.exports` block should be:

```javascript
module.exports = {
  ARTIFACT_DIRS,
  HOST,
  buildIndexHtml,
  contentTypeFor,
  createServer,
  discoverWorkspace,
  listen,
  openUrl,
  parseArgs,
  resolveTarget,
  safeResolve,
  scanHtmlReferences,
  startupReport,
};
```

- [ ] **Step 6: Run the full workbench tests**

Run:

```bash
node --test skills/artifact-workbench/scripts/serve-artifact-workbench.test.js
```

Expected: all artifact-workbench tests pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add skills/artifact-workbench/scripts/serve-artifact-workbench.js \
  skills/artifact-workbench/scripts/serve-artifact-workbench.test.js
git commit -m "feat: add artifact workbench CLI startup"
```

---

### Task 5: Update Artifact Skill Documentation

**Files:**
- Modify: `skills/html-artifact/SKILL.md`
- Modify: `skills/markdown-artifact/SKILL.md`
- Modify: `skills/image-artifact/SKILL.md`
- Modify: `skills/publish-artifact/SKILL.md`
- Modify: `README.md`

- [ ] **Step 1: Update `html-artifact` documentation**

In `skills/html-artifact/SKILL.md`, under **Bundled Script**, add this command block after the existing renderer/verifier commands:

```markdown
Optional local preview after HTML exists:

```bash
node <artifact-workbench-skill-dir>/scripts/serve-artifact-workbench.js <workspace-or-html-file> [--open]
```
```

In `skills/html-artifact/SKILL.md`, under **Validation**, add:

```markdown
- Local `artifact-workbench` preview is optional and never replaces self-contained HTML validation. If a workbench warning reports relative, absolute, or remote asset references, fix the HTML or document why it is not an `html-artifact` output.
```

- [ ] **Step 2: Update `markdown-artifact` documentation**

In `skills/markdown-artifact/SKILL.md`, under **Relationship To Companions**, add this subsection after the HTML subsection:

```markdown
### Local Workbench

After Markdown, HTML, or image companions exist in a workspace, offer local preview only when the user wants browser review, variant comparison, screenshots, or pre-publish inspection:

> "Local workbench available. Run `artifact-workbench` on this workspace for read-only browser preview. (yes / skip)"

If the user says yes, invoke:

```text
artifact-workbench ~/agent-artifacts/<slug>
```
```

- [ ] **Step 3: Update `image-artifact` documentation**

In `skills/image-artifact/SKILL.md`, under **Workflow**, add after the output verification step:

```markdown
15. If the user wants to inspect image companions, variant boards, or related HTML in the same workspace, offer `artifact-workbench` as a read-only local preview.
```

In **Output**, add:

```markdown
Local preview: run `artifact-workbench ~/agent-artifacts/<slug>` when the user wants browser review of the workspace.
```

- [ ] **Step 4: Update `publish-artifact` documentation**

In `skills/publish-artifact/SKILL.md`, under **When To Use**, add:

```markdown
- Before publishing, use `artifact-workbench` if the user wants local inspection of Markdown, HTML, images, assets, metadata, or the default upload set.
```

Under **When Not To Use**, add:

```markdown
- Do not use this for local preview. Use `artifact-workbench` for read-only localhost inspection.
```

- [ ] **Step 5: Update README artifact workflow references**

In `README.md`, update the "Creating Markdown artifact workspaces" optional follow-ups to include:

```markdown
4. Optional follow-up: `artifact-workbench` - serve the workspace locally for read-only review, variant comparison, screenshots, or pre-publish inspection.
```

In "Publishing artifact workspaces externally", prepend:

```markdown
0. Optional preflight: `artifact-workbench` - inspect the workspace locally before publishing.
```

- [ ] **Step 6: Run documentation checks**

Run:

```bash
rg -n "artifact-workbench" README.md skills/html-artifact/SKILL.md skills/markdown-artifact/SKILL.md skills/image-artifact/SKILL.md skills/publish-artifact/SKILL.md
LC_ALL=C rg -n "[^\\x00-\\x7F]" skills/artifact-workbench/SKILL.md
```

Expected: `artifact-workbench` appears in all listed docs. The ASCII scan prints no output for the new `SKILL.md`.

- [ ] **Step 7: Commit**

Run:

```bash
git add README.md skills/html-artifact/SKILL.md skills/markdown-artifact/SKILL.md \
  skills/image-artifact/SKILL.md skills/publish-artifact/SKILL.md
git commit -m "docs: document artifact workbench preview"
```

---

### Task 6: Final Verification And Link Check

**Files:**
- Modify only if verification finds a defect in files changed by Tasks 1-5.

- [ ] **Step 1: Run artifact-workbench tests**

Run:

```bash
node --test skills/artifact-workbench/scripts/serve-artifact-workbench.test.js
```

Expected: all tests pass.

- [ ] **Step 2: Run related publish workspace tests**

Run:

```bash
node --test skills/publish-artifact/scripts/common/workspace.test.js
```

Expected: all tests pass. This confirms the shared helper still behaves as expected.

- [ ] **Step 3: Run a manual local smoke check**

Create a temporary workspace and run the server:

```bash
tmp_root="$(mktemp -d)"
mkdir -p "$tmp_root/demo/html" "$tmp_root/demo/markdown" "$tmp_root/demo/images"
printf '<!doctype html><h1>Demo</h1><img src="../images/pic.png">\\n' > "$tmp_root/demo/html/demo.html"
printf '# Demo\\n' > "$tmp_root/demo/markdown/demo.md"
printf 'png' > "$tmp_root/demo/images/pic.png"
node skills/artifact-workbench/scripts/serve-artifact-workbench.js "$tmp_root/demo"
```

Expected: this command exits non-zero because workspace paths outside `~/agent-artifacts` are rejected in workspace mode. This verifies the safety boundary.

- [ ] **Step 4: Run an allowed manual smoke check**

Create a temporary workspace under `~/agent-artifacts` and start the server:

```bash
slug="artifact-workbench-smoke-$(date +%s)"
ws="$HOME/agent-artifacts/$slug"
mkdir -p "$ws/html" "$ws/markdown" "$ws/images"
printf '<!doctype html><h1>Demo</h1><img src="../images/pic.png">\\n' > "$ws/html/demo.html"
printf '# Demo\\n' > "$ws/markdown/demo.md"
printf 'png' > "$ws/images/pic.png"
node skills/artifact-workbench/scripts/serve-artifact-workbench.js "$slug"
```

Expected: command prints a URL, counts for HTML/Markdown/Images, and `HTML checks: 1 warning`. Stop the server with `Ctrl-C` after confirming output.

- [ ] **Step 5: Run the link script**

Run:

```bash
bin/link-skills.sh
```

Expected: the script exits 0 and includes an `artifact-workbench` line for each target directory.

- [ ] **Step 6: Check git status for scope**

Run:

```bash
git status --short
```

Expected: only intended artifact-workbench, README, link script, and artifact skill documentation changes are present since the task branch began. Pre-existing unrelated changes may still appear; do not stage or revert them.

- [ ] **Step 7: Commit any verification fixes**

If Task 6 required small fixes, commit only those changed files:

```bash
git add <fixed-files>
git commit -m "fix: stabilize artifact workbench verification"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review Checklist

- Spec coverage:
  - Dedicated `artifact-workbench` micro-skill: Tasks 1 and 5.
  - Dependency-free Node CLI: Tasks 1-4.
  - Workspace and single HTML input modes: Tasks 2-4.
  - Localhost-only read-only behavior: Tasks 2-4.
  - Isolated HTML preview and self-contained warnings: Tasks 2-3.
  - Default publish upload set through shared helper: Tasks 2-3.
  - Metadata warning and no-store headers: Tasks 3 and 5.
  - Cross-platform `--open`: Task 4.
  - README/link script/docs updates: Tasks 1 and 5.
  - Verification and smoke checks: Task 6.
- Completeness scan:
  - No unresolved marker tokens or unspecified implementation steps should remain.
  - Each code-changing step includes exact code or exact snippets to insert.
- Type consistency:
  - Public helper names used in tests match exports from `serve-artifact-workbench.js`.
  - Route names match the spec: `/preview/html/<file>`, `/html/<file>`, `/markdown/<file>`, `/images/<file>`, `/assets/<file>`, `/metadata.md`.
