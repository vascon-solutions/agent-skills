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
    /Workspace not found|Invalid slug/,
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

test('resolveWorkspace rejects absolute paths outside the workspace root', () => {
  const root = tempDir();
  const outside = tempDir();
  write(path.join(outside, 'markdown', 'doc.md'), '# Doc\n');
  assert.throws(
    () => workspace.resolveWorkspace(outside, { workspaceRoot: root, homeDir: root }),
    /outside workspace root/,
  );
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
