#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const STARTER = path.join(__dirname, '..', 'starter.html');
const TONES = ['done', 'partial', 'info', 'neutral', 'blocked'];
const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;
const PRINT_BLOCK = /\/\* walkthrough:print[^*]*\*\/([\s\S]*?)\/\* \/walkthrough:print \*\//;
const SECRET_PATTERNS = [
  { name: 'a JWT', re: /eyJ[\w-]{6,}\.eyJ[\w-]{6,}\.[\w-]+/ },
  { name: 'token=', re: /token=/i },
  { name: 'access_token', re: /access_token/i },
  { name: 'a Bearer token', re: /\bBearer\s+[\w.~+/-]{8,}/i },
];

function usage(exitCode = 0) {
  const out = exitCode === 0 ? process.stdout : process.stderr;
  out.write(`Usage:
  walkthrough-artifact.js check <page.html> [--manifest <manifest.md>]
  walkthrough-artifact.js pdf <page.html> [--out <file.pdf>] [--copy-to <dir>]
  walkthrough-artifact.js text <page.html>

check  compares the page with its manifest (default: manifest.md beside the page) and reports every failure.
pdf    prints the page with headless Chrome (CHROME_BIN or a standard install) and fails unless the PDF has one page per section.
text   prints the page's visible text and alt text, for: text <page> | node <unslop>/scripts/scan.mjs --stdin
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  if (!argv.length || argv[0] === '--help' || argv[0] === '-h') usage(0);
  const [command, ...rest] = argv;
  const positionals = [];
  const flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--help' || arg === '-h') usage(0);
    if (arg.startsWith('--')) {
      if (i + 1 >= rest.length) throw new Error(`${arg} needs a value`);
      flags[arg.slice(2)] = rest[(i += 1)];
    } else {
      positionals.push(arg);
    }
  }
  return { command, positionals, flags };
}

function expandHome(p) {
  return p === '~' || p.startsWith('~/') ? path.join(os.homedir(), p.slice(1)) : p;
}

function decode(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function stripTags(html) {
  return decode(html.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match ? decode(match[1] ?? match[2] ?? match[3]) : null;
}

/* ---------- page ---------- */

function stripComments(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, open, css, close) => open + css.replace(/\/\*[\s\S]*?\*\//g, '') + close);
}

function isRemote(value) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value);
}

function normalizeRef(value) {
  return value.trim().replace(/^\.\//, '');
}

function sections(html) {
  const out = [];
  const re = /<section\b([^>]*)>([\s\S]*?)<\/section>/gi;
  let match;
  while ((match = re.exec(html))) {
    const classes = (attr(match[0].slice(0, match[0].indexOf('>') + 1), 'class') || '').split(/\s+/);
    if (classes.includes('page')) out.push({ classes, body: match[2] });
  }
  return out;
}

function images(html) {
  return [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => {
    const src = attr(m[0], 'src');
    return { src: src === null ? null : normalizeRef(src), alt: attr(m[0], 'alt') };
  });
}

function figures(html) {
  return [...html.matchAll(/<figure\b[^>]*>([\s\S]*?)<\/figure>/gi)].map((m) => {
    const caption = m[1].match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i);
    const img = m[1].match(/<img\b[^>]*>/i);
    const src = img ? attr(img[0], 'src') : null;
    return { src: src === null ? null : normalizeRef(src), caption: caption ? stripTags(caption[1]) : '' };
  });
}

function pageStatusRows(html) {
  const table = html.match(/<table\b[^>]*class="[^"]*\bstatus\b[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
  if (!table) return null;
  const body = table[1].match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i);
  return [...(body ? body[1] : '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) => {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => c[1]);
    const badge = row[1].match(/<span\b[^>]*class="[^"]*\bbadge\b[^"]*\bt-([a-z]+)[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    return { item: stripTags(cells[0] || ''), tone: badge ? badge[1] : '', label: badge ? stripTags(badge[2]) : '' };
  });
}

function localRefs(html) {
  const found = [];
  for (const m of html.matchAll(/<[a-z][\w-]*\b[^>]*>/gi)) {
    for (const name of ['src', 'poster']) {
      const value = attr(m[0], name);
      if (value && value.trim()) found.push(value);
    }
    const srcset = attr(m[0], 'srcset');
    if (srcset) found.push(...srcset.split(',').map((candidate) => candidate.trim().split(/\s+/)[0]).filter(Boolean));
  }
  for (const m of html.matchAll(/url\(\s*["']?([^"')]+)/gi)) found.push(m[1]);
  return found.map(normalizeRef).filter((value) => value && !isRemote(value) && !value.startsWith('#'));
}

function remoteLoads(html) {
  const found = [];
  for (const m of html.matchAll(/<(?:img|image|script|iframe|source|video|audio|track|embed|object|link|input)\b[^>]*>/gi)) {
    for (const name of ['src', 'href', 'xlink:href', 'data', 'poster']) {
      const value = attr(m[0], name);
      if (value && isRemote(value.trim())) found.push(value.trim());
    }
    const srcset = attr(m[0], 'srcset');
    for (const candidate of srcset ? srcset.split(',').map((c) => c.trim().split(/\s+/)[0]).filter(Boolean) : []) {
      if (isRemote(candidate)) found.push(candidate);
    }
  }
  for (const m of html.matchAll(/url\(\s*["']?([^"')]+)/gi)) {
    if (isRemote(m[1].trim())) found.push(m[1].trim());
  }
  for (const m of html.matchAll(/@import\s+(?:url\()?["']?([^"');]+)/gi)) found.push(m[1].trim());
  return found;
}

function visibleText(html) {
  const body = stripComments(html).replace(/<style\b[\s\S]*?<\/style>/gi, '').replace(/<script\b[\s\S]*?<\/script>/gi, '');
  const alts = images(body).map((img) => img.alt).filter(Boolean);
  const blocks = body
    .replace(/<(?:\/(?:p|h[1-6]|li|div|span|figcaption|td|th|tr|section)|br\s*\/?)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .split('\n')
    .map((line) => decode(line).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return [...blocks, ...alts].join('\n\n');
}

/* ---------- manifest ---------- */

function manifestSections(text) {
  const out = {};
  let current = '';
  for (const line of text.split('\n')) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      current = heading[1].toLowerCase();
      out[current] = out[current] || [];
    } else if (current) {
      out[current].push(line);
    }
  }
  return out;
}

function pathToken(text) {
  const ticked = text.match(/`([^`]+)`/);
  return (ticked ? ticked[1] : text.trim().split(/\s+/)[0] || '').replace(/[.,;:)]+$/, '');
}

function readManifest(text, manifestDir) {
  const parts = manifestSections(text);
  const originsLine = text.match(/^\s*-\s*Allowed origins:\s*(.+)$/im);
  const origins = originsLine
    ? [...originsLine[1].matchAll(/https?:\/\/[^\s,`<>]+/g)].map((m) => originOf(m[0].replace(/[.;:!?]+$/, '')))
    : null;
  const runs = (parts['audit runs'] || [])
    .filter((line) => /^\s*-\s+/.test(line))
    .map((line) => path.resolve(manifestDir, expandHome(pathToken(line.replace(/^\s*-\s+/, '')))));
  const imageLines = [];
  for (const line of parts.images || []) {
    const m = line.match(/^\s*-\s+`?([^\s`:]+)`?:/);
    if (!m || !IMAGE_EXT.test(m[1])) continue;
    const from = line.match(/\bfrom:\s*(`[^`]+`|\S+)/);
    imageLines.push({ path: m[1], from: from ? pathToken(from[1]) : null });
  }
  let status = null;
  if (parts.status) {
    const rows = parts.status
      .filter((line) => /^\s*\|/.test(line))
      .map((line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.replace(/[*`]/g, '').trim()));
    const header = rows.shift() || [];
    const col = (name) => header.findIndex((h) => h.toLowerCase() === name);
    const [item, tone, label] = [col('item'), col('tone'), col('label')];
    status = rows
      .filter((cells) => !cells.every((c) => /^:?-+:?$/.test(c)))
      .map((cells) => ({ item: cells[item] || '', tone: (cells[tone] || '').toLowerCase(), label: cells[label] || '' }));
    if (item < 0 || tone < 0 || label < 0) status = { malformed: true };
  }
  const withoutPublished = text.replace(/\bPublished:\s*https?:\/\/[^\s`<>)\]]+/gi, 'Published:');
  return { origins, runs, imageLines, status, withoutPublished };
}

/* ---------- check ---------- */

function urlsIn(text) {
  return [...text.matchAll(/https?:\/\/[^\s"'<>`)\]]+/g)].map((m) => m[0].replace(/[.,;:!?]+$/, ''));
}

