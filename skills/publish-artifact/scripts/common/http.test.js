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
