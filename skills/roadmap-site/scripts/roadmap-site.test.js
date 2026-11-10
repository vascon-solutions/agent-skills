const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { pathToFileURL } = require('url');

const script = path.join(__dirname, 'roadmap-site.js');
const skill = path.join(__dirname, '..');
const fixture = (...parts) => path.join(skill, 'fixtures', ...parts);
const SYNC_TOKEN = 'sync-secret-7f3a91c2';
const SERVICE_TOKEN = 'service-secret-b84d10e6';

let L;
test.before(async () => {
  const load = (name) => import(pathToFileURL(path.join(skill, 'starter', 'lib', 'roadmap', name)).href);
  const [parse, merge, access] = await Promise.all([load('parse.mjs'), load('merge.mjs'), load('access.mjs')]);
  L = { ...parse, ...merge, ...access };
});

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-site-test-'));
}

const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('ROADMAP_')));

function run(args, { env = {}, input } = {}) {
  return new Promise((resolve) => {
    const child = childProcess.spawn(process.execPath, [script, ...args], { env: { ...cleanEnv, ...env } });
    let out = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => { out += chunk; });
    child.stdin.end(input);
    child.on('close', (status) => resolve({ status, out }));
  });
}

function git(cwd, ...args) {
  const result = childProcess.spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'Test Author', GIT_AUTHOR_EMAIL: 'author@example.test', GIT_COMMITTER_NAME: 'Test Author', GIT_COMMITTER_EMAIL: 'author@example.test' } });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

/* A scratch repo holding the sync fixture, plus a config outside it so the tree stays clean. */
function repoWithRoadmap(siteUrl) {
  const root = tempDir();
  const repo = path.join(root, 'repo');
  fs.mkdirSync(path.join(repo, '.agent'), { recursive: true });
  fs.copyFileSync(fixture('sync', 'roadmap.md'), path.join(repo, '.agent', 'roadmap.md'));
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.name', 'Test Author');
  git(repo, 'config', 'user.email', 'author@example.test');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'roadmap');
  const config = path.join(root, 'config.json');
  fs.writeFileSync(config, JSON.stringify({ title: 'Test', repo, roadmapPath: '.agent/roadmap.md', siteUrl }));
  return { root, repo, config, file: path.join(repo, '.agent', 'roadmap.md') };
}

/* In-memory sync endpoint with the same token check and clearing rule as the app route. */
async function fakeSite(initial = {}) {
  const site = { snapshot: initial.snapshot || null, states: initial.states || [], requests: [] };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      site.requests.push({ method: req.method, url: req.url, headers: req.headers, body });
      const send = (status, payload) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(payload));
      };
      const denied = L.authorizeSync(req.headers['x-roadmap-sync-token'], SYNC_TOKEN);
      if (denied) return send(denied.status, { error: denied.error });
      if (req.method === 'GET') {
        return send(200, { snapshot: site.snapshot, pending: site.states.filter((s) => s.status != null).map((s) => ({ id: s.itemId, status: s.status, base: s.base })) });
      }
      const data = JSON.parse(body);
      if (data.action === 'push') {
        site.snapshot = { commit: data.snapshot.commit, pushedAt: new Date().toISOString() };
        site.pushed = data.snapshot;
        const { clear, keep } = L.clearPending(site.states, L.snapshotItems(data.snapshot));
        clear.forEach((state) => { state.status = null; state.base = null; });
        return send(200, { cleared: clear.map((s) => s.itemId), kept: keep.length });
      }
      const discarded = [];
      for (const edit of data.discard) {
        const state = site.states.find((s) => s.itemId === edit.id && s.status === edit.status);
        if (state) { state.status = null; state.base = null; discarded.push(edit.id); }
      }
      site.pulled = data;
      return send(200, { discarded });
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  site.url = `http://127.0.0.1:${server.address().port}`;
  site.close = () => new Promise((resolve) => server.close(resolve));
  return site;
}

const tokenEnv = { ROADMAP_SYNC_TOKEN: SYNC_TOKEN };

/* ---------- source format ---------- */