function originOf(url) {
  try { return new URL(url).origin; } catch { return url; }
}

function listImageFiles(dir) {
  const imgDir = path.join(dir, 'img');
  if (!fs.existsSync(imgDir)) return [];
  return fs.readdirSync(imgDir).filter((name) => IMAGE_EXT.test(name)).map((name) => `img/${name}`);
}

function checkFrom(line, runs, manifestDir, failures, notes) {
  if (!line.from) {
    failures.push(`${line.path}: manifest line has no from: <raw capture>`);
    return;
  }
  const raw = expandHome(line.from);
  if (path.isAbsolute(raw)) {
    const marker = raw.lastIndexOf(`${path.sep}screenshots${path.sep}`);
    const runDir = marker >= 0 ? raw.slice(0, marker) : path.dirname(raw);
    if (!fs.existsSync(runDir)) notes.push(`${line.path}: audit run ${runDir} not present; raw capture not checked`);
    else if (!fs.existsSync(raw)) failures.push(`${line.path}: raw capture ${line.from} is missing`);
    return;
  }
  const present = runs.filter((run) => fs.existsSync(run));
  if (!present.length) {
    notes.push(`${line.path}: no listed audit run is present; raw capture not checked`);
    return;
  }
  if (!present.some((run) => fs.existsSync(path.join(run, raw)))) {
    failures.push(`${line.path}: raw capture ${line.from} is missing from the listed audit runs`);
  }
}

