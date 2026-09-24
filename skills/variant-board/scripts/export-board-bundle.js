#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const lib = require('./lib/board');

function usage(exitCode = 0) {
  const out = exitCode === 0 ? process.stdout : process.stderr;
  out.write(`Usage:
  export-board-bundle.js export <board-id-or-board.html> --workspace <topic-or-path> --out <bundle-dir> [--brief <brief.md>] [--tokens <tokens.md>] [--sources <dir>] [--new|--revision]
  export-board-bundle.js import <candidate-dir> --into <topic-or-path> [--bundle <bundle-dir>] [--skip-theme-source]

export writes a self-contained authoring pack for a host without this filesystem. A new-board bundle carries the
portable instructions, brief, token map, starter and sources; a revision bundle also carries the current working
board, its frozen versions, its index entry and a base manifest with digests.

import checks the returned candidate against the manifest and the current canonical board, validates it, and only
then replaces the working file and updates boards.md. Frozen files are never written by import.
`);
  process.exit(exitCode);
}

const BOOLEAN_FLAGS = new Set(['new', 'revision', 'skip-theme-source']);

function parseArgs(argv) {
  if (!argv.length || argv[0] === '--help' || argv[0] === '-h') usage(0);
  const command = argv[0];
  const positionals = [];
  const flags = {};
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') usage(0);
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      flags[key] = BOOLEAN_FLAGS.has(key) || !next || next.startsWith('--') ? true : (i += 1, next);
    } else positionals.push(arg);
  }
  return { command, positionals, flags };
}

function die(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function resolveWorkspace(value, home = os.homedir()) {
  const raw = lib.expandHome(value, home);
  if (raw.includes('/') || raw.startsWith('.')) return path.resolve(raw);
  return path.join(home, 'agent-artifacts', raw);
}

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from, { withFileTypes: true }).forEach((entry) => {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst);
    else fs.copyFileSync(src, dst);
  });
}

function bundleReadme(manifest) {
  return `# Board bundle — ${manifest.boardId} (${manifest.kind})

This folder is a complete authoring pack for the \`${manifest.boardId}\` variant board. It was exported from
\`${manifest.topic}\` on ${manifest.exportedAt}.

Read \`instructions/SKILL.md\` and \`instructions/references/anatomy.md\` first, then \`brief.md\` (section ids and
scenarios are already assigned), \`tokens.md\` (the app token values to put in the \`--app-*\` block) and \`sources/\`
(requirement and source excerpts with file path and commit for the Before panes). The instructions mention
verification scripts; they are not in this bundle and run on the owner's side after import.

${manifest.kind === 'revision'
    ? `This is a **revision** bundle. Start from \`current/${manifest.boardId}.html\`, not from the starter: it is the
working board at v${manifest.baseVersion}, and \`current/boards.md\` plus the revision notes inside it carry the
accepted decisions. Keep every section id, keep the revision notes, add a proposal entry for the new version, and
never edit the frozen copies under \`current/versions/\`.`
    : `This is a **new-board** bundle. Copy \`starter.html\`, keep its chrome tokens and runtime untouched, replace the
example section with the sections from \`brief.md\`, and fill the \`--app-*\` block from \`tokens.md\`.`}

Return a folder containing:

- \`${manifest.boardId}.html\` — the candidate board, self-contained (inline CSS and JavaScript, no web fonts, no
  remote assets), with \`data-board-issued="false"\`.
- \`manifest.json\` — this bundle's manifest, byte for byte. The importer uses it to confirm the base has not moved.

The board owner imports the candidate with \`export-board-bundle.js import\`, which verifies it before it replaces
anything. A candidate cannot issue a version; issuance happens on the canonical file after verification.
`;
}

