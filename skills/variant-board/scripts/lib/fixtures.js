#!/usr/bin/env node
'use strict';

/*
 * Synthetic fixture workspace: two boards drawn against an invented "Northwind Field Ops" app. Nothing here is
 * copied from a real product. Tests build these in temporary directories; `node fixtures.js --write <dir>`
 * regenerates the committed copy under fixtures/workspace so reviewers can open real files.
 */

const fs = require('fs');
const path = require('path');
const { buildBoard, renderBrief, renderTokenMap } = require('./build');

const THEME_FILE = 'packages/theme/src/styles.css';
const REPO = '~/Code/northwind/field-ops-ui';
const REVISION = 'a1b2c3d';
const DATE = '2026-09-24';

const THEME_CSS = `@import "tailwindcss";

@theme inline {
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.21 0.02 260);
  --color-muted: oklch(0.97 0.004 260);
  --color-muted-foreground: oklch(0.55 0.02 260);
  --color-border: oklch(0.92 0.006 260);
  --color-default: var(--color-border);
  --color-primary: #2f6f9f;
  --color-primary-foreground: oklch(1 0 0);
  --color-destructive: #b3261e;
  --color-success: #edf7ee;
  --color-success-foreground: #1b5e20;
  --color-warning: #fff4e5;
  --color-warning-foreground: #8a4b00;
  --color-info: #e8f0fe;
  --color-info-foreground: #1a56db;
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
}

body {
  font-family:
    "Inter Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
`;

const APP_TOKENS = {
  '--app-background': 'oklch(1 0 0)',
  '--app-foreground': 'oklch(0.21 0.02 260)',
  '--app-muted': 'oklch(0.97 0.004 260)',
  '--app-muted-foreground': 'oklch(0.55 0.02 260)',
  '--app-border': 'oklch(0.92 0.006 260)',
  '--app-primary': '#2f6f9f',
  '--app-primary-foreground': 'oklch(1 0 0)',
  '--app-destructive': '#b3261e',
  '--app-success': '#edf7ee',
  '--app-success-foreground': '#1b5e20',
  '--app-warning': '#fff4e5',
  '--app-warning-foreground': '#8a4b00',
  '--app-info': '#e8f0fe',
  '--app-info-foreground': '#1a56db',
  '--app-radius-sm': '0.25rem',
  '--app-radius-md': '0.5rem',
  '--app-radius-lg': '0.75rem',
  '--app-radius-xl': '1rem',
  '--app-font': '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const TOKEN_ROWS = [
  ['--app-background', '--color-background', 'resolved'],
  ['--app-foreground', '--color-foreground', 'resolved'],
  ['--app-muted', '--color-muted', 'resolved'],
  ['--app-muted-foreground', '--color-muted-foreground', 'resolved'],
  ['--app-border', '--color-default', 'resolved', 'alias of `--color-border`'],
  ['--app-primary', '--color-primary', 'resolved'],
  ['--app-primary-foreground', '--color-primary-foreground', 'resolved'],
  ['--app-destructive', '--color-destructive', 'resolved'],
  ['--app-success', '--color-success', 'resolved'],
  ['--app-success-foreground', '--color-success-foreground', 'resolved'],
  ['--app-warning', '--color-warning', 'resolved'],
  ['--app-warning-foreground', '--color-warning-foreground', 'resolved'],
  ['--app-info', '--color-info', 'resolved'],
  ['--app-info-foreground', '--color-info-foreground', 'resolved'],
  ['--app-radius-sm', '--radius-sm', 'resolved'],
  ['--app-radius-md', '--radius-md', 'resolved'],
  ['--app-radius-lg', '--radius-lg', 'resolved'],
  ['--app-radius-xl', '--radius-xl', 'resolved'],
  ['--app-font', 'body { font-family }', 'substituted', '`Inter Variable` is a bundled web font that cannot be embedded; the rest of the stack stands in'],
].map(([boardToken, sourceToken, status, note]) => ({ boardToken, sourceToken, status, note: note || '', value: APP_TOKENS[boardToken] }));

function tokensMarkdown(boardId) {
  return renderTokenMap({ boardId, repo: REPO, themeFile: THEME_FILE, revision: REVISION, rows: TOKEN_ROWS });
}