function check(pagePath, manifestPath) {
  const failures = [];
  const notes = [];
  const pageDir = path.dirname(pagePath);
  const html = fs.readFileSync(pagePath, 'utf8');
  const rendered = stripComments(html);
  const manifestText = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, 'utf8') : null;
  if (manifestText === null) failures.push(`manifest not found: ${manifestPath}`);
  const manifest = readManifest(manifestText || '', path.dirname(manifestPath));

  if (!/^\s*<!doctype html>/i.test(html)) failures.push('page does not start with <!DOCTYPE html>');
  const pages = sections(rendered);
  if (!pages.length) failures.push('page has no <section class="page"> elements');
  else if (!pages[0].classes.includes('cover')) failures.push('first page section is not the cover');

  const starterBlock = fs.readFileSync(STARTER, 'utf8').match(PRINT_BLOCK);
  const pageBlock = html.match(PRINT_BLOCK);
  const squash = (s) => s.replace(/\s+/g, ' ').trim();
  if (!pageBlock) failures.push('print block (/* walkthrough:print */ ... /* /walkthrough:print */) is missing');
  else if (squash(pageBlock[1]) !== squash(starterBlock[1])) failures.push('print block differs from the starter');

  for (const img of images(rendered)) {
    if (!img.src) failures.push('an <img> has no src');
    if (!img.alt || !img.alt.trim()) failures.push(`${img.src || '<img>'}: alt text is empty`);
  }
  for (const figure of figures(rendered)) {
    if (!figure.caption) failures.push(`${figure.src || '<figure>'}: figure has no caption`);
  }

  const used = new Set();
  for (const ref of new Set(localRefs(rendered))) {
    if (!/^img\/[^/]+$/.test(ref)) failures.push(`${ref}: reference is not under img/`);
    else if (!fs.existsSync(path.join(pageDir, ref))) failures.push(`${ref}: file is missing`);
    if (/^img\/[^/]+$/.test(ref)) used.add(ref);
  }
  for (const file of listImageFiles(pageDir)) {
    if (!used.has(file)) failures.push(`${file}: file in img/ is not used by the page`);
  }
  const listed = new Map(manifest.imageLines.map((line) => [line.path, line]));
  for (const src of used) {
    if (!listed.has(src)) failures.push(`${src}: no manifest line`);
  }
  for (const line of manifest.imageLines) {
    if (!used.has(line.path)) failures.push(`${line.path}: manifest line names an image the page does not use`);
    if (!fs.existsSync(path.join(pageDir, line.path))) failures.push(`${line.path}: manifest line names a missing file`);
    checkFrom(line, manifest.runs, path.dirname(manifestPath), failures, notes);
  }

  for (const url of remoteLoads(rendered)) failures.push(`page loads a remote resource: ${url}`);
  if (!manifest.origins) {
    failures.push('manifest has no "- Allowed origins:" line');
  } else {
    const allowed = new Set(manifest.origins);
    const pageText = html.replace(/\sxmlns(?::[\w-]+)?\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');
    for (const [label, text] of [['page', pageText], ['manifest', manifest.withoutPublished]]) {
      for (const url of new Set(urlsIn(text))) {
        if (!allowed.has(originOf(url))) failures.push(`${label} names ${url}, whose origin is not in Allowed origins`);
      }
    }
  }
  for (const [label, text] of [['page', html], ['manifest', manifestText || '']]) {
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.re.test(text)) failures.push(`${label} contains ${pattern.name}`);
    }
  }

  const pageRows = pageStatusRows(rendered);
  const manifestRows = manifest.status;
  if (manifestRows && manifestRows.malformed) {
    failures.push('manifest ## Status table needs Item, Tone and Label columns');
  } else if (pageRows && !manifestRows) {
    failures.push('page has a status table but the manifest has no ## Status section');
  } else if (manifestRows && !pageRows) {
    failures.push('manifest has a ## Status section but the page has no status table');
  } else if (pageRows && manifestRows) {
    for (const row of manifestRows) {
      if (!TONES.includes(row.tone)) failures.push(`status item ${row.item}: tone "${row.tone}" is not one of ${TONES.join(', ')}`);
    }
    const key = (r) => `${r.item}|${r.tone}|${r.label}`;
    const pageKeys = pageRows.map(key);
    const manifestKeys = manifestRows.map(key);
    if (pageKeys.join('\n') !== manifestKeys.join('\n')) {
      const pageSet = new Set(pageKeys);
      const manifestSet = new Set(manifestKeys);
      for (const k of manifestKeys) if (!pageSet.has(k)) failures.push(`status row ${k.replace(/\|/g, ' · ')} is in the manifest but not on the page`);
      for (const k of pageKeys) if (!manifestSet.has(k)) failures.push(`status row ${k.replace(/\|/g, ' · ')} is on the page but not in the manifest`);
      if (pageSet.size === manifestSet.size && [...pageSet].every((k) => manifestSet.has(k))) failures.push('status rows are in a different order on the page and in the manifest');
    }
  }

  const bytes = [...used].reduce((sum, src) => {
    const file = path.join(pageDir, src);
    return sum + (fs.existsSync(file) ? fs.statSync(file).size : 0);
  }, 0);
  return { failures, notes, counts: { pages: pages.length, images: used.size, imageBytes: bytes } };
}

