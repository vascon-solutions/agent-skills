const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const { check, countPdfPages } = require('./walkthrough-artifact');

const script = path.join(__dirname, 'walkthrough-artifact.js');
const fixtures = path.join(__dirname, '..', 'fixtures');
const PAGE = 'job-assignment-walkthrough.html';
const IMAGE_LINE_1 = '- img/1-01-job-list.png: Dispatcher · Jobs list · two open jobs. from: `screenshots/1-01-job-list.png`\n';

/* Copy the fixture walkthrough and its audit run, keeping them siblings so relative from: paths resolve. */
function workspace(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'walkthrough-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.cpSync(path.join(fixtures, 'walkthrough'), path.join(root, 'walkthrough'), { recursive: true });
  fs.cpSync(path.join(fixtures, 'audit-run'), path.join(root, 'audit-run'), { recursive: true });
  const dir = path.join(root, 'walkthrough');
  const page = path.join(dir, PAGE);
  const manifest = path.join(dir, 'manifest.md');
  const edit = (file, from, to) => {
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(text.includes(from), `fixture no longer contains: ${from}`);
    fs.writeFileSync(file, text.replace(from, to));
  };
  return { root, dir, page, manifest, edit };
}

function failuresOf(ws) {
  return check(ws.page, ws.manifest).failures;
}

function assertReported(failures, patterns) {
  for (const pattern of patterns) {
    assert.ok(failures.some((f) => pattern.test(f)), `expected a failure matching ${pattern}; got:\n${failures.join('\n')}`);
  }
}

test('the fixture passes check and the CLI prints counts', (t) => {
  const ws = workspace(t);
  const result = childProcess.spawnSync(process.execPath, [script, 'check', ws.page], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /5 pages, 2 images/);
  assert.match(result.stdout, /check passed/);
});

