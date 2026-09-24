const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const lib = require('./lib/board');
const fixtures = require('./lib/fixtures');

const verify = path.join(__dirname, 'verify-variant-board.js');
const bundle = path.join(__dirname, 'export-board-bundle.js');
const runtime = lib.starterRuntime();

function tempDir(prefix = 'variant-board-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function run(script, args, options = {}) {
  const result = childProcess.spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { ...process.env, ...(options.env || {}) } });
  return { status: result.status, out: `${result.stdout}${result.stderr}` };
}

function workspace() {
  const root = tempDir();
  const home = path.join(root, 'home');
  const ws = path.join(home, 'agent-artifacts', 'northwind-jobs-ux');
  fixtures.writeWorkspace(ws);
  return { root, home, ws, memo: path.join(ws, 'html', 'memo-style.html'), route: path.join(ws, 'html', 'route-state.html') };
}

function git(cwd, ...args) {
  const result = childProcess.spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

/* Create a synthetic theme repo and point the fixture token map at its commit. */
function themeRepo(home, tokensPath, css = fixtures.THEME_CSS) {
  const repo = path.join(home, 'Code', 'northwind', 'field-ops-ui');
  fs.mkdirSync(path.join(repo, 'packages', 'theme', 'src'), { recursive: true });
  fs.writeFileSync(path.join(repo, fixtures.THEME_FILE), css);
  git(repo, 'init', '-q');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'theme');
  const sha = git(repo, 'rev-parse', '--short', 'HEAD');
  fs.writeFileSync(tokensPath, fs.readFileSync(tokensPath, 'utf8').split(fixtures.REVISION).join(sha));
  return { repo, sha };
}

const memoDef = fixtures.memoStyleDefinition();
const routeDef = fixtures.routeStateDefinition();

/* ---------- runtime: scopes, dependencies, replay ---------- */

test('each section owns its selection; changing one scope leaves the other untouched', () => {
  const notes = runtime.defaultSelection(memoDef.sections.notes);
  const owner = runtime.defaultSelection(memoDef.sections.owner);
  const changed = runtime.applyChange(memoDef.sections.notes, notes, 'state', 'failed');
  assert.deepEqual(changed, { surface: 'composer', state: 'failed', view: 'both' });
  assert.deepEqual(owner, { state: 'crew', view: 'both' });
  assert.deepEqual(runtime.defaultSelection(memoDef.sections.owner), owner);
});

test('a controlling change keeps valid dependents and resets invalid ones deterministically', () => {
  const section = routeDef.sections.commands;
  let sel = runtime.defaultSelection(section);
  sel = runtime.applyChange(section, sel, 'route', 'external');
  sel = runtime.applyChange(section, sel, 'state', 'authority-review');
  const back = runtime.applyChange(section, sel, 'route', 'depot');
  assert.equal(back.state, 'draft', 'invalid dependent resets to the first valid option');
  assert.equal(back.route, 'depot', 'the controlling option is always selectable');
  const kept = runtime.applyChange(section, runtime.applyChange(section, sel, 'state', 'submitted'), 'route', 'region');
  assert.equal(kept.state, 'submitted', 'a still-valid dependent choice is preserved');
  assert.deepEqual(runtime.allowedOptions(section, back, 'state'), ['draft', 'submitted', 'depot-approved', 'closed']);
  assert.throws(() => runtime.applyChange(section, back, 'state', 'authority-review'), /not allowed/);
});

test('malformed and cyclic definitions are rejected instead of drawn', () => {
  const cyclic = { sections: { s: { dimensions: [{ id: 'a', options: [{ id: 'x' }] }, { id: 'b', options: [{ id: 'y' }] }], dependencies: [
    { controlling: 'a', dependent: 'b', allowed: { x: ['y'] } }, { controlling: 'b', dependent: 'a', allowed: { y: ['x'] } },
  ] } } };
  assert.throws(() => runtime.validateDefinition(cyclic), /dependency cycle/);
  const empty = { sections: { s: { dimensions: [{ id: 'a', options: [{ id: 'x' }, { id: 'z' }] }, { id: 'b', options: [{ id: 'y' }] }], dependencies: [
    { controlling: 'a', dependent: 'b', allowed: { x: ['y'], z: [] } },
  ] } } };
  assert.throws(() => runtime.validateDefinition(empty), /no valid 'b' option for 'z'/);
  const unknown = { sections: { s: { dimensions: [{ id: 'a', options: [{ id: 'x' }] }], dependencies: [{ controlling: 'a', dependent: 'nope', allowed: {} }] } } };
  assert.throws(() => runtime.validateDefinition(unknown), /unknown dependent dimension/);
  const dup = { sections: { s: { dimensions: [{ id: 'a', options: [{ id: 'x' }, { id: 'x' }] }] } } };
  assert.throws(() => runtime.validateDefinition(dup), /declares option 'x' twice/);
  assert.doesNotThrow(() => runtime.validateDefinition(routeDef));
});

test('a cited scenario replays exactly and every malformed hash is rejected with a reason', () => {
  const ok = runtime.resolveScenario(routeDef, '#commands?variant=a&route=external&state=authority-review&viewer=approver');
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.selection, { variant: 'a', route: 'external', state: 'authority-review', viewer: 'approver' });
  const cases = [
    ['#commands?variant=a&route=depot&state=draft', /missing dimension 'viewer'/],
    ['#commands?variant=a&route=depot&state=draft&viewer=reader&state=closed', /assigned twice/],
    ['#commands?variant=a&route=depot&state=draft&viewer=reader&colour=red', /unknown dimension 'colour'/],
    ['#commands?variant=a&route=depot&state=nope&viewer=reader', /unknown option 'nope'/],
    ['#commands?variant=a&route=depot&state=authority-review&viewer=reader', /forbidden by the section's dependencies/],
    ['#nowhere?variant=a', /unknown section 'nowhere'/],
    ['#commands?', /missing dimensions/],
  ];
  cases.forEach(([hash, reason]) => {
    const result = runtime.resolveScenario(routeDef, hash);
    assert.equal(result.ok, false, hash);
    assert.match(result.reason, reason, hash);
  });
});