function commandExport(args) {
  const target = args.positionals[0];
  if (!target || !args.flags.out) usage(1);
  let boardPath;
  if (target.endsWith('.html')) boardPath = path.resolve(lib.expandHome(target));
  else {
    if (!args.flags.workspace) die('--workspace is required when the board is given by id');
    boardPath = path.join(resolveWorkspace(args.flags.workspace), 'html', `${target}.html`);
  }
  const paths = lib.boardPaths(boardPath);
  const exists = fs.existsSync(paths.board);
  const kind = args.flags.revision ? 'revision' : args.flags.new ? 'new' : exists ? 'revision' : 'new';
  if (kind === 'revision' && !exists) die(`revision bundle needs an existing board at ${paths.board}`);
  if (kind === 'new' && exists) die(`board already exists at ${paths.board}; export a revision bundle instead`);
  const briefPath = args.flags.brief ? path.resolve(lib.expandHome(args.flags.brief)) : paths.brief;
  const tokensPath = args.flags.tokens ? path.resolve(lib.expandHome(args.flags.tokens)) : paths.tokens;
  if (!fs.existsSync(briefPath)) die(`brief not found: ${briefPath}`);
  if (!fs.existsSync(tokensPath)) die(`token map not found: ${tokensPath}`);
  const out = path.resolve(lib.expandHome(args.flags.out));
  if (fs.existsSync(out) && fs.readdirSync(out).length) die(`bundle directory is not empty: ${out}`);
  fs.mkdirSync(path.join(out, 'instructions'), { recursive: true });
  const starterHtml = fs.readFileSync(lib.STARTER_PATH);
  const manifest = {
    kind,
    boardId: paths.stem,
    topic: path.basename(paths.workspace),
    destination: `html/${paths.stem}.html`,
    exportedAt: new Date().toISOString(),
    starterDigest: lib.sha256(starterHtml),
    briefDigest: lib.sha256(fs.readFileSync(briefPath)),
    tokensDigest: lib.sha256(fs.readFileSync(tokensPath)),
  };
  // The instructions keep their relative layout so SKILL.md's links to references/ and templates/ resolve in the bundle.
  fs.copyFileSync(path.join(lib.SKILL_ROOT, 'SKILL.md'), path.join(out, 'instructions', 'SKILL.md'));
  copyTree(path.join(lib.SKILL_ROOT, 'references'), path.join(out, 'instructions', 'references'));
  copyTree(path.join(lib.SKILL_ROOT, 'templates'), path.join(out, 'instructions', 'templates'));
  fs.writeFileSync(path.join(out, 'instructions', 'starter.html'), starterHtml);
  fs.copyFileSync(briefPath, path.join(out, 'brief.md'));
  fs.copyFileSync(tokensPath, path.join(out, 'tokens.md'));
  fs.writeFileSync(path.join(out, 'starter.html'), starterHtml);
  if (args.flags.sources) {
    const sources = path.resolve(lib.expandHome(args.flags.sources));
    if (!fs.existsSync(sources)) die(`sources directory not found: ${sources}`);
    copyTree(sources, path.join(out, 'sources'));
  } else fs.mkdirSync(path.join(out, 'sources'), { recursive: true });
  if (kind === 'revision') {
    const html = fs.readFileSync(paths.board);
    const board = lib.parseBoard(html.toString('utf8'));
    manifest.baseVersion = board.version;
    manifest.baseIssued = board.issued;
    manifest.baseDigest = lib.sha256(html);
    manifest.baseRevisions = board.revisions.map((e) => ({ version: e.version, type: e.type, date: e.date, author: e.author }));
    manifest.frozen = {};
    fs.mkdirSync(path.join(out, 'current', 'versions'), { recursive: true });
    fs.writeFileSync(path.join(out, 'current', `${paths.stem}.html`), html);
    if (fs.existsSync(paths.versionsDir)) {
      fs.readdirSync(paths.versionsDir).filter((f) => f.startsWith(`${paths.stem}.v`) && f.endsWith('.html')).sort().forEach((f) => {
        const bytes = fs.readFileSync(path.join(paths.versionsDir, f));
        manifest.frozen[`html/versions/${f}`] = lib.sha256(bytes);
        fs.writeFileSync(path.join(out, 'current', 'versions', f), bytes);
      });
    }
    const index = lib.readIndex(paths);
    if (index.boards[paths.stem]) {
      fs.writeFileSync(path.join(out, 'current', 'boards.md'), lib.renderIndex({ topic: index.topic, boards: { [paths.stem]: index.boards[paths.stem] } }));
    }
  }
  fs.writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(path.join(out, 'README.md'), bundleReadme(manifest));
  process.stdout.write(`Exported ${kind} bundle for ${paths.stem}: ${out}\n`);
}

