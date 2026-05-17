const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const googleDrive = require('./google-drive.js');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'google-drive-test-'));
}

function write(file, content = '') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function response(body) {
  return { json: async () => body };
}

test('google-drive driver requires Drive parent folder', () => {
  assert.throws(() => googleDrive.validateFlags({}), /google-folder/);
  assert.doesNotThrow(() => googleDrive.validateFlags({ googleFolder: 'parent-folder' }));
});

test('google-drive driver dry-run plans raw file upload without auth or HTTP', async () => {
  const workspacePath = tempDir();
  write(path.join(workspacePath, 'markdown', 'doc.md'), '# Doc\n');
  const result = await googleDrive.publish({
    workspace: { workspacePath, slug: 'demo' },
    files: [{ fullPath: path.join(workspacePath, 'markdown', 'doc.md'), relativePath: 'markdown/doc.md', size: 6 }],
    flags: { googleFolder: 'parent-folder', dryRun: true, force: false },
    ctx: {
      env: {},
      now: new Date('2026-05-17T12:00:00Z'),
      runner: async () => { throw new Error('dry-run should not fetch auth'); },
      httpClient: { request: async () => { throw new Error('dry-run should not call HTTP'); } },
    },
  });

  assert.deepEqual(result.planned.map((f) => f.relativePath), ['markdown/doc.md']);
  assert.match(googleDrive.formatReport(result).join('\n'), /\[dry-run\].*would upload raw file/);
});

test('google-drive driver creates slug folder and uploads raw workspace files', async () => {
  const workspacePath = tempDir();
  write(path.join(workspacePath, 'markdown', 'doc.md'), '# Doc\n');
  write(path.join(workspacePath, 'html', 'doc.html'), '<h1>Doc</h1>\n');
  write(path.join(workspacePath, 'images', 'pic.png'), 'png');
  write(path.join(workspacePath, 'metadata.md'), '# Meta\n');
  const files = [
    { fullPath: path.join(workspacePath, 'html', 'doc.html'), relativePath: 'html/doc.html', size: 13 },
    { fullPath: path.join(workspacePath, 'images', 'pic.png'), relativePath: 'images/pic.png', size: 3 },
    { fullPath: path.join(workspacePath, 'markdown', 'doc.md'), relativePath: 'markdown/doc.md', size: 6 },
  ];
  const credPath = path.join(tempDir(), 'sa.json');
  write(credPath, JSON.stringify({
    type: 'service_account',
    client_email: 'svc@example.iam.gserviceaccount.com',
    private_key: [
      '-----BEGIN PRIVATE KEY-----',
      'MIIEvQIBADANBgkqhkiG9w0BAQEFAASC',
      '-----END PRIVATE KEY-----',
    ].join('\n'),
    token_uri: 'https://oauth2.googleapis.com/token',
  }));
  const calls = [];
  const searchCounts = new Map();
  const httpClient = {
    request: async (url, init = {}) => {
      calls.push({ url, init });
      if (url === 'https://oauth2.googleapis.com/token') {
        return response({ access_token: 'drive-token' });
      }
      if (/drive\/v3\/files\?q=/.test(url)) {
        const decoded = decodeURIComponent(url);
        searchCounts.set(decoded, (searchCounts.get(decoded) || 0) + 1);
        return response({ files: [] });
      }
      if (/drive\/v3\/files\?supportsAllDrives=true$/.test(url)) {
        const body = JSON.parse(init.body);
        if (body.mimeType === 'application/vnd.google-apps.folder') {
          return response({ id: `folder-${body.name}`, webViewLink: `https://drive.google.com/drive/folders/folder-${body.name}` });
        }
      }
      if (/upload\/drive\/v3\/files\?uploadType=multipart/.test(url)) {
        return response({ id: `file-${calls.length}`, webViewLink: `https://drive.google.com/file/d/file-${calls.length}/view` });
      }
      throw new Error(`No mock route for ${url}`);
    },
  };

  const result = await googleDrive.publish({
    workspace: { workspacePath, slug: 'demo' },
    files,
    flags: { googleFolder: 'parent-folder', dryRun: false, force: false },
    ctx: {
      env: { GOOGLE_APPLICATION_CREDENTIALS: credPath },
      now: new Date('2026-05-17T12:00:00Z'),
      signJwt: () => 'signed.jwt',
      runner: async () => { throw new Error('ADC should not be used'); },
      httpClient,
    },
  });

  assert.equal(result.uploaded.length, 4);
  assert.equal(result.folderUrl, 'https://drive.google.com/drive/folders/folder-demo');
  const uploadBodies = calls.filter((c) => /upload\/drive/.test(c.url)).map((c) => c.init.body);
  assert.ok(uploadBodies.some((body) => body.includes('"name":"doc.md"')));
  assert.ok(uploadBodies.some((body) => body.includes('"name":"doc.html"')));
  assert.ok(uploadBodies.some((body) => body.includes('"name":"pic.png"')));
  assert.ok(uploadBodies.some((body) => body.includes('"name":"metadata.md"')));
  assert.ok(uploadBodies.some((body) => body.includes('Content-Type: image/png')));
});
