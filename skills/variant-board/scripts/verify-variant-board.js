#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const lib = require('./lib/board');

function usage(exitCode = 0) {
  const out = exitCode === 0 ? process.stdout : process.stderr;
  out.write(`Usage:
  verify-variant-board.js check <board.html> [--brief <brief.md>] [--tokens <tokens.md>] [--skip-theme-source]
  verify-variant-board.js scenario <board.html> '<#section?dimension=id&...>'
  verify-variant-board.js cite '<citation text>'
  verify-variant-board.js issue <board.html> [--date YYYY-MM-DD] [--brief ...] [--tokens ...] [--skip-theme-source]
  verify-variant-board.js bump <board.html> [--to <N>] [--date YYYY-MM-DD] [--note '<what changed>']
  verify-variant-board.js publish <board.html> --version <N> --url <url> --host <host>
  verify-variant-board.js migrate <board.html> [--reserve <N>] [--citation '<text>' --location '<file:line>']...

Structure and token-map checks, scenario resolution, citation resolution, issuance, and the boards.md index.
Defaults: brief = <workspace>/markdown/<board>-brief.md, tokens = <workspace>/markdown/<board>-tokens.md.
`);
  process.exit(exitCode);
}

const BOOLEAN_FLAGS = new Set(['skip-theme-source']);

function parseArgs(argv) {
  if (!argv.length || argv[0] === '--help' || argv[0] === '-h') usage(0);
  const command = argv[0];
  const positionals = [];
  const flags = {};
  const lists = {};
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') usage(0);
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      const value = BOOLEAN_FLAGS.has(key) || !next || next.startsWith('--') ? true : (i += 1, next);
      if (key === 'citation' || key === 'location') {
        (lists[key] = lists[key] || []).push(value);
      } else flags[key] = value;
    } else positionals.push(arg);
  }
  return { command, positionals, flags, lists };
}