test('a bare section anchor is navigation, not a scenario citation', () => {
  assert.deepEqual(runtime.parseHash('#commands'), { kind: 'anchor', section: 'commands' });
  assert.deepEqual(runtime.parseHash(''), { kind: 'none' });
  const result = runtime.resolveScenario(routeDef, '#commands');
  assert.equal(result.ok, false);
  assert.equal(result.kind, 'anchor');
});

test('scenario hashes serialise every dimension in declared order', () => {
  const section = routeDef.sections.commands;
  const sel = runtime.defaultSelection(section);
  assert.equal(runtime.scenarioHash('commands', section, sel), '#commands?variant=today&route=depot&state=draft&viewer=planner');
  assert.equal(runtime.resolveScenario(routeDef, runtime.scenarioHash('commands', section, sel)).ok, true);
});

/* ---------- structure and token map ---------- */

test('fixture boards pass the structure and token checks; committed fixtures match the generator', () => {
  const { memo, route } = workspace();
  for (const board of [memo, route]) {
    const result = run(verify, ['check', board]);
    assert.equal(result.status, 0, result.out);
    assert.match(result.out, /theme repo .* is not available here/);
  }
  const committed = path.join(__dirname, '..', 'fixtures', 'workspace');
  assert.equal(fs.readFileSync(path.join(committed, 'html', 'memo-style.html'), 'utf8'), fixtures.memoStyleBoard(), 'regenerate with: node scripts/lib/fixtures.js --write fixtures/workspace');
  assert.equal(fs.readFileSync(path.join(committed, 'html', 'route-state.html'), 'utf8'), fixtures.routeStateBoard());
  assert.equal(fs.readFileSync(path.join(committed, 'markdown', 'memo-style-tokens.md'), 'utf8'), fixtures.tokensMarkdown('memo-style'));
});

test('resolved token rows are re-read from the theme file at the recorded revision, following aliases', () => {
  const { home, ws, memo } = workspace();
  const tokensPath = path.join(ws, 'markdown', 'memo-style-tokens.md');
  const { repo, sha } = themeRepo(home, tokensPath);
  const ok = run(verify, ['check', memo], { env: { HOME: home } });
  assert.equal(ok.status, 0, ok.out);
  assert.doesNotMatch(ok.out, /not available here/);
  // An app-level override committed later must not satisfy a row recorded at the earlier revision.
  fs.appendFileSync(path.join(repo, fixtures.THEME_FILE), '\n.app { --color-primary: #ff0000; }\n');
  git(repo, 'commit', '-qam', 'override');
  const later = git(repo, 'rev-parse', '--short', 'HEAD');
  const tokens = fs.readFileSync(tokensPath, 'utf8').replace(/\| `--app-primary` \| `--color-primary` \| `([^`]+)` \| light \| `[^`]+` \|/, `| \`--app-primary\` | \`--color-primary\` | \`$1\` | light | \`${later}\` |`);
  fs.writeFileSync(tokensPath, tokens);
  const stale = run(verify, ['check', memo], { env: { HOME: home } });
  assert.equal(stale.status, 1);
  assert.match(stale.out, /--app-primary: --color-primary is "#ff0000" at/);
  assert.equal(lib.sourceValue(fixtures.THEME_CSS, '--color-default'), 'oklch(0.92 0.006 260)');
  assert.equal(lib.sourceValue(fixtures.THEME_CSS, 'body { font-family }'), '"Inter Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif');
  assert.equal(run(verify, ['check', memo, '--skip-theme-source'], { env: { HOME: home } }).status, 0);
});

test('substituted and waived rows must be visible; a waiver needs an owner decision; unresolved rows block issuance', () => {
  const { ws, memo } = workspace();
  const tokensPath = path.join(ws, 'markdown', 'memo-style-tokens.md');
  const original = fs.readFileSync(tokensPath, 'utf8');
  const html = fs.readFileSync(memo, 'utf8');

  // Substitution that the masthead does not name.
  fs.writeFileSync(memo, html.replace('18 resolved, 1 substituted (--app-font)', 'all resolved'));
  let result = run(verify, ['check', memo]);
  assert.equal(result.status, 1);
  assert.match(result.out, /substituted token --app-font is not named in the masthead/);
  fs.writeFileSync(memo, html);

  // Waiver without a recorded decision, then with one.
  fs.writeFileSync(tokensPath, original.replace('| `--app-info-foreground` | `--color-info-foreground` | `packages/theme/src/styles.css` | light | `a1b2c3d` | `#1a56db` | resolved |', '| `--app-info-foreground` | `--color-info-foreground` | `packages/theme/src/styles.css` | light | `a1b2c3d` | `#1a56db` | waived |'));
  result = run(verify, ['check', memo]);
  assert.equal(result.status, 1);
  assert.match(result.out, /waived token --app-info-foreground is not named in the masthead/);
  assert.match(result.out, /has no revision-notes decision entry/);
  const waived = html
    .replace('18 resolved, 1 substituted (--app-font)', '17 resolved, 1 substituted (--app-font), 1 waived (--app-info-foreground)')
    .replace('--app-font substituted (bundled web font replaced by the system stack)', '--app-font substituted (bundled web font replaced by the system stack); --app-info-foreground waived')
    .replace('</ol>', '      <li data-version="1" data-type="decision" data-date="2026-09-24" data-author="Board owner" data-waives="--app-info-foreground"><b>v1</b> · 2026-09-24 · <span class="who">Board owner</span> · decision — info foreground may stay unmapped on this board; no info alert is drawn.</li>\n    </ol>');
  fs.writeFileSync(memo, waived);
  result = run(verify, ['check', memo]);
  assert.equal(result.status, 0, result.out);
  assert.match(result.out, /1 waived/);
  const agentWaiver = waived.replace('data-author="Board owner" data-waives', 'data-author="agent" data-waives');
  fs.writeFileSync(memo, agentWaiver);
  result = run(verify, ['check', memo]);
  assert.match(result.out, /must be recorded by the board owner/);

  // Unresolved row: draft, cannot issue.
  fs.writeFileSync(memo, html);
  fs.writeFileSync(tokensPath, original.replace('| `#1a56db` | resolved |', '| | unresolved |'));
  result = run(verify, ['check', memo]);
  assert.equal(result.status, 0, 'a draft with the token still declared is reviewable');
  assert.match(result.out, /draft: unresolved tokens block issuance/);
  assert.doesNotMatch(result.out, /has no token map row/);
  const issue = run(verify, ['issue', memo, '--date', '2026-09-24']);
  assert.equal(issue.status, 1);
  assert.match(issue.out, /unresolved token rows make this board a draft/);
  assert.equal(fs.existsSync(path.join(ws, 'html', 'versions')), false);
});