test('the valid fixture parses every surveyed shape and ignores tables that are not item tables', () => {
  const parsed = L.parseRoadmap(fs.readFileSync(fixture('roadmaps', 'valid.md'), 'utf8'));
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.groups.map((g) => g.title), ['Milestone 1: Foundations', 'Backend', 'Milestone 2: Storefront']);
  assert.equal(parsed.groups[0].outcome, 'The team can deploy a signed-in shell.');
  assert.deepEqual(parsed.items.map((i) => i.id), ['1.4', '00-02', 'BE-03B', '03-04A', '2.1', '2.2', '2.3']);
  const byId = Object.fromEntries(parsed.items.map((i) => [i.id, i]));
  assert.equal(byId['1.4'].link, '.agent/tasks/1.4-sign-in.md', 'Task doc column, backticks stripped');
  assert.equal(byId['BE-03B'].link, 'https://example.test/pr/12', 'Link column, Markdown link target');
  assert.equal(byId['BE-03B'].outcome, 'Products can be created and priced');
  assert.equal(byId['BE-03B'].status, 'in-progress');
  assert.equal(byId['BE-03B'].note, 'PR open');
  assert.equal(byId['00-02'].note, 'shipped with `v0.2`');
  assert.equal(byId['03-04A'].status, 'blocked');
  assert.equal(byId['2.1'].status, 'todo', 'lower-case id header and # header both match');
  assert.ok(!('owner' in byId['BE-03B']), 'extra columns are ignored');
  assert.ok(!parsed.items.some((i) => i.id === 'D-1' || i.id === 'X.1'), 'decision register and fenced example are not items');
});

test('each failure fixture fails and names its row', () => {
  const cases = {
    'duplicate-id.md': /line 6 \(row "1\.1"\): duplicate id, first used on line 5/,
    'malformed-id.md': /line 6 \(row "#7 bad"\): malformed id/,
    'unknown-status.md': /line 5 \(row "1\.1"\): unknown status "superseded"/,
    'free-text-status.md': /line 5 \(row "1\.1"\): free-text status "implemented; acceptance complete, PR open"/,
    'missing-status-column.md': /line 3: table has ID and Item columns but no Status column/,
  };
  for (const [file, pattern] of Object.entries(cases)) {
    const parsed = L.parseRoadmap(fs.readFileSync(fixture('roadmaps', file), 'utf8'));
    assert.equal(parsed.errors.length, 1, file);
    assert.match(parsed.errors[0], pattern, file);
  }
});

test('check exits 1 on a failing roadmap and 0 on the valid one', async () => {
  assert.equal((await run(['check', fixture('roadmaps', 'valid.md')])).status, 0);
  const failing = await run(['check', fixture('roadmaps', 'free-text-status.md')]);
  assert.equal(failing.status, 1);
  assert.match(failing.out, /FAIL line 5 \(row "1\.1"\)/);
});

/* ---------- three-way merge ---------- */

test('every repo-changed x page-changed cell, convergence, conflict, each prefer and an orphan', () => {
  const { cases } = JSON.parse(fs.readFileSync(fixture('sync', 'scenarios.json'), 'utf8'));
  const bucket = { apply: 'apply', discard: 'discard', conflict: 'conflicts', orphan: 'orphans', converged: 'converged' };
  for (const c of cases) {
    const repo = new Map(c.repo ? [['X', c.repo]] : []);
    const prefer = new Map(c.prefer ? [['X', c.prefer]] : []);
    const plan = L.planPull({ repo, pending: [{ id: 'X', status: c.page, base: c.base }], prefer });
    for (const [expect, key] of Object.entries(bucket)) {
      assert.equal(plan[key].length, expect === c.expect ? 1 : 0, `${c.name}: ${key}`);
    }
    if (c.expect === 'apply') assert.equal(plan.apply[0].to, c.page, c.name);
  }
});

test('a server push clears only edits equal to the new repo status and keeps the rest with their original base', () => {
  const states = [
    { itemId: 'S-1', status: 'done', base: 'todo' },
    { itemId: 'S-3', status: 'blocked', base: 'todo' },
    { itemId: 'S-4', status: null, base: null },
  ];
  const { clear, keep } = L.clearPending(states, [{ id: 'S-1', status: 'done' }, { id: 'S-3', status: 'in-progress' }, { id: 'S-4', status: 'blocked' }]);
  assert.deepEqual(clear.map((s) => s.itemId), ['S-1']);
  assert.deepEqual(keep, [{ itemId: 'S-3', status: 'blocked', base: 'todo' }]);
});

