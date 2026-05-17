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

test('google-docs driver can fetch an access token from service-account JSON outside the workspace', async () => {
  const workspace = tempDir();
  const credDir = tempDir();
  fs.mkdirSync(path.join(workspace, 'markdown'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'markdown', 'doc.md'), '# Hello\n');
  const privateKey = [
    '-----BEGIN PRIVATE KEY-----',
    'MIIEvQIBADANBgkqhkiG9w0BAQEFAASC',
    '-----END PRIVATE KEY-----',
  ].join('\n');
  const credPath = path.join(credDir, 'sa.json');
  fs.writeFileSync(credPath, JSON.stringify({
    type: 'service_account',
    client_email: 'svc@example.iam.gserviceaccount.com',
    private_key: privateKey,
    token_uri: 'https://oauth2.googleapis.com/token',
  }));
  const calls = [];
  const result = await gdocs.publish({
    workspace: { workspacePath: workspace, slug: 'demo' },
    files: [{ fullPath: path.join(workspace, 'markdown', 'doc.md'), relativePath: 'markdown/doc.md', size: 8 }],
    flags: { googleFolder: 'folder-abc', googleDoc: null, to: ['google-docs'], dryRun: false, force: false },
    ctx: {
      env: { GOOGLE_APPLICATION_CREDENTIALS: credPath },
      now: new Date('2026-05-17T12:00:00Z'),
      signJwt: () => 'signed.jwt',
      runner: async () => { throw new Error('ADC should not be used'); },
      presignedByFile: {},
      httpClient: {
        request: async (url, init = {}) => {
          calls.push({ url, init });
          if (url === 'https://oauth2.googleapis.com/token') {
            return { json: async () => ({ access_token: 'service-token' }) };
          }
          if (/drive\/v3\/files\?q=/.test(url)) return { json: async () => ({ files: [] }) };
          if (/upload\/drive\/v3\/files\?uploadType=multipart/.test(url)) return { json: async () => ({ id: 'gdoc-1' }) };
          throw new Error(`No mock route for ${url}`);
        },
      },
    },
  });

  assert.equal(result.created[0].url, 'https://docs.google.com/document/d/gdoc-1/edit');
  assert.match(calls[0].init.body, /signed\.jwt/);
  const search = calls.find((c) => /drive\/v3\/files/.test(c.url));
  assert.equal(search.init.headers.Authorization, 'Bearer service-token');
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