test('chrome drift, runtime edits, placeholder facts and remote assets fail the structure check', () => {
  const { memo } = workspace();
  const html = fs.readFileSync(memo, 'utf8');
  const cases = [
    [html.replace('--board-accent: #1d5fbf;', '--board-accent: #ff00ff;'), /chrome token --board-accent differs from the starter/],
    [html.replace('function parseHash(hash) {', 'function parseHash(hash) { /* edited */'), /runtime script differs from the starter/],
    [html.replace('<code>main @ a1b2c3d</code>', '<code>develop @ 0000000</code>'), /starter placeholders/],
    [html.replace('</head>', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter"></head>'), /disallowed network reference/],
    [html.replace('<p>File names, people and references are example fixtures. Prototype markup is a discussion aid, not an implementation.</p>', '<p>Fixtures.</p>'), /discussion aid, not an implementation/],
    [html.replace('id="owner" data-purpose="proposed-change"', 'id="owner-renamed" data-purpose="proposed-change"'), /brief section #owner .* is missing/],
    [html.replace('"allowed": {', '"allowed": { "ghost": ["empty"],'), /keys unknown controlling option 'ghost'/],
  ];
  cases.forEach(([mutated, expected]) => {
    fs.writeFileSync(memo, mutated);
    const result = run(verify, ['check', memo]);
    assert.equal(result.status, 1, expected.toString());
    assert.match(result.out, expected);
  });
});

/* ---------- issuance, citations, publication ---------- */

test('issue freezes v1, identical reissue is a no-op, changed bytes need a bump, v1 stays intact through v2 and a late publish', () => {
  const { home, ws, route } = workspace();
  const frozen1 = path.join(ws, 'html', 'versions', 'route-state.v1.html');
  const issue = run(verify, ['issue', route, '--date', '2026-09-24']);
  assert.equal(issue.status, 0, issue.out);
  assert.equal(fs.existsSync(frozen1), true);
  const v1 = fs.readFileSync(frozen1);
  assert.equal(fs.readFileSync(route).equals(v1), true, 'working issued copy and frozen file agree');
  assert.match(fs.readFileSync(route, 'utf8'), /data-board-issued="true"/);
  assert.match(fs.readFileSync(route, 'utf8'), /v1 · 2026-09-24 · issued/);
  assert.match(fs.readFileSync(route, 'utf8'), /data-type="issued"[^>]*>.*<a href="versions\/route-state\.v1\.html">/);
  assert.equal(run(verify, ['check', route]).status, 0);
  const index1 = fs.readFileSync(path.join(ws, 'boards.md'), 'utf8');
  assert.match(index1, /\| v1 \| 2026-09-24 \| `html\/versions\/route-state\.v1\.html` \| `sha256:[0-9a-f]{64}` \| — \|/);

  const again = run(verify, ['issue', route, '--date', '2026-09-25']);
  assert.equal(again.status, 0, again.out);
  assert.match(again.out, /already issued with identical content/);
  assert.equal(fs.readFileSync(frozen1).equals(v1), true);

  // A typo fix on the issued working copy: check refuses, issue refuses, frozen bytes untouched.
  const typo = fs.readFileSync(route, 'utf8').replace('Three placements', 'Three placemnets');
  fs.writeFileSync(route, typo);
  const check = run(verify, ['check', route]);
  assert.equal(check.status, 1);
  assert.match(check.out, /already issued .* with different bytes; run "bump"/);
  const overwrite = run(verify, ['issue', route]);
  assert.equal(overwrite.status, 1);
  assert.match(overwrite.out, /Frozen files are never overwritten/);
  assert.equal(fs.readFileSync(frozen1).equals(v1), true);

  const bump = run(verify, ['bump', route, '--date', '2026-09-25', '--note', 'copy correction']);
  assert.equal(bump.status, 0, bump.out);
  assert.match(fs.readFileSync(route, 'utf8'), /data-board-version="2" data-board-issued="false"/);
  assert.match(fs.readFileSync(route, 'utf8'), /v2 · 2026-09-25 · working/);
  assert.equal(run(verify, ['check', route]).status, 0, run(verify, ['check', route]).out);
  const issue2 = run(verify, ['issue', route, '--date', '2026-09-25']);
  assert.equal(issue2.status, 0, issue2.out);
  const frozen2 = path.join(ws, 'html', 'versions', 'route-state.v2.html');
  assert.equal(fs.existsSync(frozen2), true);
  assert.equal(fs.readFileSync(frozen1).equals(v1), true, 'v1 bytes unchanged after v2');
  assert.match(fs.readFileSync(frozen2, 'utf8'), /placemnets/);

  // Citations: v1 resolves to the frozen v1 even though the working file is v2; v2 cannot satisfy v1.
  const cite1 = run(verify, ['cite', `Companion: \`${route}\` (v1) — "Where the approval commands go" (#commands?variant=a&route=external&state=authority-review&viewer=approver)`], { env: { HOME: home } });
  assert.equal(cite1.status, 0, cite1.out);
  assert.match(cite1.out, /Working file identical: false/);
  assert.match(cite1.out, /Scenario: \{"variant":"a","route":"external","state":"authority-review","viewer":"approver"\}/);
  const cite3 = run(verify, ['cite', `Companion: \`${route}\` (v3) — "Where the approval commands go" (#commands?variant=a&route=external&state=authority-review&viewer=approver)`]);
  assert.equal(cite3.status, 1);
  assert.match(cite3.out, /v3 was never issued/);
  const missing = run(verify, ['cite', `\`${route}\` (v1) — "Where the approval commands go" (#commands?variant=a&route=external&state=authority-review)`]);
  assert.equal(missing.status, 1);
  assert.match(missing.out, /missing dimension 'viewer'/);
  const headingOnly = run(verify, ['cite', `\`${route}\` (v1) — "Where the approval commands go"`]);
  assert.equal(headingOnly.status, 1);
  assert.match(headingOnly.out, /interactive; the citation must carry a complete scenario/);
  const tilde = run(verify, ['cite', `Companion: \`~/agent-artifacts/northwind-jobs-ux/html/route-state.html\` (v2) — "Where the approval commands go" (#commands?variant=today&route=depot&state=draft&viewer=planner)`], { env: { HOME: home } });
  assert.equal(tilde.status, 0, tilde.out);

  // Late publication touches the index only.
  const v2 = fs.readFileSync(frozen2);
  const publish = run(verify, ['publish', route, '--version', '2', '--url', 'https://example.test/artifact/abc', '--host', 'claude']);
  assert.equal(publish.status, 0, publish.out);
  assert.equal(fs.readFileSync(frozen2).equals(v2), true);
  assert.equal(fs.readFileSync(frozen1).equals(v1), true);
  assert.match(fs.readFileSync(path.join(ws, 'boards.md'), 'utf8'), /\| v2 \| 2026-09-25 \| .* \| https:\/\/example\.test\/artifact\/abc \(claude\) \|/);
  const unissued = run(verify, ['publish', route, '--version', '9', '--url', 'https://example.test/x', '--host', 'claude']);
  assert.equal(unissued.status, 1);
  assert.match(unissued.out, /not issued/);
});

test('legacy migration reserves historical numbers, exempts only inventoried citations, and issues above them', () => {
  const { home, ws, memo } = workspace();
  const legacy = 'Companion: `~/agent-artifacts/northwind-jobs-ux/html/memo-style.html` (v17) — "Dispatch note on job creation"';
  const migrate = run(verify, ['migrate', memo, '--citation', legacy, '--location', 'field-ops-ui/.agent/tasks/ui-dispatch-notes.md:7']);
  assert.equal(migrate.status, 0, migrate.out);
  assert.match(migrate.out, /reserved through v17; next issue must be v18/);
  const index = fs.readFileSync(path.join(ws, 'boards.md'), 'utf8');
  assert.match(index, /- Reserved: 17/);
  assert.match(index, /\| Companion: .*\(v17\).* \| field-ops-ui\/\.agent\/tasks\/ui-dispatch-notes\.md:7 \| legacy — historical version unavailable \|/);
  assert.equal(fs.existsSync(path.join(ws, 'html', 'versions')), false, 'no historical file is invented');

  const cite17 = run(verify, ['cite', legacy], { env: { HOME: home } });
  assert.equal(cite17.status, 1);
  assert.match(cite17.out, /legacy citation: legacy — historical version unavailable/);
  assert.match(cite17.out, /Citation does not resolve \(legacy\)/);
  const cite5 = run(verify, ['cite', legacy.replace('(v17)', '(v5)')], { env: { HOME: home } });
  assert.match(cite5.out, /v5 was never issued/);
  assert.doesNotMatch(cite5.out, /legacy citation/);

  const low = run(verify, ['issue', memo, '--date', '2026-09-24']);
  assert.equal(low.status, 1);
  assert.match(low.out, /at or below the reserved legacy number 17/);
  const bump = run(verify, ['bump', memo, '--date', '2026-09-24']);
  assert.equal(bump.status, 0, bump.out);
  assert.match(bump.out, /to v18/);
  const issue = run(verify, ['issue', memo, '--date', '2026-09-24']);
  assert.equal(issue.status, 0, issue.out);
  assert.equal(fs.existsSync(path.join(ws, 'html', 'versions', 'memo-style.v18.html')), true);
  const cite18 = run(verify, ['cite', 'Companion: `~/agent-artifacts/northwind-jobs-ux/html/memo-style.html` (v18) — "Dispatch note on job creation" (#notes?surface=record&state=legacy&view=both)'], { env: { HOME: home } });
  assert.equal(cite18.status, 0, cite18.out);
  const cite18bad = run(verify, ['cite', 'Companion: `~/agent-artifacts/northwind-jobs-ux/html/memo-style.html` (v18) — "Dispatch note on job creation" (#notes?surface=record&state=empty&view=both)'], { env: { HOME: home } });
  assert.equal(cite18bad.status, 1);
  assert.match(cite18bad.out, /forbidden by the section's dependencies/);
});

/* ---------- bundles ---------- */

test('a new-board bundle round-trips through import; a used identity is rejected', () => {
  const { root, home, ws } = workspace();
  const brief = path.join(ws, 'markdown', 'memo-style-brief.md');
  const tokens = path.join(ws, 'markdown', 'memo-style-tokens.md');
  const target = path.join(home, 'agent-artifacts', 'fresh-topic');
  const out = path.join(root, 'bundle-new');
  const exported = run(bundle, ['export', 'memo-style', '--workspace', target, '--out', out, '--brief', brief, '--tokens', tokens, '--new'], { env: { HOME: home } });
  assert.equal(exported.status, 0, exported.out);
  const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
  assert.equal(manifest.kind, 'new');
  for (const file of ['README.md', 'instructions/SKILL.md', 'instructions/references/anatomy.md', 'instructions/references/lifecycle.md', 'instructions/templates/brief.md', 'instructions/starter.html', 'brief.md', 'tokens.md', 'starter.html']) assert.equal(fs.existsSync(path.join(out, file)), true, file);
  assert.equal(fs.existsSync(path.join(out, 'current')), false);

  // The host returns a candidate plus the untouched manifest.
  const candidate = path.join(root, 'candidate-new');
  fs.mkdirSync(candidate);
  fs.writeFileSync(path.join(candidate, 'memo-style.html'), fixtures.memoStyleBoard());
  fs.copyFileSync(path.join(out, 'manifest.json'), path.join(candidate, 'manifest.json'));
  const noMap = run(bundle, ['import', candidate, '--into', target], { env: { HOME: home } });
  assert.equal(noMap.status, 1);
  assert.match(noMap.out, /no token map available/);
  assert.equal(fs.existsSync(path.join(target, 'html')), false, 'nothing written on rejection');
  const imported = run(bundle, ['import', candidate, '--into', target, '--bundle', out], { env: { HOME: home } });
  assert.equal(imported.status, 0, imported.out);
  assert.equal(fs.existsSync(path.join(target, 'html', 'memo-style.html')), true);
  assert.equal(fs.existsSync(path.join(target, 'markdown', 'memo-style-brief.md')), true);
  assert.match(fs.readFileSync(path.join(target, 'boards.md'), 'utf8'), /Imported v1 candidate from a new bundle/);
  assert.equal(run(verify, ['check', path.join(target, 'html', 'memo-style.html')], { env: { HOME: home } }).status, 0);

  const again = run(bundle, ['import', candidate, '--into', target, '--bundle', out], { env: { HOME: home } });
  assert.equal(again.status, 1);
  assert.match(again.out, /needs an unused board identity/);
});

test('a revision bundle preserves the current board and decisions; stale bases and frozen conflicts are rejected without changes', () => {
  const { root, home, ws, route } = workspace();
  assert.equal(run(verify, ['issue', route, '--date', '2026-09-24']).status, 0);
  const decided = fs.readFileSync(route, 'utf8');
  const withDecision = lib.bumpWorking(decided, lib.parseBoard(decided), 2, '2026-09-25', 'after review')
    .replace('</ol>', '      <li data-version="2" data-type="decision" data-date="2026-09-25" data-author="Board owner"><b>v2</b> · 2026-09-25 · <span class="who">Board owner</span> · decision — variant A accepted; B dropped.</li>\n    </ol>');
  fs.writeFileSync(route, withDecision);
  assert.equal(run(verify, ['check', route]).status, 0, run(verify, ['check', route]).out);
  const out = path.join(root, 'bundle-rev');
  const exported = run(bundle, ['export', route, '--out', out], { env: { HOME: home } });
  assert.equal(exported.status, 0, exported.out);
  const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
  assert.equal(manifest.kind, 'revision');
  assert.equal(manifest.baseVersion, 2);
  assert.equal(manifest.baseDigest, lib.sha256(fs.readFileSync(route)));
  assert.deepEqual(Object.keys(manifest.frozen), ['html/versions/route-state.v1.html']);
  assert.equal(fs.existsSync(path.join(out, 'current', 'route-state.html')), true);
  assert.equal(fs.existsSync(path.join(out, 'current', 'versions', 'route-state.v1.html')), true);
  assert.match(fs.readFileSync(path.join(out, 'current', 'boards.md'), 'utf8'), /route-state/);

  // The host revises the current board (keeping history) and returns it with the base manifest.
  const candidate = path.join(root, 'candidate-rev');
  fs.mkdirSync(candidate);
  const revised = fs.readFileSync(path.join(out, 'current', 'route-state.html'), 'utf8').replace('Three placements for the approval commands', 'Three placements for the approval commands, revised on the bundle path');
  fs.writeFileSync(path.join(candidate, 'route-state.html'), revised);
  fs.copyFileSync(path.join(out, 'manifest.json'), path.join(candidate, 'manifest.json'));

  // A canonical edit after export makes the base stale: rejected, nothing replaced.
  const canonicalBefore = fs.readFileSync(route);
  fs.writeFileSync(route, decided.replace('Three placements', 'Three placements (edited after export)'));
  const stale = run(bundle, ['import', candidate, '--into', ws], { env: { HOME: home } });
  assert.equal(stale.status, 1);
  assert.match(stale.out, /stale base/);
  assert.doesNotMatch(fs.readFileSync(route, 'utf8'), /revised on the bundle path/);
  fs.writeFileSync(route, canonicalBefore);

  // A frozen-file conflict is rejected too.
  const frozen1 = path.join(ws, 'html', 'versions', 'route-state.v1.html');
  const frozenBytes = fs.readFileSync(frozen1);
  fs.writeFileSync(frozen1, `${frozenBytes.toString('utf8')}\n<!-- tampered -->`);
  const conflict = run(bundle, ['import', candidate, '--into', ws], { env: { HOME: home } });
  assert.equal(conflict.status, 1);
  assert.match(conflict.out, /differs from the bundle's digest/);
  assert.equal(fs.readFileSync(route).equals(canonicalBefore), true, 'working file untouched on a frozen conflict');
  fs.writeFileSync(frozen1, frozenBytes);

  // A candidate that drops accepted history is rejected.
  fs.writeFileSync(path.join(candidate, 'route-state.html'), revised.replace(/\s*<li data-version="2" data-type="decision"[^\n]*<\/li>/, ''));
  const dropped = run(bundle, ['import', candidate, '--into', ws], { env: { HOME: home } });
  assert.equal(dropped.status, 1);
  assert.match(dropped.out, /dropped the base revision entry v2 decision/);
  assert.equal(fs.readFileSync(route).equals(canonicalBefore), true);

  // A candidate claiming issuance is rejected.
  fs.writeFileSync(path.join(candidate, 'route-state.html'), revised.replace('data-board-issued="false"', 'data-board-issued="true"'));
  const issued = run(bundle, ['import', candidate, '--into', ws], { env: { HOME: home } });
  assert.equal(issued.status, 1);
  assert.match(issued.out, /cannot issue a version/);
  fs.writeFileSync(path.join(candidate, 'route-state.html'), revised);

  fs.writeFileSync(path.join(candidate, 'route-state.html'), revised);
  const ok = run(bundle, ['import', candidate, '--into', ws], { env: { HOME: home } });
  assert.equal(ok.status, 0, ok.out);
  const after = fs.readFileSync(route, 'utf8');
  assert.match(after, /revised on the bundle path/);
  assert.match(after, /decision — variant A accepted; B dropped/, 'accepted decisions survive the round trip');
  assert.match(after, /data-type="issued"[^>]*>.*route-state\.v1\.html/, 'issued history survives');
  assert.equal(fs.readFileSync(frozen1).equals(frozenBytes), true);
  assert.equal(run(verify, ['check', route]).status, 0);
});

/* ---------- review follow-ups: dark mode, multi-controller dead ends, static sections, parsing edges ---------- */

test('theme declarations are attributed to their innermost block and mode', () => {
  const css = `/* dark theme lives in .dark { below */
@layer base {
  :root { --background: oklch(1 0 0); --primary: #1a56db; }
  :root:not(.dark) { --ring: #cccccc; }
  .dark { --background: oklch(0.145 0 0); --primary: #7fb8e0; }
  /* .dark { --background: black; } */
}
@theme inline { --color-background: var(--background); --color-primary: var(--primary) }
@media (prefers-color-scheme: dark) { :root { --primary: #ffffff } }
.btn-dark-outline { --btn: #123456; }
`;
  assert.equal(lib.sourceValue(css, '--background', 'light'), 'oklch(1 0 0)');
  assert.equal(lib.sourceValue(css, '--color-background', 'light'), 'oklch(1 0 0)');
  assert.equal(lib.sourceValue(css, '--primary', 'light'), '#1a56db');
  assert.equal(lib.sourceValue(css, '--ring', 'light'), '#cccccc');
  assert.equal(lib.sourceValue(css, '--btn', 'light'), '#123456');
  assert.equal(lib.sourceValue(css, '--background', 'dark'), 'oklch(0.145 0 0)');
  assert.equal(lib.sourceValue(css, '--color-primary', 'dark'), '#ffffff', 'the media-query override is the last dark declaration');
  const modes = lib.cssDeclarations(css);
  assert.equal(modes.dark['--background'], 'oklch(0.145 0 0)');
  assert.equal(modes.light['--background'], 'oklch(1 0 0)');
});

test('the starter itself parses without phantom sections; selector lists with the dark attribute are read', () => {
  const starter = lib.parseBoard(fs.readFileSync(lib.STARTER_PATH, 'utf8'));
  assert.deepEqual(starter.sections.map((s) => s.id), ['example', 'revisions']);
  const html = '<style>.mock[data-app-scheme="dark"],\n.mock[data-app-scheme="dark"] .m-card { --app-x: #111; }\n.mock:not([data-app-scheme="dark"]) { --app-y: #222; }</style>';
  assert.deepEqual(lib.parseBoard(html).appDarkVars, { '--app-x': '#111' });
});

test('dark token rows resolve in the theme dark block, need a dark --app-* block and a scheme dimension', () => {
  const { home, ws, memo } = workspace();
  const tokensPath = path.join(ws, 'markdown', 'memo-style-tokens.md');
  const css = `@layer base {\n${fixtures.THEME_CSS}\n  .dark {\n    --color-background: oklch(0.15 0 0);\n    --color-primary: #7fb8e0;\n  }\n}\n`;
  const { sha } = themeRepo(home, tokensPath, css);
  const light = run(verify, ['check', memo], { env: { HOME: home } });
  assert.equal(light.status, 0, `light rows must not read the .dark override: ${light.out}`);

  fs.appendFileSync(tokensPath, `| \`--app-background\` | \`--color-background\` | \`${fixtures.THEME_FILE}\` | dark | \`${sha}\` | \`oklch(0.15 0 0)\` | resolved | |\n| \`--app-primary\` | \`--color-primary\` | \`${fixtures.THEME_FILE}\` | dark | \`${sha}\` | \`#7fb8e0\` | resolved | |\n`);
  const missing = run(verify, ['check', memo], { env: { HOME: home } });
  assert.equal(missing.status, 1);
  assert.match(missing.out, /dark token map row --app-background has no matching/);
  assert.match(missing.out, /need a mock-only Scheme control/);

  const briefPath = path.join(ws, 'markdown', 'memo-style-brief.md');
  fs.writeFileSync(briefPath, fs.readFileSync(briefPath, 'utf8').replace('#owner?state=region&view=after', '#owner?state=region&view=after&scheme=light'));
  const html = fs.readFileSync(memo, 'utf8');
  const withDark = html
    .replace('  /* Host dark-mode rules', '  .mock[data-app-scheme="dark"] {\n    --app-background: oklch(0.15 0 0);\n    --app-primary: #7fb8e0;\n  }\n  /* Host dark-mode rules')
    .replace(/<script type="application\/json" id="board-scenarios">([\s\S]*?)<\/script>/, (m, json) => {
      const def = JSON.parse(json);
      def.sections.owner.dimensions.push({ id: 'scheme', label: 'Scheme', options: [{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }] });
      return `<script type="application/json" id="board-scenarios">\n${JSON.stringify(def, null, 2)}\n</script>`;
    });
  fs.writeFileSync(memo, withDark);
  const ok = run(verify, ['check', memo], { env: { HOME: home } });
  assert.equal(ok.status, 0, ok.out);
  assert.match(ok.out, /21 rows: 20 resolved, 1 substituted/);
  fs.writeFileSync(memo, withDark.replace('--app-primary: #7fb8e0;', '--app-primary: #000000;'));
  const wrong = run(verify, ['check', memo], { env: { HOME: home } });
  assert.match(wrong.out, /--app-primary is #000000 in the board but #7fb8e0 in the token map/);
  const html2 = runtime.frame('<b>x</b>', 'note', 'dark');
  assert.match(html2, /<div class="mock" data-app-scheme="dark">/);
  assert.doesNotMatch(runtime.frame('<b>x</b>', 'note', 'light'), /data-app-scheme/);
});

test('two controllers whose allowed lists never meet are rejected at definition time', () => {
  const deadEnd = { sections: { s: { dimensions: [
    { id: 'a', options: [{ id: 'a1' }, { id: 'a2' }] }, { id: 'b', options: [{ id: 'b1' }, { id: 'b2' }] }, { id: 'c', options: [{ id: 'c1' }, { id: 'c2' }] },
  ], dependencies: [
    { controlling: 'a', dependent: 'c', allowed: { a1: ['c1'], a2: ['c2'] } },
    { controlling: 'b', dependent: 'c', allowed: { b1: ['c1'], b2: ['c2'] } },
  ] } } };
  assert.throws(() => runtime.validateDefinition(deadEnd), /leaves no valid 'c' option when a=a1, b=b2/);
  const meets = JSON.parse(JSON.stringify(deadEnd));
  meets.sections.s.dependencies[1].allowed = { b1: ['c1', 'c2'], b2: ['c1', 'c2'] };
  assert.doesNotThrow(() => runtime.validateDefinition(meets));
  // Many controlled dimensions do not blow up the search; a conflict hidden behind them is still found.
  const wide = { sections: { s: { dimensions: [], dependencies: [] } } };
  const opts = ['o0', 'o1', 'o2', 'o3', 'o4', 'o5'].map((id) => ({ id }));
  for (let d = 0; d < 9; d += 1) wide.sections.s.dimensions.push({ id: `d${d}`, options: opts.map((o) => ({ ...o })) });
  for (let d = 2; d < 9; d += 1) wide.sections.s.dependencies.push({ controlling: 'd0', dependent: `d${d}`, allowed: Object.fromEntries(opts.map((o) => [o.id, opts.map((x) => x.id)])) });
  wide.sections.s.dependencies.push({ controlling: 'd1', dependent: 'd8', allowed: Object.fromEntries(opts.map((o) => [o.id, opts.map((x) => x.id)])) });
  assert.doesNotThrow(() => runtime.validateDefinition(wide));
  wide.sections.s.dependencies[wide.sections.s.dependencies.length - 1].allowed.o5 = ['o0'];
  wide.sections.s.dependencies[wide.sections.s.dependencies.length - 2].allowed.o5 = ['o1'];
  assert.throws(() => runtime.validateDefinition(wide), /leaves no valid 'd8' option when d0=o5, d1=o5/);
  const huge = { sections: { s: { dimensions: [], dependencies: [] } } };
  const many = Array.from({ length: 30 }, (_, i) => ({ id: `o${i}` }));
  for (let d = 0; d < 5; d += 1) huge.sections.s.dimensions.push({ id: `d${d}`, options: many.map((o) => ({ ...o })) });
  for (let d = 1; d < 5; d += 1) huge.sections.s.dependencies.push({ controlling: `d${d - 1}`, dependent: `d${d}`, allowed: Object.fromEntries(many.map((o) => [o.id, many.map((x) => x.id)])) });
  assert.throws(() => runtime.validateDefinition(huge), /too many controller combinations/);
  const sel = runtime.applyChange(meets.sections.s, runtime.defaultSelection(meets.sections.s), 'a', 'a2');
  assert.deepEqual(sel, { a: 'a2', b: 'b1', c: 'c2' });
});

test('malformed percent-encoding is reported, not thrown', () => {
  const result = runtime.resolveScenario(routeDef, '#commands?variant=%E0');
  assert.equal(result.ok, false);
  assert.match(result.reason, /malformed percent-encoding/);
  assert.equal(runtime.parseHash('#%E0').kind, 'malformed');
  const { home, route } = workspace();
  assert.equal(run(verify, ['issue', route, '--date', '2026-09-24']).status, 0);
  const cite = run(verify, ['cite', `\`${route}\` (v1) — "Where the approval commands go" (#commands?variant=%E0)`], { env: { HOME: home } });
  assert.equal(cite.status, 1);
  assert.match(cite.out, /FAIL scenario does not resolve: malformed percent-encoding/);
});

test('static sections, mock <section> markup and other <ol> lists do not confuse structure checks or issuance', () => {
  const { home, ws, memo } = workspace();
  const briefPath = path.join(ws, 'markdown', 'memo-style-brief.md');
  fs.writeFileSync(briefPath, fs.readFileSync(briefPath, 'utf8')
    .replace('- Purpose: proposed-change', '- Purpose: proposed-change, defect-report')
    .replace('| `owner` | Job detail reads the owning unit | proposed-change |', '| `owner` | Job detail reads the owning unit | proposed-change |\n| `defects` | On the page today | defect-report |'));
  const staticSection = `  <section class="board-section" id="defects" data-purpose="defect-report">
    <header><h2>On the page today</h2></header>
    <ol data-board-part="defects"><li>D1 · the owner label wraps at 390 px</li></ol>
    <div class="pane" data-board-part="before-pane"><p class="pane-label">Before <i>· reconstructed from source @ main @ a1b2c3d</i></p><div class="frame"><div class="mock"><section class="m-card">Static mock with its own section tag</section></div></div></div>
  </section>

`;
  const html = fs.readFileSync(memo, 'utf8')
    .replace('  <section class="board-section" id="revisions">', `${staticSection}  <section class="board-section" id="revisions">`)
    .replace("var OWNER = {", "var PHANTOM = '<section class=\"m-card\">inside a renderer string</section>';\n  var OWNER = {");
  fs.writeFileSync(memo, html);
  const check = run(verify, ['check', '--skip-theme-source', memo]);
  assert.equal(check.status, 0, check.out);
  const parsed = lib.parseBoard(html);
  assert.deepEqual(parsed.sections.map((s) => s.id), ['notes', 'owner', 'defects', 'revisions']);
  assert.equal(run(verify, ['issue', memo, '--date', '2026-09-24']).status, 0);
  const issued = fs.readFileSync(memo, 'utf8');
  assert.doesNotMatch(/<ol data-board-part="defects">[\s\S]*?<\/ol>/.exec(issued)[0], /data-type="issued"/, 'the issued entry lands in the revision list, not the defects list');
  assert.match(/<ol class="revision-list"[\s\S]*?<\/ol>/.exec(issued)[0], /data-type="issued"/);
  const staticCite = run(verify, ['cite', `\`${memo}\` (v1) — "On the page today"`], { env: { HOME: home } });
  assert.equal(staticCite.status, 0, staticCite.out);
  assert.match(staticCite.out, /#defects/);
  const scenario = run(verify, ['scenario', memo, '#owner?state=depot&view=after']);
  assert.equal(scenario.status, 0, scenario.out);
  assert.match(scenario.out, /Scenario ok: #owner/);
});

test('bump refreshes an older runtime from the starter; the frozen file keeps and uses its own', () => {
  const { home, ws, route } = workspace();
  const stale = fs.readFileSync(route, 'utf8').replace('function parseHash(hash) {', 'function parseHash(hash) { /* older starter */');
  fs.writeFileSync(route, stale);
  const check = run(verify, ['check', route]);
  assert.equal(check.status, 1);
  assert.match(check.out, /refreshed by "bump"/);
  const bump = run(verify, ['bump', route, '--date', '2026-09-24']);
  assert.equal(bump.status, 0, bump.out);
  assert.match(bump.out, /runtime refreshed from the starter/);
  assert.equal(run(verify, ['check', route]).status, 0);
  assert.match(fs.readFileSync(route, 'utf8'), /proposal — runtime refreshed from the starter/);
  assert.equal(run(verify, ['issue', route, '--date', '2026-09-24']).status, 0);
  const frozen = path.join(ws, 'html', 'versions', 'route-state.v2.html');
  fs.writeFileSync(frozen, fs.readFileSync(frozen, 'utf8').replace('function parseHash(hash) {', 'function parseHash(hash) { /* frozen with an older runtime */'));
  const cite = run(verify, ['cite', `\`${route}\` (v2) — "Where the approval commands go" (#commands?variant=a&route=depot&state=draft&viewer=planner)`], { env: { HOME: home } });
  assert.equal(cite.status, 0, cite.out);
});

test('migrate --reserve, index notes with parentheses, and citations survive an index round trip', () => {
  const { ws, memo } = workspace();
  const reserve = run(verify, ['migrate', memo, '--reserve', '20']);
  assert.equal(reserve.status, 0, reserve.out);
  assert.match(reserve.out, /reserved through v20; next issue must be v21/);
  const bump = run(verify, ['bump', memo, '--date', '2026-09-24']);
  assert.match(bump.out, /to v21/);
  const paths = lib.boardPaths(memo);
  const index = lib.readIndex(paths);
  index.boards['memo-style'].notes = 'Accepted variant A (B dropped)';
  lib.writeIndex(paths, index);
  const again = lib.readIndex(paths);
  assert.equal(again.boards['memo-style'].notes, 'Accepted variant A (B dropped)');
  assert.equal(again.boards['memo-style'].reserved, 20);
  assert.equal(fs.existsSync(path.join(ws, 'html', 'versions')), false);
});
