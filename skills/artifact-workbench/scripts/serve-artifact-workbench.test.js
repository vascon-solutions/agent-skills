const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const workbench = require('./serve-artifact-workbench.js');

function tempDir(prefix = 'artifact-workbench-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function write(file, content = '') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

test('parseArgs accepts target, --port, and --open', () => {
  assert.deepEqual(workbench.parseArgs(['demo', '--port', '54321', '--open']), {
    target: 'demo',
    port: 54321,
    open: true,
  });
});

test('parseArgs rejects invalid port values', () => {
  assert.throws(() => workbench.parseArgs(['demo', '--port', 'abc']), /Invalid --port/);
  assert.throws(() => workbench.parseArgs(['demo', '--port', '70000']), /Invalid --port/);
});

test('contentTypeFor maps known artifact types', () => {
  assert.equal(workbench.contentTypeFor('demo.html'), 'text/html; charset=utf-8');
  assert.equal(workbench.contentTypeFor('demo.md'), 'text/markdown; charset=utf-8');
  assert.equal(workbench.contentTypeFor('demo.png'), 'image/png');
  assert.equal(workbench.contentTypeFor('demo.svg'), 'image/svg+xml');
  assert.equal(workbench.contentTypeFor('demo.js'), 'application/javascript; charset=utf-8');
  assert.equal(workbench.contentTypeFor('demo.mjs'), 'application/javascript; charset=utf-8');
  assert.equal(workbench.contentTypeFor('demo.woff2'), 'font/woff2');
  assert.equal(workbench.contentTypeFor('demo.wasm'), 'application/wasm');
  assert.equal(workbench.contentTypeFor('demo.bin'), 'application/octet-stream');
});

test('resolveTarget resolves a workspace slug under workspace root', () => {
  const root = tempDir();
  const ws = path.join(root, 'demo');
  write(path.join(ws, 'markdown', 'doc.md'), '# Doc\n');

  const result = workbench.resolveTarget('demo', { workspaceRoot: root, homeDir: root });

  assert.equal(result.mode, 'workspace');
  assert.equal(result.workspacePath, ws);
  assert.equal(result.slug, 'demo');
});

test('resolveTarget accepts a relative workspace path that stays under workspace root', () => {
  const root = tempDir();
  const ws = path.join(root, 'demo');
  write(path.join(ws, 'markdown', 'doc.md'), '# Doc\n');

  const result = workbench.resolveTarget('./demo', { workspaceRoot: root, homeDir: root, cwd: root });

  assert.equal(result.mode, 'workspace');
  assert.equal(result.workspacePath, ws);
  assert.equal(result.slug, 'demo');
});

test('resolveTarget rejects a workspace path outside workspace root', () => {
  const root = tempDir();
  const outside = tempDir();
  write(path.join(outside, 'markdown', 'doc.md'), '# Doc\n');

  assert.throws(() => workbench.resolveTarget(outside, { workspaceRoot: root, homeDir: root }), /outside workspace root/);
});

test('resolveTarget accepts a single explicit html file outside workspace root', () => {
  const root = tempDir();
  const outside = tempDir();
  const html = path.join(outside, 'demo.html');
  write(html, '<!doctype html><h1>Demo</h1>');

  const result = workbench.resolveTarget(html, { workspaceRoot: root, homeDir: root });

  assert.equal(result.mode, 'single-html');
  assert.equal(result.filePath, html);
  assert.equal(result.rootPath, outside);
});

test('resolveTarget rejects a missing workspace', () => {
  const root = tempDir();
  assert.throws(() => workbench.resolveTarget('missing', { workspaceRoot: root, homeDir: root }), /Workspace not found/);
});

test('discoverWorkspace returns partial sections and default upload files', () => {
  const ws = tempDir();
  write(path.join(ws, 'html', 'a.html'), '<!doctype html><h1>A</h1>');
  write(path.join(ws, 'images', 'pic.png'), 'png');
  write(path.join(ws, 'metadata.md'), '# Metadata\n');
  write(path.join(ws, '.hidden', 'secret.txt'), 'hidden');
  write(path.join(ws, 'dist', 'bundle.js'), 'ignored');

  const info = workbench.discoverWorkspace(ws);

  assert.deepEqual(info.files.html.map((f) => f.relativePath), ['html/a.html']);
  assert.deepEqual(info.files.markdown, []);
  assert.deepEqual(info.files.images.map((f) => f.relativePath), ['images/pic.png']);
  assert.equal(info.metadata.relativePath, 'metadata.md');
  assert.deepEqual(info.uploadFiles.map((f) => f.relativePath), ['html/a.html', 'images/pic.png']);
});

test('scanHtmlReferences flags non-self-contained references', () => {
  const html = [
    '<!doctype html>',
    '<link rel="stylesheet" href="./style.css">',
    '<link rel=preload href=./unquoted.css>',
    '<img src="../images/pic.png">',
    '<source src=../media/demo.mp4>',
    '<script src="https://cdn.example/app.js"></script>',
    '<div style="background-image:url(/images/bg.png)"></div>',
    '<a href="#local">Local</a>',
    '<img src="data:image/png;base64,abc">',
    '<img srcset="data:image/png;base64,abc 1x, data:image/png;base64,def 2x">',
  ].join('\n');

  const warnings = workbench.scanHtmlReferences(html, 'html/demo.html');

  assert.deepEqual(
    warnings.map((warning) => warning.value).sort(),
    ['./style.css', './unquoted.css', '/images/bg.png', '../images/pic.png', '../media/demo.mp4', 'https://cdn.example/app.js'].sort(),
  );
});

test('safeResolve rejects traversal and symlink escapes', () => {
  const root = tempDir();
  const outside = tempDir();
  write(path.join(root, 'assets', 'ok.txt'), 'ok');
  write(path.join(outside, 'secret.txt'), 'secret');
  fs.symlinkSync(path.join(outside, 'secret.txt'), path.join(root, 'assets', 'secret-link.txt'));

  assert.equal(workbench.safeResolve(root, 'assets/ok.txt'), path.join(root, 'assets', 'ok.txt'));
  assert.throws(() => workbench.safeResolve(root, '../escape.txt'), /Unsafe path/);
  assert.throws(() => workbench.safeResolve(root, 'assets/secret-link.txt'), /Unsafe path/);
});

async function withServer(server, fn) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test('buildIndexHtml includes artifact sections, upload set, and html warnings', () => {
  const ws = tempDir();
  write(path.join(ws, 'html', 'a.html'), '<!doctype html><img src="../images/pic.png">');
  write(path.join(ws, 'markdown', 'doc.md'), '# Doc\n');
  write(path.join(ws, 'images', 'pic.png'), 'png');
  write(path.join(ws, 'assets', 'data.json'), '{}');
  write(path.join(ws, 'metadata.md'), '# Metadata\n');
  const info = workbench.discoverWorkspace(ws);

  const html = workbench.buildIndexHtml({ workspacePath: ws, slug: 'demo', info });

  assert.match(html, /Artifact Workbench/);
  assert.match(html, /HTML/);
  assert.match(html, /Markdown/);
  assert.match(html, /Images/);
  assert.match(html, /Assets/);
  assert.match(html, /Metadata/);
  assert.match(html, /Default Publish Upload Set/);
  assert.match(html, /HTML Self-Contained Checks/);
  assert.match(html, /\.\.\/images\/pic\.png/);
  assert.match(html, /\/preview\/html\/a\.html/);
  assert.match(html, /\/html\/a\.html/);
  const anchor = workbench.htmlChecksAnchor('html/a.html');
  assert.match(html, new RegExp(`href="#${anchor}"`));
  assert.match(html, new RegExp(`id="${anchor}"`));
  assert.match(html, /<section id="html-checks">/);
});

test('createRequestHandler serves workspace index and files with no-store', async () => {
  const ws = tempDir();
  write(path.join(ws, 'html', 'a.html'), '<!doctype html><h1>A</h1>');
  write(path.join(ws, 'markdown', 'doc.md'), '# Doc\n');
  write(path.join(ws, 'images', 'pic.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  write(path.join(ws, 'metadata.md'), '# Metadata\n');
  const target = { mode: 'workspace', workspacePath: ws, slug: 'demo' };
  const server = workbench.createServer(target);

  await withServer(server, async (baseUrl) => {
    const index = await fetch(`${baseUrl}/`);
    assert.equal(index.status, 200);
    assert.equal(index.headers.get('cache-control'), 'no-store');
    assert.match(await index.text(), /Artifact Workbench/);

    const md = await fetch(`${baseUrl}/markdown/doc.md`);
    assert.equal(md.status, 200);
    assert.match(md.headers.get('content-type'), /text\/markdown/);
    assert.equal(await md.text(), '# Doc\n');

    const metadata = await fetch(`${baseUrl}/metadata.md`);
    assert.equal(metadata.status, 200);
    assert.match(metadata.headers.get('content-type'), /text\/plain/);
    assert.match(await metadata.text(), /Metadata/);

    const svg = await fetch(`${baseUrl}/images/pic.svg`);
    assert.equal(svg.status, 200);
    assert.match(svg.headers.get('content-type'), /image\/svg\+xml/);
  });
});

test('workspace preview route isolates html asset requests', async () => {
  const ws = tempDir();
  write(path.join(ws, 'html', 'a.html'), '<!doctype html><img src="../images/pic.png">');
  write(path.join(ws, 'html', 'style.css'), 'body { color: red; }');
  write(path.join(ws, 'images', 'pic.png'), 'png');
  const target = { mode: 'workspace', workspacePath: ws, slug: 'demo' };
  const server = workbench.createServer(target);

  await withServer(server, async (baseUrl) => {
    const html = await fetch(`${baseUrl}/preview/html/a.html`);
    assert.equal(html.status, 200);
    assert.match(await html.text(), /pic\.png/);

    const maskedAsset = await fetch(`${baseUrl}/preview/images/pic.png`);
    assert.equal(maskedAsset.status, 404);

    const sameFolderAsset = await fetch(`${baseUrl}/preview/html/style.css`);
    assert.equal(sameFolderAsset.status, 404);

    const rawAsset = await fetch(`${baseUrl}/images/pic.png`);
    assert.equal(rawAsset.status, 200);
  });
});

test('malformed URL escapes return 404 instead of crashing routes', async () => {
  const ws = tempDir();
  write(path.join(ws, 'html', 'a.html'), '<!doctype html><h1>A</h1>');
  const workspaceServer = workbench.createServer({ mode: 'workspace', workspacePath: ws, slug: 'demo' });

  await withServer(workspaceServer, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/%E0%A4%A`);
    assert.equal(response.status, 404);
  });

  const root = tempDir();
  const htmlPath = path.join(root, 'demo.html');
  write(htmlPath, '<!doctype html><h1>Demo</h1>');
  const singleServer = workbench.createServer({ mode: 'single-html', rootPath: root, filePath: htmlPath, fileName: 'demo.html' });

  await withServer(singleServer, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/%E0%A4%A`);
    assert.equal(response.status, 404);
  });
});

test('buildIndexHtml omits absent workspace sections cleanly', () => {
  const ws = tempDir();
  write(path.join(ws, 'html', 'a.html'), '<!doctype html><h1>A</h1>');
  const info = workbench.discoverWorkspace(ws);

  const html = workbench.buildIndexHtml({ workspacePath: ws, slug: 'demo', info });

  assert.match(html, /HTML/);
  assert.doesNotMatch(html, /Markdown/);
  assert.doesNotMatch(html, /Images/);
  assert.doesNotMatch(html, /Assets/);
  assert.doesNotMatch(html, /Metadata/);
});

test('single html mode serves direct file without workspace index', async () => {
  const root = tempDir();
  const htmlPath = path.join(root, 'demo.html');
  write(htmlPath, '<!doctype html><h1>Demo</h1>');
  write(path.join(root, 'style.css'), 'body { color: red; }');
  const target = { mode: 'single-html', rootPath: root, filePath: htmlPath, fileName: 'demo.html' };
  const server = workbench.createServer(target);

  await withServer(server, async (baseUrl) => {
    const rootResponse = await fetch(`${baseUrl}/`, { redirect: 'manual' });
    assert.equal(rootResponse.status, 302);
    assert.equal(rootResponse.headers.get('location'), '/demo.html');

    const html = await fetch(`${baseUrl}/demo.html`);
    assert.equal(html.status, 200);
    assert.match(await html.text(), /Demo/);

    const css = await fetch(`${baseUrl}/style.css`);
    assert.equal(css.status, 200);
    assert.match(css.headers.get('content-type'), /text\/css/);
  });
});

test('startupReport prints workspace counts and warnings', () => {
  const ws = tempDir();
  write(path.join(ws, 'html', 'a.html'), '<!doctype html><img src="../images/pic.png">');
  write(path.join(ws, 'markdown', 'doc.md'), '# Doc\n');
  write(path.join(ws, 'images', 'pic.png'), 'png');
  write(path.join(ws, 'metadata.md'), '# Metadata\n');
  const target = { mode: 'workspace', workspacePath: ws, slug: 'demo' };
  const report = workbench.startupReport(target, 'http://127.0.0.1:49152/');

  assert.match(report, /Artifact workbench/);
  assert.match(report, /Workspace:/);
  assert.match(report, /URL: http:\/\/127\.0\.0\.1:49152\//);
  assert.match(report, /HTML: 1/);
  assert.match(report, /Markdown: 1/);
  assert.match(report, /Images: 1/);
  assert.match(report, /Assets: 0/);
  assert.match(report, /Metadata: yes/);
  assert.match(report, /HTML checks: 1 warning/);
});

test('openUrl selects platform commands and ignores unsupported platforms', async () => {
  const calls = [];
  const warnings = [];
  const runner = (cmd, args, cb) => {
    calls.push({ cmd, args });
    cb(null);
  };
  const warn = (message) => warnings.push(message);

  assert.equal(await workbench.openUrl('http://127.0.0.1:1/', { platform: 'darwin', runner, warn }), true);
  assert.equal(await workbench.openUrl('http://127.0.0.1:1/', { platform: 'linux', runner, warn }), true);
  assert.equal(await workbench.openUrl('http://127.0.0.1:1/', { platform: 'win32', runner, warn }), true);
  assert.equal(await workbench.openUrl('http://127.0.0.1:1/', { platform: 'freebsd', runner, warn }), false);

  assert.deepEqual(calls, [
    { cmd: 'open', args: ['http://127.0.0.1:1/'] },
    { cmd: 'xdg-open', args: ['http://127.0.0.1:1/'] },
    { cmd: 'cmd', args: ['/c', 'start', '""', 'http://127.0.0.1:1/'] },
  ]);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /freebsd/);
});

test('openUrl resolves false and warns when the launcher errors', async () => {
  const warnings = [];
  const runner = (_cmd, _args, cb) => cb(new Error('boom'));
  const result = await workbench.openUrl('http://127.0.0.1:1/', {
    platform: 'darwin',
    runner,
    warn: (message) => warnings.push(message),
  });
  assert.equal(result, false);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /could not open browser/);
  assert.match(warnings[0], /boom/);
});