function die(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function loadInputs(boardArg, flags) {
  const paths = lib.boardPaths(lib.expandHome(boardArg));
  if (!fs.existsSync(paths.board)) die(`board not found: ${paths.board}`);
  const html = fs.readFileSync(paths.board, 'utf8');
  const board = lib.parseBoard(html);
  const briefPath = flags.brief ? path.resolve(lib.expandHome(flags.brief)) : paths.brief;
  const tokensPath = flags.tokens ? path.resolve(lib.expandHome(flags.tokens)) : paths.tokens;
  const brief = fs.existsSync(briefPath) ? lib.parseBrief(fs.readFileSync(briefPath, 'utf8')) : null;
  const tokens = fs.existsSync(tokensPath) ? lib.parseTokenMap(fs.readFileSync(tokensPath, 'utf8')) : null;
  return { paths, html, board, brief, tokens, briefPath, tokensPath };
}

function runChecks(inputs, flags) {
  const starterHtml = fs.readFileSync(lib.STARTER_PATH, 'utf8');
  const structure = lib.checkStructure({ html: inputs.html, board: inputs.board, brief: inputs.brief, starterHtml });
  const report = { failures: [...structure.failures], warnings: [...structure.warnings], draft: false };
  if (!inputs.brief) report.warnings.push(`no brief at ${inputs.briefPath}; section ids and purposes were not checked against a brief`);
  if (!inputs.tokens) report.failures.push(`no token map at ${inputs.tokensPath}; the --app-* block cannot be verified`);
  else {
    const tokens = lib.checkTokens({ board: inputs.board, tokens: inputs.tokens, skipSource: Boolean(flags['skip-theme-source']) });
    report.failures.push(...tokens.failures);
    report.warnings.push(...tokens.warnings);
    report.draft = tokens.draft;
    report.tokenSummary = `${inputs.tokens.rows.length} rows: ${inputs.tokens.rows.length - tokens.unresolved - tokens.substituted.length - tokens.waived.length} resolved, ${tokens.substituted.length} substituted, ${tokens.waived.length} waived, ${tokens.unresolved} unresolved`;
  }
  report.failures.push(...issuanceConsistency(inputs, Boolean(flags.issuing)));
  return report;
}

function highestIssuedVersion(paths, entry) {
  const versions = entry ? entry.versions.map((v) => v.version) : [];
  if (fs.existsSync(paths.versionsDir)) {
    fs.readdirSync(paths.versionsDir).forEach((file) => {
      if (!file.startsWith(`${paths.stem}.v`)) return;
      const match = /^(\d+)\.html$/.exec(file.slice(`${paths.stem}.v`.length));
      if (match) versions.push(Number(match[1]));
    });
  }
  return Math.max(0, ...versions);
}

/* Changed bytes after issuance need a new number; identical bytes are fine. */
function issuanceConsistency({ paths, html, board }, issuing) {
  const failures = [];
  if (board.id !== paths.stem) failures.push(`data-board-id "${board.id}" must match the board filename "${paths.stem}.html"`);
  if (board.version === null) return failures;
  const frozen = paths.frozen(board.version);
  if (fs.existsSync(frozen)) {
    const same = fs.readFileSync(frozen).equals(Buffer.from(html));
    if (!same) failures.push(`v${board.version} is already issued (${path.relative(paths.workspace, frozen)}) with different bytes; run "bump" and issue the change under a new number`);
  } else if (board.issued && !issuing) {
    failures.push(`board claims v${board.version} issued but ${path.relative(paths.workspace, frozen)} does not exist; run "issue"`);
  }
  const index = lib.readIndex(paths);
  const entry = index.boards[paths.stem];
  if (entry && entry.reserved && board.version <= entry.reserved) failures.push(`v${board.version} is at or below the reserved legacy number ${entry.reserved}; the first issued number must be ${entry.reserved + 1} or higher`);
  if (!fs.existsSync(frozen)) {
    const highest = highestIssuedVersion(paths, entry);
    if (board.version <= highest) failures.push(`new issuance v${board.version} must be above the highest issued version v${highest}; run "bump"`);
  }
  return failures;
}

function printReport(report, label) {
  report.failures.forEach((f) => process.stdout.write(`FAIL ${f}\n`));
  report.warnings.forEach((w) => process.stdout.write(`WARN ${w}\n`));
  if (report.tokenSummary) process.stdout.write(`Tokens: ${report.tokenSummary}\n`);
  process.stdout.write(`${label}: ${report.failures.length ? `${report.failures.length} failure(s)` : 'ok'}${report.draft ? ' (draft: unresolved tokens block issuance)' : ''}\n`);
}

function commandCheck(args) {
  if (!args.positionals[0]) usage(1);
  const inputs = loadInputs(args.positionals[0], args.flags);
  const report = runChecks(inputs, args.flags);
  printReport(report, `Check ${path.basename(inputs.paths.board)} v${inputs.board.version}`);
  process.exit(report.failures.length ? 1 : 0);
}

function commandScenario(args) {
  if (args.positionals.length < 2) usage(1);
  const inputs = loadInputs(args.positionals[0], args.flags);
  if (!inputs.board.definition) die('board has no scenario definition');
  const runtime = lib.loadRuntime(inputs.html);
  const result = runtime.resolveScenario(inputs.board.definition, args.positionals[1]);
  if (!result.ok) {
    process.stdout.write(`Scenario not found: ${result.reason}\n`);
    process.exit(1);
  }
  process.stdout.write(`Scenario ok: #${result.section} ${JSON.stringify(result.selection)}\n`);
}

function commandCite(args) {
  if (!args.positionals[0]) usage(1);
  let report;
  try {
    report = lib.resolveCitation(args.positionals.join(' '));
  } catch (error) {
    die(error.message);
  }
  process.stdout.write(`Citation: ${report.citation.path} (v${report.citation.version})${report.section ? ` #${report.section}` : ''}\n`);
  process.stdout.write(`Frozen file: ${report.frozenPath}\n`);
  if (report.selection) process.stdout.write(`Scenario: ${JSON.stringify(report.selection)}\n`);
  if (report.workingIdentical !== undefined) process.stdout.write(`Working file identical: ${report.workingIdentical}\n`);
  report.failures.forEach((f) => process.stdout.write(`FAIL ${f}\n`));
  process.stdout.write(report.ok ? 'Citation resolves\n' : `Citation does not resolve${report.legacy ? ' (legacy)' : ''}\n`);
  process.exit(report.ok ? 0 : 1);
}

function repairIssuedIndex(paths, board, bytes) {
  const index = lib.readIndex(paths);
  const before = lib.renderIndex(index);
  const entry = lib.indexEntry(index, paths, null);
  let record = entry.versions.find((v) => v.version === board.version);
  const file = path.relative(paths.workspace, paths.frozen(board.version));
  const digest = lib.sha256(bytes);
  if (record && record.digest && record.digest !== digest) die(`v${board.version} differs from its indexed digest; identical HTML copies do not permit replacing recorded evidence`);
  if (record && record.file && record.file !== file) die(`v${board.version} has a conflicting indexed frozen path; index left unchanged`);
  const stamp = /^v\d+ · (\d{4}-\d{2}-\d{2}) · issued$/.exec(board.facts.version || '');
  if (!stamp || !board.issued) die('cannot repair the index without the frozen file\'s issued date and status');
  if (!record) {
    record = { version: board.version, date: stamp[1], file, digest, published: [] };
    entry.versions.push(record);
    entry.versions.sort((a, b) => a.version - b.version);
  } else {
    record.date = record.date || stamp[1];
    record.file = record.file || file;
    record.digest = record.digest || digest;
  }
  if (!entry.current || entry.current.version <= board.version) entry.current = { version: board.version, issued: true };
  if (lib.renderIndex(index) === before) return false;
  lib.writeIndex(paths, index);
  return true;
}

function commandIssue(args) {
  if (!args.positionals[0]) usage(1);
  const inputs = loadInputs(args.positionals[0], args.flags);
  const { paths, board } = inputs;
  if (board.id !== paths.stem) die(`data-board-id "${board.id}" must match the board filename "${paths.stem}.html"`);
  const date = args.flags.date || today();
  const frozenPath = paths.frozen(board.version);
  const issuedHtml = lib.stampIssued(inputs.html, board, date);
  const issuedBoard = lib.parseBoard(issuedHtml);
  const report = runChecks({ ...inputs, html: issuedHtml, board: issuedBoard }, { ...args.flags, issuing: true });
  if (fs.existsSync(frozenPath)) {
    const frozenBytes = fs.readFileSync(frozenPath);
    if (frozenBytes.equals(Buffer.from(issuedHtml))) {
      const repaired = repairIssuedIndex(paths, issuedBoard, frozenBytes);
      process.stdout.write(`v${board.version} already issued with identical content; ${repaired ? 'repaired missing index metadata' : 'nothing to do'}\n`);
      process.exit(0);
    }
    die(`v${board.version} is already issued at ${path.relative(paths.workspace, frozenPath)} with different content. Frozen files are never overwritten; run "bump" and issue under a new number.`);
  }
  if (report.draft) report.failures.push('unresolved token rows make this board a draft; resolve, substitute, or record a waiver before issuing');
  if (report.failures.length) {
    printReport(report, `Issue v${board.version}`);
    die('not issued');
  }
  fs.mkdirSync(paths.versionsDir, { recursive: true });
  fs.writeFileSync(frozenPath, issuedHtml);
  fs.writeFileSync(paths.board, issuedHtml);
  const index = lib.readIndex(paths);
  const entry = lib.indexEntry(index, paths, issuedBoard);
  entry.versions = entry.versions.filter((v) => v.version !== board.version);
  entry.versions.push({ version: board.version, date, file: path.relative(paths.workspace, frozenPath), digest: lib.sha256(Buffer.from(issuedHtml)), published: [] });
  entry.versions.sort((a, b) => a.version - b.version);
  lib.writeIndex(paths, index);
  report.warnings.forEach((w) => process.stdout.write(`WARN ${w}\n`));
  process.stdout.write(`Issued v${board.version}: ${frozenPath}\nIndex: ${paths.index}\n`);
}

function commandBump(args) {
  if (!args.positionals[0]) usage(1);
  const inputs = loadInputs(args.positionals[0], args.flags);
  const { paths, board } = inputs;
  const index = lib.readIndex(paths);
  const entry = index.boards[paths.stem];
  const floor = Math.max(board.version, entry ? entry.reserved : 0, highestIssuedVersion(paths, entry));
  const next = args.flags.to ? Number(args.flags.to) : floor + 1;
  if (!Number.isInteger(next) || next <= floor) die(`next version must be greater than ${floor}`);
  if (fs.existsSync(paths.frozen(next))) die(`v${next} already has a frozen file`);
  const refreshed = lib.refreshRuntime(inputs.html);
  const note = args.flags.note ? `${args.flags.note}${refreshed.refreshed ? '; runtime refreshed from the starter' : ''}` : refreshed.refreshed ? 'runtime refreshed from the starter' : undefined;
  const html = lib.bumpWorking(refreshed.html, board, next, args.flags.date || today(), note);
  fs.writeFileSync(paths.board, html);
  if (entry) { entry.current = { version: next, issued: false }; lib.writeIndex(paths, index); }
  process.stdout.write(`Bumped ${path.basename(paths.board)} to v${next} (working)${refreshed.refreshed ? '; runtime refreshed from the starter' : ''}\n`);
}

function commandPublish(args) {
  if (!args.positionals[0] || !args.flags.version || !args.flags.url || !args.flags.host) usage(1);
  const paths = lib.boardPaths(lib.expandHome(args.positionals[0]));
  const version = Number(args.flags.version);
  const index = lib.readIndex(paths);
  const entry = index.boards[paths.stem];
  const record = entry && entry.versions.find((v) => v.version === version);
  if (!record) die(`v${version} of ${paths.stem} is not issued; publish issued versions only`);
  const frozen = path.join(paths.workspace, record.file);
  if (!fs.existsSync(frozen) || lib.sha256(fs.readFileSync(frozen)) !== record.digest) die(`frozen file ${record.file} is missing or its digest changed; the index cannot record a publication for altered evidence`);
  if (!record.published.some((p) => p.url === args.flags.url)) record.published.push({ url: args.flags.url, host: args.flags.host });
  lib.writeIndex(paths, index);
  process.stdout.write(`Recorded ${args.flags.url} (${args.flags.host}) for ${paths.stem} v${version} in ${paths.index}; frozen bytes unchanged\n`);
}

function commandMigrate(args) {
  if (!args.positionals[0]) usage(1);
  const paths = lib.boardPaths(lib.expandHome(args.positionals[0]));
  const index = lib.readIndex(paths);
  const entry = lib.indexEntry(index, paths, null);
  const citations = args.lists.citation || [];
  const locations = args.lists.location || [];
  if (citations.length !== locations.length) die('each --citation needs a matching --location');
  let highest = entry.reserved;
  citations.forEach((citation, i) => {
    const m = /\(v(\d+)\)/.exec(citation);
    if (!m) die(`legacy citation has no (vN): ${citation}`);
    highest = Math.max(highest, Number(m[1]));
    if (!entry.legacy.some((l) => l.citation === citation && l.location === locations[i])) {
      entry.legacy.push({ citation, location: locations[i], status: 'legacy — historical version unavailable' });
    }
  });
  if (fs.existsSync(paths.board)) {
    const board = lib.parseBoard(fs.readFileSync(paths.board, 'utf8'));
    if (board.version) highest = Math.max(highest, board.version - (board.issued ? 0 : 1));
  }
  if (args.flags.reserve) highest = Math.max(highest, Number(args.flags.reserve));
  entry.reserved = highest;
  entry.notes = entry.notes || `Migrated ${today()}: legacy citations inventoried; first issued number is v${highest + 1}.`;
  lib.writeIndex(paths, index);
  process.stdout.write(`Inventoried ${citations.length} legacy citation(s); reserved through v${highest}; next issue must be v${highest + 1} or higher\nIndex: ${paths.index}\n`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const commands = { check: commandCheck, scenario: commandScenario, cite: commandCite, issue: commandIssue, bump: commandBump, publish: commandPublish, migrate: commandMigrate };
  const run = commands[args.command];
  if (!run) usage(1);
  try {
    run(args);
  } catch (error) {
    if (error instanceof lib.BoardError) die(error.message);
    throw error;
  }
}

main();
