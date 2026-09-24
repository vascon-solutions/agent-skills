'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const SKILL_ROOT = path.resolve(__dirname, '..', '..');
const STARTER_PATH = path.join(SKILL_ROOT, 'starter.html');
const PURPOSES = ['proposed-change', 'unsettled-choice', 'state-coverage', 'defect-report'];
const TOKEN_STATUSES = ['resolved', 'substituted', 'waived', 'unresolved'];
const REVISION_TYPES = ['issued', 'proposal', 'decision', 'amendment'];

class BoardError extends Error {}

function expandHome(value, home = os.homedir()) {
  if (!value) return value;
  if (value === '~') return home;
  if (value.startsWith('~/')) return path.join(home, value.slice(2));
  return value;
}

function sha256(buffer) {
  return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`;
}

function stripTags(html) {
  return String(html || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
}

function attr(tag, name) {
  const match = new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i').exec(tag) || new RegExp(`\\s${name}\\s*=\\s*'([^']*)'`, 'i').exec(tag);
  return match ? match[1] : null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripCodeLike(html) {
  return html.replace(/<pre\b[\s\S]*?<\/pre>/gi, '<pre></pre>').replace(/<code\b[\s\S]*?<\/code>/gi, '<code></code>');
}

/* ---------- runtime ---------- */

function extractRuntimeScript(html) {
  const match = /<script id="board-runtime">([\s\S]*?)<\/script>/.exec(html);
  return match ? match[1] : null;
}

let starterRuntimeCache = null;

function loadRuntime(html) {
  const source = extractRuntimeScript(html || fs.readFileSync(STARTER_PATH, 'utf8'));
  if (!source) throw new BoardError('no <script id="board-runtime"> found');
  const sandbox = { window: {} };
  sandbox.window.window = sandbox.window;
  vm.runInNewContext(source, sandbox, { filename: 'board-runtime.js' });
  return sandbox.window.VariantBoard;
}

function starterRuntime() {
  if (!starterRuntimeCache) starterRuntimeCache = loadRuntime(fs.readFileSync(STARTER_PATH, 'utf8'));
  return starterRuntimeCache;
}

/* ---------- board html ---------- */

/* Token declarations from the board's own <style>: `:root` blocks, or any block whose selector list names the
   given attribute selector outside a :not(). */
function parseCssVars(html, selector) {
  const vars = {};
  [...html.matchAll(/([^{}]*)\{([^{}]*)\}/g)].forEach((block) => {
    const selectors = block[1].replace(/\/\*[\s\S]*?\*\//g, '').trim();
    const matches = selector === ':root'
      ? /(?:^|[\s,}]):root\s*$/.test(selectors)
      : selectors.replace(/:not\([^)]*\)/gi, '').includes(selector);
    if (!matches) return;
    [...block[2].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)].forEach((m) => {
      vars[m[1]] = m[2].replace(/\s+/g, ' ').trim();
    });
  });
  return vars;
}

function stripScripts(html) {
  return html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
}

function pickVars(vars, prefix) {
  const out = {};
  Object.keys(vars).filter((k) => k.startsWith(prefix)).sort().forEach((k) => { out[k] = vars[k]; });
  return out;
}