test('an edit made between pull and push is compared against its original base on the next pull', () => {
  const states = [{ itemId: 'S-1', status: 'done', base: 'todo' }];
  const first = L.planPull({ repo: new Map([['S-1', 'todo'], ['S-3', 'todo']]), pending: [{ id: 'S-1', status: 'done', base: 'todo' }] });
  assert.deepEqual(first.apply.map((a) => a.id), ['S-1']);
  states.push({ itemId: 'S-3', status: 'in-progress', base: 'todo' });
  states[0].status = 'blocked';
  const { clear, keep } = L.clearPending(states, [{ id: 'S-1', status: 'done' }, { id: 'S-3', status: 'todo' }]);
  assert.equal(clear.length, 0);
  const next = L.planPull({ repo: new Map([['S-1', 'done'], ['S-3', 'todo']]), pending: keep.map((s) => ({ id: s.itemId, status: s.status, base: s.base })) });
  assert.deepEqual(next.apply.map((a) => [a.id, a.to]), [['S-3', 'in-progress']]);
  assert.deepEqual(next.conflicts, [{ id: 'S-1', base: 'todo', repo: 'done', page: 'blocked' }]);
});

/* ---------- pull against a site ---------- */

test('pull writes status words only and records the pull; conflicts and prefers behave as specified', async () => {
  const site = await fakeSite({ states: [
    { itemId: 'S-2', status: 'done', base: 'in-progress' },
    { itemId: 'S-9', status: 'done', base: 'todo' },
  ] });
  const { config, file } = repoWithRoadmap(site.url);
  try {
    const original = fs.readFileSync(file, 'utf8');
    const item = L.parseRoadmap(original).items.find((i) => i.id === 'S-2');
    const result = await run(['pull', '--config', config], { env: tokenEnv });
    assert.equal(result.status, 0, result.out);
    assert.match(result.out, /WARN orphaned S-9/);
    const expected = original.slice(0, lineStart(original, item.line) + item.statusOffset) + 'done' + original.slice(lineStart(original, item.line) + item.statusOffset + 'in-progress'.length);
    assert.equal(fs.readFileSync(file, 'utf8'), expected, 'only the status word changed');
    assert.match(fs.readFileSync(file, 'utf8'), /\| `done` — PR open, waiting on review \|/);
    assert.ok(fs.readFileSync(file, 'utf8').endsWith('Repo note after the table stays byte for byte.\n'));
    assert.deepEqual(site.pulled.applied, ['S-2']);

    fs.writeFileSync(file, original);
    site.states = [{ itemId: 'S-4', status: 'done', base: 'todo' }, { itemId: 'S-1', status: 'in-progress', base: 'todo' }];
    const conflict = await run(['pull', '--config', config], { env: tokenEnv });
    assert.equal(conflict.status, 1);
    assert.match(conflict.out, /CONFLICT S-4: repo blocked, page done/);
    assert.equal(fs.readFileSync(file, 'utf8'), original, 'a conflict leaves the file alone');

    const page = await run(['pull', '--config', config, '--prefer', 'page', 'S-4'], { env: tokenEnv });
    assert.equal(page.status, 0, page.out);
    assert.match(fs.readFileSync(file, 'utf8'), /\| S-4 \| Refunds \| `done` \|/);
    assert.match(fs.readFileSync(file, 'utf8'), /\| S-1 \| Cart totals \| `in-progress` \|/);

    fs.writeFileSync(file, original);
    site.states = [{ itemId: 'S-4', status: 'done', base: 'todo' }];
    const repo = await run(['pull', '--config', config, '--prefer', 'repo', 'S-4'], { env: tokenEnv });
    assert.equal(repo.status, 0, repo.out);
    assert.equal(fs.readFileSync(file, 'utf8'), original);
    assert.deepEqual(site.pulled.discard, [{ id: 'S-4', status: 'done' }]);
    assert.equal(site.states[0].status, null);
  } finally {
    await site.close();
  }
});

function lineStart(text, line) {
  return text.split('\n').slice(0, line - 1).reduce((sum, l) => sum + l.length + 1, 0);
}

/* ---------- push guards ---------- */

