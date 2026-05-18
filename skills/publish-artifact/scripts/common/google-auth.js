const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function assertCredentialsOutside(credPath, workspacePath, scriptDir) {
  if (!credPath) return;
  const abs = path.resolve(credPath);
  const checks = [workspacePath];
  if (scriptDir) {
    const skillDir = path.dirname(scriptDir);
    const skillsDir = path.dirname(skillDir);
    checks.push(scriptDir, skillDir, skillsDir, path.dirname(skillsDir));
  }
  for (const root of checks) {
    if (!root) continue;
    const absRoot = path.resolve(root);
    if (abs === absRoot || abs.startsWith(absRoot + path.sep)) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS must live outside the repo and workspace');
    }
  }
}

async function defaultAccessToken(env, runner) {
  const result = await runner('gcloud', ['auth', 'application-default', 'print-access-token'], { env });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error([
      'Google Drive publishing requires local Google auth.',
      '',
      'Set up one of these credential sources, then rerun:',
      '1. Install Google Cloud SDK and run: gcloud auth application-default login',
      '2. Or set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON outside this repo/workspace, then share the target Drive folder with that service account email.',
      '',
      `gcloud ADC token fetch failed${detail ? `: ${detail}` : ''}`,
    ].join('\n'));
  }
  return result.stdout.trim();
}

function base64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(unsigned, privateKey) {
  return crypto.createSign('RSA-SHA256').update(unsigned).sign(privateKey, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createServiceAccountAssertion(creds, now, signer = signJwt) {
  if (creds.type !== 'service_account' || !creds.client_email || !creds.private_key) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS must point to a service-account JSON with client_email and private_key');
  }
  const tokenUri = creds.token_uri || 'https://oauth2.googleapis.com/token';
  const issuedAt = Math.floor(now.getTime() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: tokenUri,
    exp: issuedAt + 3600,
    iat: issuedAt,
  }));
  const unsigned = `${header}.${claims}`;
  return { assertion: `${unsigned}.${signer(unsigned, creds.private_key)}`, tokenUri };
}

async function serviceAccountAccessToken({ env, httpClient, now, signJwt: signer }) {
  const credPath = path.resolve(env.GOOGLE_APPLICATION_CREDENTIALS);
  const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
  const { assertion, tokenUri } = createServiceAccountAssertion(creds, now, signer);
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  }).toString();
  const res = await httpClient.request(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Google service-account token response did not include access_token');
  return data.access_token;
}

async function getAccessToken({ env, workspacePath, scriptDir, runner, httpClient, now = new Date(), signJwt: signer }) {
  assertCredentialsOutside(env.GOOGLE_APPLICATION_CREDENTIALS, workspacePath, scriptDir);
  if (env.GOOGLE_APPLICATION_CREDENTIALS) {
    return serviceAccountAccessToken({ env, httpClient, now, signJwt: signer });
  }
  return defaultAccessToken(env, runner);
}

module.exports = {
  assertCredentialsOutside,
  createServiceAccountAssertion,
  getAccessToken,
};