const FACTS = {
  sourceOfTruth: '.agent/tasks/ui-dispatch-notes.md',
  readAgainst: `main @ ${REVISION}`,
  themeSource: `${THEME_FILE} @ ${REVISION}`,
  date: DATE,
  status: 'Proposal, awaiting decision',
  tokens: '18 resolved, 1 substituted (--app-font)',
};

const COLOPHON_TOKENS = '18 rows resolved from the theme source; --app-font substituted (bundled web font replaced by the system stack)';

/* ---------- memo-style: two independent proposed-change sections, one with a surface -> state dependency ---------- */

function memoStyleDefinition() {
  return {
    sections: {
      notes: {
        dimensions: [
          { id: 'surface', label: 'Surface', options: [{ id: 'composer', label: 'New job composer' }, { id: 'record', label: 'Job record' }] },
          { id: 'state', label: 'State', options: [
            { id: 'empty', label: 'Nothing attached' }, { id: 'staged', label: 'Note staged' }, { id: 'failed', label: 'Upload rejected' },
            { id: 'withnote', label: 'Record with note' }, { id: 'legacy', label: 'Pre-note record' },
          ] },
          { id: 'view', label: 'View', options: [{ id: 'both', label: 'Side by side' }, { id: 'before', label: 'Before' }, { id: 'after', label: 'After' }] },
        ],
        dependencies: [
          { controlling: 'surface', dependent: 'state', allowed: { composer: ['empty', 'staged', 'failed'], record: ['withnote', 'legacy'] } },
        ],
      },
      owner: {
        dimensions: [
          { id: 'state', label: 'Owning unit', options: [{ id: 'crew', label: 'Crew' }, { id: 'depot', label: 'Depot' }, { id: 'region', label: 'Region' }] },
          { id: 'view', label: 'View', options: [{ id: 'both', label: 'Side by side' }, { id: 'before', label: 'Before' }, { id: 'after', label: 'After' }] },
        ],
        dependencies: [],
      },
    },
  };
}

const MEMO_SECTIONS = `  <section class="board-section" id="notes" data-purpose="proposed-change">
    <header><h2>Dispatch note on job creation</h2><span class="tag">ui-dispatch-notes.md</span></header>
    <p class="note">The composer gains a dispatch-note accordion in place of the bare file input; the job record shows the note beside the schedule.</p>
    <div class="controls" data-controls="notes"></div>
    <p class="scenario-link" data-scenario-link="notes"></p>
    <div data-mock="notes" data-board-part="panes"></div>
    <table class="board-table" data-board-part="proof">
      <thead><tr><th>Behaviour</th><th>Before</th><th>After</th><th>Same or changed</th></tr></thead>
      <tbody>
        <tr><td>Required fields</td><td>Title, crew, window</td><td>Title, crew, window</td><td>same</td></tr>
        <tr><td>Note upload</td><td>Single file input, no validation copy</td><td>Accordion with drop zone and file row</td><td>changed</td></tr>
      </tbody>
    </table>
  </section>

  <section class="board-section" id="owner" data-purpose="proposed-change">
    <header><h2>Job detail reads the owning unit</h2><span class="tag">ui-job-owner.md</span></header>
    <p class="note">The detail header names the unit that owns the job instead of the user who created it.</p>
    <div class="controls" data-controls="owner"></div>
    <p class="scenario-link" data-scenario-link="owner"></p>
    <div data-mock="owner" data-board-part="panes"></div>
  </section>
`;