test('push is refused for a dirty tree, a failing check and a non-ancestor site snapshot; a good push clears matching edits', async () => {
  const site = await fakeSite();
  const { config, repo, file } = repoWithRoadmap(site.url);
  try {
    const original = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, `${original}\n`);
    const dirty = await run(['push', '--config', config], { env: tokenEnv });
    assert.equal(dirty.status, 1);
    assert.match(dirty.out, /working tree is not clean/);

    fs.writeFileSync(file, original.replace('`todo` | — |', '`superseded` | — |'));
    git(repo, 'commit', '-qam', 'bad status');
    const failing = await run(['push', '--config', config], { env: tokenEnv });
    assert.equal(failing.status, 1);
    assert.match(failing.out, /unknown status "superseded"[\s\S]*does not pass check/);
    git(repo, 'reset', '-q', '--hard', 'HEAD~1');

    git(repo, 'checkout', '-q', '-b', 'side');
    fs.writeFileSync(file, original.replace('| S-5 | Receipts | `done`', '| S-5 | Receipts | `deferred`'));
    git(repo, 'commit', '-qam', 'side change');
    const sideCommit = git(repo, 'rev-parse', 'HEAD');
    git(repo, 'checkout', '-q', 'main');
    site.snapshot = { commit: sideCommit, pushedAt: new Date().toISOString() };
    const stale = await run(['push', '--config', config], { env: tokenEnv });
    assert.equal(stale.status, 1);
    assert.match(stale.out, /is not an ancestor of HEAD/);
    assert.equal(site.pushed, undefined, 'nothing was uploaded');

    site.snapshot = null;
    site.states = [{ itemId: 'S-1', status: 'todo', base: 'blocked' }, { itemId: 'S-3', status: 'done', base: 'todo' }];
    const ok = await run(['push', '--config', config], { env: tokenEnv });
    assert.equal(ok.status, 0, ok.out);
    assert.equal(site.pushed.commit, git(repo, 'rev-parse', 'HEAD'));
    assert.equal(site.pushed.author, 'Test Author');
    assert.deepEqual(site.states, [{ itemId: 'S-1', status: null, base: null }, { itemId: 'S-3', status: 'done', base: 'todo' }]);
  } finally {
    await site.close();
  }
});

/* ---------- authorisation and projection ---------- */

test('writes, comments and deletes are authorised by role; stale versions and bad sync tokens are refused', () => {
  const editors = L.parseEditorEmails('Editor@example.test, other@example.test');
  const anon = L.viewerFor(null, editors);
  const reader = L.viewerFor({ userId: 'u-reader', email: 'reader@example.test', fullName: null }, editors);
  const editor = L.viewerFor({ userId: 'u-editor', email: 'editor@example.test', fullName: 'Ed Itor' }, editors);
  assert.equal(L.authorize(anon, 'write').status, 401);
  assert.equal(L.authorize(reader, 'write').status, 403);
  assert.equal(L.authorize(editor, 'write'), null);
  assert.equal(L.authorize(anon, 'comment').status, 401);
  assert.equal(L.authorize(reader, 'comment'), null);
  const comment = { authorId: 'u-author' };
  assert.equal(L.authorize(reader, 'delete-comment', comment).status, 403);
  assert.equal(L.authorize(L.viewerFor({ userId: 'u-author', email: 'a@example.test' }, editors), 'delete-comment', comment), null);
  assert.equal(L.authorize(editor, 'delete-comment', comment), null);
  assert.equal(L.checkVersion(3, 2).status, 409);
  assert.equal(L.checkVersion(3, 3), null);
  assert.equal(L.authorizeSync(null, SYNC_TOKEN).status, 401);
  assert.equal(L.authorizeSync('wrong', SYNC_TOKEN).status, 401);
  assert.equal(L.authorizeSync(SYNC_TOKEN, SYNC_TOKEN), null);
  assert.equal(L.authorizeSync(SYNC_TOKEN, undefined).status, 503);
});

test('read payloads carry no email or user id, and a user with no full name is shown by the part before @', () => {
  const editors = L.parseEditorEmails('nofull@example.test');
  const viewer = L.viewerFor({ userId: 'u-nofull-123', email: 'nofull@example.test', fullName: null }, editors);
  const payload = L.projectRoadmap({
    snapshot: { commit: 'a'.repeat(40), author: 'Test Author', generatedAt: '2026-11-01T00:00:00Z', pushedAt: '2026-11-01T00:00:00Z', groups: [{ title: 'G', outcome: null, items: [{ id: 'S-1', item: 'One', outcome: null, status: 'todo', note: '', link: null }] }] },
    states: [{ itemId: 'S-1', status: 'done', base: 'todo', note: 'n', link: '', version: 2, editorName: viewer.name }],
    comments: [{ id: 1, itemId: 'S-1', authorId: 'u-nofull-123', authorName: viewer.name, body: 'hi', createdAt: '2026-11-02T00:00:00Z' }],
    activity: [{ id: 1, at: '2026-11-02T00:00:00Z', kind: 'comment', itemId: 'S-1', actorName: viewer.name, detail: 'Commented' }],
    viewer,
    now: Date.parse('2026-11-03T00:00:00Z'),
  });
  const text = JSON.stringify(payload);
  assert.equal(viewer.name, 'nofull');
  assert.ok(!text.includes('@'), text);
  assert.ok(!text.includes('u-nofull-123'), text);
  assert.equal(payload.groups[0].items[0].comments[0].canDelete, true);
  assert.equal(payload.pendingCount, 1);
});