test('startupReport for single html mode discloses the asset root', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-workbench-test-single-'));
  const htmlPath = path.join(root, 'demo.html');
  write(htmlPath, '<!doctype html><h1>Demo</h1>');
  const target = { mode: 'single-html', rootPath: root, filePath: htmlPath, fileName: 'demo.html' };
  const report = workbench.startupReport(target, 'http://127.0.0.1:49152/demo.html');

  assert.match(report, /File:/);
  assert.match(report, /URL: http:\/\/127\.0\.0\.1:49152\/demo\.html/);
  assert.match(report, new RegExp(`Asset root: ${root.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}`));
  assert.match(report, /any file under this directory is reachable/);
});

function previewConfig(html) {
  return JSON.parse(html.match(/const c = (\{[^\n]+\});/)[1]);
}

test('live previews track file revisions while raw exports stay untouched', async () => {
  const ws = tempDir();
  const file = path.join(ws, 'html', 'a.html');
  const original = '<!doctype html><body><button data-workbench-choice="a">A</button></body>';
  write(file, original);
  const server = workbench.createServer({ mode: 'workspace', workspacePath: ws, slug: 'demo' }, { live: true });
  await withServer(server, async base => {
    const html = await (await fetch(base + '/preview/html/a.html')).text();
    const c = previewConfig(html);
    const headers = { 'X-Workbench-Token': c.token };
    const revisionUrl = base + '/__workbench/revision?page=' + encodeURIComponent(c.page);
    assert.equal((await (await fetch(revisionUrl, { headers })).json()).revision, c.revision);
    write(file, original.replace('>A<', '>B<'));
    assert.notEqual((await (await fetch(revisionUrl, { headers })).json()).revision, c.revision);
    assert.equal(await (await fetch(base + '/html/a.html')).text(), fs.readFileSync(file, 'utf8'));
    assert.equal((await fetch(base + '/preview/html/style.css')).status, 404);
    fs.unlinkSync(file);
    assert.equal((await fetch(revisionUrl, { headers })).status, 404);
  });
  assert.equal(server.eventsPath, null);
});

