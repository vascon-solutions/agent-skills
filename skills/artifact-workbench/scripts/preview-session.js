const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

// Runtime helpers are injected into responses only; artifact files remain portable.
function createSession(options = {}) {
  const token = crypto.randomBytes(24).toString('hex');
  const stateDir = options.captureSelections
    ? fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-workbench-session-')) : null;
  const eventsPath = stateDir && path.join(stateDir, 'events.jsonl');
  if (eventsPath) fs.writeFileSync(eventsPath, '', { mode: 0o600 });
  const pages = new Map();
  let count = 0;
  function decorate(html, read, page) {
    const revision = hash(html);
    pages.set(page, read);
    const config = JSON.stringify({ token, page, revision, live: !!options.live, capture: !!eventsPath }).replace(/</g, '\\u003c');
    return html + `<script data-artifact-workbench>
(() => {
 const c = ${config};
 const status = document.createElement('output');
 status.setAttribute('aria-live', 'polite');
 status.style.cssText = 'position:fixed;bottom:12px;right:12px;padding:8px;background:#172033;color:white;z-index:2147483647;font:13px system-ui';
 document.body.append(status);
 if(c.live) setInterval(async () => {
  try { const r = await fetch('/__workbench/revision?page='+encodeURIComponent(c.page), {headers:{'X-Workbench-Token':c.token}});
   if(r.ok && (await r.json()).revision !== c.revision) location.reload();
  } catch {} 
 }, 1000);
 if(c.capture) document.addEventListener('click', async e => {
  const el = e.target.closest('[data-workbench-choice]');
  if(!el) return;
  try { const r = await fetch('/__workbench/selection', {method:'POST',headers:{'Content-Type':'application/json','X-Workbench-Token':c.token},body:JSON.stringify({page:c.page,revision:c.revision,choice:el.dataset.workbenchChoice})});
   status.textContent = r.ok ? 'Selection recorded' : 'Selection not recorded; refresh and try again';
  } catch { status.textContent = 'Preview disconnected; selection not recorded'; }
 });
})();</script>`;
  }
  async function handle(req, res, send) {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (!url.pathname.startsWith('/__workbench/')) return false;
    const origin = `http://127.0.0.1:${req.socket.localPort}`;
    if (req.headers.host !== `127.0.0.1:${req.socket.localPort}` ||
        req.headers['x-workbench-token'] !== token ||
        (req.headers.origin && req.headers.origin !== origin)) {
      send(res, 403, 'Forbidden'); return true;
    }
    if (url.pathname === '/__workbench/revision' && req.method === 'GET' && options.live) {
      const read = pages.get(url.searchParams.get('page'));
      if (!read) send(res, 404, 'Unknown preview');
      else { try { send(res, 200, JSON.stringify({ revision: hash(read()) }), 'application/json'); }
        catch { send(res, 404, 'Preview unavailable'); } }
      return true;
    }
    if (url.pathname !== '/__workbench/selection' || req.method !== 'POST' || !eventsPath) {
      send(res, 405, 'Method not allowed'); return true;
    }
    if (req.headers.origin !== origin || req.headers['content-type'] !== 'application/json') {
      send(res, 403, 'Invalid origin or content type'); return true;
    }
    let body = '';
    try {
      for await (const chunk of req) {
        body += chunk;
        if (Buffer.byteLength(body) > 4096) { send(res, 413, 'Selection too large'); return true; }
      }
      const event = JSON.parse(body);
      if (typeof event.choice !== 'string' || !event.choice.trim() || event.choice.length > 200 ||
          typeof event.page !== 'string' || !pages.has(event.page)) {
        send(res, 400, 'Invalid selection'); return true;
      }
      if (hash(pages.get(event.page)()) !== event.revision) { send(res, 409, 'Stale preview'); return true; }
      if (count >= 1000) { send(res, 429, 'Session selection limit reached'); return true; }
      fs.appendFileSync(eventsPath, JSON.stringify({ type: 'selection', page: event.page,
        revision: event.revision, choice: event.choice, timestamp: new Date().toISOString() }) + '\n');
      count += 1;
      send(res, 201, 'Recorded');
    } catch { send(res, 400, 'Invalid or unavailable preview'); }
    return true;
  }
  return { decorate, handle, eventsPath };
}
module.exports = { createSession };
