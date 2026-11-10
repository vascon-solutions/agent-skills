#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const STARTER = path.join(__dirname, '..', 'starter');
const CONFIG_FILE = 'roadmap-site.config.json';
const STYLESHEET = 'app/globals.css';
const TOKEN_BLOCK = /(\/\* roadmap-site:tokens:start \*\/\n)([\s\S]*?)(\/\* roadmap-site:tokens:end \*\/)/;
const TOKENS = ['--app-primary', '--app-primary-foreground', '--app-background', '--app-foreground', '--app-muted', '--app-border', '--app-radius', '--app-font'];
const TOKEN_STATUSES = ['resolved', 'substituted', 'waived', 'unresolved'];

function usage(exitCode = 0) {
  const out = exitCode === 0 ? process.stdout : process.stderr;
  out.write(`Usage:
  roadmap-site.js check [<roadmap.md>] [--config <file>] [--repo <dir>]
  roadmap-site.js build <site-dir> --config <file> --tokens <file>
  roadmap-site.js verify <site-dir>
  roadmap-site.js pull --config <file> [--repo <dir>] [--url <site-url>] [--prefer repo|page <id>]... [--token-stdin]
  roadmap-site.js push --config <file> [--repo <dir>] [--url <site-url>] [--token-stdin]

check   parse the roadmap with the minimum source format and report every failing row
build   apply the starter overlay, config and token block to a host starter directory
verify  compare a site directory's overlay-owned files with this skill's starter
pull    three-way merge of pending page edits into the roadmap file (status words only; never commits)
push    upload the committed roadmap as the site snapshot

pull and push read ROADMAP_SYNC_TOKEN and, for a private Site, ROADMAP_SERVICE_TOKEN from the environment, or
as KEY=value lines on stdin with --token-stdin. Tokens are never accepted as arguments.
`);
  process.exit(exitCode);
}

const BOOLEAN_FLAGS = new Set(['token-stdin']);

function parseArgs(argv) {
  if (!argv.length || argv[0] === '--help' || argv[0] === '-h') usage(0);
  const args = { command: argv[0], positionals: [], flags: {}, prefer: new Map() };
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') usage(0);
    if (arg === '--prefer') {
      const side = argv[i + 1];
      const id = argv[i + 2];
      if (!['repo', 'page'].includes(side) || !id) die('--prefer takes "repo" or "page" and an item id');
      args.prefer.set(id, side);
      i += 2;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (/token$/.test(key) && !BOOLEAN_FLAGS.has(key)) die(`--${key}: tokens are read from the environment or stdin, never from arguments`);
      const next = argv[i + 1];
      args.flags[key] = BOOLEAN_FLAGS.has(key) || !next || next.startsWith('--') ? true : (i += 1, next);
    } else args.positionals.push(arg);
  }
  return args;
}

function die(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function expandHome(file) {
  return file === '~' || file.startsWith('~/') ? path.join(os.homedir(), file.slice(1)) : file;
}

async function lib() {
  const load = (name) => import(pathToFileURL(path.join(STARTER, 'lib', 'roadmap', name)).href);
  const [parse, merge, access] = await Promise.all([load('parse.mjs'), load('merge.mjs'), load('access.mjs')]);
  return { ...parse, ...merge, ...access };
}

function readJsonFile(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return die(`cannot read ${label} ${file}: ${error.message}`);
  }
}

function loadContext(flags, positional) {
  const configPath = flags.config ? path.resolve(expandHome(flags.config)) : null;
  const config = configPath ? readJsonFile(configPath, 'config') : {};
  let repo = flags.repo || config.repo || '.';
  repo = path.resolve(configPath && !flags.repo ? path.dirname(configPath) : process.cwd(), expandHome(repo));
  const roadmapPath = config.roadmapPath || '.agent/roadmap.md';
  const file = positional ? path.resolve(expandHome(positional)) : path.join(repo, roadmapPath);
  return { config, repo, roadmapPath, file, url: flags.url || config.siteUrl || '' };
}

/* ---------- check ---------- */