const MEMO_SCRIPT = `(function () {
  function fileRow(name, sub, action) {
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--app-border);border-radius:var(--app-radius-md)"><span class="m-pill">PDF</span><div style="flex:1"><b style="font-weight:500">' + name + '</b><div class="m-muted" style="font-size:12px">' + sub + '</div></div><span class="m-btn ghost sm">' + action + '</span></div>';
  }
  function accordion(state) {
    var body = '<p class="m-muted" style="margin:0 0 10px">Scanned dispatch note for the crew lead. PDF up to 10 MB.</p>';
    if (state === 'failed') body += '<div class="m-alert destructive" style="margin-bottom:10px"><b>Upload rejected</b><span>The file exceeds 10 MB.</span></div>';
    body += '<div style="border:1px dashed var(--app-border);border-radius:var(--app-radius-md);padding:18px;text-align:center" class="m-muted">Choose a file or drag it here</div>';
    if (state === 'staged') body += '<div style="margin-top:10px">' + fileRow('dispatch-note-0142.pdf', '1.2 MB · Ready', 'Remove') + '</div>';
    return '<div class="m-card sm"><h4>Dispatch note <span class="m-pill">Optional</span></h4>' + body + '</div>';
  }
  function composer(inner) {
    return '<div class="m-card"><h4>New job</h4><div><span class="m-label">Title</span><div class="m-input">Replace transformer at Depot 4</div></div>' + inner + '<div><span class="m-btn">Create job</span></div></div>';
  }
  function record(state) {
    var note = state === 'withnote' ? '<div>' + fileRow('dispatch-note-0142.pdf', 'Attached 2026-09-24', 'Download') + '</div>' : '<p class="m-muted">No dispatch note on this job.</p>';
    return '<div class="m-card"><h4>Job 0142 <span class="m-pill success">Scheduled</span></h4><p class="m-muted">Depot 4 · Crew B · 09:00–13:00</p>' + note + '</div>';
  }
  var NOTES = {
    empty: function () { return { before: composer('<div><span class="m-label">Dispatch note</span><div class="m-input">No file chosen</div></div>'), after: composer(accordion('empty')) }; },
    staged: function () { return { before: composer('<div><span class="m-label">Dispatch note</span><div class="m-input">dispatch-note-0142.pdf</div></div>'), after: composer(accordion('staged')) }; },
    failed: function () { return { before: composer('<div><span class="m-label">Dispatch note</span><div class="m-input">dispatch-note-0142.pdf</div><p class="m-muted" style="color:var(--app-destructive)">File too large</p></div>'), after: composer(accordion('failed')) }; },
    withnote: function () { return { before: '<div class="m-card"><h4>Job 0142</h4><p class="m-muted">Depot 4 · Crew B</p><p class="m-muted">Attachments: 1</p></div>', after: record('withnote') }; },
    legacy: function () { return { before: '<div class="m-card"><h4>Job 0142</h4><p class="m-muted">Depot 4 · Crew B</p></div>', after: record('legacy') }; }
  };
  var OWNER = { crew: 'Crew B', depot: 'Depot 4', region: 'North region' };
  VariantBoard.mount({
    notes: function (sel, api) { var c = NOTES[sel.state](); return api.panes({ view: sel.view, before: c.before, after: c.after }); },
    owner: function (sel, api) {
      var before = '<div class="m-card sm"><h4>Job 0142</h4><p class="m-muted">Created by A. Okafor</p></div>';
      var after = '<div class="m-card sm"><h4>Job 0142</h4><p class="m-muted">Owned by ' + OWNER[sel.state] + '</p></div>';
      return api.panes({ view: sel.view, before: before, after: after });
    }
  });
})();`;

function memoStyleBoard() {
  return buildBoard({
    id: 'memo-style',
    title: 'Dispatch notes and job ownership',
    eyebrow: 'Northwind Field Ops · Jobs · Proposed changes',
    lede: 'Before and after panes for two task docs: the dispatch-note upload on job creation, and the owning unit on the job detail.',
    facts: FACTS,
    appTokens: APP_TOKENS,
    sectionsHtml: MEMO_SECTIONS,
    revisions: [{ version: 1, date: DATE, author: 'agent', type: 'proposal', text: 'first draft from the two task docs.' }],
    colophon: { sources: 'Sources read: <code>.agent/tasks/ui-dispatch-notes.md</code>, <code>.agent/tasks/ui-job-owner.md</code>; Before panes reconstructed from <code>features/jobs/job-composer.tsx</code> and <code>features/jobs/job-detail.tsx</code> at the read-against commit.', tokens: COLOPHON_TOKENS },
    definition: memoStyleDefinition(),
    script: MEMO_SCRIPT,
  });
}