test('the snapshot warns only after 14 days from the last push', () => {
  const pushed = '2026-11-01T00:00:00Z';
  const at = (iso) => L.snapshotAge(pushed, Date.parse(iso));
  assert.deepEqual(at('2026-11-15T00:00:00Z'), { days: 14, stale: false });
  assert.deepEqual(at('2026-11-15T00:01:00Z'), { days: 14, stale: true });
  assert.equal(at('2026-11-02T00:00:00Z').stale, false);
});

/* ---------- secrets ---------- */

test('neither token reaches output, the activity payload or any request field other than its own header', async () => {
  const site = await fakeSite({ states: [{ itemId: 'S-1', status: 'done', base: 'todo' }] });
  const { config } = repoWithRoadmap(site.url);
  try {
    const viaEnv = await run(['pull', '--config', config], { env: { ROADMAP_SYNC_TOKEN: SYNC_TOKEN, ROADMAP_SERVICE_TOKEN: SERVICE_TOKEN } });
    assert.equal(viaEnv.status, 0, viaEnv.out);
    const stdin = `ROADMAP_SYNC_TOKEN=${SYNC_TOKEN}\nROADMAP_SERVICE_TOKEN="${SERVICE_TOKEN}"\n`;
    const viaStdin = await run(['push', '--config', config, '--token-stdin'], { input: stdin });
    const outputs = [viaEnv.out, viaStdin.out];
    assert.equal(viaStdin.status, 1, 'the pull left the tree dirty, so the push is refused before any request');
    const repo = path.join(path.dirname(config), 'repo');
    git(repo, 'commit', '-qam', 'apply pull');
    const pushed = await run(['push', '--config', config, '--token-stdin'], { input: stdin });
    assert.equal(pushed.status, 0, pushed.out);
    outputs.push(pushed.out);
    for (const out of outputs) {
      assert.ok(!out.includes(SYNC_TOKEN) && !out.includes(SERVICE_TOKEN), out);
    }
    assert.ok(site.requests.length >= 4);
    for (const request of site.requests) {
      assert.equal(request.headers['x-roadmap-sync-token'], SYNC_TOKEN);
      assert.equal(request.headers['oai-sites-authorization'], `Bearer ${SERVICE_TOKEN}`);
      const others = Object.entries(request.headers).filter(([key]) => !['x-roadmap-sync-token', 'oai-sites-authorization'].includes(key));
      const rest = `${request.url}\n${request.body}\n${JSON.stringify(others)}`;
      assert.ok(!rest.includes(SYNC_TOKEN) && !rest.includes(SERVICE_TOKEN), rest);
    }
    assert.ok(!JSON.stringify(site.pulled).includes(SYNC_TOKEN));
    const argToken = await run(['pull', '--config', config, '--sync-token', SYNC_TOKEN]);
    assert.equal(argToken.status, 1);
    assert.ok(!argToken.out.includes(SYNC_TOKEN));
    const none = await run(['pull', '--config', config]);
    assert.equal(none.status, 1);
    assert.match(none.out, /ROADMAP_SYNC_TOKEN is required/);
  } finally {
    await site.close();
  }
});

/* ---------- build and verify ---------- */

function hostSite() {
  const dir = tempDir();
  const files = {
    'vite.config.ts': 'import { sites } from "./scripts/vite/sites-vite-plugin";\nexport default { plugins: [sites({ mockAuth: true })] };\n',
    'package.json': '{ "devDependencies": { "vinext": "1.0.0" } }\n',
    'app/chatgpt-auth.ts': 'export async function getChatGPTUser() { return null; }\n',
    'app/page.tsx': 'export default function Home() { return null; }\n',
    'db/index.ts': 'export function getDb() {}\n',
    'components/ui/button.tsx': 'export const Button = 1;\n',
    'drizzle/meta/_journal.json': '{ "version": "7", "dialect": "sqlite", "entries": [] }\n',
    '.openai/hosting.json': '{\n  "project_id": "proj-test",\n  "d1": null,\n  "r2": null\n}\n',
  };
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
  return dir;
}