function reportParse(parsed, file) {
  parsed.errors.forEach((error) => process.stdout.write(`FAIL ${error}\n`));
  const label = `Check ${path.basename(file)}`;
  process.stdout.write(parsed.errors.length
    ? `${label}: ${parsed.errors.length} failure(s)\n`
    : `${label}: ok (${parsed.groups.length} group(s), ${parsed.items.length} item(s))\n`);
}

async function commandCheck(args) {
  const L = await lib();
  const ctx = loadContext(args.flags, args.positionals[0]);
  if (!fs.existsSync(ctx.file)) die(`roadmap not found: ${ctx.file}`);
  const parsed = L.parseRoadmap(fs.readFileSync(ctx.file, 'utf8'));
  reportParse(parsed, ctx.file);
  process.exit(parsed.errors.length ? 1 : 0);
}

/* ---------- build and verify ---------- */

function starterFiles(dir = STARTER, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? starterFiles(path.join(dir, entry.name), rel) : [rel];
  }).sort();
}

function parseTokenMap(markdown) {
  const rows = [];
  let inTable = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (!/^\s*\|/.test(line)) {
      inTable = false;
      continue;
    }
    const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
    if (/^site token$/i.test(cells[0])) {
      inTable = true;
      continue;
    }
    if (!inTable || cells.every((cell) => /^:?-+:?$/.test(cell))) continue;
    const strip = (text) => (text || '').replace(/^`+|`+$/g, '').trim();
    rows.push({ token: strip(cells[0]), value: strip(cells[5]), status: strip(cells[6]).toLowerCase(), note: cells[7] || '' });
  }
  return rows;
}

