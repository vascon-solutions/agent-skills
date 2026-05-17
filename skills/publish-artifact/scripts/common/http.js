const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 500;
const TOKEN_ENV_KEYS = [
  'CLICKUP_API_TOKEN',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
];

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
