const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_BODY_BYTES = 25 * 1024 * 1024;
const TOKEN_ENV_KEYS = [
  'CLICKUP_API_TOKEN',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
];
const TOKEN_PATTERNS = [
  /pk_\d+_[A-Za-z0-9_-]{12,}/g,
  /AIza[0-9A-Za-z\-_]{35}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /gh[pousr]_[A-Za-z0-9]{20,}/g,
  /sk-[A-Za-z0-9]{32,}/g,
  /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
];

function redactToken(text, env = {}) {
  let out = String(text || '');
  for (const key of TOKEN_ENV_KEYS) {
    const value = env[key];
    if (value && value.length >= 8 && out.includes(value)) {
      out = out.split(value).join(`<REDACTED:${key}>`);
    }
  }
  for (const pattern of TOKEN_PATTERNS) {
    out = out.replace(pattern, '<REDACTED:TOKEN>');
  }
  return out;
}

function bodyByteLength(body) {
  if (body === undefined || body === null) return 0;
  if (typeof body === 'string') return Buffer.byteLength(body);
  if (Buffer.isBuffer(body)) return body.length;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (ArrayBuffer.isView(body)) return body.byteLength;
  if (body instanceof URLSearchParams) return Buffer.byteLength(body.toString());
  return 0;
}

function createHttpClient(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const sleep = options.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const jitter = options.jitter || (() => Math.random());
  const env = options.env || {};
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const maxRetries = options.maxRetries || DEFAULT_MAX_RETRIES;
  const baseDelay = options.baseDelayMs || DEFAULT_BASE_DELAY_MS;
  const maxBodyBytes = options.maxBodyBytes || DEFAULT_MAX_BODY_BYTES;

  async function request(url, init = {}) {
    const safeUrl = redactToken(url, env);
    if (!/^https:\/\//.test(url)) {
      throw new Error(`HTTPS required for HTTP request: ${safeUrl}`);
    }
    const length = bodyByteLength(init.body);
    if (length > maxBodyBytes) {
      throw new Error(`HTTP request body exceeds ${maxBodyBytes} bytes for ${safeUrl}`);
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
        throw new Error(`HTTP error for ${safeUrl}: ${message}`);
      }
      clearTimeout(timer);
      if (res.ok) return res;
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= maxRetries - 1) {
        const body = redactToken(await res.text().catch(() => ''), env);
        throw new Error(`HTTP ${res.status} ${res.statusText || ''} for ${safeUrl}: ${body}`.trim());
      }
      const delay = baseDelay * Math.pow(2, attempt) * (0.5 + jitter() * 0.5);
      await sleep(delay);
      attempt += 1;
    }
  }

  return { request };
}

module.exports = { createHttpClient, redactToken, TOKEN_ENV_KEYS };