function snapshotDir(dir) {
  const out = {};
  const walk = (d, prefix) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) walk(path.join(d, e.name), rel);
    else out[rel] = fs.readFileSync(path.join(d, e.name), 'utf8');
  });
  walk(dir, '');
  return out;
}

test('build applies the overlay idempotently, preserves host files and refuses bad inputs; verify reports only overlay drift', async () => {
  const site = hostSite();
  const buildArgs = ['build', site, '--config', fixture('site', 'config.json'), '--tokens', fixture('site', 'tokens.md')];
  const hostBefore = snapshotDir(site);
  const first = await run(buildArgs);
  assert.equal(first.status, 0, first.out);
  assert.match(first.out, /colophon names --app-font, --app-radius/);
  const built = snapshotDir(site);
  for (const rel of ['vite.config.ts', 'package.json', 'app/chatgpt-auth.ts', 'db/index.ts', 'components/ui/button.tsx']) {
    assert.equal(built[rel], hostBefore[rel], `${rel} is host-owned`);
  }
  assert.deepEqual(JSON.parse(built['.openai/hosting.json']), { project_id: 'proj-test', d1: 'DB', r2: null });
  assert.match(built['app/globals.css'], /--app-primary: #0e7490;/);
  assert.match(built['app/globals.css'], /--app-radius: 0\.5rem;/, 'a waived token keeps the shell default');
  assert.notEqual(built['drizzle/meta/_journal.json'], hostBefore['drizzle/meta/_journal.json']);
  const config = JSON.parse(built['roadmap-site.config.json']);
  assert.deepEqual(config.colophon.substituted.map((r) => r.token), ['--app-font']);
  assert.ok(!('siteUrl' in config) && !('repo' in config), 'local paths and the site URL stay out of the deployed bundle');

  const second = await run(buildArgs);
  assert.equal(second.status, 0, second.out);
  assert.match(second.out, /0 file\(s\) written/);
  assert.deepEqual(snapshotDir(site), built);

  assert.equal((await run(['verify', site])).status, 0);
  fs.writeFileSync(path.join(site, 'roadmap-site.config.json'), '{ "title": "Changed" }\n');
  fs.writeFileSync(path.join(site, 'app/globals.css'), built['app/globals.css'].replace('#0e7490', '#123456'));
  fs.writeFileSync(path.join(site, 'db/index.ts'), 'export const changed = true;\n');
  assert.equal((await run(['verify', site])).status, 0, 'config, token block and host files are not compared');
  fs.writeFileSync(path.join(site, 'app/page.tsx'), 'export default function Changed() { return null; }\n');
  fs.rmSync(path.join(site, 'app/api/sync/route.ts'));
  const drift = await run(['verify', site]);
  assert.equal(drift.status, 1);
  assert.match(drift.out, /FAIL changed app\/page\.tsx/);
  assert.match(drift.out, /FAIL missing app\/api\/sync\/route\.ts/);

  const unresolved = path.join(tempDir(), 'tokens.md');
  fs.writeFileSync(unresolved, fs.readFileSync(fixture('site', 'tokens.md'), 'utf8').replace('| `#0e7490` | resolved |', '| `#0e7490` | unresolved |'));
  const fresh = hostSite();
  const refused = await run(['build', fresh, '--config', fixture('site', 'config.json'), '--tokens', unresolved]);
  assert.equal(refused.status, 1);
  assert.match(refused.out, /--app-primary is unresolved/);
  assert.equal(fs.existsSync(path.join(fresh, 'app/roadmap-view.tsx')), false, 'nothing is written on refusal');
  const notStarter = tempDir();
  fs.writeFileSync(path.join(notStarter, 'vite.config.ts'), 'export default {};\n');
  const wrongDir = await run(['build', notStarter, '--config', fixture('site', 'config.json'), '--tokens', fixture('site', 'tokens.md')]);
  assert.equal(wrongDir.status, 1);
  assert.match(wrongDir.out, /sites\(\) build integration not found/);
});