function tokenDefaults() {
  const block = TOKEN_BLOCK.exec(fs.readFileSync(path.join(STARTER, STYLESHEET), 'utf8'))[2];
  return new Map([...block.matchAll(/(--app-[a-z-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

function resolveTokens(rows) {
  const failures = [];
  const defaults = tokenDefaults();
  const values = new Map();
  const colophon = { substituted: [], waived: [] };
  const seen = new Set();
  for (const row of rows) {
    if (!TOKENS.includes(row.token)) failures.push(`token map row ${row.token || '(empty)'} is not one of ${TOKENS.join(', ')}`);
    else if (seen.has(row.token)) failures.push(`token map has two rows for ${row.token}`);
    seen.add(row.token);
    if (!TOKEN_STATUSES.includes(row.status)) failures.push(`${row.token}: status "${row.status}" is not one of ${TOKEN_STATUSES.join(', ')}`);
    if (row.status === 'unresolved') failures.push(`${row.token} is unresolved; resolve, substitute or waive it before building`);
    if (row.status === 'waived') {
      values.set(row.token, defaults.get(row.token));
      colophon.waived.push({ token: row.token, note: row.note || 'owner decision' });
      continue;
    }
    if (!row.value || /[;{}<>]|url\(|@import/i.test(row.value)) failures.push(`${row.token}: value "${row.value}" is empty or not a plain CSS value`);
    values.set(row.token, row.value);
    if (row.status === 'substituted') colophon.substituted.push({ token: row.token, note: row.note || 'substituted' });
  }
  TOKENS.filter((token) => !seen.has(token)).forEach((token) => failures.push(`token map has no row for ${token}`));
  const block = `:root {\n${TOKENS.map((token) => `  ${token}: ${values.get(token)};`).join('\n')}\n}\n`;
  return { failures, block, colophon };
}

function hostFailures(siteDir) {
  const failures = [];
  const read = (rel) => (fs.existsSync(path.join(siteDir, rel)) ? fs.readFileSync(path.join(siteDir, rel), 'utf8') : null);
  const vite = read('vite.config.ts');
  if (!vite || !/\bsites\(/.test(vite)) failures.push('vite.config.ts with the host sites() build integration not found');
  const pkg = read('package.json');
  if (!pkg || !/"vinext"/.test(pkg)) failures.push('package.json does not depend on vinext');
  if (!read('app/chatgpt-auth.ts')) failures.push('app/chatgpt-auth.ts (the host sign-in helper) not found');
  const hosting = read('.openai/hosting.json');
  if (!hosting) failures.push('.openai/hosting.json not found');
  else {
    try {
      const manifest = JSON.parse(hosting);
      if (manifest.d1 && manifest.d1 !== 'DB') failures.push(`.openai/hosting.json binds D1 as "${manifest.d1}"; this app reads the DB binding`);
    } catch (error) {
      failures.push(`.openai/hosting.json is not valid JSON: ${error.message}`);
    }
  }
  return failures;
}

function writeIfChanged(file, content, written) {
  if (fs.existsSync(file) && fs.readFileSync(file).equals(Buffer.from(content))) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  written.push(file);
}

function commandBuild(args) {
  const siteArg = args.positionals[0];
  if (!siteArg || !args.flags.config || !args.flags.tokens) usage(1);
  const siteDir = path.resolve(expandHome(siteArg));
  const failures = fs.existsSync(siteDir) ? hostFailures(siteDir) : [`site directory not found: ${siteDir}`];
  if (failures.length) {
    failures.forEach((f) => process.stdout.write(`FAIL ${f}\n`));
    die(`Build refused: ${siteDir} is not a host Vinext starter`);
  }
  const config = readJsonFile(path.resolve(expandHome(args.flags.config)), 'config');
  const tokensFile = path.resolve(expandHome(args.flags.tokens));
  if (!fs.existsSync(tokensFile)) die(`token map not found: ${tokensFile}`);
  const tokens = resolveTokens(parseTokenMap(fs.readFileSync(tokensFile, 'utf8')));
  if (!config.title || typeof config.title !== 'string') tokens.failures.push('config needs a title');
  if (tokens.failures.length) {
    tokens.failures.forEach((f) => process.stdout.write(`FAIL ${f}\n`));
    die(`Build refused: ${tokens.failures.length} failure(s)`);
  }

  const written = [];
  for (const rel of starterFiles()) {
    let content = fs.readFileSync(path.join(STARTER, rel));
    if (rel === STYLESHEET) content = content.toString('utf8').replace(TOKEN_BLOCK, (m, start, body, end) => `${start}${tokens.block}${end}`);
    writeIfChanged(path.join(siteDir, rel), content, written);
  }
  const siteConfig = {
    title: config.title,
    summary: config.summary || '',
    roadmapPath: config.roadmapPath || '.agent/roadmap.md',
    repositoryUrl: config.repositoryUrl || '',
    ref: config.ref || 'main',
    colophon: tokens.colophon,
  };
  writeIfChanged(path.join(siteDir, CONFIG_FILE), `${JSON.stringify(siteConfig, null, 2)}\n`, written);
  const hostingFile = path.join(siteDir, '.openai', 'hosting.json');
  const manifest = JSON.parse(fs.readFileSync(hostingFile, 'utf8'));
  if (manifest.d1 !== 'DB') writeIfChanged(hostingFile, `${JSON.stringify({ ...manifest, d1: 'DB' }, null, 2)}\n`, written);

  written.forEach((file) => process.stdout.write(`wrote ${path.relative(siteDir, file)}\n`));
  const named = [...tokens.colophon.substituted, ...tokens.colophon.waived].map((row) => row.token);
  process.stdout.write(`Build ${path.basename(siteDir)}: ok (${written.length} file(s) written${named.length ? `; colophon names ${named.join(', ')}` : ''})\n`);
}

function withoutTokenBlock(text) {
  return text.replace(TOKEN_BLOCK, '$1$3');
}

function commandVerify(args) {
  const siteArg = args.positionals[0];
  if (!siteArg) usage(1);
  const siteDir = path.resolve(expandHome(siteArg));
  if (!fs.existsSync(siteDir)) die(`site directory not found: ${siteDir}`);
  const failures = [];
  for (const rel of starterFiles()) {
    const target = path.join(siteDir, rel);
    if (!fs.existsSync(target)) {
      failures.push(`missing ${rel}`);
      continue;
    }
    const expected = fs.readFileSync(path.join(STARTER, rel));
    const actual = fs.readFileSync(target);
    const same = rel === STYLESHEET
      ? withoutTokenBlock(expected.toString('utf8')) === withoutTokenBlock(actual.toString('utf8'))
      : expected.equals(actual);
    if (!same) failures.push(`changed ${rel}`);
  }
  failures.forEach((f) => process.stdout.write(`FAIL ${f}\n`));
  process.stdout.write(`Verify ${path.basename(siteDir)}: ${failures.length ? `${failures.length} drifted file(s)` : 'ok'}\n`);
  process.exit(failures.length ? 1 : 0);
}

/* ---------- sync ---------- */

function git(repo, args) {
  const result = childProcess.spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
  return { status: result.status, out: (result.stdout || '').trim(), err: (result.stderr || '').trim() };
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
  });
}

async function readTokens(flags) {
  const tokens = { sync: process.env.ROADMAP_SYNC_TOKEN || '', service: process.env.ROADMAP_SERVICE_TOKEN || '' };
  if (flags['token-stdin']) {
    for (const line of (await readStdin()).split(/\r?\n/)) {
      const match = /^\s*(ROADMAP_SYNC_TOKEN|ROADMAP_SERVICE_TOKEN)\s*=\s*(.*?)\s*$/.exec(line);
      if (!match) continue;
      const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
      if (match[1] === 'ROADMAP_SYNC_TOKEN') tokens.sync = value;
      else tokens.service = value;
    }
  }
  if (!tokens.sync) die('ROADMAP_SYNC_TOKEN is required: set it in the environment, or pass KEY=value lines on stdin with --token-stdin');
  return tokens;
}

/* Tokens travel only in their own headers; error output names the status, never a header value. */
async function syncRequest(url, tokens, method, body) {
  const headers = { accept: 'application/json', 'x-roadmap-sync-token': tokens.sync };
  if (tokens.service) headers['oai-sites-authorization'] = `Bearer ${tokens.service}`;
  if (body) headers['content-type'] = 'application/json';
  let endpoint;
  try {
    endpoint = new URL('/api/sync', url);
  } catch {
    return die(`site URL "${url}" is not a URL; set siteUrl in the config or pass --url`);
  }
  let response;
  try {
    response = await fetch(endpoint, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' });
  } catch (error) {
    return die(`cannot reach ${endpoint.origin}: ${(error.cause && error.cause.code) || error.message}`);
  }
  if (response.status >= 300 && response.status < 400) {
    return die(`${method} ${endpoint.pathname} was redirected (${response.status}); a private Site needs a current ROADMAP_SERVICE_TOKEN`);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return die(`${method} ${endpoint.pathname} returned ${response.status}: ${payload.error || 'no error message'}`);
  return payload;
}

function requireUrl(ctx) {
  if (!ctx.url) die('no site URL: set siteUrl in the config or pass --url');
}

async function commandPull(args) {
  const L = await lib();
  const ctx = loadContext(args.flags);
  requireUrl(ctx);
  if (!fs.existsSync(ctx.file)) die(`roadmap not found: ${ctx.file}`);
  const text = fs.readFileSync(ctx.file, 'utf8');
  const parsed = L.parseRoadmap(text);
  if (parsed.errors.length) {
    reportParse(parsed, ctx.file);
    die('Pull refused: the roadmap does not pass check');
  }
  const tokens = await readTokens(args.flags);
  const site = await syncRequest(ctx.url, tokens, 'GET');
  const plan = L.planPull({ repo: new Map(parsed.items.map((item) => [item.id, item.status])), pending: site.pending || [], prefer: args.prefer });

  plan.ignoredPrefers.forEach((id) => process.stdout.write(`WARN --prefer ${id} ignored: it is not a conflict or an orphaned edit\n`));
  plan.orphans.forEach((edit) => process.stdout.write(`WARN orphaned ${edit.id}: page status ${edit.status} has no row in the roadmap; --prefer repo ${edit.id} drops it\n`));
  if (plan.conflicts.length) {
    plan.conflicts.forEach((c) => process.stdout.write(`CONFLICT ${c.id}: repo ${c.repo}, page ${c.page} (both changed from ${c.base}); rerun with --prefer repo ${c.id} or --prefer page ${c.id}\n`));
    die(`Pull stopped: ${plan.conflicts.length} conflict(s); the roadmap file was left unchanged`);
  }

  const changes = new Map(plan.apply.map((change) => [change.id, change.to]));
  if (changes.size) {
    const next = L.rewriteStatuses(text, changes);
    const before = text.split('\n');
    const after = next.split('\n');
    fs.writeFileSync(ctx.file, next);
    plan.apply.forEach((change) => {
      const line = parsed.items.find((item) => item.id === change.id).line - 1;
      process.stdout.write(`applied ${change.id}: ${change.from} -> ${change.to}\n- ${before[line]}\n+ ${after[line]}\n`);
    });
  }
  plan.discard.forEach((edit) => process.stdout.write(`discard ${edit.id}: page edit ${edit.status} dropped; the repo status stands\n`));
  const result = await syncRequest(ctx.url, tokens, 'POST', {
    action: 'pull',
    commit: git(ctx.repo, ['rev-parse', 'HEAD']).out,
    author: git(ctx.repo, ['config', 'user.name']).out || 'sync',
    applied: plan.apply.map((change) => change.id),
    discard: plan.discard.map(({ id, status }) => ({ id, status })),
  });
  const skipped = plan.discard.length - (result.discarded || []).length;
  if (skipped > 0) process.stdout.write(`WARN ${skipped} discard(s) skipped because the page edit changed again; pull again\n`);
  process.stdout.write(`Pull: ${plan.apply.length} applied, ${(result.discarded || []).length} discarded, ${plan.converged.length} already equal, ${plan.orphans.length} orphaned.${changes.size ? ` Review the diff of ${ctx.roadmapPath} and commit it; sync never commits.` : ''}\n`);
}

async function commandPush(args) {
  const L = await lib();
  const ctx = loadContext(args.flags);
  requireUrl(ctx);
  const failures = [];
  const status = git(ctx.repo, ['status', '--porcelain']);
  if (status.status !== 0) die(`${ctx.repo} is not a git checkout: ${status.err}`);
  if (status.out) failures.push('working tree is not clean; commit or stash changes before pushing');
  if (!fs.existsSync(ctx.file)) die(`roadmap not found: ${ctx.file}`);
  const parsed = L.parseRoadmap(fs.readFileSync(ctx.file, 'utf8'));
  if (parsed.errors.length) {
    reportParse(parsed, ctx.file);
    failures.push('the roadmap does not pass check');
  }
  if (failures.length) {
    failures.forEach((f) => process.stdout.write(`FAIL ${f}\n`));
    die(`Push refused: ${failures.length} failure(s)`);
  }
  const tokens = await readTokens(args.flags);
  const head = git(ctx.repo, ['rev-parse', 'HEAD']).out;
  const site = await syncRequest(ctx.url, tokens, 'GET');
  const siteCommit = site.snapshot && site.snapshot.commit;
  if (siteCommit) {
    const ancestor = git(ctx.repo, ['merge-base', '--is-ancestor', siteCommit, head]);
    if (ancestor.status === 1) die(`Push refused: the site snapshot ${siteCommit.slice(0, 7)} is not an ancestor of HEAD ${head.slice(0, 7)}; pushing would roll the page back`);
    if (ancestor.status !== 0) die(`Push refused: the site snapshot ${siteCommit.slice(0, 7)} is not a commit in this repository`);
  }
  const result = await syncRequest(ctx.url, tokens, 'POST', {
    action: 'push',
    snapshot: {
      commit: head,
      author: git(ctx.repo, ['log', '-1', '--format=%an']).out,
      generatedAt: new Date().toISOString(),
      roadmapPath: ctx.roadmapPath,
      groups: L.snapshotGroups(parsed),
    },
  });
  process.stdout.write(`Push ${head.slice(0, 7)}: ok (${parsed.items.length} item(s); ${(result.cleared || []).length} page change(s) cleared, ${result.kept || 0} still pending)\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const commands = { check: commandCheck, build: commandBuild, verify: commandVerify, pull: commandPull, push: commandPush };
  if (!commands[args.command]) usage(1);
  await commands[args.command](args);
}

main().catch((error) => die(error.message));