function memoStyleBrief() {
  return renderBrief({
    id: 'memo-style',
    title: 'Dispatch notes and job ownership',
    product: 'Northwind Field Ops',
    repo: REPO,
    surface: 'features/jobs/',
    sourceOfTruth: '.agent/tasks/ui-dispatch-notes.md',
    readAgainst: `main @ ${REVISION}`,
    purposes: ['proposed-change'],
    themeSource: `${THEME_FILE} @ ${REVISION}`,
    sections: [
      { id: 'notes', heading: 'Dispatch note on job creation', purposes: ['proposed-change'] },
      { id: 'owner', heading: 'Job detail reads the owning unit', purposes: ['proposed-change'] },
    ],
    scenarios: [
      { section: 'notes', hash: '#notes?surface=composer&state=empty&view=both', expected: 'Before: bare file input. After: dispatch-note accordion, nothing staged.' },
      { section: 'notes', hash: '#notes?surface=composer&state=failed&view=after', expected: 'After only: accordion with the rejected-upload alert.' },
      { section: 'notes', hash: '#notes?surface=record&state=legacy&view=both', expected: 'Record without a note on both sides; After says "No dispatch note".' },
      { section: 'owner', hash: '#owner?state=region&view=after', expected: 'After: header reads "Owned by North region".' },
    ],
    themeEvidence: `- Tokens: \`markdown/memo-style-tokens.md\`\n- Proportions read from \`packages/theme/src/components/button.tsx\` (h-9, px-2.5, rounded-md)`,
  });
}

/* ---------- route-state: one shared mock with variant, route -> state, viewer; options and a state matrix ---------- */

function routeStateDefinition() {
  return {
    sections: {
      commands: {
        dimensions: [
          { id: 'variant', label: 'Variant', options: [{ id: 'today', label: 'Today' }, { id: 'a', label: 'A · Sections + route column', rec: true }, { id: 'b', label: 'B · One timeline' }] },
          { id: 'route', label: 'Route', options: [{ id: 'depot', label: 'Depot approval' }, { id: 'region', label: 'Region approval' }, { id: 'external', label: 'External authority' }] },
          { id: 'state', label: 'State', options: [
            { id: 'draft', label: 'Draft' }, { id: 'submitted', label: 'Submitted' }, { id: 'depot-approved', label: 'Depot approved' },
            { id: 'region-approved', label: 'Region approved' }, { id: 'authority-review', label: 'Authority review' }, { id: 'closed', label: 'Closed' },
          ] },
          { id: 'viewer', label: 'Viewer', options: [{ id: 'planner', label: 'Planner' }, { id: 'approver', label: 'Approver' }, { id: 'reader', label: 'Reader' }] },
        ],
        dependencies: [
          { controlling: 'route', dependent: 'state', allowed: {
            depot: ['draft', 'submitted', 'depot-approved', 'closed'],
            region: ['draft', 'submitted', 'depot-approved', 'region-approved', 'closed'],
            external: ['draft', 'submitted', 'depot-approved', 'region-approved', 'authority-review', 'closed'],
          } },
        ],
      },
    },
  };
}

const ROUTE_SECTIONS = `  <section class="board-section" id="commands" data-purpose="unsettled-choice state-coverage">
    <header><h2>Where the approval commands go</h2><span class="tag">ui-approval-commands.md</span></header>
    <p class="note">Pick a variant, a route, a state and a viewer; the mock shows who sees which command. The route decides which states exist; states a route cannot reach are hidden.</p>
    <div class="controls" data-controls="commands"></div>
    <p class="scenario-link" data-scenario-link="commands"></p>
    <div data-mock="commands"></div>
    <div class="options" data-board-part="options">
      <div class="option"><h3>Today</h3><p class="note">Commands sit in a dropdown at the page top; the route is invisible until the submission fails.</p></div>
      <div class="option"><h3>A · Sections + route column <span class="tag rec">Recommended</span></h3><p class="note">One section per approval step, the route named in a right-hand column, the next command inline in the current section.</p></div>
      <div class="option"><h3>B · One timeline</h3><p class="note">A single vertical timeline; commands appear on the active step only.</p></div>
    </div>
    <table class="board-table" data-board-part="comparison">
      <thead><tr><th>Criterion</th><th>Today</th><th>A</th><th>B</th></tr></thead>
      <tbody>
        <tr><td>Route visible before submission</td><td>no</td><td>yes</td><td>partly</td></tr>
        <tr><td>Next command discoverable</td><td>dropdown</td><td>inline</td><td>inline</td></tr>
        <tr><td>Fits external-authority routes</td><td>no</td><td>yes</td><td>yes, long</td></tr>
      </tbody>
    </table>
    <table class="board-table" data-board-part="state-matrix">
      <thead><tr><th>State</th><th>Depot route</th><th>Region route</th><th>External route</th></tr></thead>
      <tbody>
        <tr><td>Draft</td><td>Submit</td><td>Submit</td><td>Submit</td></tr>
        <tr><td>Submitted</td><td>Approve at depot</td><td>Approve at depot</td><td>Approve at depot</td></tr>
        <tr><td>Depot approved</td><td>Close</td><td>Approve at region</td><td>Approve at region</td></tr>
        <tr><td>Region approved</td><td>—</td><td>Close</td><td>Send to authority</td></tr>
        <tr><td>Authority review</td><td>—</td><td>—</td><td>Record decision</td></tr>
        <tr><td>Closed</td><td>—</td><td>—</td><td>—</td></tr>
      </tbody>
    </table>
    <p class="note" data-board-part="cannot-settle"><b>What this board cannot settle:</b> whether the external authority decision is recorded by the planner or by an authority user; the API contract is not written.</p>
  </section>
`;