function commandImport(args) {
  const candidateDir = args.positionals[0];
  if (!candidateDir || !args.flags.into) usage(1);
  const dir = path.resolve(lib.expandHome(candidateDir));
  const manifestPath = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) die(`candidate has no manifest.json: ${dir}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const workspace = resolveWorkspace(args.flags.into);
  const paths = lib.boardPaths(path.join(workspace, 'html', `${manifest.boardId}.html`));
  const candidatePath = [path.join(dir, `${manifest.boardId}.html`), path.join(dir, 'candidate.html')].find((p) => fs.existsSync(p));
  if (!candidatePath) die(`candidate board not found: expected ${manifest.boardId}.html or candidate.html in ${dir}`);
  const rejections = [];
  if (manifest.kind === 'revision') {
    if (!fs.existsSync(paths.board)) rejections.push(`stale base: canonical board ${paths.board} no longer exists`);
    else {
      const currentDigest = lib.sha256(fs.readFileSync(paths.board));
      if (currentDigest !== manifest.baseDigest) rejections.push(`stale base: canonical ${manifest.destination} is ${currentDigest}, bundle base was ${manifest.baseDigest}; re-export from the current board`);
    }
    Object.keys(manifest.frozen || {}).forEach((rel) => {
      const frozenPath = path.join(workspace, rel);
      if (!fs.existsSync(frozenPath)) rejections.push(`frozen file ${rel} is missing from the workspace`);
      else if (lib.sha256(fs.readFileSync(frozenPath)) !== manifest.frozen[rel]) rejections.push(`frozen file ${rel} differs from the bundle's digest; issued files must not change`);
    });
    if (fs.existsSync(paths.versionsDir)) {
      fs.readdirSync(paths.versionsDir).filter((f) => f.startsWith(`${paths.stem}.v`) && f.endsWith('.html')).forEach((f) => {
        if (!(manifest.frozen || {})[`html/versions/${f}`]) rejections.push(`stale base: ${f} was issued after the bundle was exported`);
      });
    }
  } else if (manifest.kind === 'new') {
    if (fs.existsSync(paths.board)) rejections.push(`destination ${manifest.destination} already exists in ${workspace}; a new-board import needs an unused board identity`);
    const index = lib.readIndex(paths);
    if (index.boards[paths.stem]) rejections.push(`boards.md already lists ${paths.stem}`);
  } else rejections.push(`unknown bundle kind "${manifest.kind}"`);
  const html = fs.readFileSync(candidatePath, 'utf8');
  const board = lib.parseBoard(html);
  if (board.id !== manifest.boardId) rejections.push(`candidate data-board-id "${board.id}" differs from the manifest board "${manifest.boardId}"`);
  if (board.issued) rejections.push('candidate claims data-board-issued="true"; a candidate cannot issue a version');
  if (manifest.kind === 'revision' && board.version !== null) {
    const floor = manifest.baseIssued ? manifest.baseVersion + 1 : manifest.baseVersion;
    if (board.version < floor) rejections.push(`candidate is v${board.version}; a revision of ${manifest.baseIssued ? 'issued' : 'working'} v${manifest.baseVersion} must be v${floor} or higher`);
  }
  if (manifest.kind === 'revision') {
    // History travels with the board: every base revision entry (issued, decisions, proposals) must survive.
    (manifest.baseRevisions || []).forEach((base) => {
      const kept = board.revisions.some((e) => e.version === base.version && e.type === base.type && e.date === base.date);
      if (!kept) rejections.push(`candidate dropped the base revision entry v${base.version} ${base.type} (${base.date}); a revision keeps the board's history`);
    });
  }
  const bundleDir = args.flags.bundle ? path.resolve(lib.expandHome(args.flags.bundle)) : dir;
  const firstExisting = (candidates) => candidates.find((p) => fs.existsSync(p)) || null;
  const briefFile = firstExisting([paths.brief, path.join(dir, 'brief.md'), path.join(bundleDir, 'brief.md')]);
  const tokensFile = firstExisting([paths.tokens, path.join(dir, 'tokens.md'), path.join(bundleDir, 'tokens.md')]);
  const brief = briefFile ? lib.parseBrief(fs.readFileSync(briefFile, 'utf8')) : null;
  const tokens = tokensFile ? lib.parseTokenMap(fs.readFileSync(tokensFile, 'utf8')) : null;
  const starterHtml = fs.readFileSync(lib.STARTER_PATH, 'utf8');
  const structure = lib.checkStructure({ html, board, brief, starterHtml });
  rejections.push(...structure.failures);
  if (!tokens) rejections.push('no token map available (workspace markdown/<board>-tokens.md, candidate tokens.md, or --bundle <dir>/tokens.md)');
  else rejections.push(...lib.checkTokens({ board, tokens, skipSource: Boolean(args.flags['skip-theme-source']) }).failures);
  if (rejections.length) {
    rejections.forEach((r) => process.stdout.write(`REJECT ${r}\n`));
    die(`candidate rejected; ${workspace} unchanged`);
  }
  fs.mkdirSync(path.dirname(paths.board), { recursive: true });
  fs.mkdirSync(path.dirname(paths.brief), { recursive: true });
  if (!fs.existsSync(paths.brief) && briefFile) fs.copyFileSync(briefFile, paths.brief);
  if (!fs.existsSync(paths.tokens) && tokensFile) fs.copyFileSync(tokensFile, paths.tokens);
  fs.writeFileSync(paths.board, html);
  const index = lib.readIndex(paths);
  const entry = lib.indexEntry(index, paths, board);
  entry.notes = `${entry.notes ? `${entry.notes} ` : ''}Imported v${board.version} candidate from a ${manifest.kind} bundle on ${new Date().toISOString().slice(0, 10)}.`.trim();
  lib.writeIndex(paths, index);
  structure.warnings.forEach((w) => process.stdout.write(`WARN ${w}\n`));
  process.stdout.write(`Imported ${manifest.boardId} v${board.version} (working) into ${paths.board}\nIndex: ${paths.index}\nNext: preview, run the manual checks, then issue.\n`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    if (args.command === 'export') commandExport(args);
    else if (args.command === 'import') commandImport(args);
    else usage(1);
  } catch (error) {
    if (error instanceof lib.BoardError) die(error.message);
    throw error;
  }
}

main();