function parseBoard(html) {
  const htmlTag = (/<html\b[^>]*>/i.exec(html) || [''])[0];
  const versionRaw = attr(htmlTag, 'data-board-version');
  const board = {
    id: attr(htmlTag, 'data-board-id'),
    version: versionRaw !== null && /^\d+$/.test(versionRaw) ? Number(versionRaw) : null,
    issued: attr(htmlTag, 'data-board-issued') === 'true',
    issuedAttr: attr(htmlTag, 'data-board-issued'),
    title: stripTags((/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html) || ['', ''])[1]),
    hasMasthead: /<header class="masthead">/.test(html),
    facts: {},
    sections: [],
    revisions: [],
    colophon: null,
    definition: null,
    definitionError: null,
    runtime: extractRuntimeScript(html),
    boardVars: pickVars(parseCssVars(html, ':root'), '--board-'),
    appVars: pickVars(parseCssVars(html, ':root'), '--app-'),
    appDarkVars: pickVars(parseCssVars(html, '[data-app-scheme="dark"]'), '--app-'),
    hasSchemeDimension: false,
    colorScheme: /color-scheme\s*:\s*light/i.test(html),
    partsBySection: {},
  };
  [...html.matchAll(/<dd data-fact="([a-z-]+)"[^>]*>([\s\S]*?)<\/dd>/gi)].forEach((m) => { board.facts[m[1]] = stripTags(m[2]); });
  const stampTag = /<span class="stamp"[^>]*>/i.exec(html);
  board.stampIssued = stampTag ? attr(stampTag[0], 'data-issued') : null;
  // Only top-level board sections count; mock markup inside renderers or static panes may use <section> too.
  const markup = stripScripts(html);
  const starts = [...markup.matchAll(/<section\b[^>]*\bclass="[^"]*\bboard-section\b[^"]*"[^>]*>/gi)];
  starts.forEach((start, index) => {
    const tag = start[0];
    const id = attr(tag, 'id');
    const endAt = index + 1 < starts.length ? starts[index + 1].index : (markup.indexOf('<footer class="colophon"', start.index) >= 0 ? markup.indexOf('<footer class="colophon"', start.index) : markup.length);
    const body = markup.slice(start.index + tag.length, endAt).replace(/<\/section>\s*$/i, '');
    const h2 = /<h2\b[^>]*>([\s\S]*?)<\/h2>/i.exec(body);
    const purposes = (attr(tag, 'data-purpose') || '').split(/\s+/).filter(Boolean);
    const parts = [...body.matchAll(/data-board-part="([a-z-]+)"/g)].map((p) => p[1]);
    const section = {
      id,
      heading: h2 ? stripTags(h2[1]) : null,
      hasH2: Boolean(h2),
      purposes,
      parts,
      interactive: new RegExp(`data-controls="${escapeRegExp(id || '')}"`).test(body),
      reconstructedLabel: /reconstructed from source/i.test(body),
      hasRecommended: /class="tag rec"/.test(body),
      optionGroups: [...body.matchAll(/<div class="options"[^>]*>([\s\S]*?)<\/div>\s*(?=<(?:p|div|table|h3|ul|section|footer)|$)/g)].length,
    };
    board.sections.push(section);
    if (id) board.partsBySection[id] = parts;
  });
  const revisionsBlock = /<ol class="revision-list"[^>]*>([\s\S]*?)<\/ol>/i.exec(html);
  if (revisionsBlock) {
    [...revisionsBlock[1].matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi)].forEach((li) => {
      const tag = `<li${li[1]}>`;
      board.revisions.push({
        version: Number(attr(tag, 'data-version')),
        type: attr(tag, 'data-type'),
        date: attr(tag, 'data-date'),
        author: attr(tag, 'data-author'),
        waives: (attr(tag, 'data-waives') || '').split(/[,\s]+/).filter(Boolean),
        links: [...li[2].matchAll(/href="([^"]+)"/g)].map((h) => h[1]),
        text: stripTags(li[2]),
      });
    });
  }
  const colophon = /<footer class="colophon"[^>]*>([\s\S]*?)<\/footer>/i.exec(html);
  if (colophon) {
    board.colophon = {
      text: stripTags(colophon[1]),
      tokens: stripTags((/<span data-colophon="tokens">([\s\S]*?)<\/span>/i.exec(colophon[1]) || ['', ''])[1]),
    };
  }
  const definition = /<script type="application\/json" id="board-scenarios">([\s\S]*?)<\/script>/.exec(html);
  if (definition) {
    try {
      board.definition = JSON.parse(definition[1]);
      const sections = (board.definition && board.definition.sections) || {};
      board.hasSchemeDimension = Object.keys(sections).some((id) => Array.isArray(sections[id].dimensions) && sections[id].dimensions.some((d) => d && d.id === 'scheme' && Array.isArray(d.options) && ['light', 'dark'].every((o) => d.options.some((opt) => opt && opt.id === o))));
    } catch (error) {
      board.definitionError = `scenario definition is not valid JSON: ${error.message}`;
    }
  }
  return board;
}