test('capture stores bounded revision-specific choices outside the workspace', async () => {
  const root = tempDir();
  const file = path.join(root, 'demo.html');
  const original = '<!doctype html><body><button data-workbench-choice="layout-a">A</button></body>';
  write(file, original);
  const server = workbench.createServer({ mode: 'single-html', rootPath: root, filePath: file, fileName: 'demo.html' }, { captureSelections: true });
  try {
    await withServer(server, async base => {
      const c = previewConfig(await (await fetch(base + '/demo.html')).text());
      const event = { page: c.page, revision: c.revision, choice: 'layout-a' };
      const headers = { Origin: base, 'Content-Type': 'application/json', 'X-Workbench-Token': c.token };
      const post = (data, extra = {}) => fetch(base + '/__workbench/selection', { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(data) });
      assert.equal((await post(event, { Origin: 'https://example.com' })).status, 403);
      assert.equal((await post(event, { 'X-Workbench-Token': 'wrong' })).status, 403);
      assert.equal((await post({ ...event, choice: 'a'.repeat(5000) })).status, 413);
      assert.equal((await post({ ...event, page: '/unknown' })).status, 400);
      assert.equal((await post(event)).status, 201);
      const events = fs.readFileSync(server.eventsPath, 'utf8').trim().split('\n').map(JSON.parse);
      assert.equal(events.length, 1);
      assert.equal(events[0].choice, 'layout-a');
      assert.equal(events[0].revision, c.revision);
      assert.equal(fs.readFileSync(file, 'utf8'), original);
      assert.ok(!server.eventsPath.startsWith(root + path.sep));
      write(file, original + '<p>Changed</p>');
      assert.equal((await post(event)).status, 409);
      assert.equal(fs.readFileSync(server.eventsPath, 'utf8').trim().split('\n').length, 1);
    });
  } finally { fs.rmSync(path.dirname(server.eventsPath), { recursive: true }); }
});

