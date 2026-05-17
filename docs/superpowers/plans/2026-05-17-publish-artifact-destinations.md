# Publish-Artifact Destinations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand `publish-artifact` from a single-destination S3 + gist publisher into a multi-destination publisher that also writes to GitHub Wikis, ClickUp Docs, and Google Docs/Drive, with no mandatory destination, byte-identical default behavior, and an explicit security baseline (HTTPS-only, extended secret scan, output redaction, native-only deps).

**Architecture:** One skill, one CLI (`publish-artifact <slug>`), one driver module per destination under `scripts/destinations/<name>.js`. Cross-cutting code (workspace resolution, secret scan, metadata, Markdown rewriting, HTTP client) lives in `scripts/common/`. A repeatable `--to <s3|wiki|clickup|google-docs>` flag selects destinations; absent `--to` preserves today's S3 + optional gist flow exactly. Each driver implements `{ requiredEnv, validateFlags, plan, publish, formatReport }` and receives a shared `ctx` carrying the runner, HTTP client, logger, and dry-run/force flags.

**Tech Stack:** Node 18+ (built-in `fetch`, `https`, `child_process`, `fs`, `crypto`), `aws` CLI (S3), `gh` + `git` CLIs (Wiki + gist), `gcloud` CLI for ADC token (Google Docs). No new runtime dependencies. `node:test` for tests. Spec: `docs/superpowers/specs/2026-05-17-publish-artifact-destinations-design.md`.

**Spec reference:** Throughout this plan, "the spec" means the design document above. Re-read its **Security Priorities** section before each phase begins.

---

## File Structure

This plan creates new modules and refactors the existing single-file script. End state:

```
skills/publish-artifact/
  SKILL.md                                # updated in Phase 5
  .env.example                            # updated in Phase 5
  scripts/
    publish-artifact.js                   # CLI entry, flag parse, dispatcher, re-exports
    publish-artifact.test.js              # existing tests preserved verbatim
    common/
      workspace.js                        # slug resolution + file listing
      workspace.test.js
      secret-scan.js                      # extended pattern list
      secret-scan.test.js
      metadata.js                         # publish-section writers + redaction
      metadata.test.js
      http.js                             # fetch wrapper: HTTPS, timeout, retry, redacted errors
      http.test.js
      markdown-rewrite.js                 # rewrite relative image paths to presigned URLs
      markdown-rewrite.test.js
    destinations/
      s3.js                               # existing S3 + gist behavior, refactored
      s3.test.js                          # narrow per-driver tests (existing top-level tests stay)
      wiki.js
      wiki.test.js
      clickup.js
      clickup.test.js
      google-docs.js
      google-docs.test.js
```

`publish-artifact.test.js` keeps all existing tests as the regression bar. Per-driver tests live next to each driver.

---

## Phase 0 — Pre-flight

### Task 0: Confirm current state is green

**Files:** none

- [ ] **Step 1: Run the existing tests to establish the regression bar**

Run: `node --test skills/publish-artifact/scripts/publish-artifact.test.js`
Expected: every test passes.

- [ ] **Step 2: Note Node version**

Run: `node --version`
Expected: `v18.x` or newer (built-in `fetch` is required). If lower, stop and fix the environment before continuing.

---

## Phase 1 — Refactor into driver pattern

Goal: no behavior change. All existing tests keep passing without edits at every commit in this phase.

### Task 1: Extract `common/workspace.js`

**Files:**
- Create: `skills/publish-artifact/scripts/common/workspace.js`
- Create: `skills/publish-artifact/scripts/common/workspace.test.js`
- Modify: `skills/publish-artifact/scripts/publish-artifact.js`

- [ ] **Step 1: Write the new module test first**

Create `skills/publish-artifact/scripts/common/workspace.test.js`:

```js
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const workspace = require('./workspace.js');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-test-'));
}

function write(file, content = '') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

test('resolveWorkspace rejects a slug containing path separators', () => {
  const root = tempDir();
  assert.throws(
    () => workspace.resolveWorkspace('../escape', { workspaceRoot: root, homeDir: root }),
    /Invalid slug/,
  );
});

test('resolveWorkspace rejects a slug with disallowed characters', () => {
  const root = tempDir();
  assert.throws(
    () => workspace.resolveWorkspace('bad slug!', { workspaceRoot: root, homeDir: root }),
    /Invalid slug/,
  );
});

test('resolveWorkspace accepts a clean slug', () => {
  const root = tempDir();
  const ws = path.join(root, 'good-slug_v2');
  write(path.join(ws, 'markdown', 'doc.md'), '# Doc\n');
  const result = workspace.resolveWorkspace('good-slug_v2', { workspaceRoot: root, homeDir: root });
  assert.equal(result.workspacePath, ws);
});

test('listUploadFiles excludes hidden, metadata, node_modules, and dist', () => {
  const ws = tempDir();
  write(path.join(ws, 'metadata.md'), '# Meta\n');
  write(path.join(ws, 'markdown', 'doc.md'), '# Doc\n');
  write(path.join(ws, '.hidden', 'x'), 'h');
  write(path.join(ws, 'node_modules', 'pkg', 'i.js'), 'm');
  write(path.join(ws, 'dist', 'o.txt'), 'd');
  const files = workspace.listUploadFiles(ws).map((f) => f.relativePath).sort();
  assert.deepEqual(files, ['markdown/doc.md']);
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run: `node --test skills/publish-artifact/scripts/common/workspace.test.js`
Expected: FAIL with `Cannot find module './workspace.js'`.

- [ ] **Step 3: Implement `common/workspace.js`**

Create `skills/publish-artifact/scripts/common/workspace.js`:

```js
const fs = require('fs');
const path = require('path');

const SLUG_PATTERN = /^[A-Za-z0-9._-]+$/;

function expandHome(value, homeDir = process.env.HOME) {
  if (value === '~') return homeDir;
  if (value && value.startsWith('~/')) return path.join(homeDir, value.slice(2));
  return value;
}

function normalizeRelative(filePath) {
  return filePath.split(path.sep).join('/');
}

function resolveWorkspace(slug, options = {}) {
  const homeDir = options.homeDir || process.env.HOME;
  const workspaceRoot = options.workspaceRoot || path.join(homeDir, 'agent-artifacts');
  const expanded = expandHome(slug, homeDir);
  const isPath = path.isAbsolute(expanded) || expanded.includes(path.sep);
  const workspacePath = isPath ? path.resolve(expanded) : path.join(workspaceRoot, expanded);

  if (!isPath && !SLUG_PATTERN.test(expanded)) {
    throw new Error(`Invalid slug: ${slug}`);
  }

  if (!fs.existsSync(workspacePath) || !fs.statSync(workspacePath).isDirectory()) {
    throw new Error(`Workspace not found: ${workspacePath}`);
  }

  const hasMetadata = fs.existsSync(path.join(workspacePath, 'metadata.md'));
  const hasArtifactDir = ['markdown', 'html', 'images', 'assets'].some((dir) => {
    const dirPath = path.join(workspacePath, dir);
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  });
  if (!hasMetadata && !hasArtifactDir) {
    throw new Error(`Workspace does not look like an artifact workspace: ${workspacePath}`);
  }

  return { workspacePath, slug: path.basename(workspacePath) };
}

function listUploadFiles(workspacePath) {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      const relativePath = normalizeRelative(path.relative(workspacePath, fullPath));
      if (relativePath === 'metadata.md') continue;
      if (relativePath.split('/').includes('node_modules') || relativePath.split('/').includes('dist')) continue;
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        files.push({ fullPath, relativePath, size: fs.statSync(fullPath).size });
      }
    }
  }
  walk(workspacePath);
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

module.exports = { expandHome, normalizeRelative, resolveWorkspace, listUploadFiles, SLUG_PATTERN };
```

- [ ] **Step 4: Run the new test to verify it passes**

Run: `node --test skills/publish-artifact/scripts/common/workspace.test.js`
Expected: PASS.

- [ ] **Step 5: Re-export from `publish-artifact.js` to keep existing tests green**

In `skills/publish-artifact/scripts/publish-artifact.js`, replace the inline `expandHome`, `normalizeRelative`, `resolveWorkspace`, and `listUploadFiles` definitions with a `require('./common/workspace.js')` at the top of the file (after the existing requires) and use those references in the rest of the script. Keep the same module.exports list at the bottom. Update the call to `resolveWorkspace` inside `runPublish` so it still works.

Concretely, at the top of `publish-artifact.js` add:

```js
const { expandHome, normalizeRelative, resolveWorkspace, listUploadFiles } = require('./common/workspace.js');
```

And remove the in-file `function expandHome`, `function normalizeRelative`, `function resolveWorkspace`, `function listUploadFiles` blocks.

- [ ] **Step 6: Run the existing top-level tests to verify no regression**

Run: `node --test skills/publish-artifact/scripts/publish-artifact.test.js skills/publish-artifact/scripts/common/workspace.test.js`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add skills/publish-artifact/scripts/common/workspace.js skills/publish-artifact/scripts/common/workspace.test.js skills/publish-artifact/scripts/publish-artifact.js
git commit -m "refactor(publish-artifact): extract workspace.js with slug validation"
```

### Task 2: Extract `common/secret-scan.js` with extended patterns

**Files:**
- Create: `skills/publish-artifact/scripts/common/secret-scan.js`
- Create: `skills/publish-artifact/scripts/common/secret-scan.test.js`
- Modify: `skills/publish-artifact/scripts/publish-artifact.js`

- [ ] **Step 1: Write the test first**

Create `skills/publish-artifact/scripts/common/secret-scan.test.js`:

```js
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const { scanSecrets, IMAGE_EXTENSIONS } = require('./secret-scan.js');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'secret-scan-test-'));
}

function file(relPath, content) {
  return { fullPath: relPath, relativePath: relPath, size: content.length, content };
}

test('scanSecrets detects ClickUp personal API tokens', () => {
  const ws = tempDir();
  fs.mkdirSync(path.join(ws, 'markdown'), { recursive: true });
  fs.writeFileSync(path.join(ws, 'markdown', 'doc.md'), 'token pk_12345_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345\n');
  const matches = scanSecrets([{ fullPath: path.join(ws, 'markdown', 'doc.md'), relativePath: 'markdown/doc.md', size: 0 }], ws);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].pattern, 'ClickUp personal API token');
});

test('scanSecrets detects Google API keys', () => {
  const ws = tempDir();
  fs.mkdirSync(path.join(ws, 'markdown'), { recursive: true });
  fs.writeFileSync(path.join(ws, 'markdown', 'doc.md'), 'key AIzaSyA-1234567890abcdefghijklmnopqrstuv\n');
  const matches = scanSecrets([{ fullPath: path.join(ws, 'markdown', 'doc.md'), relativePath: 'markdown/doc.md', size: 0 }], ws);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].pattern, 'Google API key');
});

test('scanSecrets detects service-account JSON markers', () => {
  const ws = tempDir();
  fs.mkdirSync(path.join(ws, 'markdown'), { recursive: true });
  fs.writeFileSync(path.join(ws, 'markdown', 'doc.md'), '{"type": "service_account", "project_id": "x"}\n');
  const matches = scanSecrets([{ fullPath: path.join(ws, 'markdown', 'doc.md'), relativePath: 'markdown/doc.md', size: 0 }], ws);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].pattern, 'Service account JSON');
});

test('scanSecrets ignores image binaries', () => {
  const ws = tempDir();
  fs.mkdirSync(path.join(ws, 'images'), { recursive: true });
  fs.writeFileSync(path.join(ws, 'images', 'pic.png'), 'pk_12345_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345');
  const matches = scanSecrets([{ fullPath: path.join(ws, 'images', 'pic.png'), relativePath: 'images/pic.png', size: 0 }], ws);
  assert.equal(matches.length, 0);
  assert.ok(IMAGE_EXTENSIONS.has('.png'));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test skills/publish-artifact/scripts/common/secret-scan.test.js`