const ROUTE_SCRIPT = `(function () {
  var STEPS = { depot: ['submitted', 'depot-approved', 'closed'], region: ['submitted', 'depot-approved', 'region-approved', 'closed'], external: ['submitted', 'depot-approved', 'region-approved', 'authority-review', 'closed'] };
  var LABEL = { draft: 'Draft', submitted: 'Submitted', 'depot-approved': 'Depot approved', 'region-approved': 'Region approved', 'authority-review': 'Authority review', closed: 'Closed' };
  var NEXT = { draft: 'Submit', submitted: 'Approve at depot', 'depot-approved': { depot: 'Close', region: 'Approve at region', external: 'Approve at region' }, 'region-approved': { region: 'Close', external: 'Send to authority' }, 'authority-review': 'Record decision', closed: null };
  function nextCommand(sel) { var n = NEXT[sel.state]; if (n && typeof n === 'object') n = n[sel.route]; return n || null; }
  function canAct(sel) { return sel.viewer === 'approver' || (sel.viewer === 'planner' && sel.state === 'draft'); }
  function header(sel) {
    var cmd = nextCommand(sel);
    var btn = cmd ? (canAct(sel) ? '<span class="m-btn">' + cmd + '</span>' : '<span class="m-btn outline" aria-disabled="true">' + cmd + '</span>') : '<span class="m-muted">No further action</span>';
    return '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><div><b style="font-weight:500">Job 0142 · approval</b> <span class="m-pill">' + LABEL[sel.state] + '</span></div>' + (sel.variant === 'today' ? '<span class="m-btn outline">Actions ▾</span>' : btn) + '</div>';
  }
  function sections(sel) {
    var steps = STEPS[sel.route];
    var reached = sel.state === 'draft' ? 0 : steps.indexOf(sel.state) + 1;
    var rows = steps.map(function (s, i) {
      var status = i < reached ? '<span class="m-pill success">done</span>' : i === reached ? '<span class="m-pill primary">current</span>' : '<span class="m-pill">upcoming</span>';
      var cmd = i === reached && nextCommand(sel) && canAct(sel) ? ' <span class="m-btn sm">' + nextCommand(sel) + '</span>' : '';
      return '<tr><td>' + LABEL[s] + '</td><td>' + status + cmd + '</td><td class="m-muted">' + sel.route + ' route</td></tr>';
    }).join('');
    return '<table class="m-table"><thead><tr><th>Step</th><th>Status</th><th>Route</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }
  function timeline(sel) {
    var steps = STEPS[sel.route];
    var reached = sel.state === 'draft' ? 0 : steps.indexOf(sel.state) + 1;
    return '<ol style="margin:0;padding-left:20px">' + steps.map(function (s, i) {
      return '<li style="padding:6px 0">' + LABEL[s] + (i === reached ? ' <span class="m-pill primary">current</span>' : '') + '</li>';
    }).join('') + '</ol>';
  }
  VariantBoard.mount({
    commands: function (sel, api) {
      var body = sel.variant === 'a' ? sections(sel) : sel.variant === 'b' ? timeline(sel) : '<p class="m-muted">Route ' + sel.route + ' is not shown on the page today.</p>';
      return api.frame('<div class="m-card">' + header(sel) + body + '</div>', 'Viewer: ' + sel.viewer);
    }
  });
})();`;

