#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const LAYOUT_TYPES = [
  'task-doc',
  'roadmap',
  'qa-handoff',
  'frontend-handoff',
  'repo-doc',
  'generic',
  'approach-comparison',
  'diff-annotation',
  'design-system-tokens',
  'slide-deck',
  'animation-sandbox',
  'clickable-flow',
  'svg-figure-sheet',
  'chart-report',
  'draggable-kanban',
  'split-view-editor',
];

function usage(exitCode = 0) {
  const stream = exitCode === 0 ? process.stdout : process.stderr;
  stream.write(`Usage: verify-layout-artifact.js <doc-type-or-artifact-kind> <output.html>\n`);
  stream.write(`\nValidates self-contained HTML and article-style layout features.\n`);
  stream.write(`Allowed layout types: ${LAYOUT_TYPES.join(', ')}\n`);
  process.exit(exitCode);
}

function fail(message) {
  throw new Error(message);
}

function stripCodeLike(html) {
  return html
    .replace(/<pre\b[\s\S]*?<\/pre>/gi, '<pre></pre>')
    .replace(/<code\b[\s\S]*?<\/code>/gi, '<code></code>');
}

function validateNoNetwork(html) {
  const checkable = stripCodeLike(html);
  const patterns = [
    { name: '<script src=remote>', re: /<script[^>]*\ssrc\s*=\s*["'](?!data:)/i },
    { name: '<link href=remote>', re: /<link[^>]*\shref\s*=\s*["'](?!data:)/i },
    { name: '<iframe>', re: /<iframe\b/i },
    { name: '<img src=remote>', re: /<img[^>]*\ssrc\s*=\s*["'](?!data:)/i },
    { name: 'CSS url(remote)', re: /url\(\s*["']?(?!data:|#)/i },
  ];
  for (const { name, re } of patterns) {
    const match = checkable.match(re);
    if (match) fail(`disallowed network reference (${name}): ${match[0]}`);
  }
}

function countMatches(value, re) {
  const matches = value.match(re);
  return matches ? matches.length : 0;
}

function validateBalancedTags(html) {
  const checkable = stripCodeLike(html);
  const tags = ['html', 'head', 'body', 'style', 'script', 'div', 'nav', 'main', 'section', 'details', 'summary', 'ul', 'ol', 'table', 'tr', 'td', 'th'];
  for (const tag of tags) {
    const open = countMatches(checkable, new RegExp(`<${tag}(?=[\\s>])[^>]*>`, 'gi'));
    const close = countMatches(checkable, new RegExp(`</${tag}>`, 'gi'));
    if (open !== close) fail(`unbalanced <${tag}> tags: ${open} opening, ${close} closing`);
  }
}

function assertHas(html, label, re) {
  if (!re.test(html)) fail(`missing ${label}`);
}

function assertAny(html, label, patterns) {
  if (!patterns.some((re) => re.test(html))) fail(`missing ${label}`);
}

function commonChecks(html) {
  assertHas(html, '<!DOCTYPE html>', /<!doctype html>/i);
  assertHas(html, '<style>', /<style\b/i);
  assertHas(html, '<body>', /<body\b/i);
  validateNoNetwork(html);
  validateBalancedTags(html);
}

const CHECKS = {
  'task-doc': (html) => {
    assertHas(html, 'sidebar navigation', /<nav\b/i);
    assertHas(html, 'jump links', /href=["']#/i);
    assertHas(html, 'collapsible sections', /<details\b/i);
    assertHas(html, 'section summaries', /<summary\b/i);
    assertAny(html, 'TL;DR summary', [/TL;DR/i, /tldr/i]);
    assertAny(html, 'decision badge labels', [/\bResolved\b/i, /\bUnresolved\b/i, /\bBlocked\b/i]);
  },
  roadmap: (html) => {
    assertHas(html, 'copyBoard function', /function\s+copyBoard\s*\(/i);
    assertHas(html, 'status columns', /data-col=/i);
    assertHas(html, 'cards', /data-card\b/i);
    ['Planned', 'In Progress', 'Done', 'Blocked'].forEach((status) => {
      assertHas(html, `${status} column`, new RegExp(status, 'i'));
    });
  },
  'qa-handoff': (html) => {
    assertHas(html, 'copyChecklist function', /function\s+copyChecklist\s*\(/i);
    assertHas(html, 'copyable checklist items', /data-check\b/i);
    assertHas(html, 'endpoint table', /<table\b/i);
    assertAny(html, 'HTTP method badges or labels', [/\bGET\b/, /\bPOST\b/, /\bPUT\b/, /\bPATCH\b/, /\bDELETE\b/]);
    assertAny(html, 'state timeline content', [/\btimeline\b/i, /\bLifecycle\b/i, /\bState\b/i, /\bDraft\b/i, /\bSent\b/i, /\bAccepted\b/i, /\bExpired\b/i]);
    assertAny(html, 'role callout content', [/\bRoles?\b/i, /\bAdmin\b/i, /\bMember\b/i]);
  },
  'frontend-handoff': (html) => {
    assertHas(html, 'showTab function', /function\s+showTab\s*\(/i);
    assertHas(html, 'API tab pane', /pane-api/i);
    assertHas(html, 'checklist tab pane', /pane-checklist/i);
    assertHas(html, 'retired dependencies tab pane', /pane-retired/i);
    assertHas(html, 'copyChecklist function', /function\s+copyChecklist\s*\(/i);
    assertHas(html, 'copyable checklist items', /data-check\b/i);
  },
  'repo-doc': (html) => {
    assertHas(html, 'sidebar navigation', /<nav\b/i);
    assertHas(html, 'jump links', /href=["']#/i);
    assertAny(html, 'TL;DR summary', [/TL;DR/i, /tldr/i]);
    assertHas(html, 'collapsible subsections', /<details\b/i);
    assertHas(html, 'subsection summaries', /<summary\b/i);
  },
  generic: (html) => {
    assertHas(html, 'main content', /<main\b|<div\b/i);
    assertHas(html, 'heading', /<h1\b/i);
  },
  'approach-comparison': (html) => {
    assertAny(html, 'approach cards or columns', [/data-approach\b/i, /approach-card/i]);
    assertAny(html, 'tradeoff matrix', [/<table\b/i, /tradeoff/i]);
    assertAny(html, 'recommendation area', [/recommendation/i, /recommended/i]);
  },
  'diff-annotation': (html) => {
    assertHas(html, 'diff code block', /<pre[\s\S]*?(?:\bdiff --git\b|@@\s*-?\d+|(?:^|\n)[+-][^+\-\n])/i);
    assertAny(html, 'annotation markers', [/data-annotation\b/i, /annotation/i]);
    assertAny(html, 'severity labels', [/severity/i, /critical/i, /major/i, /minor/i]);
  },
  'design-system-tokens': (html) => {
    assertAny(html, 'token rows or swatches', [/data-token\b/i, /swatch/i]);
    assertHas(html, 'copy token function', /function\s+(copyToken|copyValue)\s*\(/i);
    assertAny(html, 'token categories', [/color/i, /spacing/i, /typography/i, /radius/i]);
  },
  'slide-deck': (html) => {
    assertHas(html, 'slide elements', /data-slide\b/i);
    assertAny(html, 'slide navigation function', [/function\s+(showSlide|nextSlide|prevSlide)\s*\(/i]);
    assertHas(html, 'keyboard navigation', /keydown/i);
  },
  'animation-sandbox': (html) => {
    assertHas(html, 'numeric controls', /<input[^>]+type=["']range["']/i);
    assertAny(html, 'animation target', [/data-preview\b/i, /animation/i]);
    assertAny(html, 'update function', [/function\s+(updateAnimation|updatePreview)\s*\(/i, /requestAnimationFrame/i]);
  },
  'clickable-flow': (html) => {
    assertHas(html, 'screen nodes', /data-screen\b/i);
    assertAny(html, 'flow navigation function', [/function\s+(showScreen|goToScreen|setScreen)\s*\(/i]);
    assertAny(html, 'active screen state', [/active/i, /aria-selected/i]);
  },
  'svg-figure-sheet': (html) => {
    assertHas(html, 'inline SVG', /<svg\b/i);
    assertAny(html, 'figure controls', [/data-control\b/i, /<input\b/i, /function\s+(updateFigure|updatePreview)\s*\(/i]);
  },
  'chart-report': (html) => {
    assertAny(html, 'inline chart', [/<svg\b/i, /data-chart\b/i]);
    assertAny(html, 'chart labels or legend', [/legend/i, /axis/i, /data-series\b/i]);
    assertAny(html, 'report summary', [/summary/i, /insight/i, /status/i]);
  },
  'draggable-kanban': (html) => {
    assertHas(html, 'draggable cards', /draggable=["']true["']/i);
    assertHas(html, 'status columns', /data-col=/i);
    assertHas(html, 'dragstart handler', /dragstart/i);
    assertHas(html, 'drop handler', /(?:ondrop\s*=|function\s+(?:on)?drop\b|addEventListener\(['"]drop)/i);
  },
  'split-view-editor': (html) => {
    assertAny(html, 'source editor', [/<textarea\b/i, /contenteditable=/i]);
    assertAny(html, 'preview pane', [/data-preview\b/i, /preview/i]);
    assertAny(html, 'update preview function', [/function\s+(updatePreview|renderPreview)\s*\(/i]);
  },
};

function main() {
  try {
    const [docType, htmlFile] = process.argv.slice(2);
    if (!docType || docType === '--help' || docType === '-h') usage(0);
    if (!LAYOUT_TYPES.includes(docType)) fail(`unknown layout type: ${docType}`);
    if (!htmlFile) usage(1);
    const resolved = path.resolve(htmlFile);
    if (!fs.existsSync(resolved)) fail(`HTML file not found: ${resolved}`);
    const html = fs.readFileSync(resolved, 'utf8');
    commonChecks(html);
    CHECKS[docType](html);
    process.stdout.write(`Verified: ${resolved} (${docType})\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

main();