Expected: FAIL with `Cannot find module './secret-scan.js'`.

- [ ] **Step 3: Implement `common/secret-scan.js`**

Create `skills/publish-artifact/scripts/common/secret-scan.js`:

```js
const fs = require('fs');
const path = require('path');

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico']);

const SECRET_PATTERNS = [
  ['AWS access key ID', /AKIA[0-9A-Z]{16}/g],
  ['AWS secret access key assignment', /aws_secret_access_key\s*=\s*['"]?[A-Za-z0-9/+=]{40}['"]?/gi],
  ['GitHub personal access token', /ghp_[A-Za-z0-9]{36}/g],
  ['GitHub fine-grained personal access token', /github_pat_[A-Za-z0-9_]{82}/g],
  ['GitHub server-to-server token', /ghs_[A-Za-z0-9]{36}/g],
  ['GitHub OAuth token', /gho_[A-Za-z0-9]{36}/g],
  ['GitHub user-to-server token', /ghu_[A-Za-z0-9]{36}/g],
  ['Anthropic API key', /sk-ant-[A-Za-z0-9_-]{32,}/g],
  ['OpenAI-style API key', /sk-[A-Za-z0-9]{32,}/g],
  ['Slack token', /xox[abpr]-[A-Za-z0-9-]+/g],
  ['JWT', /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g],
  ['private key', /-----BEGIN (RSA |EC |DSA |OPENSSH |ENCRYPTED |)PRIVATE KEY-----/g],
  ['ClickUp personal API token', /pk_\d+_[A-Z0-9]{32}/g],
  ['Google API key', /AIza[0-9A-Za-z\-_]{35}/g],
  ['Service account JSON', /"type"\s*:\s*"service_account"/g],
];

function scanSecrets(files, workspacePath) {
  const matches = [];
  for (const file of files) {
    const ext = path.extname(file.relativePath).toLowerCase();
    if (IMAGE_EXTENSIONS.has(ext)) continue;
    const content = fs.readFileSync(path.join(workspacePath, file.relativePath), 'utf8');
    for (const [patternName, pattern] of SECRET_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) {
        matches.push({ relativePath: file.relativePath, pattern: patternName });
      }
    }
  }
  return matches;
}

module.exports = { IMAGE_EXTENSIONS, SECRET_PATTERNS, scanSecrets };
```

- [ ] **Step 4: Run the new test to verify it passes**

Run: `node --test skills/publish-artifact/scripts/common/secret-scan.test.js`
Expected: PASS.

- [ ] **Step 5: Re-wire `publish-artifact.js` to use the module**

In `skills/publish-artifact/scripts/publish-artifact.js`:

1. Remove the in-file `const IMAGE_EXTENSIONS = ...` and `const SECRET_PATTERNS = ...` blocks.
2. Remove the in-file `function scanSecrets`.
3. Add at the top of the file (with the other common imports):

```js
const { scanSecrets, IMAGE_EXTENSIONS } = require('./common/secret-scan.js');
```

Keep `scanSecrets` in `module.exports` for backward-compat with existing tests.

- [ ] **Step 6: Run all tests to confirm no regression**

Run: `node --test skills/publish-artifact/scripts/publish-artifact.test.js skills/publish-artifact/scripts/common/secret-scan.test.js`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add skills/publish-artifact/scripts/common/secret-scan.js skills/publish-artifact/scripts/common/secret-scan.test.js skills/publish-artifact/scripts/publish-artifact.js
git commit -m "refactor(publish-artifact): extract secret-scan.js with extended patterns"
```

### Task 3: Extract `common/metadata.js`

**Files:**
- Create: `skills/publish-artifact/scripts/common/metadata.js`
- Create: `skills/publish-artifact/scripts/common/metadata.test.js`
- Modify: `skills/publish-artifact/scripts/publish-artifact.js`

- [ ] **Step 1: Write the test first**

Create `skills/publish-artifact/scripts/common/metadata.test.js`:

```js
const assert = require('assert');
const test = require('node:test');

const meta = require('./metadata.js');