function networkReferences(html) {
  const checkable = stripCodeLike(html);
  const patterns = [
    { name: '<script src=remote>', re: /<script[^>]*\ssrc\s*=\s*["'](?!data:)[^"']*/i },
    { name: '<link href=remote>', re: /<link[^>]*\shref\s*=\s*["'](?!data:)[^"']*/i },
    { name: '<iframe>', re: /<iframe\b/i },
    { name: '<img src=remote>', re: /<img[^>]*\ssrc\s*=\s*["'](?!data:)[^"']*/i },
    { name: 'CSS url(remote)', re: /url\(\s*["']?(?!data:|#)[^)]*/i },
    { name: '@import', re: /@import\s+/i },
  ];
  return patterns.filter(({ re }) => re.test(checkable)).map(({ name, re }) => `${name}: ${checkable.match(re)[0].slice(0, 80)}`);
}

/* ---------- markdown helpers ---------- */

function parseKeyValues(markdown) {
  const values = {};
  markdown.split('\n').forEach((line) => {
    const m = /^-\s+([A-Za-z][A-Za-z0-9 /()-]*?):\s+(.*)$/.exec(line.trim());
    if (!m) return;
    const raw = m[2].trim();
    const quoted = /^`([^`]*)`/.exec(raw);
    values[m[1].trim().toLowerCase()] = quoted ? quoted[1].trim() : raw;
  });
  return values;
}

function parseTables(markdown) {
  const tables = [];
  const lines = markdown.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].trim().startsWith('|')) continue;
    if (!lines[i + 1] || !/^\|\s*:?-+/.test(lines[i + 1].trim())) continue;
    const header = splitRow(lines[i]);
    const rows = [];
    let j = i + 2;
    while (j < lines.length && lines[j].trim().startsWith('|')) {
      rows.push(splitRow(lines[j]));
      j += 1;
    }
    tables.push({ header, rows, line: i });
    i = j - 1;
  }
  return tables;
}

function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function tableWithHeader(tables, firstHeader) {
  return tables.find((t) => t.header[0] && t.header[0].toLowerCase() === firstHeader.toLowerCase()) || null;
}

function unbacktick(value) {
  return String(value || '').replace(/^`+|`+$/g, '').trim();
}

function parseBrief(markdown) {
  const values = parseKeyValues(markdown);
  const tables = parseTables(markdown);
  const sectionsTable = tableWithHeader(tables, 'Section id') || tableWithHeader(tables, 'id');
  const scenariosTable = tableWithHeader(tables, 'Section') || tableWithHeader(tables, 'Scenario');
  return {
    boardId: values['board id'] || null,
    product: values.product || null,
    repo: values['repo path'] || values.repo || null,
    surface: values.surface || null,
    sourceOfTruth: values['source of truth'] || null,
    readAgainst: values['read against'] || null,
    purposes: (values['purpose'] || values['purposes'] || '').replace(/\s*\(.*\)\s*$/, '').split(/[,\s]+/).map((p) => unbacktick(p)).filter(Boolean),
    themeSource: values['theme source'] || null,
    sections: sectionsTable ? sectionsTable.rows.map((row) => ({ id: unbacktick(row[0]).replace(/^#/, ''), heading: unbacktick(row[1] || ''), purposes: (row[2] || '').split(/[,\s]+/).map(unbacktick).filter(Boolean) })) : [],
    scenarios: scenariosTable ? scenariosTable.rows.map((row) => ({ section: unbacktick(row[0]).replace(/^#/, ''), hash: unbacktick(row[1] || ''), expected: row[2] || '' })) : [],
    values,
  };
}

function parseTokenMap(markdown) {
  const values = parseKeyValues(markdown);
  const tables = parseTables(markdown);
  const table = tableWithHeader(tables, 'Board token');
  const rows = table ? table.rows.map((row) => ({
    boardToken: unbacktick(row[0]),
    sourceToken: unbacktick(row[1]),
    file: unbacktick(row[2]),
    mode: unbacktick(row[3]).toLowerCase() || 'light',
    revision: unbacktick(row[4]),
    value: unbacktick(row[5]).replace(/\s+/g, ' '),
    status: unbacktick(row[6]).toLowerCase(),
    note: row[7] || '',
  })) : [];
  return {
    repo: values.repo || values['repo path'] || null,
    themeFile: values['theme file'] || values['theme source'] || null,
    revision: values.revision || null,
    rows,
    values,
  };
}

/* ---------- theme source resolution ---------- */

function gitShow(repo, revision, file) {
  const result = childProcess.spawnSync('git', ['-C', repo, 'show', `${revision}:${file}`], { encoding: 'utf8' });
  if (result.status !== 0) throw new BoardError(`cannot read ${file} at ${revision} in ${repo}: ${(result.stderr || '').trim()}`);
  return result.stdout;
}

const DARK_SELECTOR = /\.dark\b|\[data-(?:theme|mode|scheme|color-scheme|app-scheme)=["']?dark|prefers-color-scheme\s*:\s*dark/i;

/* `:root:not(.dark)` scopes the light theme; the negated part must not count as dark. */
function isDarkSelector(selector) {
  return DARK_SELECTOR.test(selector.replace(/:not\([^)]*\)/gi, ''));
}

/*
 * Custom-property declarations grouped by mode. Each declaration belongs to the innermost block it sits in; a
 * block is dark when its own selector or any enclosing at-rule names a dark scheme (`@layer base { :root {…}
 * .dark {…} }` keeps the two apart). Within a mode the last declaration wins, which matches how an app-level
 * override after the theme block applies in the browser.
 */
function cssDeclarations(rawCss) {
  const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const modes = { light: {}, dark: {} };
  const stack = [];
  let cursor = 0;
  const record = (text) => {
    if (!stack.length) return;
    const m = /^\s*(--[a-z0-9-]+)\s*:\s*([\s\S]+?)\s*$/i.exec(text);
    if (!m) return;
    const target = stack[stack.length - 1].dark ? modes.dark : modes.light;
    target[m[1]] = m[2].replace(/\s+/g, ' ').trim();
  };
  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === '{') {
      const selector = css.slice(cursor, i).trim();
      const inherited = stack.some((s) => s.dark);
      stack.push({ selector, dark: inherited || isDarkSelector(selector) });
      cursor = i + 1;
    } else if (ch === '}') {
      record(css.slice(cursor, i));
      stack.pop();
      cursor = i + 1;
    } else if (ch === ';') {
      record(css.slice(cursor, i));
      cursor = i + 1;
    }
  }
  return modes;
}

function resolveVar(vars, name, seen = new Set()) {
  if (!(name in vars)) return null;
  if (seen.has(name)) return null;
  seen.add(name);
  const value = vars[name];
  const alias = /^var\((--[a-z0-9-]+)\)$/i.exec(value);
  if (alias) return resolveVar(vars, alias[1], seen);
  return value;
}

function propertyValue(css, selector, property) {
  const blockRe = new RegExp(`(?:^|[\\s}])${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`, 'g');
  let m;
  while ((m = blockRe.exec(css))) {
    const decl = new RegExp(`(?:^|[;\\s])${escapeRegExp(property)}\\s*:\\s*([^;]+);`, 'i').exec(m[1]);
    if (decl) return decl[1].replace(/\s+/g, ' ').trim();
  }
  return null;
}

function sourceValue(css, sourceToken, mode = 'light') {
  if (sourceToken.startsWith('--')) {
    const modes = cssDeclarations(css);
    // Dark rows resolve in the dark block first, then fall back to light declarations the dark block inherits.
    const vars = mode === 'dark' ? { ...modes.light, ...modes.dark } : modes.light;
    return resolveVar(vars, sourceToken);
  }
  const m = /^(.+?)\s*\{\s*([a-z-]+)\s*\}$/.exec(sourceToken);
  if (m) return propertyValue(css, m[1].trim(), m[2].trim());
  return null;
}

function normalizeCssValue(value) {
  return String(value || '').replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').trim().toLowerCase();
}

/* ---------- checks ---------- */

function relativeAppVarsMatch(boardVars, rows, mode) {
  const failures = [];
  const expected = {};
  const known = new Set();
  rows.filter((r) => (r.mode || 'light') === mode).forEach((r) => {
    known.add(r.boardToken);
    if (r.status !== 'unresolved') expected[r.boardToken] = r.value;
  });
  Object.keys(expected).forEach((name) => {
    if (!(name in boardVars)) failures.push(`${mode} token map row ${name} has no matching --app-* declaration in the board`);
    else if (normalizeCssValue(boardVars[name]) !== normalizeCssValue(expected[name])) failures.push(`${name} is ${boardVars[name]} in the board but ${expected[name]} in the token map`);
  });
  Object.keys(boardVars).forEach((name) => {
    if (!known.has(name)) failures.push(`${name} is declared in the board (${mode}) but has no token map row`);
  });
  return failures;
}

function checkStructure({ html, board, brief, starterHtml }) {
  const failures = [];
  const warnings = [];
  const starter = parseBoard(starterHtml);
  if (!board.id || !/^[a-z0-9][a-z0-9_-]*$/i.test(board.id)) failures.push('<html data-board-id> missing or not a plain id');
  if (board.version === null || board.version < 1) failures.push('<html data-board-version> missing or not a positive integer');
  if (board.issuedAttr !== 'true' && board.issuedAttr !== 'false') failures.push('<html data-board-issued> must be "true" or "false"');
  if (!board.hasMasthead) failures.push('masthead missing (<header class="masthead">)');
  if (!board.title) failures.push('masthead has no <h1>');
  ['source-of-truth', 'read-against', 'theme-source', 'version', 'status', 'tokens'].forEach((fact) => {
    if (!board.facts[fact]) failures.push(`masthead fact "${fact}" missing or empty`);
  });
  if (/0000000|example\.md/.test(`${board.facts['read-against']} ${board.facts['source-of-truth']} ${board.facts['theme-source']}`)) failures.push('masthead facts still carry starter placeholders');
  const stamp = /^v(\d+) · (\d{4}-\d{2}-\d{2}) · (issued|working)$/.exec(board.facts.version || '');
  if (!stamp) failures.push('version stamp must read "v<N> · <YYYY-MM-DD> · issued|working"');
  else {
    if (Number(stamp[1]) !== board.version) failures.push(`version stamp says v${stamp[1]} but data-board-version is ${board.version}`);
    if ((stamp[3] === 'issued') !== board.issued) failures.push(`version stamp says ${stamp[3]} but data-board-issued is ${board.issuedAttr}`);
    if (board.stampIssued !== null && (board.stampIssued === 'true') !== board.issued) failures.push('stamp data-issued disagrees with data-board-issued');
  }
  if (!board.colorScheme) failures.push('color-scheme: light must be declared');
  if (!board.runtime) failures.push('runtime script (<script id="board-runtime">) missing');
  else if (board.runtime.trim() !== (starter.runtime || '').trim()) failures.push('runtime script differs from the starter; boards do not edit the runtime (an older starter runtime is refreshed by "bump")');
  Object.keys(starter.boardVars).forEach((name) => {
    if (!(name in board.boardVars)) failures.push(`chrome token ${name} missing; boards keep the starter chrome`);
    else if (normalizeCssValue(board.boardVars[name]) !== normalizeCssValue(starter.boardVars[name])) failures.push(`chrome token ${name} differs from the starter (${board.boardVars[name]} vs ${starter.boardVars[name]})`);
  });
  Object.keys(board.boardVars).forEach((name) => { if (!(name in starter.boardVars)) failures.push(`chrome token ${name} is not part of the starter chrome`); });
  const core = ['revisions'];
  board.sections.forEach((section) => {
    if (!section.id) failures.push(`section "${section.heading || '?'}" has no id`);
    if (!section.hasH2) failures.push(`section #${section.id} has no <h2>`);
  });
  if (!board.sections.some((s) => s.id === 'revisions')) failures.push('revision notes section (#revisions) missing');
  if (!board.revisions.length) failures.push('revision notes list is empty');
  board.revisions.forEach((entry, index) => {
    if (!Number.isInteger(entry.version) || entry.version < 1) failures.push(`revision entry ${index + 1} has no data-version`);
    if (!REVISION_TYPES.includes(entry.type)) failures.push(`revision entry ${index + 1} has type "${entry.type}"; expected ${REVISION_TYPES.join('|')}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date || '')) failures.push(`revision entry ${index + 1} has no data-date`);
    if (!entry.author) failures.push(`revision entry ${index + 1} has no data-author`);
    if (entry.type === 'issued' && !entry.links.some((href) => /versions\/[^/]+\.v\d+\.html$/.test(href))) failures.push(`issued entry v${entry.version} does not link its frozen file`);
    if (entry.type === 'issued' && entry.version > board.version) failures.push(`revision notes record v${entry.version} issued but the board is v${board.version}`);
  });
  if (!board.revisions.some((e) => e.version === board.version)) failures.push(`revision notes have no entry for v${board.version}`);
  if (board.issued && !board.revisions.some((e) => e.version === board.version && e.type === 'issued')) failures.push(`board is marked issued but revision notes have no "issued" entry for v${board.version}`);
  if (!board.colophon) failures.push('colophon missing (<footer class="colophon">)');
  else {
    if (!/discussion aid, not an implementation/i.test(board.colophon.text)) failures.push('colophon must state "Prototype markup is a discussion aid, not an implementation."');
    if (!/example fixtures/i.test(board.colophon.text)) failures.push('colophon must carry the example-fixtures disclaimer');
    if (!board.colophon.tokens) failures.push('colophon must echo the token map status (<span data-colophon="tokens">)');
  }
  networkReferences(html).forEach((ref) => failures.push(`disallowed network reference: ${ref}`));
  if (/fonts\.googleapis|fonts\.gstatic|@font-face[^}]*url\(\s*["']?https?:/i.test(html)) failures.push('web-font reference found; boards use the app stack or a system stack');
  if (board.definitionError) failures.push(board.definitionError);
  if (board.definition) {
    try {
      starterRuntime().validateDefinition(board.definition);
    } catch (error) {
      failures.push(`scenario definition rejected: ${error.boardReason || error.message}`);
    }
    Object.keys(board.definition.sections || {}).forEach((id) => {
      if (!board.sections.some((s) => s.id === id)) failures.push(`scenario definition names section "${id}" which the board does not contain`);
      if (!new RegExp(`data-controls="${escapeRegExp(id)}"`).test(html)) failures.push(`section #${id} is declared interactive but has no data-controls host`);
    });
  }
  if (brief) {
    if (brief.boardId && board.id && brief.boardId !== board.id) failures.push(`brief board id "${brief.boardId}" differs from data-board-id "${board.id}"`);
    brief.sections.forEach((s) => {
      if (!board.sections.some((b) => b.id === s.id)) failures.push(`brief section #${s.id} ("${s.heading}") is missing from the board`);
    });
    board.sections.filter((s) => !core.includes(s.id)).forEach((s) => {
      if (brief.sections.length && !brief.sections.some((b) => b.id === s.id)) warnings.push(`section #${s.id} is not listed in the brief`);
    });
    const purposes = brief.purposes.length ? brief.purposes : [];
    purposes.forEach((p) => { if (!PURPOSES.includes(p)) failures.push(`brief purpose "${p}" is not one of ${PURPOSES.join(', ')}`); });
    const purposeSections = board.sections.filter((s) => s.purposes.length);
    purposes.forEach((purpose) => {
      const carriers = purposeSections.filter((s) => s.purposes.includes(purpose));
      if (!carriers.length) failures.push(`brief purpose "${purpose}" has no section carrying data-purpose="${purpose}"`);
      carriers.forEach((s) => {
        const parts = s.parts;
        if (purpose === 'proposed-change' && !parts.includes('panes') && !parts.includes('before-pane')) failures.push(`section #${s.id} (proposed-change) needs Before/After panes (data-board-part="panes" or "before-pane")`);
        if (purpose === 'proposed-change' && parts.includes('before-pane') && !s.reconstructedLabel) failures.push(`section #${s.id} static Before pane lacks the "reconstructed from source" label`);
        if (purpose === 'unsettled-choice') {
          if (!parts.includes('options')) failures.push(`section #${s.id} (unsettled-choice) needs option cards (data-board-part="options")`);
          if (!parts.includes('comparison')) failures.push(`section #${s.id} (unsettled-choice) needs a side-by-side comparison table (data-board-part="comparison")`);
          if (!parts.includes('cannot-settle')) failures.push(`section #${s.id} (unsettled-choice) needs a "What this board cannot settle" list (data-board-part="cannot-settle")`);
          if (!s.hasRecommended) failures.push(`section #${s.id} (unsettled-choice) has no Recommended tag`);
        }
        if (purpose === 'state-coverage' && !parts.includes('state-matrix')) failures.push(`section #${s.id} (state-coverage) needs a state matrix (data-board-part="state-matrix")`);
        if (purpose === 'defect-report' && !parts.includes('defects')) failures.push(`section #${s.id} (defect-report) needs a defects list with finding codes (data-board-part="defects")`);
      });
    });
    board.sections.forEach((s) => s.purposes.forEach((p) => { if (!PURPOSES.includes(p)) failures.push(`section #${s.id} declares unknown purpose "${p}"`); }));
    brief.scenarios.forEach((row) => {
      if (!row.hash) return;
      if (!board.definition) { failures.push(`brief scenario ${row.hash} cannot be checked: board has no scenario definition`); return; }
      const result = starterRuntime().resolveScenario(board.definition, row.hash);
      if (!result.ok) failures.push(`brief scenario ${row.hash} does not resolve: ${result.reason}`);
    });
  }
  return { failures, warnings };
}

function checkTokens({ board, tokens, skipSource = false, home }) {
  const failures = [];
  const warnings = [];
  let unresolved = 0;
  const substituted = [];
  const waived = [];
  if (!tokens.rows.length) failures.push('token map has no rows');
  tokens.rows.forEach((row) => {
    if (!TOKEN_STATUSES.includes(row.status)) failures.push(`token row ${row.boardToken} has status "${row.status}"; expected ${TOKEN_STATUSES.join('|')}`);
    if (!row.boardToken.startsWith('--app-')) failures.push(`token row "${row.boardToken}" is not an --app-* token`);
    if (row.status === 'unresolved') unresolved += 1;
    if (row.status === 'substituted') substituted.push(row.boardToken);
    if (row.status === 'waived') waived.push(row.boardToken);
    if (row.status !== 'unresolved' && !row.value) failures.push(`token row ${row.boardToken} has no value`);
  });
  failures.push(...relativeAppVarsMatch(board.appVars, tokens.rows, 'light'));
  const hasDarkRows = tokens.rows.some((r) => r.mode === 'dark');
  if (hasDarkRows) {
    failures.push(...relativeAppVarsMatch(board.appDarkVars, tokens.rows, 'dark'));
    if (!board.hasSchemeDimension) failures.push('dark token rows need a mock-only Scheme control: declare a "scheme" dimension with options "light" and "dark" in a section and pass its selection to api.panes/api.frame');
  } else if (Object.keys(board.appDarkVars).length) failures.push('the board declares a [data-app-scheme="dark"] block but the token map has no dark rows');
  const factTokens = board.facts.tokens || '';
  substituted.forEach((name) => { if (!factTokens.includes(name)) failures.push(`substituted token ${name} is not named in the masthead "Design tokens" fact`); });
  waived.forEach((name) => {
    if (!factTokens.includes(name)) failures.push(`waived token ${name} is not named in the masthead "Design tokens" fact`);
    const decision = board.revisions.find((e) => e.type === 'decision' && e.waives.includes(name));
    if (!decision) failures.push(`waived token ${name} has no revision-notes decision entry naming it (data-type="decision" data-waives="${name}")`);
    else if (!decision.author || /^agent$/i.test(decision.author)) failures.push(`waiver for ${name} must be recorded by the board owner, not "${decision.author || ''}"`);
  });
  if (board.colophon && (substituted.length || waived.length)) {
    [...substituted, ...waived].forEach((name) => { if (!board.colophon.text.includes(name)) failures.push(`colophon does not mention ${name} (${substituted.includes(name) ? 'substituted' : 'waived'})`); });
  }
  const sourceRows = tokens.rows.filter((r) => r.status === 'resolved');
  if (sourceRows.length) {
    const repo = tokens.repo ? expandHome(tokens.repo, home) : null;
    if (skipSource) warnings.push('theme source check skipped (--skip-theme-source)');
    else if (!repo || !fs.existsSync(repo)) warnings.push(`theme repo ${tokens.repo || '(none)'} is not available here; resolved rows were not checked against the source`);
    else {
      const cache = {};
      sourceRows.forEach((row) => {
        const file = row.file || tokens.themeFile;
        const revision = row.revision || tokens.revision;
        if (!file || !revision) { failures.push(`resolved row ${row.boardToken} has no file or revision`); return; }
        const key = `${revision}:${file}`;
        try {
          if (!(key in cache)) cache[key] = gitShow(repo, revision, file);
        } catch (error) { failures.push(error.message); return; }
        const found = sourceValue(cache[key], row.sourceToken, row.mode || 'light');
        if (found === null) failures.push(`resolved row ${row.boardToken}: source token ${row.sourceToken} not found in ${file} at ${revision} (${row.mode || 'light'})`);
        else if (normalizeCssValue(found) !== normalizeCssValue(row.value)) failures.push(`resolved row ${row.boardToken}: ${row.sourceToken} is "${found}" at ${revision} (${row.mode || 'light'}), not "${row.value}"`);
      });
    }
  }
  return { failures, warnings, unresolved, substituted, waived, draft: unresolved > 0 };
}

/* ---------- workspace and index ---------- */

function workspaceOf(boardPath) {
  const htmlDir = path.dirname(path.resolve(boardPath));
  if (path.basename(htmlDir) !== 'html') throw new BoardError(`board must live in <workspace>/html/: ${boardPath}`);
  return path.dirname(htmlDir);
}

function boardPaths(boardPath) {
  const resolved = path.resolve(boardPath);
  const workspace = workspaceOf(resolved);
  const stem = path.basename(resolved, '.html');
  return {
    board: resolved,
    stem,
    workspace,
    versionsDir: path.join(workspace, 'html', 'versions'),
    frozen: (n) => path.join(workspace, 'html', 'versions', `${stem}.v${n}.html`),
    brief: path.join(workspace, 'markdown', `${stem}-brief.md`),
    tokens: path.join(workspace, 'markdown', `${stem}-tokens.md`),
    index: path.join(workspace, 'boards.md'),
  };
}

function emptyIndex(topic) {
  return { topic, boards: {} };
}

function parseIndex(markdown, topic) {
  const index = emptyIndex(topic);
  const titleMatch = /^#\s+Boards\s+—\s+(.+)$/m.exec(markdown);
  if (titleMatch) index.topic = titleMatch[1].trim();
  const chunks = markdown.split(/^##\s+/m).slice(1);
  chunks.forEach((chunk) => {
    const lines = chunk.split('\n');
    const id = lines[0].trim();
    const values = parseKeyValues(chunk);
    const tables = parseTables(chunk);
    const versionsTable = tableWithHeader(tables, 'Version');
    const legacyTable = tableWithHeader(tables, 'Citation');
    const currentMatch = /^v(\d+)\s+(working|issued)/.exec(values.current || '');
    index.boards[id] = {
      id,
      file: unbacktick(values.file || ''),
      brief: unbacktick(values.brief || ''),
      tokens: unbacktick(values.tokens || ''),
      current: currentMatch ? { version: Number(currentMatch[1]), issued: currentMatch[2] === 'issued' } : null,
      reserved: values.reserved ? Number(/(\d+)/.exec(values.reserved)[1]) : 0,
      notes: values.notes || '',
      versions: versionsTable ? versionsTable.rows.map((row) => ({
        version: Number(unbacktick(row[0]).replace(/^v/, '')),
        date: row[1],
        file: unbacktick(row[2]),
        digest: unbacktick(row[3]),
        published: row[4] === '—' ? [] : row[4].split(/;\s*/).filter(Boolean).map((entry) => { const m = /^(.+?)\s+\((.+)\)$/.exec(entry.trim()); return m ? { url: m[1], host: m[2] } : { url: entry.trim(), host: '' }; }),
      })) : [],
      legacy: legacyTable ? legacyTable.rows.map((row) => ({ citation: row[0], location: row[1], status: row[2] })) : [],
    };
  });
  return index;
}

function renderIndex(index) {
  const lines = [`# Boards — ${index.topic}`, '', 'Per-topic board index. Working files hold the latest version; frozen issued copies under `html/versions/` are the citable evidence. Legacy citations were made before issuance existed and have no frozen file.', ''];
  Object.keys(index.boards).sort().forEach((id) => {
    const b = index.boards[id];
    lines.push(`## ${id}`, '');
    lines.push(`- File: \`${b.file}\``);
    if (b.brief) lines.push(`- Brief: \`${b.brief}\``);
    if (b.tokens) lines.push(`- Tokens: \`${b.tokens}\``);
    lines.push(`- Current: ${b.current ? `v${b.current.version} ${b.current.issued ? 'issued' : 'working'}` : 'none'}`);
    if (b.reserved) lines.push(`- Reserved: ${b.reserved} (numbers up to this were cited or stamped before issuance; no frozen file exists for them)`);
    if (b.notes) lines.push(`- Notes: ${b.notes}`);
    lines.push('', '| Version | Date | Frozen file | Digest | Published |', '|---|---|---|---|---|');
    b.versions.forEach((v) => {
      const published = v.published.length ? v.published.map((p) => `${p.url} (${p.host})`).join('; ') : '—';
      lines.push(`| v${v.version} | ${v.date} | \`${v.file}\` | \`${v.digest}\` | ${published} |`);
    });
    lines.push('');
    if (b.legacy.length) {
      lines.push('Legacy citations (historical version unavailable):', '', '| Citation | Location | Status |', '|---|---|---|');
      b.legacy.forEach((l) => lines.push(`| ${l.citation} | ${l.location} | ${l.status} |`));
      lines.push('');
    }
  });
  return `${lines.join('\n').trimEnd()}\n`;
}

function readIndex(paths) {
  const topic = path.basename(paths.workspace);
  if (!fs.existsSync(paths.index)) return emptyIndex(topic);
  return parseIndex(fs.readFileSync(paths.index, 'utf8'), topic);
}

function writeIndex(paths, index) {
  fs.writeFileSync(paths.index, renderIndex(index));
}

function indexEntry(index, paths, board) {
  if (!index.boards[paths.stem]) {
    index.boards[paths.stem] = {
      id: paths.stem,
      file: `html/${paths.stem}.html`,
      brief: fs.existsSync(paths.brief) ? `markdown/${paths.stem}-brief.md` : '',
      tokens: fs.existsSync(paths.tokens) ? `markdown/${paths.stem}-tokens.md` : '',
      current: null,
      reserved: 0,
      notes: '',
      versions: [],
      legacy: [],
    };
  }
  const entry = index.boards[paths.stem];
  if (board) entry.current = { version: board.version, issued: board.issued };
  return entry;
}

/* ---------- citations ---------- */

function parseCitation(text) {
  const raw = String(text || '').trim();
  const pathMatch = /`?((?:~|\/|\.\.?\/)[^`\s()]+\.html)`?/.exec(raw);
  const versionMatch = /\(v(\d+)\)/.exec(raw);
  const anchorMatch = /\((#[^)\s]+)\)/.exec(raw);
  const headingMatch = /[“"]([^”"]+)[”"]/.exec(raw);
  if (!pathMatch) throw new BoardError(`citation has no board path: ${raw}`);
  if (!versionMatch) throw new BoardError(`citation has no (vN) version: ${raw}`);
  return {
    path: pathMatch[1],
    version: Number(versionMatch[1]),
    anchor: anchorMatch ? anchorMatch[1] : null,
    heading: headingMatch ? headingMatch[1].trim() : null,
    raw,
  };
}

function resolveCitation(text, { home } = {}) {
  const citation = parseCitation(text);
  const boardPath = path.resolve(expandHome(citation.path, home));
  const paths = boardPaths(boardPath);
  const frozenPath = paths.frozen(citation.version);
  const report = { citation, frozenPath, ok: false, failures: [], legacy: false };
  const index = readIndex(paths);
  const entry = index.boards[paths.stem];
  const legacyMatch = entry && entry.legacy.find((l) => l.citation.includes(`(v${citation.version})`) && l.citation.includes(path.basename(boardPath)));
  if (!fs.existsSync(frozenPath)) {
    if (legacyMatch) {
      report.legacy = true;
      report.failures.push(`legacy citation: ${legacyMatch.status}; no frozen file exists and none will be reconstructed`);
    } else report.failures.push(`frozen file ${frozenPath} does not exist; v${citation.version} was never issued`);
    return report;
  }
  const html = fs.readFileSync(frozenPath, 'utf8');
  const board = parseBoard(html);
  if (board.version !== citation.version) report.failures.push(`frozen file carries data-board-version="${board.version}", not ${citation.version}`);
  if (!board.issued) report.failures.push('frozen file is not marked issued');
  // The frozen file is the evidence, so its own runtime interprets the citation, not whatever the starter is today.
  let runtime;
  try { runtime = loadRuntime(html); } catch (error) { runtime = starterRuntime(); report.failures.push(`frozen file has no usable runtime (${error.message}); resolved with the starter runtime instead`); }
  let sectionId = null;
  if (citation.anchor) {
    const parsed = runtime.parseHash(citation.anchor);
    sectionId = parsed.section;
  } else if (citation.heading) {
    const section = board.sections.find((s) => s.heading && s.heading.toLowerCase().includes(citation.heading.toLowerCase()));
    if (!section) report.failures.push(`no section heading contains "${citation.heading}"`);
    else sectionId = section.id;
  }
  if (sectionId && !board.sections.some((s) => s.id === sectionId)) report.failures.push(`section #${sectionId} not found in the frozen file`);
  report.section = sectionId;
  if (citation.anchor) {
    const parsed = runtime.parseHash(citation.anchor);
    if (parsed.kind === 'scenario' || parsed.kind === 'malformed') {
      if (!board.definition) report.failures.push('citation carries a scenario but the frozen board has no scenario definition');
      else {
        const result = runtime.resolveScenario(board.definition, citation.anchor);
        if (!result.ok) report.failures.push(`scenario does not resolve: ${result.reason}`);
        else report.selection = result.selection;
      }
    } else if (board.definition && board.definition.sections && board.definition.sections[sectionId]) {
      report.failures.push(`section #${sectionId} is interactive; the citation must carry a complete scenario (#${sectionId}?dimension=id&...)`);
    }
  } else if (sectionId && board.definition && board.definition.sections && board.definition.sections[sectionId]) {
    report.failures.push(`section #${sectionId} is interactive; the citation must carry a complete scenario (#${sectionId}?dimension=id&...)`);
  }
  const workingPath = paths.board;
  if (fs.existsSync(workingPath)) report.workingIdentical = fs.readFileSync(workingPath).equals(Buffer.from(html));
  report.ok = report.failures.length === 0;
  return report;
}

/* ---------- issuance edits ---------- */

function stampIssued(html, board, date) {
  if (board.issued) return html;
  let out = html;
  out = out.replace(/(<html\b[^>]*\sdata-board-issued=")(true|false)(")/i, '$1true$3');
  out = out.replace(/(<span class="stamp" data-issued=")(true|false)("[^>]*>)v\d+ · \d{4}-\d{2}-\d{2} · (?:issued|working)(<\/span>)/, `$1true$3v${board.version} · ${date} · issued$4`);
  const frozenHref = `versions/${board.id}.v${board.version}.html`;
  if (!board.revisions.some((e) => e.version === board.version && e.type === 'issued')) {
    const entry = `      <li data-version="${board.version}" data-type="issued" data-date="${date}" data-author="agent"><b>v${board.version}</b> · ${date} · <span class="who">agent</span> · issued — frozen as <a href="${frozenHref}">${frozenHref}</a> after verification.</li>\n`;
    out = appendRevisionEntry(out, entry);
  }
  return out;
}

/* Insert before the revision list's own closing tag; other <ol> elements on the page are not touched. */
function appendRevisionEntry(html, entry) {
  const match = /(<ol class="revision-list"[^>]*>[\s\S]*?)\n?([ \t]*)<\/ol>/.exec(html);
  if (!match) throw new BoardError('board has no <ol class="revision-list"> to record the revision in');
  const before = html.slice(0, match.index);
  const after = html.slice(match.index + match[0].length);
  return `${before}${match[1]}\n${entry}${match[2]}</ol>${after}`;
}

/* A new working number is the moment to pick up a newer starter runtime; frozen files keep theirs. */
function refreshRuntime(html) {
  const starter = extractRuntimeScript(fs.readFileSync(STARTER_PATH, 'utf8'));
  const current = extractRuntimeScript(html);
  if (!starter || current === null || current.trim() === starter.trim()) return { html, refreshed: false };
  return { html: html.replace(/<script id="board-runtime">[\s\S]*?<\/script>/, () => `<script id="board-runtime">${starter}</script>`), refreshed: true };
}

function bumpWorking(html, board, nextVersion, date, note) {
  let out = html;
  out = out.replace(/(<html\b[^>]*\sdata-board-version=")\d+(")/i, `$1${nextVersion}$2`);
  out = out.replace(/(<html\b[^>]*\sdata-board-issued=")(true|false)(")/i, '$1false$3');
  out = out.replace(/(<span class="stamp" data-issued=")(true|false)("[^>]*>)v\d+ · \d{4}-\d{2}-\d{2} · (?:issued|working)(<\/span>)/, `$1false$3v${nextVersion} · ${date} · working$4`);
  const entry = `      <li data-version="${nextVersion}" data-type="proposal" data-date="${date}" data-author="agent"><b>v${nextVersion}</b> · ${date} · <span class="who">agent</span> · proposal — ${note || 'working revision after v' + board.version}.</li>\n`;
  return appendRevisionEntry(out, entry);
}

module.exports = {
  BoardError,
  PURPOSES,
  REVISION_TYPES,
  SKILL_ROOT,
  STARTER_PATH,
  TOKEN_STATUSES,
  boardPaths,
  bumpWorking,
  checkStructure,
  checkTokens,
  cssDeclarations,
  expandHome,
  extractRuntimeScript,
  indexEntry,
  loadRuntime,
  networkReferences,
  parseBoard,
  parseBrief,
  parseCitation,
  parseIndex,
  parseTokenMap,
  readIndex,
  refreshRuntime,
  renderIndex,
  resolveCitation,
  resolveVar,
  sha256,
  sourceValue,
  stampIssued,
  starterRuntime,
  workspaceOf,
  writeIndex,
};
