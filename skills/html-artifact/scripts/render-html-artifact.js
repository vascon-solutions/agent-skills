#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DOC_TYPE_FOLDERS = {
  'task-doc': 'task-docs',
  roadmap: 'roadmaps',
  'qa-handoff': 'qa-handoffs',
  'frontend-handoff': 'frontend-handoffs',
  'repo-doc': 'repo-docs',
  generic: 'generic',
};

function usage(exitCode = 0) {
  const stream = exitCode === 0 ? process.stdout : process.stderr;
  stream.write(`Usage: render-html-artifact.js <source.md> [--out <path>] [--doc-type <type>]\n`);
  stream.write(`\nConverts Markdown into a self-contained HTML file with zero network dependencies.\n`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = { source: null, out: null, docType: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') usage(0);
    if (arg === '--out') {
      args.out = argv[++i];
    } else if (arg === '--doc-type') {
      args.docType = argv[++i];
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!args.source) {
      args.source = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }
  if (!args.source) usage(1);
  if (args.docType && !DOC_TYPE_FOLDERS[args.docType]) {
    throw new Error(`Unknown --doc-type: ${args.docType}. Allowed: ${Object.keys(DOC_TYPE_FOLDERS).join(', ')}`);
  }
  return args;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'section';
}

function inlineMarkdown(value) {
  let out = escapeHtml(value);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return out;
}

function detectDocType(sourcePath, markdown) {
  const lowerPath = sourcePath.toLowerCase();
  if (/task-[^/]*\.md$/.test(lowerPath) || (markdown.includes('## Decisions Required') && markdown.includes('## Likely Files'))) {
    return 'task-doc';
  }
  if (/(roadmap|todo)[^/]*\.md$/.test(lowerPath) || /\b(planned|in-progress|done|blocked)\b/i.test(markdown)) {
    return 'roadmap';
  }
  if (lowerPath.includes('qa') && lowerPath.includes('handoff')) return 'qa-handoff';
  if (lowerPath.includes('frontend') && lowerPath.includes('handoff')) return 'frontend-handoff';
  if (/(readme|agents|claude|contributing|architecture)[^/]*\.md$/.test(lowerPath) || lowerPath.includes('/docs/')) {
    return 'repo-doc';
  }
  return 'generic';
}

function repoName(cwd) {
  try {
    const remote = execSync('git remote get-url origin', { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return path.basename(remote.replace(/\.git$/, ''));
  } catch {
    return path.basename(cwd);
  }
}

function resolveOutPath(sourcePath, outArg, docType) {
  if (outArg) {
    if (outArg.endsWith(path.sep) || (fs.existsSync(outArg) && fs.statSync(outArg).isDirectory())) {
      return path.join(outArg, `${path.basename(sourcePath, path.extname(sourcePath))}.html`);
    }
    return outArg;
  }
  const folder = DOC_TYPE_FOLDERS[docType] || DOC_TYPE_FOLDERS.generic;
  return path.join(process.env.HOME, 'agent-artifacts', repoName(process.cwd()), folder, `${path.basename(sourcePath, path.extname(sourcePath))}.html`);
}

function makeRemoteImagePlaceholder(alt) {
  const label = escapeHtml(alt || 'Remote image removed');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="180" viewBox="0 0 640 180"><rect width="640" height="180" fill="#f1f5f9"/><rect x="1" y="1" width="638" height="178" fill="none" stroke="#cbd5e1" stroke-width="2"/><text x="320" y="92" text-anchor="middle" fill="#64748b" font-family="Arial, sans-serif" font-size="18">${label}</text></svg>`;
  return `<img alt="${label}" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`;
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let inCode = false;
  let code = [];
  let inUl = false;
  let inOl = false;
  let inTable = false;
  let inSection = false;
  let tableRows = [];
  const headings = [];

  function closeLists() {
    if (inUl) {
      html.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      html.push('</ol>');
      inOl = false;
    }
  }

  function closeSection() {
    if (inSection) {
      html.push('</section>');
      inSection = false;
    }
  }

  function closeTable() {
    if (!inTable) return;
    html.push('<div class="table-wrap"><table>');
    tableRows.forEach((row, index) => {
      if (index === 1 && row.every((cell) => /^:?-+:?$/.test(cell.trim()))) return;
      const tag = index === 0 ? 'th' : 'td';
      html.push(`<tr>${row.map((cell) => `<${tag}>${inlineMarkdown(cell.trim())}</${tag}>`).join('')}</tr>`);
    });
    html.push('</table></div>');
    inTable = false;
    tableRows = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');
    if (line.startsWith('```')) {
      closeTable();
      closeLists();
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
        code = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      code.push(rawLine);
      continue;
    }
    const remoteImage = line.match(/^!\[([^\]]*)\]\((https?:\/\/[^)]+)\)$/);
    if (remoteImage) {
      closeTable();
      closeLists();
      html.push(`<figure>${makeRemoteImagePlaceholder(remoteImage[1])}</figure>`);
      continue;
    }
    if (/^\|.*\|$/.test(line.trim())) {
      closeLists();
      inTable = true;
      tableRows.push(line.trim().slice(1, -1).split('|'));
      continue;
    }
    closeTable();
    if (line.startsWith('# ')) {
      closeLists();
      closeSection();
      html.push(`<h1>${inlineMarkdown(line.slice(2).trim())}</h1>`);
    } else if (line.startsWith('## ')) {
      closeLists();
      closeSection();
      const title = line.slice(3).trim();
      const id = slugify(title);
      headings.push({ id, title });
      html.push(`<section id="${id}"><h2>${inlineMarkdown(title)}</h2>`);
      inSection = true;
    } else if (line.startsWith('### ')) {
      closeLists();
      html.push(`<h3>${inlineMarkdown(line.slice(4).trim())}</h3>`);
    } else if (/^\d+\.\s+/.test(line)) {
      if (inUl) {
        html.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        html.push('<ol>');
        inOl = true;
      }
      html.push(`<li>${inlineMarkdown(line.replace(/^\d+\.\s+/, ''))}</li>`);
    } else if (line.startsWith('- ')) {
      if (inOl) {
        html.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        html.push('<ul>');
        inUl = true;
      }
      html.push(`<li>${inlineMarkdown(line.slice(2).trim())}</li>`);
    } else if (line.trim() === '') {
      closeLists();
    } else {
      closeLists();
      html.push(`<p>${inlineMarkdown(line.trim())}</p>`);
    }
  }
  closeTable();
  closeLists();
  closeSection();
  return {
    headings,
    content: html.join('\n'),
  };
}