test('replacePublishedSection creates fresh metadata when none exists', () => {
  const result = meta.replacePublishedSection(null, 'demo', ['- entry']);
  assert.match(result, /^# demo Metadata\n\n## Published\n\n- entry/m);
});

test('replacePublishedSection replaces only the Published section', () => {
  const existing = '# Title\n\nIntro\n\n## Published\n\nold\n\n## Notes\n\nkeep\n';
  const replaced = meta.replacePublishedSection(existing, 'demo', ['- new']);
  assert.equal(replaced, '# Title\n\nIntro\n\n## Published\n\n- new\n\n## Notes\n\nkeep\n');
});

test('redactPublishedSection redacts presigned and gist URLs only inside Published', () => {
  const m = [
    '# Meta',
    '',
    'outside https://example.com/keep',
    '',
    '## Published',
    '- `markdown/doc.md` — https://bucket.s3.amazonaws.com/x?token=secret',
    '- `markdown/doc.md` — https://gist.github.com/u/id',
    '',
    '## Notes',
    'https://example.com/still-keep',
  ].join('\n');
  const redacted = meta.redactPublishedSection(m);
  assert.match(redacted, /<presigned URL — see local metadata>/);
  assert.match(redacted, /<gist URL — see local metadata>/);
  assert.match(redacted, /outside https:\/\/example.com\/keep/);
  assert.match(redacted, /https:\/\/example.com\/still-keep/);
});

test('findExistingGist returns id and url when present', () => {
  const m = '## Published\n\n- `markdown/doc.md` — https://gist.github.com/user/abc123\n';
  const hit = meta.findExistingGist(m, 'markdown/doc.md');
  assert.deepEqual(hit, { url: 'https://gist.github.com/user/abc123', id: 'abc123' });
});

test('findExistingGist returns null when missing or metadata empty', () => {
  assert.equal(meta.findExistingGist(null, 'markdown/doc.md'), null);
  assert.equal(meta.findExistingGist('## Published\n\nnone\n', 'markdown/doc.md'), null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test skills/publish-artifact/scripts/common/metadata.test.js`
Expected: FAIL with `Cannot find module './metadata.js'`.

- [ ] **Step 3: Implement `common/metadata.js`**

Create `skills/publish-artifact/scripts/common/metadata.js`:

```js
const fs = require('fs');
const path = require('path');

function readMetadata(workspacePath) {
  const metadataPath = path.join(workspacePath, 'metadata.md');
  return fs.existsSync(metadataPath) ? fs.readFileSync(metadataPath, 'utf8') : null;
}

function replacePublishedSection(existingContent, slug, lines) {
  const section = ['## Published', '', ...lines, ''].join('\n');
  if (!existingContent) {
    return `# ${slug} Metadata\n\n${section}`;
  }
  const normalized = existingContent.endsWith('\n') ? existingContent : `${existingContent}\n`;
  const match = normalized.match(/^## Published$/m);
  if (!match) {
    return `${normalized.replace(/\n*$/, '\n\n')}${section}`;
  }
  const start = match.index;
  const afterStart = start + match[0].length;
  const nextMatch = normalized.slice(afterStart).match(/\n## .*/);
  const end = nextMatch ? afterStart + nextMatch.index : normalized.length;
  return `${normalized.slice(0, start)}${section}${normalized.slice(end)}`;
}

function redactPublishedSection(metadata) {
  const lines = metadata.split('\n');
  let inPublished = false;
  return lines.map((line) => {
    if (line === '## Published') { inPublished = true; return line; }
    if (inPublished && line.startsWith('## ')) { inPublished = false; return line; }
    if (!inPublished) return line;
    if (line.includes('gist.github.com')) {
      return line.replace(/https?:\/\/\S+/, '<gist URL — see local metadata>');
    }
    if (/https?:\/\/\S+/.test(line)) {
      return line.replace(/https?:\/\/\S+/, '<presigned URL — see local metadata>');
    }
    return line;
  }).join('\n');
}

function extractPublishedSection(metadata) {
  const lines = metadata.split('\n');
  const start = lines.findIndex((line) => line === '## Published');
  if (start === -1) return '';
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  return lines.slice(start, end === -1 ? lines.length : end).join('\n');
}

function findExistingGist(metadata, relativePath) {
  if (!metadata) return null;
  const escaped = relativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = metadata.match(new RegExp(`- \`${escaped}\` — (https://gist\\.github\\.com/[^\\s]+)`));
  if (!match) return null;
  const parts = match[1].split('/');
  return { url: match[1], id: parts[parts.length - 1] };
}

module.exports = {
  readMetadata,
  replacePublishedSection,
  redactPublishedSection,
  extractPublishedSection,
  findExistingGist,
};
```

- [ ] **Step 4: Run the new test to verify it passes**

Run: `node --test skills/publish-artifact/scripts/common/metadata.test.js`
Expected: PASS.

- [ ] **Step 5: Re-wire `publish-artifact.js`**

In `publish-artifact.js`:

1. Replace the in-file `readMetadata`, `replacePublishedSection`, `redactPublishedSection`, `extractPublishedSection`, and `findExistingGist` definitions with:

```js
const {
  readMetadata,
  replacePublishedSection,
  redactPublishedSection,
  extractPublishedSection,
  findExistingGist,
} = require('./common/metadata.js');
```

2. Keep `replacePublishedSection` and `redactPublishedSection` in `module.exports` for backward-compat.

- [ ] **Step 6: Run all tests**

Run: `node --test skills/publish-artifact/scripts/publish-artifact.test.js skills/publish-artifact/scripts/common/metadata.test.js`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add skills/publish-artifact/scripts/common/metadata.js skills/publish-artifact/scripts/common/metadata.test.js skills/publish-artifact/scripts/publish-artifact.js
git commit -m "refactor(publish-artifact): extract metadata.js"
```

### Task 4: Add `common/http.js` (HTTPS-only fetch wrapper)

**Files:**
- Create: `skills/publish-artifact/scripts/common/http.js`
- Create: `skills/publish-artifact/scripts/common/http.test.js`

- [ ] **Step 1: Write the test first**

Create `skills/publish-artifact/scripts/common/http.test.js`:

```js
const assert = require('assert');
const test = require('node:test');

const { createHttpClient, redactToken } = require('./http.js');

test('createHttpClient rejects non-HTTPS URLs', async () => {
  const client = createHttpClient({ fetchImpl: async () => ({ ok: true, status: 200, text: async () => '' }) });
  await assert.rejects(client.request('http://example.com/x'), /HTTPS required/);
});

test('createHttpClient retries 429 with backoff and eventually succeeds', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls < 3) return { ok: false, status: 429, statusText: 'Too Many Requests', text: async () => 'rate limited' };
    return { ok: true, status: 200, text: async () => 'ok' };
  };
  const sleeps = [];
  const client = createHttpClient({ fetchImpl, sleep: (ms) => { sleeps.push(ms); return Promise.resolve(); }, jitter: () => 0 });
  const res = await client.request('https://api.example.com/x');
  assert.equal(res.status, 200);
  assert.equal(calls, 3);
  assert.equal(sleeps.length, 2);
  assert.ok(sleeps[1] >= sleeps[0]);
});

test('createHttpClient fails fast on 4xx other than 429', async () => {
  const fetchImpl = async () => ({ ok: false, status: 404, statusText: 'Not Found', text: async () => 'missing' });
  const client = createHttpClient({ fetchImpl, sleep: () => Promise.resolve() });
  await assert.rejects(client.request('https://api.example.com/x'), /404/);
});

test('redactToken replaces a known token with REDACTED', () => {
  const env = { CLICKUP_API_TOKEN: 'pk_1_ABCDEFGHIJKL' };
  assert.equal(redactToken('Bearer pk_1_ABCDEFGHIJKL fail', env), 'Bearer <REDACTED:CLICKUP_API_TOKEN> fail');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test skills/publish-artifact/scripts/common/http.test.js`
Expected: FAIL with `Cannot find module './http.js'`.

- [ ] **Step 3: Implement `common/http.js`**

Create `skills/publish-artifact/scripts/common/http.js`:

```js
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 500;
const TOKEN_ENV_KEYS = ['CLICKUP_API_TOKEN', 'GOOGLE_APPLICATION_CREDENTIALS', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN'];

function redactToken(text, env = {}) {
  let out = String(text || '');
  for (const key of TOKEN_ENV_KEYS) {
    const value = env[key];
    if (value && value.length >= 8 && out.includes(value)) {
      out = out.split(value).join(`<REDACTED:${key}>`);
    }
  }
  return out;
}

function createHttpClient(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const sleep = options.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const jitter = options.jitter || (() => Math.random());
  const env = options.env || {};
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const maxRetries = options.maxRetries || DEFAULT_MAX_RETRIES;
  const baseDelay = options.baseDelayMs || DEFAULT_BASE_DELAY_MS;

  async function request(url, init = {}) {
    if (!/^https:\/\//.test(url)) {
      throw new Error(`HTTPS required for HTTP request: ${url}`);
    }
    let attempt = 0;
    while (true) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let res;
      try {
        res = await fetchImpl(url, { ...init, signal: controller.signal });
      } catch (err) {
        clearTimeout(timer);
        const message = redactToken(err.message || String(err), env);
        throw new Error(`HTTP error for ${url}: ${message}`);
      }
      clearTimeout(timer);
      if (res.ok) return res;
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= maxRetries - 1) {
        const body = redactToken(await res.text().catch(() => ''), env);
        throw new Error(`HTTP ${res.status} ${res.statusText || ''} for ${url}: ${body}`.trim());
      }
      const delay = baseDelay * Math.pow(2, attempt) * (0.5 + jitter() * 0.5);
      await sleep(delay);
      attempt += 1;
    }
  }

  return { request };
}

module.exports = { createHttpClient, redactToken, TOKEN_ENV_KEYS };
```

- [ ] **Step 4: Run the new test to verify it passes**

Run: `node --test skills/publish-artifact/scripts/common/http.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills/publish-artifact/scripts/common/http.js skills/publish-artifact/scripts/common/http.test.js
git commit -m "feat(publish-artifact): add common/http.js with HTTPS-only fetch wrapper"
```

### Task 5: Add `common/markdown-rewrite.js`

**Files:**
- Create: `skills/publish-artifact/scripts/common/markdown-rewrite.js`
- Create: `skills/publish-artifact/scripts/common/markdown-rewrite.test.js`

- [ ] **Step 1: Write the test first**

Create `skills/publish-artifact/scripts/common/markdown-rewrite.test.js`:

```js
const assert = require('assert');
const test = require('node:test');

const { rewriteImagePaths } = require('./markdown-rewrite.js');

test('rewriteImagePaths leaves absolute URLs untouched', () => {
  const body = '![alt](https://example.com/x.png)\n';
  const { content, warnings } = rewriteImagePaths(body, { relativeMap: {}, sourceRelative: 'markdown/doc.md' });
  assert.equal(content, body);
  assert.deepEqual(warnings, []);
});

test('rewriteImagePaths rewrites a relative path when an upload mapping is provided', () => {
  const body = '![alt](../images/pic.png)\n';
  const { content, warnings } = rewriteImagePaths(body, {
    relativeMap: { 'images/pic.png': 'https://signed.example/images/pic.png?sig=1' },
    sourceRelative: 'markdown/doc.md',
  });
  assert.match(content, /https:\/\/signed\.example\/images\/pic\.png\?sig=1/);
  assert.deepEqual(warnings, []);
});

test('rewriteImagePaths warns when a relative path has no mapping', () => {
  const body = '![alt](../images/missing.png)\n';
  const { content, warnings } = rewriteImagePaths(body, { relativeMap: {}, sourceRelative: 'markdown/doc.md' });
  assert.equal(content, body);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /images\/missing\.png/);
});

test('rewriteImagePaths handles HTML img tags', () => {
  const body = '<img src="../images/pic.png" alt="x">\n';
  const { content } = rewriteImagePaths(body, {
    relativeMap: { 'images/pic.png': 'https://signed.example/images/pic.png' },
    sourceRelative: 'markdown/doc.md',
  });
  assert.match(content, /https:\/\/signed\.example\/images\/pic\.png/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test skills/publish-artifact/scripts/common/markdown-rewrite.test.js`
Expected: FAIL with `Cannot find module './markdown-rewrite.js'`.

- [ ] **Step 3: Implement `common/markdown-rewrite.js`**

Create `skills/publish-artifact/scripts/common/markdown-rewrite.js`:

```js
const path = require('path');

const MD_IMAGE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const HTML_IMG = /<img\b([^>]*?)\bsrc=(["'])([^"']+)\2([^>]*)>/g;

function normalizeRelative(from, target) {
  const fromDir = path.posix.dirname(from);
  const joined = path.posix.normalize(path.posix.join(fromDir, target));
  return joined.replace(/^\.\//, '');
}

function rewriteImagePaths(body, { relativeMap, sourceRelative }) {
  const warnings = [];

  function rewriteOne(target) {
    if (/^https?:\/\//.test(target) || target.startsWith('data:')) return target;
    if (path.posix.isAbsolute(target)) return target;
    const key = normalizeRelative(sourceRelative, target);
    if (relativeMap[key]) return relativeMap[key];
    warnings.push(`Image reference left unresolved: ${key} (from ${sourceRelative})`);
    return target;
  }

  let content = body.replace(MD_IMAGE, (full, alt, target) => `![${alt}](${rewriteOne(target)})`);
  content = content.replace(HTML_IMG, (full, pre, quote, target, post) => `<img${pre}src=${quote}${rewriteOne(target)}${quote}${post}>`);

  return { content, warnings };
}

module.exports = { rewriteImagePaths };
```

- [ ] **Step 4: Run the new test to verify it passes**

Run: `node --test skills/publish-artifact/scripts/common/markdown-rewrite.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills/publish-artifact/scripts/common/markdown-rewrite.js skills/publish-artifact/scripts/common/markdown-rewrite.test.js
git commit -m "feat(publish-artifact): add common/markdown-rewrite.js"
```

### Task 6: Define driver contract and extract `destinations/s3.js`

**Files:**
- Create: `skills/publish-artifact/scripts/destinations/s3.js`
- Create: `skills/publish-artifact/scripts/destinations/s3.test.js`
- Modify: `skills/publish-artifact/scripts/publish-artifact.js`

This task is the biggest in Phase 1. The goal is: extract everything S3-specific (S3 upload loop, AWS subprocess calls, gist creation, presign, redacted metadata upload) into a driver module, leaving `publish-artifact.js` as a thin CLI/dispatcher. All existing tests must continue to pass without edits.

- [ ] **Step 1: Sketch the driver contract in `destinations/s3.js`**

Create `skills/publish-artifact/scripts/destinations/s3.js`. Start with the structure only; the body comes in the next steps.

```js
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const driver = {
  name: 's3',

  requiredEnv() {
    return ['ARTIFACTS_S3_BUCKET', 'ARTIFACTS_S3_REGION'];
  },

  validateFlags(flags) {
    if (flags.shares.includes('images')) {
      throw new Error('--share images is not supported; pass an explicit image filename');
    }
  },

  async plan(/* { workspace, files, flags, ctx } */) {
    // Aggregated dry-run output is built by the dispatcher today; the
    // current s3 dry-run remains intact. This driver returns nothing here.
    return { description: 's3 archive + optional presigned URLs + optional gists' };
  },

  async publish(/* args */) {
    throw new Error('not implemented yet');
  },

  formatReport() { return []; },
};

module.exports = driver;
```

- [ ] **Step 2: Move S3 publish logic from `publish-artifact.js` into the driver**

Move these functions from `publish-artifact.js` into `destinations/s3.js` as private helpers and let the driver's `publish()` method call them:

- `syncFile`
- `putObject`
- `runAws`
- `runGh`
- `buildGistCreateArgs`, `buildGistUpdateArgs`
- `resolveShareTarget`, `shareInfo`
- `contentTypeFor`
- `s3Key`
- `md5File`
- `validateAttemptedCommands`
- `validateNoCredentialLeak`
- `validateRedactedMetadata`
- `buildMetadata`
- `formatUtc`
- `dryRunOutput`, `formatSize`, `finalOutput`

`publish()` returns `{ uploaded, skipped, shareLinks, gistLinks, ghAuthed, metadataContent, redactedMetadataContent }` and writes the local metadata file. The dispatcher in `publish-artifact.js` calls `publish()` and prints the report.

The exact split — every function listed above — must end up in `destinations/s3.js`. Then re-export the ones that the existing `publish-artifact.test.js` already imports (`buildGistCreateArgs`, `buildGistUpdateArgs`, `contentTypeFor`, `dryRunOutput`, `resolveShareTarget`) via the existing `module.exports` block in `publish-artifact.js` by re-exporting from the driver module.

Concretely, in `publish-artifact.js`:

```js
const s3 = require('./destinations/s3.js');

// ...

module.exports = {
  buildGistCreateArgs: s3.helpers.buildGistCreateArgs,
  buildGistUpdateArgs: s3.helpers.buildGistUpdateArgs,
  contentTypeFor: s3.helpers.contentTypeFor,
  dryRunOutput: s3.helpers.dryRunOutput,
  listUploadFiles,
  loadEnvFiles,
  parseArgs,
  parseTtl,
  redactPublishedSection,
  replacePublishedSection,
  resolveShareTarget: s3.helpers.resolveShareTarget,
  resolveWorkspace,
  runPublish,
  scanSecrets,
};
```

And in `destinations/s3.js`, expose the helpers on `driver.helpers`:

```js
driver.helpers = {
  buildGistCreateArgs,
  buildGistUpdateArgs,
  contentTypeFor,
  dryRunOutput,
  resolveShareTarget,
};
module.exports = driver;
```

- [ ] **Step 3: Wire the dispatcher inside `runPublish`**

In `publish-artifact.js`, the `runPublish` body becomes:

```js
async function runPublish({ argv, env = process.env, runner = defaultRunner, now = new Date(), scriptDir = __dirname, httpClient } = {}) {
  const options = parseArgs(argv || process.argv.slice(2));
  const loadedEnv = loadEnvFiles(env, scriptDir);

  const selectedDriverNames = options.to.length > 0 ? options.to : ['s3'];
  const drivers = selectedDriverNames.map((name) => {
    if (name === 's3') return s3;
    // wiki / clickup / google-docs added in later phases
    throw new Error(`Unknown destination: ${name}`);
  });

  for (const driver of drivers) {
    for (const key of driver.requiredEnv()) {
      if (!loadedEnv[key]) throw new Error(`Missing ${key}`);
    }
    driver.validateFlags(options);
  }
  loadedEnv.AWS_REGION = loadedEnv.ARTIFACTS_S3_REGION;

  const workspaceRoot = options.workspaceRoot || path.join(loadedEnv.HOME || process.env.HOME, 'agent-artifacts');
  const workspace = resolveWorkspace(options.slug, { workspaceRoot, homeDir: loadedEnv.HOME || process.env.HOME });
  const uploadFiles = listUploadFiles(workspace.workspacePath);
  const secretMatches = scanSecrets(uploadFiles, workspace.workspacePath);
  if (secretMatches.length > 0 && !options.force) {
    const files = [...new Set(secretMatches.map((m) => m.relativePath))].join(', ');
    throw new Error(`Secret scan: ${secretMatches.length} matches in ${files}\nPublish blocked. Use --force to override.`);
  }

  const ctx = {
    env: loadedEnv,
    runner,
    httpClient,
    now,
    scriptDir,
    dryRun: options.dryRun,
    force: options.force,
    presignedByFile: {},
    imageRefsNeeded: drivers.some((d) => d.needsPresignedImages === true),
  };
  const outputs = [];
  for (const driver of drivers) {
    const result = await driver.publish({ workspace, files: uploadFiles, flags: options, ctx });
    if (result && result.presignedByFile) Object.assign(ctx.presignedByFile, result.presignedByFile);
    outputs.push(...driver.formatReport(result));
  }
  return { output: outputs.join('\n') + '\n' };
}
```

**How `presignedByFile` flows:** the dispatcher constructs `ctx` once and passes the same reference to every driver in order. When `s3` runs and sees `ctx.imageRefsNeeded === true`, it mints presigned URLs for every uploaded file under `images/` (in addition to any explicit `--share` targets) and returns them on `result.presignedByFile`. The dispatcher merges those into `ctx.presignedByFile`. Subsequent drivers (`clickup`, `google-docs`) read from `ctx.presignedByFile` when they rewrite image paths. If `s3` is not in the driver list, the map stays empty and image rewriting is skipped with a warning.

Drivers that consume the map (clickup, google-docs) export `needsPresignedImages: true` at the top level alongside `name`. Drivers that produce it (s3) read `ctx.imageRefsNeeded` and act accordingly.

- [ ] **Step 4: Update `parseArgs` to accept `--to`**

In `parseArgs`, add a new option:

```js
options.to = [];
// ...
} else if (arg === '--to') {
  const value = requireValue(argv, ++i, '--to');
  if (!['s3', 'wiki', 'clickup', 'google-docs'].includes(value)) {
    throw new Error(`Unknown --to value: ${value}`);
  }
  options.to.push(value);
}
```

Also enforce the `--share` rule: when `options.to.length > 0` and `options.to` does not include `'s3'`, reject `--share`:

```js
if (options.shares.length > 0 && options.to.length > 0 && !options.to.includes('s3')) {
  throw new Error('--share requires --to s3 (or no --to flag for default behavior)');
}
```

Add a test in `publish-artifact.test.js` that confirms `parseArgs(['demo', '--to', 'wiki', '--share', 'markdown'])` throws and that `parseArgs(['demo', '--share', 'markdown'])` (no `--to`) does not throw.

- [ ] **Step 5: Move the `## Published` section writer + redacted-metadata upload into the s3 driver**

Inside `destinations/s3.js`, the `publish()` body owns:

1. building share targets and presigned URLs,
2. creating/updating gists,
3. writing the local `metadata.md` (`buildMetadata` + `fs.writeFileSync`),
4. uploading the redacted in-memory copy,
5. running `validateAttemptedCommands` and `validateNoCredentialLeak`.

This matches the spec's "s3 driver: existing behavior, no functional change."

Return shape from `publish()`:

```js
return {
  archive,
  uploaded,
  skipped,
  shareLinks,
  gistLinks,
  ttlLabel: flags.ttl,
  ghAuthed,
  noGist: flags.noGist,
  metadataPath: path.join(workspace.workspacePath, 'metadata.md'),
  presignedByFile,  // see imageRefsNeeded note below
};
```

**`imageRefsNeeded` handling inside the s3 driver:** after the upload loop, check `ctx.imageRefsNeeded`. When true, iterate every uploaded file whose relative path starts with `images/` and run `aws s3 presign` to mint a URL with TTL inherited from `flags.ttl`. Collect these into a `{ relativePath: url }` map and return it as `presignedByFile`. When `ctx.imageRefsNeeded` is false, return `presignedByFile: {}`. Existing `--share` targets still get their own presigned URLs as before; this map is in addition, not a replacement.

`formatReport(result)` returns the lines that `finalOutput` used to print, as an array of lines.

For `--dry-run`, the driver's `publish()` short-circuits to call `dryRunOutput` and returns `{ dryRun: true, lines: [...] }`; `formatReport` returns those lines.

- [ ] **Step 6: Run the full existing test suite to verify zero regression**

Run: `node --test skills/publish-artifact/scripts/publish-artifact.test.js`
Expected: every existing test passes without modification.

If any test fails, do NOT mutate the test. Re-read the driver code, find the behavior difference, and restore it.

- [ ] **Step 7: Add narrow s3-driver tests**

Create `skills/publish-artifact/scripts/destinations/s3.test.js`:

```js
const assert = require('assert');
const test = require('node:test');

const s3 = require('./s3.js');

test('s3 driver requires bucket and region env', () => {
  assert.deepEqual(s3.requiredEnv(), ['ARTIFACTS_S3_BUCKET', 'ARTIFACTS_S3_REGION']);
});

test('s3 driver rejects bare image share keyword', () => {
  assert.throws(() => s3.validateFlags({ shares: ['images'] }), /explicit image filename/);
});

test('s3 driver exposes helpers used by top-level tests', () => {
  assert.ok(typeof s3.helpers.buildGistCreateArgs === 'function');
  assert.ok(typeof s3.helpers.resolveShareTarget === 'function');
});
```

Run: `node --test skills/publish-artifact/scripts/destinations/s3.test.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add skills/publish-artifact/scripts/destinations/s3.js skills/publish-artifact/scripts/destinations/s3.test.js skills/publish-artifact/scripts/publish-artifact.js
git commit -m "refactor(publish-artifact): extract s3 driver and add --to dispatch"
```

### Task 7: Confirm Phase 1 is fully green

**Files:** none.

- [ ] **Step 1: Run every test file under the skill**

Run: `node --test skills/publish-artifact/scripts/publish-artifact.test.js skills/publish-artifact/scripts/common/*.test.js skills/publish-artifact/scripts/destinations/*.test.js`
Expected: every test passes.

- [ ] **Step 2: Confirm `parseArgs` `--to s3` short-circuits to the same code path as no `--to`**

Add a regression test in `publish-artifact.test.js`:

```js
test('runPublish with --to s3 matches default behavior byte-for-byte for dry-run', async () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'publish-eq-'));
  const workspace = path.join(root, 'demo');
  fs.mkdirSync(path.join(workspace, 'markdown'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'markdown', 'doc.md'), '# Doc\n');

  const base = { env: { ARTIFACTS_S3_BUCKET: 'b', ARTIFACTS_S3_REGION: 'us-east-1' }, runner: async () => ({ stdout: '', stderr: '', status: 0 }), now: new Date('2026-05-17T12:00:00Z') };
  const defaultOut = (await publish.runPublish({ ...base, argv: ['demo', '--workspace-root', root, '--dry-run'] })).output;
  const explicitOut = (await publish.runPublish({ ...base, argv: ['demo', '--workspace-root', root, '--to', 's3', '--dry-run'] })).output;
  assert.equal(defaultOut, explicitOut);
});
```

Run: `node --test skills/publish-artifact/scripts/publish-artifact.test.js`
Expected: the new test passes alongside the existing ones.

- [ ] **Step 3: Commit**

```bash
git add skills/publish-artifact/scripts/publish-artifact.test.js
git commit -m "test(publish-artifact): verify --to s3 matches default dry-run"
```

---

## Phase 2 — Wiki driver

### Task 8: Wiki driver tests

**Files:**
- Create: `skills/publish-artifact/scripts/destinations/wiki.test.js`

- [ ] **Step 1: Write the wiki driver tests first**

Create `skills/publish-artifact/scripts/destinations/wiki.test.js`:

```js
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const wiki = require('./wiki.js');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-test-'));
}

function recordingRunner(responses = {}) {
  const calls = [];
  return {
    calls,
    run: async (cmd, args, options = {}) => {
      calls.push({ cmd, args, options });
      const key = `${cmd} ${args[0] || ''}`;
      if (responses[key]) return responses[key];
      return { stdout: '', stderr: '', status: 0 };
    },
  };
}

test('wiki driver requires no environment variables', () => {
  assert.deepEqual(wiki.requiredEnv(), []);
});

test('wiki driver validateFlags requires owner/repo format', () => {
  assert.throws(() => wiki.validateFlags({ wikiRepo: 'bad-format' }), /owner\/repo/);
  assert.doesNotThrow(() => wiki.validateFlags({ wikiRepo: 'user/repo' }));
  assert.doesNotThrow(() => wiki.validateFlags({}));
});

test('wiki driver auto-detects repo via gh repo view when --wiki-repo is absent', async () => {
  const workspace = tempDir();
  fs.mkdirSync(path.join(workspace, 'markdown'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'markdown', 'doc.md'), '# Doc\n');
  const tmp = tempDir();
  const { run, calls } = recordingRunner({
    'gh repo': { stdout: JSON.stringify({ nameWithOwner: 'me/proj' }) + '\n', stderr: '', status: 0 },
  });
  const result = await wiki.publish({
    workspace: { workspacePath: workspace, slug: 'demo' },
    files: [{ fullPath: path.join(workspace, 'markdown', 'doc.md'), relativePath: 'markdown/doc.md', size: 6 }],
    flags: { wikiRepo: null, dryRun: false, force: false },
    ctx: { env: {}, runner: run, now: new Date('2026-05-17T12:00:00Z'), makeTmpDir: () => tmp },
  });
  assert.equal(result.owner, 'me');
  assert.equal(result.repo, 'proj');
  assert.ok(calls.some((c) => c.cmd === 'gh' && c.args[0] === 'repo'));
});

test('wiki driver returns clear error when clone fails because wiki has no pages', async () => {
  const workspace = tempDir();
  fs.mkdirSync(path.join(workspace, 'markdown'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'markdown', 'doc.md'), '# Doc\n');
  const tmp = tempDir();
  const { run } = recordingRunner({
    'gh repo': { stdout: JSON.stringify({ nameWithOwner: 'me/proj' }) + '\n', stderr: '', status: 0 },
    'git clone': { stdout: '', stderr: 'fatal: repository not found', status: 128 },
  });
  await assert.rejects(
    wiki.publish({
      workspace: { workspacePath: workspace, slug: 'demo' },
      files: [{ fullPath: path.join(workspace, 'markdown', 'doc.md'), relativePath: 'markdown/doc.md', size: 6 }],
      flags: { wikiRepo: null, dryRun: false, force: false },
      ctx: { env: {}, runner: run, now: new Date('2026-05-17T12:00:00Z'), makeTmpDir: () => tmp },
    }),
    /wiki not initialized/,
  );
});

test('wiki driver dry-run reports planned actions without running git push', async () => {
  const workspace = tempDir();
  fs.mkdirSync(path.join(workspace, 'markdown'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'markdown', 'doc.md'), '# Doc\n');
  const { run, calls } = recordingRunner();
  const result = await wiki.publish({
    workspace: { workspacePath: workspace, slug: 'demo' },
    files: [{ fullPath: path.join(workspace, 'markdown', 'doc.md'), relativePath: 'markdown/doc.md', size: 6 }],
    flags: { wikiRepo: 'me/proj', dryRun: true, force: false },
    ctx: { env: {}, runner: run, now: new Date('2026-05-17T12:00:00Z'), makeTmpDir: () => tempDir() },
  });
  assert.ok(result.dryRun);
  assert.ok(!calls.some((c) => c.cmd === 'git' && c.args[0] === 'push'));
  const report = wiki.formatReport(result);
  assert.ok(report.every((line) => line.startsWith('[dry-run]')));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test skills/publish-artifact/scripts/destinations/wiki.test.js`
Expected: FAIL with `Cannot find module './wiki.js'`.

### Task 9: Wiki driver implementation

**Files:**
- Create: `skills/publish-artifact/scripts/destinations/wiki.js`
- Modify: `skills/publish-artifact/scripts/publish-artifact.js` (register the driver, parse `--wiki-repo`)

- [ ] **Step 1: Implement `destinations/wiki.js`**

Create `skills/publish-artifact/scripts/destinations/wiki.js`:

```js
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const WIKI_REPO_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

function isWikiNotInitialized(stderr) {
  return /repository not found/i.test(stderr) || /not found/i.test(stderr);
}

async function detectRepo(runner, env) {
  const result = await runner('gh', ['repo', 'view', '--json', 'nameWithOwner'], { env });
  if (result.status !== 0) {
    throw new Error('Unable to detect repo via `gh repo view`. Pass --wiki-repo <owner/repo>.');
  }
  const parsed = JSON.parse(result.stdout.trim() || '{}');
  if (!parsed.nameWithOwner) throw new Error('gh repo view did not return nameWithOwner.');
  return parsed.nameWithOwner;
}

function copyTree(src, dest) {
  if (!fs.existsSync(src)) return [];
  const copied = [];
  function walk(currentSrc, currentDest) {
    fs.mkdirSync(currentDest, { recursive: true });
    for (const entry of fs.readdirSync(currentSrc, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const s = path.join(currentSrc, entry.name);
      const d = path.join(currentDest, entry.name);
      if (entry.isDirectory()) walk(s, d);
      else if (entry.isFile()) {
        fs.copyFileSync(s, d);
        copied.push(path.relative(dest, d));
      }
    }
  }
  walk(src, dest);
  return copied;
}

const driver = {
  name: 'wiki',

  requiredEnv() { return []; },

  validateFlags(flags) {
    if (flags.wikiRepo && !WIKI_REPO_PATTERN.test(flags.wikiRepo)) {
      throw new Error('--wiki-repo must be in owner/repo format');
    }
  },

  async publish({ workspace, files, flags, ctx }) {
    const owner_repo = flags.wikiRepo || await detectRepo(ctx.runner, ctx.env);
    const [owner, repo] = owner_repo.split('/');
    const url = `git@github.com:${owner}/${repo}.wiki.git`;
    const tmp = (ctx.makeTmpDir || makeTmpDir)();

    if (flags.dryRun) {
      const sources = ['markdown', 'html', 'images', 'assets'].filter((d) => fs.existsSync(path.join(workspace.workspacePath, d)));
      return { dryRun: true, owner, repo, url, sources, tmp };
    }

    const clone = await ctx.runner('git', ['clone', '--depth', '1', url, tmp], { env: ctx.env });
    if (clone.status !== 0) {
      cleanupTmp(tmp);
      if (isWikiNotInitialized(clone.stderr || clone.stdout)) {
        throw new Error(`wiki not initialized — create the first page at https://github.com/${owner}/${repo}/wiki and retry`);
      }
      throw new Error(`git clone failed for ${url}: ${(clone.stderr || clone.stdout).trim()}`);
    }

    let copiedAny = false;
    for (const dir of ['markdown', 'html', 'images', 'assets']) {
      const src = path.join(workspace.workspacePath, dir);
      if (!fs.existsSync(src)) continue;
      const copied = copyTree(src, path.join(tmp, dir));
      if (copied.length > 0) copiedAny = true;
    }

    if (!copiedAny) {
      cleanupTmp(tmp);
      return { owner, repo, url, pushed: false, reason: 'no source files to publish' };
    }

    const add = await ctx.runner('git', ['-C', tmp, 'add', '-A'], { env: ctx.env });
    if (add.status !== 0) {
      cleanupTmp(tmp);
      throw new Error(`git add failed: ${(add.stderr || add.stdout).trim()}`);
    }

    const status = await ctx.runner('git', ['-C', tmp, 'status', '--porcelain'], { env: ctx.env });
    if (status.status === 0 && status.stdout.trim() === '') {
      cleanupTmp(tmp);
      return { owner, repo, url, pushed: false, reason: 'wiki already up to date' };
    }

    const message = `publish-artifact: ${workspace.slug} @ ${ctx.now.toISOString()}`;
    const commit = await ctx.runner('git', ['-C', tmp, 'commit', '-m', message], { env: ctx.env });
    if (commit.status !== 0) {
      cleanupTmp(tmp);
      throw new Error(`git commit failed: ${(commit.stderr || commit.stdout).trim()}`);
    }

    const push = await ctx.runner('git', ['-C', tmp, 'push'], { env: ctx.env });
    cleanupTmp(tmp);
    if (push.status !== 0) {
      throw new Error(`git push failed for ${url}: ${(push.stderr || push.stdout).trim()}`);
    }

    const pageUrls = files
      .filter((f) => f.relativePath.startsWith('markdown/') && f.relativePath.endsWith('.md'))
      .map((f) => {
        const page = path.basename(f.relativePath, '.md');
        return { relativePath: f.relativePath, url: `https://github.com/${owner}/${repo}/wiki/${encodeURIComponent(page)}` };
      });

    return { owner, repo, url, pushed: true, pageUrls };
  },

  formatReport(result) {
    if (result.dryRun) {
      const lines = [`[dry-run] Wiki: ${result.url}`];
      for (const src of result.sources) lines.push(`[dry-run]   would mirror ${src}/`);
      lines.push('[dry-run] Would run git add -A, git commit, git push');
      return lines;
    }
    if (!result.pushed) {
      return [`Wiki: ${result.url} — ${result.reason}`];
    }
    const lines = [`Wiki: ${result.url} (pushed)`];
    for (const page of result.pageUrls || []) {
      lines.push(`- ${page.relativePath} — ${page.url}`);
    }
    return lines;
  },
};

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), `publish-artifact-wiki-${crypto.randomBytes(4).toString('hex')}-`));
}