function routeStateBoard() {
  return buildBoard({
    id: 'route-state',
    title: 'Approval commands by route and state',
    eyebrow: 'Northwind Field Ops · Approvals · Unsettled choice',
    lede: 'Three placements for the approval commands, drawn across the three routes and every state each route can reach.',
    facts: { ...FACTS, sourceOfTruth: '.agent/tasks/ui-approval-commands.md' },
    appTokens: APP_TOKENS,
    sectionsHtml: ROUTE_SECTIONS,
    revisions: [{ version: 1, date: DATE, author: 'agent', type: 'proposal', text: 'first draft; variant A recommended.' }],
    colophon: { sources: 'Sources read: <code>.agent/tasks/ui-approval-commands.md</code>; route steps reconstructed from <code>features/approvals/route-steps.ts</code> at the read-against commit.', tokens: COLOPHON_TOKENS },
    definition: routeStateDefinition(),
    script: ROUTE_SCRIPT,
  });
}

function routeStateBrief() {
  return renderBrief({
    id: 'route-state',
    title: 'Approval commands by route and state',
    product: 'Northwind Field Ops',
    repo: REPO,
    surface: 'features/approvals/',
    sourceOfTruth: '.agent/tasks/ui-approval-commands.md',
    readAgainst: `main @ ${REVISION}`,
    purposes: ['unsettled-choice', 'state-coverage'],
    themeSource: `${THEME_FILE} @ ${REVISION}`,
    sections: [{ id: 'commands', heading: 'Where the approval commands go', purposes: ['unsettled-choice', 'state-coverage'] }],
    scenarios: [
      { section: 'commands', hash: '#commands?variant=a&route=external&state=authority-review&viewer=approver', expected: 'Sections layout; Authority review current; "Record decision" enabled.' },
      { section: 'commands', hash: '#commands?variant=a&route=depot&state=depot-approved&viewer=reader', expected: '"Close" shown disabled for the reader.' },
      { section: 'commands', hash: '#commands?variant=today&route=depot&state=draft&viewer=planner', expected: 'Today: Actions dropdown; route not shown.' },
    ],
  });
}

function writeWorkspace(dir) {
  fs.mkdirSync(path.join(dir, 'html'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'markdown'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'html', 'memo-style.html'), memoStyleBoard());
  fs.writeFileSync(path.join(dir, 'html', 'route-state.html'), routeStateBoard());
  fs.writeFileSync(path.join(dir, 'markdown', 'memo-style-brief.md'), memoStyleBrief());
  fs.writeFileSync(path.join(dir, 'markdown', 'memo-style-tokens.md'), tokensMarkdown('memo-style'));
  fs.writeFileSync(path.join(dir, 'markdown', 'route-state-brief.md'), routeStateBrief());
  fs.writeFileSync(path.join(dir, 'markdown', 'route-state-tokens.md'), tokensMarkdown('route-state'));
  fs.writeFileSync(path.join(dir, 'README.md'), '# Synthetic fixture workspace\n\nTwo boards against an invented app, generated by `scripts/lib/fixtures.js --write`. They exist so tests and browser checks have real files; nothing here comes from a product.\n');
}

module.exports = { APP_TOKENS, DATE, REPO, REVISION, THEME_CSS, THEME_FILE, TOKEN_ROWS, memoStyleBoard, memoStyleBrief, memoStyleDefinition, routeStateBoard, routeStateBrief, routeStateDefinition, tokensMarkdown, writeWorkspace };

if (require.main === module) {
  const index = process.argv.indexOf('--write');
  if (index < 0 || !process.argv[index + 1]) {
    process.stderr.write('Usage: fixtures.js --write <dir>\n');
    process.exit(1);
  }
  writeWorkspace(path.resolve(process.argv[index + 1]));
  process.stdout.write(`Fixture workspace written to ${path.resolve(process.argv[index + 1])}\n`);
}
