const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const googleAuth = require('./google-auth.js');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'google-auth-test-'));
}

test('getAccessToken fetches a token from service-account JSON outside the workspace', async () => {
  const workspacePath = tempDir();
  const credDir = tempDir();
  const credPath = path.join(credDir, 'sa.json');
  fs.writeFileSync(credPath, JSON.stringify({
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
  const token = await googleAuth.getAccessToken({
    env: { GOOGLE_APPLICATION_CREDENTIALS: credPath },
    workspacePath,
    scriptDir: path.join(process.cwd(), 'skills', 'publish-artifact', 'scripts'),
    now: new Date('2026-05-17T12:00:00Z'),
    signJwt: () => 'signed.jwt',
    runner: async () => { throw new Error('ADC should not be used'); },
    httpClient: {
      request: async (url, init = {}) => {
        calls.push({ url, init });
        return { json: async () => ({ access_token: 'service-token' }) };
      },
    },
  });

  assert.equal(token, 'service-token');
  assert.equal(calls[0].url, 'https://oauth2.googleapis.com/token');
  assert.match(calls[0].init.body, /signed\.jwt/);
});

test('getAccessToken refuses service-account JSON inside the workspace', async () => {
  const workspacePath = tempDir();
  const credPath = path.join(workspacePath, 'sa.json');
  fs.writeFileSync(credPath, '{}');

  await assert.rejects(
    googleAuth.getAccessToken({
      env: { GOOGLE_APPLICATION_CREDENTIALS: credPath },
      workspacePath,
      scriptDir: path.join(process.cwd(), 'skills', 'publish-artifact', 'scripts'),
      now: new Date('2026-05-17T12:00:00Z'),
      runner: async () => ({ stdout: '', stderr: '', status: 0 }),
      httpClient: { request: async () => { throw new Error('should not call'); } },
    }),
    /outside the repo and workspace/,
  );
});

test('getAccessToken falls back to ADC when no service-account path is set', async () => {
  const token = await googleAuth.getAccessToken({
    env: {},
    workspacePath: tempDir(),
    scriptDir: path.join(process.cwd(), 'skills', 'publish-artifact', 'scripts'),
    runner: async (cmd, args) => {
      assert.equal(cmd, 'gcloud');
      assert.deepEqual(args, ['auth', 'application-default', 'print-access-token']);
      return { stdout: 'adc-token\n', stderr: '', status: 0 };
    },
    httpClient: { request: async () => { throw new Error('should not call'); } },
  });

  assert.equal(token, 'adc-token');
});