function cleanupTmp(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

module.exports = driver;
```

- [ ] **Step 2: Run the wiki tests to verify they pass**

Run: `node --test skills/publish-artifact/scripts/destinations/wiki.test.js`
Expected: PASS.

- [ ] **Step 3: Register the wiki driver in the dispatcher**

In `publish-artifact.js`:

1. `const wiki = require('./destinations/wiki.js');`
2. Update the driver lookup inside `runPublish`:

```js
const driverByName = { s3, wiki };
const drivers = selectedDriverNames.map((name) => {
  const d = driverByName[name];
  if (!d) throw new Error(`Unknown destination: ${name}`);
  return d;
});
```

3. In `parseArgs`, add `--wiki-repo`:

```js
} else if (arg === '--wiki-repo') {
  options.wikiRepo = requireValue(argv, ++i, '--wiki-repo');
}
```

And initialize `options.wikiRepo = null` near the top of `parseArgs`.

- [ ] **Step 4: Run all tests**

Run: `node --test skills/publish-artifact/scripts/publish-artifact.test.js skills/publish-artifact/scripts/common/*.test.js skills/publish-artifact/scripts/destinations/*.test.js`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add skills/publish-artifact/scripts/destinations/wiki.js skills/publish-artifact/scripts/destinations/wiki.test.js skills/publish-artifact/scripts/publish-artifact.js
git commit -m "feat(publish-artifact): add wiki destination driver"
```

---

## Phase 3 — ClickUp driver

### Task 10: ClickUp driver tests

**Files:**
- Create: `skills/publish-artifact/scripts/destinations/clickup.test.js`

- [ ] **Step 1: Write the tests first**

Create `skills/publish-artifact/scripts/destinations/clickup.test.js`:

```js
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const clickup = require('./clickup.js');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'clickup-test-'));
}

function mockHttpClient(routes) {
  const calls = [];
  return {
    calls,
    request: async (url, init = {}) => {
      calls.push({ url, init });
      for (const [pattern, response] of routes) {
        if (pattern instanceof RegExp ? pattern.test(url) : url.includes(pattern)) {
          const status = response.status || 200;
          return {
            ok: status >= 200 && status < 300,
            status,
            statusText: response.statusText || '',
            text: async () => response.body || '',
            json: async () => JSON.parse(response.body || '{}'),
          };
        }
      }
      throw new Error(`No mock route for ${url}`);
    },
  };
}

test('clickup driver requires CLICKUP_API_TOKEN', () => {
  assert.deepEqual(clickup.requiredEnv(), ['CLICKUP_API_TOKEN']);
});

test('clickup driver requires --clickup-parent or env defaults', () => {
  assert.throws(() => clickup.validateFlags({}), /clickup-parent/);
  assert.doesNotThrow(() => clickup.validateFlags({ clickupParent: 'workspace:123' }));
});

test('clickup driver creates a Doc when no match exists', async () => {
  const workspace = tempDir();
  fs.mkdirSync(path.join(workspace, 'markdown'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'markdown', 'doc.md'), '# Hello\n');
  const { request, calls } = mockHttpClient([
    [/\/docs\?/, { body: JSON.stringify({ docs: [] }) }],
    [/\/docs$/, { body: JSON.stringify({ id: 'doc-123', url: 'https://app.clickup.com/123/doc/doc-123' }) }],
  ]);
  const result = await clickup.publish({
    workspace: { workspacePath: workspace, slug: 'demo' },
    files: [{ fullPath: path.join(workspace, 'markdown', 'doc.md'), relativePath: 'markdown/doc.md', size: 8 }],
    flags: { clickupParent: 'workspace:wid', clickupDoc: null, to: ['clickup'], dryRun: false, force: false },
    ctx: { env: { CLICKUP_API_TOKEN: 'pk_1_TEST' }, httpClient: { request }, presignedByFile: {} },
  });
  assert.equal(result.created.length, 1);
  assert.equal(result.created[0].url, 'https://app.clickup.com/123/doc/doc-123');
  const createCall = calls.find((c) => c.init.method === 'POST');
  assert.match(createCall.init.headers.Authorization, /pk_1_TEST/);
});

test('clickup driver refuses to overwrite an existing Doc without --force', async () => {
  const workspace = tempDir();
  fs.mkdirSync(path.join(workspace, 'markdown'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'markdown', 'doc.md'), '# Hello\n');
  const { request } = mockHttpClient([
    [/\/docs\?/, { body: JSON.stringify({ docs: [{ id: 'doc-existing', name: 'doc', url: 'https://app.clickup.com/x/doc/doc-existing' }] }) }],
  ]);
  const result = await clickup.publish({
    workspace: { workspacePath: workspace, slug: 'demo' },
    files: [{ fullPath: path.join(workspace, 'markdown', 'doc.md'), relativePath: 'markdown/doc.md', size: 8 }],
    flags: { clickupParent: 'workspace:wid', clickupDoc: null, to: ['clickup'], dryRun: false, force: false },
    ctx: { env: { CLICKUP_API_TOKEN: 'pk_1_TEST' }, httpClient: { request }, presignedByFile: {} },
  });
  assert.equal(result.skipped.length, 1);
  assert.match(result.skipped[0].reason, /--force/);
});

test('clickup driver rewrites image paths only when s3 is in --to', async () => {
  const workspace = tempDir();
  fs.mkdirSync(path.join(workspace, 'markdown'), { recursive: true });
  fs.mkdirSync(path.join(workspace, 'images'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'markdown', 'doc.md'), '![alt](../images/pic.png)\n');
  fs.writeFileSync(path.join(workspace, 'images', 'pic.png'), 'png');
  const captured = [];
  const { request } = mockHttpClient([
    [/\/docs\?/, { body: JSON.stringify({ docs: [] }) }],
    [/\/docs$/, { body: JSON.stringify({ id: 'doc-1', url: 'https://app.clickup.com/x/doc/doc-1' }) }],
  ]);
  const httpClient = { request: async (url, init) => {
    if (init && init.method === 'POST') captured.push(init.body);
    return request(url, init);
  }};
  await clickup.publish({
    workspace: { workspacePath: workspace, slug: 'demo' },
    files: [{ fullPath: path.join(workspace, 'markdown', 'doc.md'), relativePath: 'markdown/doc.md', size: 27 }],
    flags: { clickupParent: 'workspace:wid', clickupDoc: null, to: ['s3', 'clickup'], dryRun: false, force: false },
    ctx: { env: { CLICKUP_API_TOKEN: 'pk_1_TEST' }, httpClient, presignedByFile: { 'images/pic.png': 'https://signed.example/pic.png' } },
  });
  const created = JSON.parse(captured[0]);
  assert.match(created.content, /https:\/\/signed\.example\/pic\.png/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test skills/publish-artifact/scripts/destinations/clickup.test.js`
Expected: FAIL with `Cannot find module './clickup.js'`.

### Task 11: ClickUp driver implementation

**Files:**
- Create: `skills/publish-artifact/scripts/destinations/clickup.js`
- Modify: `skills/publish-artifact/scripts/publish-artifact.js`

- [ ] **Step 1: Implement `destinations/clickup.js`**

Create `skills/publish-artifact/scripts/destinations/clickup.js`:

```js
const fs = require('fs');
const path = require('path');

const { rewriteImagePaths } = require('../common/markdown-rewrite.js');

const PARENT_TYPES = new Set(['workspace', 'space', 'folder', 'list']);

function parseParent(value) {
  if (!value) return null;
  const colon = value.indexOf(':');
  if (colon === -1) throw new Error('--clickup-parent must be <type>:<id>');
  const type = value.slice(0, colon);
  const id = value.slice(colon + 1);
  if (!PARENT_TYPES.has(type)) throw new Error(`--clickup-parent type must be one of ${Array.from(PARENT_TYPES).join(', ')}`);
  if (!id) throw new Error('--clickup-parent missing id');
  return { type, id };
}

function workspaceIdFromParent(env, parent) {
  if (parent.type === 'workspace') return parent.id;
  return env.CLICKUP_WORKSPACE_ID || (() => { throw new Error('CLICKUP_WORKSPACE_ID required when --clickup-parent is not workspace:<id>'); })();
}

const driver = {
  name: 'clickup',
  needsPresignedImages: true,

  requiredEnv() { return ['CLICKUP_API_TOKEN']; },

  validateFlags(flags) {
    const value = flags.clickupParent || (flags.clickupParentType && flags.clickupParentId ? `${flags.clickupParentType}:${flags.clickupParentId}` : null);
    if (!value) throw new Error('clickup destination requires --clickup-parent <type:id> (or CLICKUP_PARENT_TYPE + CLICKUP_PARENT_ID)');
    parseParent(value);
  },

  async publish({ workspace, files, flags, ctx }) {
    const parent = parseParent(flags.clickupParent || `${ctx.env.CLICKUP_PARENT_TYPE}:${ctx.env.CLICKUP_PARENT_ID}`);
    const workspaceId = workspaceIdFromParent(ctx.env, parent);
    const baseUrl = 'https://api.clickup.com/api/v3';
    const headers = {
      Authorization: ctx.env.CLICKUP_API_TOKEN,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const mdFiles = files.filter((f) => f.relativePath.startsWith('markdown/') && f.relativePath.endsWith('.md'));
    const rewriteEnabled = (flags.to || []).includes('s3') && ctx.presignedByFile;
    const created = [];
    const updated = [];
    const skipped = [];
    const warnings = [];

    for (const file of mdFiles) {
      const raw = fs.readFileSync(file.fullPath, 'utf8');
      let bodyContent = raw;
      if (rewriteEnabled) {
        const result = rewriteImagePaths(raw, { relativeMap: ctx.presignedByFile, sourceRelative: file.relativePath });
        bodyContent = result.content;
        warnings.push(...result.warnings);
      } else if (/!\[[^\]]*\]\([^)\s]+\)|<img\b/.test(raw)) {
        warnings.push(`Image references in ${file.relativePath} are not rewritten (add --to s3 to mint presigned URLs).`);
      }

      const docName = flags.clickupDoc || path.basename(file.relativePath, '.md');
      const searchUrl = `${baseUrl}/workspaces/${workspaceId}/docs?parent_id=${encodeURIComponent(parent.id)}&parent_type=${encodeURIComponent(parent.type)}`;
      if (flags.dryRun) {
        created.push({ relativePath: file.relativePath, dryRun: true, docName });
        continue;
      }

      const searchRes = await ctx.httpClient.request(searchUrl, { method: 'GET', headers });
      const searchData = await searchRes.json();
      const existing = (searchData.docs || []).find((d) => d.name === docName);

      if (existing) {
        if (!flags.force) {
          skipped.push({ relativePath: file.relativePath, docName, reason: 'Doc exists; pass --force to update' });
          continue;
        }
        const updateUrl = `${baseUrl}/workspaces/${workspaceId}/docs/${existing.id}`;
        const updateRes = await ctx.httpClient.request(updateUrl, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ name: docName, content: bodyContent }),
        });
        const updateData = await updateRes.json();
        updated.push({ relativePath: file.relativePath, docName, url: existing.url || updateData.url });
      } else {
        const createUrl = `${baseUrl}/workspaces/${workspaceId}/docs`;
        const createRes = await ctx.httpClient.request(createUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: docName, content: bodyContent, parent: { type: parent.type, id: parent.id } }),
        });
        const createData = await createRes.json();
        created.push({ relativePath: file.relativePath, docName, url: createData.url });
      }
    }

    return { created, updated, skipped, warnings };
  },

  formatReport(result) {
    const lines = [];
    if (result.created.length > 0) {
      lines.push('ClickUp docs created:');
      for (const c of result.created) {
        if (c.dryRun) lines.push(`[dry-run] - ${c.relativePath} would create doc "${c.docName}"`);
        else lines.push(`- ${c.relativePath} — ${c.url}`);
      }
    }
    if (result.updated.length > 0) {
      lines.push('ClickUp docs updated:');
      for (const u of result.updated) lines.push(`- ${u.relativePath} — ${u.url}`);
    }
    if (result.skipped.length > 0) {
      lines.push('ClickUp docs skipped:');
      for (const s of result.skipped) lines.push(`- ${s.relativePath} (${s.reason})`);
    }
    for (const w of result.warnings) lines.push(`Warning: ${w}`);
    return lines;
  },
};

module.exports = driver;
```

- [ ] **Step 2: Run the tests to verify they pass**

Run: `node --test skills/publish-artifact/scripts/destinations/clickup.test.js`
Expected: PASS.

- [ ] **Step 3: Register the clickup driver and parse its flags in `publish-artifact.js`**

In `publish-artifact.js`:

1. `const clickup = require('./destinations/clickup.js');`
2. Add to `driverByName`: `{ s3, wiki, clickup }`.
3. In `parseArgs`, add:

```js
} else if (arg === '--clickup-parent') {
  options.clickupParent = requireValue(argv, ++i, '--clickup-parent');
} else if (arg === '--clickup-doc') {
  options.clickupDoc = requireValue(argv, ++i, '--clickup-doc');
}
```

And initialize `options.clickupParent = null; options.clickupDoc = null;` near the top of `parseArgs`. Fall back to env in `runPublish` before passing to the driver:

```js
if (!options.clickupParent && loadedEnv.CLICKUP_PARENT_TYPE && loadedEnv.CLICKUP_PARENT_ID) {
  options.clickupParent = `${loadedEnv.CLICKUP_PARENT_TYPE}:${loadedEnv.CLICKUP_PARENT_ID}`;
}
```

4. Pass an `httpClient` into `ctx`. Lazy-construct it inside `runPublish`:

```js
const { createHttpClient } = require('./common/http.js');
// ...
const httpClient = options.httpClient || createHttpClient({ env: loadedEnv });
```

Allow tests to inject `httpClient` via `runPublish({ httpClient })`.

5. Build `presignedByFile` from the s3 driver's result. After running s3 (when it's in the driver list), capture `shareLinks` into a `{ relativePath: url }` map and put it on `ctx.presignedByFile`. If s3 was not selected, `ctx.presignedByFile = {}`.

- [ ] **Step 4: Run all tests**

Run: `node --test skills/publish-artifact/scripts/publish-artifact.test.js skills/publish-artifact/scripts/common/*.test.js skills/publish-artifact/scripts/destinations/*.test.js`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add skills/publish-artifact/scripts/destinations/clickup.js skills/publish-artifact/scripts/destinations/clickup.test.js skills/publish-artifact/scripts/publish-artifact.js
git commit -m "feat(publish-artifact): add clickup destination driver"
```

---

## Phase 4 — Google Docs driver

### Task 12: Google Docs driver tests

**Files:**
- Create: `skills/publish-artifact/scripts/destinations/google-docs.test.js`

- [ ] **Step 1: Write the tests first**

Create `skills/publish-artifact/scripts/destinations/google-docs.test.js`:

```js
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const gdocs = require('./google-docs.js');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gdocs-test-'));
}

function mockHttp(routes) {
  const calls = [];
  return {
    calls,
    request: async (url, init = {}) => {
      calls.push({ url, init });
      for (const [pattern, response] of routes) {
        if (pattern instanceof RegExp ? pattern.test(url) : url.includes(pattern)) {
          const status = response.status || 200;
          return {
            ok: status >= 200 && status < 300,
            status,
            statusText: '',
            text: async () => response.body || '',
            json: async () => JSON.parse(response.body || '{}'),
          };
        }
      }
      throw new Error(`No mock route for ${url}`);
    },
  };
}

test('google-docs driver requires Drive folder', () => {
  assert.throws(() => gdocs.validateFlags({}), /folder/);
  assert.doesNotThrow(() => gdocs.validateFlags({ googleFolder: 'folder-abc' }));
});

test('google-docs driver refuses GOOGLE_APPLICATION_CREDENTIALS inside the workspace', async () => {
  const workspace = tempDir();
  fs.mkdirSync(path.join(workspace, 'markdown'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'markdown', 'doc.md'), '# Hello\n');
  const inside = path.join(workspace, 'sa.json');
  fs.writeFileSync(inside, '{}');
  await assert.rejects(
    gdocs.publish({
      workspace: { workspacePath: workspace, slug: 'demo' },
      files: [{ fullPath: path.join(workspace, 'markdown', 'doc.md'), relativePath: 'markdown/doc.md', size: 8 }],
      flags: { googleFolder: 'folder-abc', googleDoc: null, to: ['google-docs'], dryRun: false, force: false },
      ctx: {
        env: { GOOGLE_APPLICATION_CREDENTIALS: inside },
        httpClient: { request: async () => { throw new Error('should not be called'); } },
        presignedByFile: {},
        fetchAccessToken: async () => 'token',
      },
    }),
    /must live outside the repo and workspace/,
  );
});

test('google-docs driver creates a Doc when no match exists', async () => {
  const workspace = tempDir();
  fs.mkdirSync(path.join(workspace, 'markdown'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'markdown', 'doc.md'), '# Hello\n');
  const { request, calls } = mockHttp([
    [/drive\/v3\/files\?q=/, { body: JSON.stringify({ files: [] }) }],
    [/upload\/drive\/v3\/files\?uploadType=multipart/, { body: JSON.stringify({ id: 'gdoc-1' }) }],
  ]);
  const result = await gdocs.publish({
    workspace: { workspacePath: workspace, slug: 'demo' },
    files: [{ fullPath: path.join(workspace, 'markdown', 'doc.md'), relativePath: 'markdown/doc.md', size: 8 }],
    flags: { googleFolder: 'folder-abc', googleDoc: null, to: ['google-docs'], dryRun: false, force: false },
    ctx: { env: {}, httpClient: { request }, presignedByFile: {}, fetchAccessToken: async () => 'token-xyz' },
  });
  assert.equal(result.created[0].url, 'https://docs.google.com/document/d/gdoc-1/edit');
  const upload = calls.find((c) => /upload\/drive/.test(c.url));
  assert.match(upload.init.headers.Authorization, /Bearer token-xyz/);
});

test('google-docs driver refuses to overwrite without --force', async () => {
  const workspace = tempDir();
  fs.mkdirSync(path.join(workspace, 'markdown'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'markdown', 'doc.md'), '# Hello\n');
  const { request } = mockHttp([
    [/drive\/v3\/files\?q=/, { body: JSON.stringify({ files: [{ id: 'existing-1', name: 'doc' }] }) }],
  ]);
  const result = await gdocs.publish({
    workspace: { workspacePath: workspace, slug: 'demo' },
    files: [{ fullPath: path.join(workspace, 'markdown', 'doc.md'), relativePath: 'markdown/doc.md', size: 8 }],
    flags: { googleFolder: 'folder-abc', googleDoc: null, to: ['google-docs'], dryRun: false, force: false },
    ctx: { env: {}, httpClient: { request }, presignedByFile: {}, fetchAccessToken: async () => 'token' },
  });
  assert.equal(result.skipped[0].reason, 'Doc exists; pass --force to update');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test skills/publish-artifact/scripts/destinations/google-docs.test.js`
Expected: FAIL with `Cannot find module './google-docs.js'`.

### Task 13: Google Docs driver implementation

**Files:**
- Create: `skills/publish-artifact/scripts/destinations/google-docs.js`
- Modify: `skills/publish-artifact/scripts/publish-artifact.js`

- [ ] **Step 1: Implement `destinations/google-docs.js`**

Create `skills/publish-artifact/scripts/destinations/google-docs.js`:

```js
const fs = require('fs');
const path = require('path');

const { rewriteImagePaths } = require('../common/markdown-rewrite.js');

function assertCredentialsOutside(credPath, workspacePath, scriptDir) {
  if (!credPath) return;
  const abs = path.resolve(credPath);
  const checks = [workspacePath, scriptDir, path.dirname(path.dirname(scriptDir))];
  for (const root of checks) {
    if (!root) continue;
    const absRoot = path.resolve(root);
    if (abs === absRoot || abs.startsWith(absRoot + path.sep)) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS must live outside the repo and workspace');
    }
  }
}

async function defaultAccessToken(env, runner) {
  if (env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('Service-account JSON support without ADC is not implemented in v1; activate the account via `gcloud auth application-default login --impersonate-service-account` or set ADC directly.');
  }
  const result = await runner('gcloud', ['auth', 'application-default', 'print-access-token'], { env });
  if (result.status !== 0) {
    throw new Error(`gcloud ADC token fetch failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.trim();
}

const driver = {
  name: 'google-docs',
  needsPresignedImages: true,

  requiredEnv() { return []; },

  validateFlags(flags) {
    if (!flags.googleFolder) throw new Error('google-docs destination requires --google-folder <drive-folder-id> (or GOOGLE_DRIVE_PARENT_ID)');
  },

  async publish({ workspace, files, flags, ctx }) {
    assertCredentialsOutside(ctx.env.GOOGLE_APPLICATION_CREDENTIALS, workspace.workspacePath, ctx.scriptDir);

    const token = ctx.fetchAccessToken
      ? await ctx.fetchAccessToken()
      : await defaultAccessToken(ctx.env, ctx.runner);
    const authHeader = { Authorization: `Bearer ${token}` };

    const mdFiles = files.filter((f) => f.relativePath.startsWith('markdown/') && f.relativePath.endsWith('.md'));
    const rewriteEnabled = (flags.to || []).includes('s3') && ctx.presignedByFile;
    const created = [];
    const updated = [];
    const skipped = [];
    const warnings = [];

    for (const file of mdFiles) {
      const raw = fs.readFileSync(file.fullPath, 'utf8');
      let bodyContent = raw;
      if (rewriteEnabled) {
        const r = rewriteImagePaths(raw, { relativeMap: ctx.presignedByFile, sourceRelative: file.relativePath });
        bodyContent = r.content;
        warnings.push(...r.warnings);
      } else if (/!\[[^\]]*\]\([^)\s]+\)|<img\b/.test(raw)) {
        warnings.push(`Image references in ${file.relativePath} are not rewritten (add --to s3 to mint presigned URLs).`);
      }

      const docName = flags.googleDoc || path.basename(file.relativePath, '.md');
      if (flags.dryRun) {
        created.push({ relativePath: file.relativePath, dryRun: true, docName });
        continue;
      }

      const q = encodeURIComponent(`name='${docName.replace(/'/g, "\\'")}' and '${flags.googleFolder}' in parents and mimeType='application/vnd.google-apps.document' and trashed=false`);
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${q}&supportsAllDrives=true&includeItemsFromAllDrives=true`;
      const searchRes = await ctx.httpClient.request(searchUrl, { method: 'GET', headers: authHeader });
      const searchData = await searchRes.json();
      const match = (searchData.files || [])[0];

      if (match) {
        if (!flags.force) {
          skipped.push({ relativePath: file.relativePath, docName, reason: 'Doc exists; pass --force to update' });
          continue;
        }
        const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${match.id}?uploadType=media&supportsAllDrives=true`;
        await ctx.httpClient.request(updateUrl, {
          method: 'PATCH',
          headers: { ...authHeader, 'Content-Type': 'text/markdown' },
          body: bodyContent,
        });
        updated.push({ relativePath: file.relativePath, docName, url: `https://docs.google.com/document/d/${match.id}/edit` });
      } else {
        const boundary = 'publish_artifact_boundary_' + Math.random().toString(16).slice(2);
        const metadata = { name: docName, parents: [flags.googleFolder], mimeType: 'application/vnd.google-apps.document' };
        const body =
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
          JSON.stringify(metadata) + `\r\n--${boundary}\r\nContent-Type: text/markdown\r\n\r\n` +
          bodyContent + `\r\n--${boundary}--`;
        const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true';
        const res = await ctx.httpClient.request(uploadUrl, {
          method: 'POST',
          headers: { ...authHeader, 'Content-Type': `multipart/related; boundary=${boundary}` },
          body,
        });
        const data = await res.json();
        created.push({ relativePath: file.relativePath, docName, url: `https://docs.google.com/document/d/${data.id}/edit` });
      }
    }

    return { created, updated, skipped, warnings };
  },

  formatReport(result) {
    const lines = [];
    if (result.created.length > 0) {
      lines.push('Google Docs created:');
      for (const c of result.created) {
        if (c.dryRun) lines.push(`[dry-run] - ${c.relativePath} would create doc "${c.docName}"`);
        else lines.push(`- ${c.relativePath} — ${c.url}`);
      }
    }
    if (result.updated.length > 0) {
      lines.push('Google Docs updated:');
      for (const u of result.updated) lines.push(`- ${u.relativePath} — ${u.url}`);
    }
    if (result.skipped.length > 0) {
      lines.push('Google Docs skipped:');
      for (const s of result.skipped) lines.push(`- ${s.relativePath} (${s.reason})`);
    }
    for (const w of result.warnings) lines.push(`Warning: ${w}`);
    return lines;
  },
};

module.exports = driver;
```

- [ ] **Step 2: Run the tests to verify they pass**

Run: `node --test skills/publish-artifact/scripts/destinations/google-docs.test.js`
Expected: PASS.

- [ ] **Step 3: Register the driver in `publish-artifact.js`**

In `publish-artifact.js`:

1. `const googleDocs = require('./destinations/google-docs.js');`
2. Add to `driverByName`: `{ s3, wiki, clickup, 'google-docs': googleDocs }`.
3. In `parseArgs`:

```js
} else if (arg === '--google-folder') {
  options.googleFolder = requireValue(argv, ++i, '--google-folder');
} else if (arg === '--google-doc') {
  options.googleDoc = requireValue(argv, ++i, '--google-doc');
}
```

Initialize `options.googleFolder = null; options.googleDoc = null;`. Inside `runPublish`, fall back to env:

```js
if (!options.googleFolder && loadedEnv.GOOGLE_DRIVE_PARENT_ID) {
  options.googleFolder = loadedEnv.GOOGLE_DRIVE_PARENT_ID;
}
```

- [ ] **Step 4: Run all tests**

Run: `node --test skills/publish-artifact/scripts/publish-artifact.test.js skills/publish-artifact/scripts/common/*.test.js skills/publish-artifact/scripts/destinations/*.test.js`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add skills/publish-artifact/scripts/destinations/google-docs.js skills/publish-artifact/scripts/destinations/google-docs.test.js skills/publish-artifact/scripts/publish-artifact.js
git commit -m "feat(publish-artifact): add google-docs destination driver"
```

---

## Phase 5 — Documentation

### Task 14: Update `SKILL.md`

**Files:**
- Modify: `skills/publish-artifact/SKILL.md`

- [ ] **Step 1: Update the front-matter `description`**

Replace the existing `description:` line with:

```
description: Publish a ~/agent-artifacts/<slug>/ workspace to one or more destinations (S3, GitHub Wikis, ClickUp Docs, Google Docs/Drive). Explicit command only; never auto-triggered; never makes any S3 bucket public.
```

- [ ] **Step 2: Restructure existing S3 content under `## S3 Destination`**

Move the existing `## Configuration`, `## Script Behavior`, `## Secret Scan`, `## S3 Safety`, `## Metadata`, and `## Gists` sections under a new H2: `## S3 Destination`. Each becomes an H3 under it. The content is unchanged.

- [ ] **Step 3: Add a `## Destinations` overview section above the per-destination details**

After `## When Not To Use`, add:

```markdown
## Destinations

Select one or more with repeatable `--to <name>` flags. With no `--to`, the script runs the S3 + optional gist flow exactly as the previous version.

- `s3` — private S3 archive plus optional presigned URLs and secret gists. Required env: `ARTIFACTS_S3_BUCKET`, `ARTIFACTS_S3_REGION`.
- `wiki` — push workspace contents to `<owner>/<repo>.wiki.git` as a single atomic commit. Auth via `gh` or SSH agent. Required flag (optional if auto-detectable): `--wiki-repo <owner/repo>`.
- `clickup` — create or update a ClickUp Doc per Markdown file. Required env: `CLICKUP_API_TOKEN`. Required flag (or env defaults): `--clickup-parent <type:id>` where type is `workspace|space|folder|list`.
- `google-docs` — create or update a Google Doc per Markdown file under a Drive folder. Required: ADC active or `GOOGLE_APPLICATION_CREDENTIALS` outside the repo and workspace. Required flag (or `GOOGLE_DRIVE_PARENT_ID`): `--google-folder <drive-folder-id>`.

Image references from `markdown/` files are rewritten to S3 presigned URLs only when `--to s3` is also selected. Without `s3`, image refs are left as-is and the report includes a warning.
```

- [ ] **Step 4: Replace the existing `When Not To Use` line on ClickUp / Google Drive**

Replace:

```
- Do not use this for Google Drive, ClickUp, Google Docs, or native-format conversion.
```

with:

```
- Do not use this for Notion, Confluence, or generic webhook destinations in v1.
```

- [ ] **Step 5: Add a `## Security` section before `## Cautions`**

```markdown
## Security

These rules are non-negotiable. Tests enforce the ones that can be enforced statically; reviewers enforce the rest.

- No credential is ever read from a CLI flag, written to `metadata.md`, or printed in logs or error output. Token-shaped strings are redacted before any error is surfaced.
- All HTTP calls are HTTPS-only. The shared `common/http.js` wrapper rejects `http://` URLs and never sets `NODE_TLS_REJECT_UNAUTHORIZED=0`.
- HTTP requests use native `fetch` (Node 18+), a per-call timeout, and exponential backoff with jitter on 429 and 5xx responses. Other 4xx responses fail fast.
- Workspace slugs must match `^[A-Za-z0-9._-]+$` and resolve under `~/agent-artifacts/`. Path traversal attempts fail at slug resolution.
- `--wiki-repo` must match `^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$`.
- The secret scan blocks before any destination publishes when it sees AWS, GitHub, Anthropic/OpenAI, Slack, JWT, private-key, ClickUp, Google API, or service-account JSON markers.
- `GOOGLE_APPLICATION_CREDENTIALS` must point to a file outside the repo and the workspace. The driver refuses to start otherwise.
- Subprocess calls (`aws`, `gh`, `git`, `gcloud`) use argv arrays, never shell strings.
- No new runtime dependency is introduced. The skill relies only on Node built-ins and the installed CLIs above.
```

- [ ] **Step 6: Add manual smoke tests under each per-destination section**

After each per-destination explanation, add a fenced block guarded by env vars, for example for ClickUp:

```sh
# Manual smoke (requires CLICKUP_API_TOKEN and a parent ID you control)
CLICKUP_API_TOKEN=$CLICKUP_API_TOKEN \
node skills/publish-artifact/scripts/publish-artifact.js my-slug \
  --to clickup --clickup-parent workspace:$CLICKUP_WORKSPACE_ID --dry-run
```

- [ ] **Step 7: Commit**

```bash
git add skills/publish-artifact/SKILL.md
git commit -m "docs(publish-artifact): document multi-destination support and security baseline"
```

### Task 15: Update `.env.example`

**Files:**
- Modify: `skills/publish-artifact/.env.example` (create if absent)

- [ ] **Step 1: Check whether the file exists**

Run: `ls skills/publish-artifact/.env.example 2>&1`

If it does not exist, create it.

- [ ] **Step 2: Set the file contents**

Set the contents of `skills/publish-artifact/.env.example` to:

```sh
# S3 (existing)
ARTIFACTS_S3_BUCKET=
ARTIFACTS_S3_REGION=
ARTIFACTS_S3_PREFIX=
AWS_PROFILE=

# Wiki destination uses gh / git; no env vars needed.

# ClickUp
CLICKUP_API_TOKEN=
CLICKUP_PARENT_TYPE=
CLICKUP_PARENT_ID=
CLICKUP_WORKSPACE_ID=

# Google Docs / Drive
GOOGLE_DRIVE_PARENT_ID=
# GOOGLE_APPLICATION_CREDENTIALS is a path to a service-account JSON.
# Never put the credential bytes themselves in this file.
GOOGLE_APPLICATION_CREDENTIALS=
```

- [ ] **Step 3: Commit**

```bash
git add skills/publish-artifact/.env.example
git commit -m "docs(publish-artifact): add destination env vars to .env.example"
```

### Task 16: Final integration sweep

**Files:** none.

- [ ] **Step 1: Run every test in the skill**

Run: `node --test skills/publish-artifact/scripts/publish-artifact.test.js skills/publish-artifact/scripts/common/*.test.js skills/publish-artifact/scripts/destinations/*.test.js`
Expected: every test passes.

- [ ] **Step 2: Confirm the dry-run path works for every destination without making network or git calls**

Run from a workspace that contains a `markdown/` directory:

```sh
node skills/publish-artifact/scripts/publish-artifact.js demo --workspace-root /tmp/empty --dry-run --to s3 --to wiki --wiki-repo me/proj
```

(use a temporary workspace you create for this — the script must report `[dry-run]` lines and not mutate anything.)

Expected: each driver's dry-run lines appear, prefixed `[dry-run]`. No clones, no presigns, no HTTP, no metadata write.

- [ ] **Step 3: Search the diff for accidental vendor names or hard-coded credentials**

Run: `git diff main -- skills/publish-artifact | grep -iE 'AKIA|ghp_|pk_[0-9]|AIza' || echo "no leaks"`
Expected: `no leaks`.

- [ ] **Step 4: Final commit (only if any small fixups land)**

```bash
git status
# If there are pending small fixes, commit them with a single descriptive message.
```

---

## Acceptance Criteria

Each item must be true before declaring this plan complete:

- [ ] Every existing test in `publish-artifact.test.js` still passes without modification.
- [ ] Every new module test (`common/*.test.js`, `destinations/*.test.js`) passes.
- [ ] `runPublish` with no `--to` produces identical output to `runPublish` with `--to s3` for an equivalent dry-run.
- [ ] No new runtime dependency was added to `package.json` (the skill currently has none; do not add).
- [ ] No HTTP destination ever makes a `http://` request — `common/http.js` blocks it; tests confirm.
- [ ] No driver reads credentials from CLI flags.
- [ ] `--share` is rejected when `--to` is explicit and does not include `s3`.
- [ ] `GOOGLE_APPLICATION_CREDENTIALS` resolving inside the repo or the workspace causes the google-docs driver to refuse to start.
- [ ] The wiki driver prints a clear "wiki not initialized" message when GitHub returns "repository not found".
- [ ] The secret scan detects ClickUp tokens (`pk_<digits>_<...>`), Google API keys (`AIza...`), and service-account JSON markers.
- [ ] `SKILL.md` lists every destination, its required env, its required flags, and a manual smoke test invocation.
