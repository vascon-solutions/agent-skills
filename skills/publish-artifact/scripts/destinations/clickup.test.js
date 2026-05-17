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
  const httpClient = {
    request: async (url, init) => {
      if (init && init.method === 'POST') captured.push(init.body);
      return request(url, init);
    },
  };
  await clickup.publish({
    workspace: { workspacePath: workspace, slug: 'demo' },
    files: [{ fullPath: path.join(workspace, 'markdown', 'doc.md'), relativePath: 'markdown/doc.md', size: 27 }],
    flags: { clickupParent: 'workspace:wid', clickupDoc: null, to: ['s3', 'clickup'], dryRun: false, force: false },
    ctx: { env: { CLICKUP_API_TOKEN: 'pk_1_TEST' }, httpClient, presignedByFile: { 'images/pic.png': 'https://signed.example/pic.png' } },
  });
  const created = JSON.parse(captured[0]);
  assert.match(created.content, /https:\/\/signed\.example\/pic\.png/);
});