/* ---------- pdf ---------- */

function countPdfPages(buffer) {
  return (buffer.toString('latin1').match(/\/Type\s*\/Page(?![A-Za-z])/g) || []).length;
}

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes('/')) {
      if (fs.existsSync(candidate)) return candidate;
      continue;
    }
    const found = childProcess.spawnSync('which', [candidate], { encoding: 'utf8' });
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  return null;
}

function printPdf(pagePath, outPath) {
  const binary = findChrome();
  if (!binary) throw new Error('no Chrome or Chromium binary found; set CHROME_BIN');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'walkthrough-chrome-'));
  fs.rmSync(outPath, { force: true });
  try {
    const result = childProcess.spawnSync(binary, [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      `--user-data-dir=${profile}`, '--no-pdf-header-footer', '--print-to-pdf-no-header', `--print-to-pdf=${outPath}`,
      pathToFileURL(path.resolve(pagePath)).href,
    ], { encoding: 'utf8', timeout: 120000 });
    if (result.status !== 0 || !fs.existsSync(outPath)) {
      throw new Error(`Chrome did not write ${outPath}: ${(result.stderr || '').trim().split('\n').slice(-3).join(' ')}`);
    }
  } finally {
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

/* ---------- cli ---------- */

function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    usage(2);
  }
  const page = args.positionals[0];
  if (!page) usage(2);
  if (!fs.existsSync(page)) {
    process.stderr.write(`page not found: ${page}\n`);
    return 2;
  }

  if (args.command === 'text') {
    process.stdout.write(`${visibleText(fs.readFileSync(page, 'utf8'))}\n`);
    return 0;
  }

  if (args.command === 'check') {
    const manifest = args.flags.manifest || path.join(path.dirname(page), 'manifest.md');
    const result = check(page, manifest);
    for (const note of result.notes) process.stdout.write(`note: ${note}\n`);
    for (const failure of result.failures) process.stdout.write(`FAIL ${failure}\n`);
    const mb = (result.counts.imageBytes / 1048576).toFixed(1);
    process.stdout.write(`${result.counts.pages} pages, ${result.counts.images} images, ${mb} MB of images\n`);
    process.stdout.write(result.failures.length ? `check failed: ${result.failures.length} problem(s)\n` : 'check passed\n');
    return result.failures.length ? 1 : 0;
  }

  if (args.command === 'pdf') {
    if (!/\.html?$/i.test(page)) {
      process.stderr.write(`pdf needs an .html page: ${page}\n`);
      return 2;
    }
    const copyTo = args.flags['copy-to'] ? path.resolve(expandHome(args.flags['copy-to'])) : null;
    if (copyTo && !(fs.existsSync(copyTo) && fs.statSync(copyTo).isDirectory())) {
      process.stderr.write(`--copy-to folder not found: ${copyTo}\n`);
      return 2;
    }
    const out = path.resolve(args.flags.out || page.replace(/\.html?$/i, '.pdf'));
    const expected = sections(stripComments(fs.readFileSync(page, 'utf8'))).length;
    try {
      printPdf(page, out);
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      return 1;
    }
    const actual = countPdfPages(fs.readFileSync(out));
    if (actual !== expected) {
      process.stdout.write(`FAIL ${out} has ${actual} pages but the page has ${expected} sections; a section overflowed or a page break is missing\n`);
      return 1;
    }
    process.stdout.write(`${out}: ${actual} pages, one per section\n`);
    if (copyTo) {
      fs.copyFileSync(out, path.join(copyTo, path.basename(out)));
      process.stdout.write(`copied to ${path.join(copyTo, path.basename(out))}\n`);
    }
    return 0;
  }

  process.stderr.write(`unknown command: ${args.command}\n`);
  usage(2);
  return 2;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { check, countPdfPages, pageStatusRows, readManifest, visibleText, sections };