test('manifest drift is reported in both directions, every failure at once', (t) => {
  const ws = workspace(t);
  fs.rmSync(path.join(ws.dir, 'img', '1-02-job-assigned.png'));
  fs.copyFileSync(path.join(ws.root, 'audit-run', 'screenshots', '1-x-unused-attempt.png'), path.join(ws.dir, 'img', '1-x-unused-attempt.png'));
  ws.edit(ws.manifest, IMAGE_LINE_1, '- screenshots/old-01.png: an earlier capture. from: `screenshots/old-01.png`\n');
  ws.edit(ws.page, '<p>The Jobs list shows every open job with its status.</p>', '<p>The Jobs list shows every open job with its status.</p><figure><img src="../audit-run/screenshots/1-x-unused-attempt.png" alt="Loading"><figcaption>Dispatcher · Jobs · loading</figcaption></figure>');
  const failures = failuresOf(ws);
  assertReported(failures, [
    /img\/1-02-job-assigned\.png: file is missing/,
    /img\/1-02-job-assigned\.png: manifest line names a missing file/,
    /img\/1-x-unused-attempt\.png: file in img\/ is not used/,
    /img\/1-01-job-list\.png: no manifest line/,
    /\.\.\/audit-run\/screenshots\/1-x-unused-attempt\.png: reference is not under img\//,
    /screenshots\/old-01\.png: manifest line names an image the page does not use/,
    /screenshots\/old-01\.png: raw capture .* is missing/,
  ]);
  const cli = childProcess.spawnSync(process.execPath, [script, 'check', ws.page], { encoding: 'utf8' });
  assert.equal(cli.status, 1);

  const css = workspace(t);
  css.edit(css.page, '<div class="bar"></div>', '<div class="bar" style="background:url(../audit-run/screenshots/1-x-unused-attempt.png)"></div>');
  css.edit(css.page, '/* /walkthrough:tokens */', '/* /walkthrough:tokens */\n/* .old { background: url(../old/hero.png) } */');
  const cssFailures = failuresOf(css);
  assertReported(cssFailures, [/1-x-unused-attempt\.png: reference is not under img\//]);
  assert.ok(!cssFailures.some((f) => /hero\.png/.test(f)), cssFailures.join('\n'));

  const missing = workspace(t);
  fs.rmSync(missing.manifest);
  assertReported(failuresOf(missing), [/manifest not found/]);
});

test('commented-out markup is not counted as part of the page', (t) => {
  const ws = workspace(t);
  const text = fs.readFileSync(ws.page, 'utf8');
  fs.writeFileSync(ws.page, text.replace(/(<section class="page status">[\s\S]*?<\/section>)/, '<!-- $1 -->').replace('</body>', '<!-- <img src="img/1-x-unused-attempt.png" alt="x"> -->\n</body>'));
  fs.copyFileSync(path.join(ws.root, 'audit-run', 'screenshots', '1-x-unused-attempt.png'), path.join(ws.dir, 'img', '1-x-unused-attempt.png'));
  const result = check(ws.page, ws.manifest);
  assert.equal(result.counts.pages, 4);
  assertReported(result.failures, [
    /manifest has a ## Status section but the page has no status table/,
    /img\/1-x-unused-attempt\.png: file in img\/ is not used/,
  ]);
});

test('every image line must trace to a raw capture in a present audit run', (t) => {
  const ws = workspace(t);
  ws.edit(ws.manifest, '. from: `screenshots/1-02-job-assigned.png`', '.');
  ws.edit(ws.manifest, 'from: `screenshots/1-01-job-list.png`', 'from: `screenshots/renamed.png`');
  assertReported(failuresOf(ws), [/1-02-job-assigned\.png: manifest line has no from:/, /1-01-job-list\.png: raw capture .*renamed\.png is missing/]);

  const absent = workspace(t);
  fs.rmSync(path.join(absent.root, 'audit-run'), { recursive: true });
  const result = check(absent.page, absent.manifest);
  assert.ok(!result.failures.some((f) => /raw capture/.test(f)), result.failures.join('\n'));
  assert.ok(result.notes.some((n) => /not checked/.test(n)));

  const cited = workspace(t);
  cited.edit(cited.manifest, '- None.', '- img/1-02-job-assigned.png: the confirmation says "sent" before delivery.');
  assert.deepEqual(failuresOf(cited), []);
});

test('tokens, unlisted origins and remote loads are refused', (t) => {
  const ws = workspace(t);
  ws.edit(ws.page, '<p>The Jobs list shows every open job with its status.</p>', '<p>Open https://fieldops.example.com/jobs?token=abc to see it.</p><img src="https://cdn.example.net/x.png" alt="x">');
  ws.edit(ws.manifest, '## Findings', '## Findings\n\n- Invite link carried eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.c2lnbmF0dXJl and Authorization: Bearer abcdefghijklmnop');
  ws.edit(ws.manifest, '- None.', '- See access_token in the network log.');
  assertReported(failuresOf(ws), [
    /page names https:\/\/fieldops\.example\.com\/jobs\?token=abc, whose origin is not in Allowed origins/,
    /page loads a remote resource: https:\/\/cdn\.example\.net\/x\.png/,
    /page contains token=/,
    /manifest contains a JWT/,
    /manifest contains a Bearer token/,
    /manifest contains access_token/,
  ]);

  const missing = workspace(t);
  missing.edit(missing.manifest, '- Allowed origins: https://fieldops.example.test, https://mail.example.test\n', '');
  assertReported(failuresOf(missing), [/no "- Allowed origins:" line/]);

  const published = workspace(t);
  published.edit(published.manifest, 'Published: not published.', 'Published: https://claude.ai/public/artifacts/abc123.');
  published.edit(published.page, '<div class="bar"></div>', '<div class="bar"><svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg></div>');
  published.edit(published.page, 'src="img/1-01-job-list.png"', 'src="./img/1-01-job-list.png"');
  assert.deepEqual(failuresOf(published), []);
  published.edit(published.manifest, 'Published: https://claude.ai/public/artifacts/abc123.', 'Published: https://claude.ai/x?token=abc. Fixed per https://tracker.example.com/X-1.');
  published.edit(published.page, '</body>', '<!-- staging admin: https://admin.example.com/jobs -->\n</body>');
  assertReported(failuresOf(published), [
    /manifest contains token=/,
    /manifest names https:\/\/tracker\.example\.com\/X-1, whose origin is not in Allowed origins/,
    /page names https:\/\/admin\.example\.com\/jobs, whose origin is not in Allowed origins/,
  ]);
});

test('the page status table must match the manifest Status rows', (t) => {
  const ws = workspace(t);
  ws.edit(ws.page, '<span class="badge t-info">API only</span></td>', '<span class="badge t-partial">API only</span></td>');
  ws.edit(ws.manifest, '| 1 | Job assignment | done | Live on staging |', '| 1 | Job assignment | done | Live on dev |');
  assertReported(failuresOf(ws), [
    /status row 1 · done · Live on dev is in the manifest but not on the page/,
    /status row 1 · done · Live on staging is on the page but not in the manifest/,
    /status row 2 · partial · API only is on the page but not in the manifest/,
  ]);

  const bad = workspace(t);
  bad.edit(bad.manifest, '| 2 | Parts ordering | info |', '| 2 | Parts ordering | maybe |');
  assertReported(failuresOf(bad), [/tone "maybe" is not one of/]);

  const order = workspace(t);
  order.edit(order.manifest, '| 1 | Job assignment | done | Live on staging | This walkthrough |\n| 2 | Parts ordering | info | API only | |', '| 2 | Parts ordering | info | API only | |\n| 1 | Job assignment | done | **Live on staging** | This walkthrough |');
  const orderFailures = failuresOf(order);
  assertReported(orderFailures, [/status rows are in a different order/]);
  assert.equal(orderFailures.length, 1, orderFailures.join('\n'));

  const gone = workspace(t);
  const text = fs.readFileSync(gone.manifest, 'utf8');
  fs.writeFileSync(gone.manifest, text.replace(/## Status[\s\S]*?(?=## Not captured)/, ''));
  assertReported(failuresOf(gone), [/page has a status table but the manifest has no ## Status section/]);
});

test('structure: doctype, cover first, starter print block, alt text and captions', (t) => {
  const ws = workspace(t);
  ws.edit(ws.page, '<!DOCTYPE html>\n', '');
  ws.edit(ws.page, '<section class="page cover">', '<section class="page closing"><p>x</p></section>\n<section class="page cover">');
  ws.edit(ws.page, 'figure { flex: 0 0 62% }', 'figure { flex: 0 0 70% }');
  ws.edit(ws.page, 'alt="Jobs list with JOB-0007 Pump inspection scheduled and JOB-0008 Valve repair awaiting parts"', 'alt=""');
  ws.edit(ws.page, '<figcaption>Dispatcher · JOB-0007 · after assigning</figcaption>', '');
  assertReported(failuresOf(ws), [
    /does not start with <!DOCTYPE html>/,
    /first page section is not the cover/,
    /print block differs from the starter/,
    /img\/1-01-job-list\.png: alt text is empty/,
    /img\/1-02-job-assigned\.png: figure has no caption/,
  ]);
});

test('PDF pages are counted from Chrome page objects', () => {
  assert.equal(countPdfPages(fs.readFileSync(path.join(fixtures, 'three-pages.pdf'))), 3);
});
