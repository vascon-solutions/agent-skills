const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const { scanSecrets, IMAGE_EXTENSIONS } = require('./secret-scan.js');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'secret-scan-test-'));
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
  const sa = matches.filter((m) => m.pattern === 'Service account JSON');
  assert.equal(sa.length, 1);
});

test('scanSecrets ignores image binaries', () => {
  const ws = tempDir();
  fs.mkdirSync(path.join(ws, 'images'), { recursive: true });
  fs.writeFileSync(path.join(ws, 'images', 'pic.png'), 'pk_12345_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345');
  const matches = scanSecrets([{ fullPath: path.join(ws, 'images', 'pic.png'), relativePath: 'images/pic.png', size: 0 }], ws);
  assert.equal(matches.length, 0);
  assert.ok(IMAGE_EXTENSIONS.has('.png'));
});