test('default preview does not inject helpers or accept selection writes', async () => {
  const root = tempDir();
  const file = path.join(root, 'demo.html');
  write(file, '<h1>Plain</h1>');
  const server = workbench.createServer({ mode: 'single-html', rootPath: root, filePath: file, fileName: 'demo.html' });
  await withServer(server, async base => {
    assert.equal(await (await fetch(base + '/demo.html')).text(), '<h1>Plain</h1>');
    assert.equal((await fetch(base + '/__workbench/selection', { method: 'POST', body: '{}' })).status, 405);
  });
  assert.equal(server.eventsPath, null);
});

test('injected browser helper refreshes changed revisions and submits marked choices', async () => {
  const vm = require('vm');
  const { createSession } = require('./preview-session');
  const session = createSession({ live: true, captureSelections: true });
  try {
    const html = session.decorate('<body></body>', () => '<body></body>', '/demo.html');
    let poll, click, reloads = 0;
    const status = {};
    const requests = [];
    vm.runInNewContext(html.match(/<script data-artifact-workbench>([\s\S]*)<\/script>/)[1], {
      document: { createElement: () => ({ ...status, style: {}, setAttribute() {} }), body: { append() {} }, addEventListener: (_, cb) => { click = cb; } },
      setInterval: cb => { poll = cb; }, location: { reload: () => { reloads++; } },
      fetch: async (url, args) => { requests.push({ url, args }); return { ok: true, json: async () => ({ revision: 'changed' }) }; },
    });
    await poll();
    assert.equal(reloads, 1);
    await click({ target: { closest: () => null } });
    assert.equal(requests.length, 1);
    await click({ target: { closest: () => ({ dataset: { workbenchChoice: 'a' } }) } });
    assert.equal(JSON.parse(requests[1].args.body).choice, 'a');
  } finally { fs.rmSync(path.dirname(session.eventsPath), { recursive: true }); }
});

test('interactive CLI flags and startup report describe capture accurately', () => {
  const args = workbench.parseArgs(['demo', '--live', '--capture-selections']);
  assert.equal(args.live, true);
  assert.equal(args.captureSelections, true);
  const report = workbench.startupReport({ mode: 'single-html', filePath: '/tmp/a.html', rootPath: '/tmp' }, 'http://127.0.0.1:1/a.html', args);
  assert.match(report, /temporary selection log/);
  assert.doesNotMatch(report, /Mode: read-only/);
});