function extractTitle(markdown, fallback) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

function extractSummary(markdown) {
  const lines = markdown.split('\n').map((line) => line.trim());
  for (const line of lines) {
    if (!line || line.startsWith('#') || line.startsWith('|') || line.startsWith('- ') || /^\d+\.\s+/.test(line)) continue;
    return line;
  }
  return 'Self-contained HTML companion generated from Markdown.';
}

function renderHtml(markdown, sourcePath, docType) {
  const title = extractTitle(markdown, path.basename(sourcePath, path.extname(sourcePath)));
  const summary = extractSummary(markdown);
  const rendered = renderMarkdown(markdown);
  const nav = rendered.headings.map((heading) => `<a href="#${heading.id}">${escapeHtml(heading.title)}</a>`).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 15px; line-height: 1.6; color: #1a1a1a; background: #f8f8f8; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; padding: 0 4px; font-size: 0.92em; }
    pre { background: #1e1e1e; color: #d4d4d4; padding: 1rem; border-radius: 6px; overflow-x: auto; font-size: 13px; margin: 0.85rem 0 1.15rem; }
    pre code { background: transparent; border: 0; padding: 0; color: inherit; }
    table { border-collapse: collapse; width: 100%; background: #fff; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; vertical-align: top; }
    th { background: #f0f0f0; font-weight: 600; }
    img { max-width: 100%; height: auto; }
    .layout { display: flex; min-height: 100vh; }
    nav { width: 270px; flex-shrink: 0; background: #fff; border-right: 1px solid #e0e0e0; padding: 1.5rem 1rem; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
    nav strong { display: block; font-size: 12px; text-transform: uppercase; color: #777; letter-spacing: .06em; margin-bottom: .75rem; }
    nav a { display: block; font-size: 13px; color: #334155; padding: .28rem .25rem; border-radius: 4px; }
    nav a:hover { background: #f1f5f9; text-decoration: none; }
    main { flex: 1; padding: 2.25rem; max-width: 980px; }
    h1 { font-size: 2rem; line-height: 1.2; margin-bottom: 1rem; color: #0f172a; }
    h2 { font-size: 1.2rem; margin: 1.9rem 0 .65rem; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: .25rem; }
    h3 { font-size: 1rem; margin: 1.15rem 0 .4rem; color: #1f2937; }
    p { margin: .55rem 0 .85rem; }
    ul, ol { margin: .45rem 0 1rem 1.5rem; }
    li { margin: .25rem 0; }
    .tldr { background:#e8f4fd; border-left:4px solid #0066cc; padding:1rem 1.25rem; margin-bottom:1.5rem; border-radius:0 6px 6px 0; }
    .tldr strong { display:block; margin-bottom:4px; color:#0066cc; }
    .meta { color: #64748b; font-size: 13px; margin-bottom: 1rem; }
    .table-wrap { overflow-x: auto; margin: .85rem 0 1.15rem; }
    @media (max-width: 780px) { .layout { display:block; } nav { position: static; width: auto; height: auto; border-right: 0; border-bottom: 1px solid #e0e0e0; } main { padding: 1.25rem; } }
  </style>
</head>
<body>
  <div class="layout">
    <nav><strong>Contents</strong>${nav}</nav>
    <main>
      <p class="meta">${escapeHtml(docType)} companion generated from ${escapeHtml(sourcePath)}</p>
      <div class="tldr"><strong>TL;DR</strong><p>${inlineMarkdown(summary)}</p></div>
      ${rendered.content}
    </main>
  </div>
</body>
</html>
`;
}

function validateNoNetwork(html) {
  const checkable = html
    .replace(/<pre>[\s\S]*?<\/pre>/g, '<pre></pre>')
    .replace(/<code>[\s\S]*?<\/code>/g, '<code></code>');
  const patterns = [
    { name: '<script src=remote>', re: /<script[^>]*\ssrc\s*=\s*["'](?!data:)/i },
    { name: '<link href=remote>',  re: /<link[^>]*\shref\s*=\s*["'](?!data:)/i },
    { name: '<iframe>',            re: /<iframe\b/i },
    { name: '<img src=remote>',    re: /<img[^>]*\ssrc\s*=\s*["'](?!data:)/i },
    { name: 'CSS url(remote)',     re: /url\(\s*["']?(?!data:|#)/i },
  ];
  for (const { name, re } of patterns) {
    const match = checkable.match(re);
    if (match) {
      throw new Error(`Generated HTML contains a disallowed network reference (${name}): ${match[0]}`);
    }
  }
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const sourcePath = path.resolve(args.source);
    if (!fs.existsSync(sourcePath)) throw new Error(`Source file not found: ${sourcePath}`);
    const markdown = fs.readFileSync(sourcePath, 'utf8');
    const docType = args.docType || detectDocType(sourcePath, markdown);
    const outPath = path.resolve(resolveOutPath(sourcePath, args.out, docType));
    const html = renderHtml(markdown, sourcePath, docType);
    validateNoNetwork(html);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html);
    process.stdout.write(`Written: ${outPath} (${docType} -> script layout)\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

main();
