#!/usr/bin/env node

const fs = require('fs');
const http = require('http');
const path = require('path');
const { execFile } = require('child_process');
const { URL } = require('url');

const publishWorkspace = require('../../publish-artifact/scripts/common/workspace.js');

const ARTIFACT_DIRS = ['html', 'markdown', 'images', 'assets'];
const HOST = '127.0.0.1';

function usage(exitCode = 0) {
  const stream = exitCode === 0 ? process.stdout : process.stderr;
  stream.write('Usage: serve-artifact-workbench.js <workspace-or-html-file> [--port <n>] [--open]\n');
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = { target: null, port: null, open: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') usage(0);
    if (arg === '--open') {
      args.open = true;
    } else if (arg === '--port') {
      const raw = argv[++i];
      const port = Number(raw);
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid --port: ${raw}`);
      args.port = port;
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!args.target) {
      args.target = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }
  if (!args.target) usage(1);
  return args;
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.md') return 'text/markdown; charset=utf-8';
  if (ext === '.txt') return 'text/plain; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js' || ext === '.mjs') return 'application/javascript; charset=utf-8';
  if (ext === '.wasm') return 'application/wasm';
  if (ext === '.woff') return 'font/woff';
  if (ext === '.woff2') return 'font/woff2';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

function listFiles(root, dirName) {
  const dirPath = path.join(root, dirName);
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) return [];
  const files = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        files.push({
          fullPath,
          relativePath: publishWorkspace.normalizeRelative(path.relative(root, fullPath)),
          size: fs.statSync(fullPath).size,
        });
      }
    }
  }
  walk(dirPath);
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function resolveTarget(target, options = {}) {
  const homeDir = options.homeDir || process.env.HOME;
  const cwd = options.cwd || process.cwd();
  const workspaceRoot = path.resolve(publishWorkspace.expandHome(options.workspaceRoot || path.join(homeDir, 'agent-artifacts'), homeDir));
  const expanded = publishWorkspace.expandHome(target, homeDir);
  const targetPath = path.resolve(cwd, expanded);
  if (path.extname(targetPath).toLowerCase() === '.html') {
    if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) throw new Error(`HTML file not found: ${targetPath}`);
    return {
      mode: 'single-html',
      filePath: targetPath,
      rootPath: path.dirname(targetPath),
      fileName: path.basename(targetPath),
    };
  }
  const workspaceInput = path.isAbsolute(expanded) || expanded.includes(path.sep) ? targetPath : target;
  const workspace = publishWorkspace.resolveWorkspace(workspaceInput, { workspaceRoot, homeDir });
  return { mode: 'workspace', ...workspace };
}

function discoverWorkspace(workspacePath) {
  const files = {
    html: listFiles(workspacePath, 'html'),
    markdown: listFiles(workspacePath, 'markdown'),
    images: listFiles(workspacePath, 'images'),
    assets: listFiles(workspacePath, 'assets'),
  };
  const metadataPath = path.join(workspacePath, 'metadata.md');
  const metadata = fs.existsSync(metadataPath) && fs.statSync(metadataPath).isFile()
    ? { fullPath: metadataPath, relativePath: 'metadata.md', size: fs.statSync(metadataPath).size }
    : null;
  const uploadFiles = publishWorkspace.listUploadFiles(workspacePath);
  const htmlChecks = files.html.map((file) => ({
    file,
    warnings: scanHtmlReferences(fs.readFileSync(file.fullPath, 'utf8'), file.relativePath),
  }));
  return { files, metadata, uploadFiles, htmlChecks };
}

function isAllowedReference(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('data:')) return true;
  if (trimmed.startsWith('#')) return true;
  if (/^(mailto|tel):/i.test(trimmed)) return true;
  return false;
}

function pushWarning(warnings, relativePath, kind, value) {
  if (isAllowedReference(value)) return;
  warnings.push({ relativePath, kind, value });
}

function scanHtmlReferences(html, relativePath) {
  const warnings = [];
  const attrRe = /\b(src|href|poster)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+))/gi;
  let attrMatch;
  while ((attrMatch = attrRe.exec(html)) !== null) {
    pushWarning(warnings, relativePath, attrMatch[1].toLowerCase(), attrMatch[2] || attrMatch[3] || attrMatch[4]);
  }
  const srcsetRe = /\bsrcset\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+))/gi;
  let srcsetMatch;
  while ((srcsetMatch = srcsetRe.exec(html)) !== null) {
    const srcset = srcsetMatch[1] || srcsetMatch[2] || srcsetMatch[3];
    const candidateRe = /(?:^|,\s*)(\S+)(?:\s+[^,]+)?/g;
    let candidateMatch;
    while ((candidateMatch = candidateRe.exec(srcset)) !== null) {
      pushWarning(warnings, relativePath, 'srcset', candidateMatch[1]);
    }
  }
  const cssUrlRe = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
  let cssMatch;
  while ((cssMatch = cssUrlRe.exec(html)) !== null) {
    pushWarning(warnings, relativePath, 'css-url', cssMatch[1]);
  }
  return warnings;
}

function safeResolve(root, requestPath) {
  const clean = String(requestPath || '').replace(/^\/+/, '');
  if (!clean || clean.split(/[\\/]+/).includes('..')) throw new Error(`Unsafe path: ${requestPath}`);
  const rootReal = fs.realpathSync(root);
  const fullPath = path.resolve(root, clean);
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) throw new Error(`File not found: ${requestPath}`);
  const fileReal = fs.realpathSync(fullPath);
  if (fileReal !== rootReal && !fileReal.startsWith(rootReal + path.sep)) throw new Error(`Unsafe path: ${requestPath}`);
  return fullPath;
}

function decodePathname(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fileLink(file, baseRoute, labelPrefix = '') {
  const href = `/${baseRoute}/${encodeURI(file.relativePath.replace(/^[^/]+\//, ''))}`;
  const label = `${labelPrefix}${file.relativePath}`;
  return `<li><a href="${href}">${escapeHtml(label)}</a> <span>${file.size} bytes</span></li>`;
}

function section(title, body) {
  return `<section><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

function listSection(title, files, baseRoute) {
  if (!files || files.length === 0) return '';
  return section(title, `<ul>${files.map((file) => fileLink(file, baseRoute)).join('\n')}</ul>`);
}

function htmlChecksAnchor(relativePath) {
  return `html-checks-${relativePath.replace(/[^A-Za-z0-9]+/g, '-')}`;
}

function htmlSection(files, checks) {
  if (!files || files.length === 0) return '';
  const warningsByFile = new Map(checks.map((check) => [check.file.relativePath, check.warnings]));
  const items = files.map((file) => {
    const relativeName = file.relativePath.replace(/^html\//, '');
    const warningCount = (warningsByFile.get(file.relativePath) || []).length;
    const warningLabel = warningCount > 0
      ? ` <a href="#${htmlChecksAnchor(file.relativePath)}"><strong>${warningCount} warning(s)</strong></a>`
      : ' <span>clean</span>';
    return [
      '<li>',
      `<a href="/preview/html/${encodeURI(relativeName)}">Preview isolated</a>`,
      ' | ',
      `<a href="/html/${encodeURI(relativeName)}">Raw file</a>`,
      ` <span>${escapeHtml(file.relativePath)}</span>`,
      warningLabel,
      '</li>',
    ].join('');
  });
  return section('HTML', `<ul>${items.join('\n')}</ul>`);
}

function imageSection(files) {
  if (!files || files.length === 0) return '';
  const items = files.map((file) => {
    const relativeName = file.relativePath.replace(/^images\//, '');
    const href = `/images/${encodeURI(relativeName)}`;
    return [
      '<li>',
      `<a href="${href}">${escapeHtml(file.relativePath)}</a>`,
      `<br><img src="${href}" alt="${escapeHtml(file.relativePath)}" loading="lazy">`,
      '</li>',
    ].join('');
  });
  return section('Images', `<ul class="image-grid">${items.join('\n')}</ul>`);
}

function metadataSection(metadata) {
  if (!metadata) return '';
  return section(
    'Metadata',
    '<p>Local-only operational metadata. It may contain destination IDs, presigned URLs, gist URLs, or internal references.</p><ul><li><a href="/metadata.md">metadata.md</a></li></ul>',
  );
}

function uploadSetSection(files) {
  if (!files || files.length === 0) return section('Default Publish Upload Set', '<p>No default upload files found.</p>');
  const items = files.map((file) => `<li>${escapeHtml(file.relativePath)} <span>${file.size} bytes</span></li>`);
  return section(
    'Default Publish Upload Set',
    '<p>Informational only. Destination drivers may add, skip, transform, or rewrite files later.</p>' +
      `<ul>${items.join('\n')}</ul>`,
  );
}

function htmlChecksSection(checks) {
  const filesWithWarnings = checks.filter((check) => check.warnings.length > 0);
  if (filesWithWarnings.length === 0) {
    return '<section id="html-checks"><h2>HTML Self-Contained Checks</h2><p>No non-self-contained references detected.</p></section>';
  }
  const blocks = filesWithWarnings.map((check) => {
    const anchor = htmlChecksAnchor(check.file.relativePath);
    const items = check.warnings.map((warning) => (
      `<li>${escapeHtml(warning.kind)} = <code>${escapeHtml(warning.value)}</code></li>`
    ));
    return `<div id="${anchor}"><h3>${escapeHtml(check.file.relativePath)}</h3><ul>${items.join('\n')}</ul></div>`;
  });
  return `<section id="html-checks"><h2>HTML Self-Contained Checks</h2>${blocks.join('\n')}</section>`;
}

function buildIndexHtml({ workspacePath, slug, info }) {
  const title = `Artifact Workbench - ${slug}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #172033; background: #f6f8fb; }
    header { padding: 24px 28px; background: #172033; color: #fff; }
    main { max-width: 1100px; margin: 0 auto; padding: 24px; }
    section { margin: 0 0 18px; padding: 18px; background: #fff; border: 1px solid #d9e0ea; border-radius: 8px; }
    h1, h2 { margin: 0 0 10px; }
    p { line-height: 1.5; }
    a { color: #0b5cad; }
    span { color: #64748b; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; }
    ul { margin: 0; padding-left: 20px; }
    li { margin: 6px 0; }
    img { max-width: 180px; max-height: 120px; margin-top: 6px; border: 1px solid #d9e0ea; border-radius: 6px; background: #fff; }
    .workspace { color: #cbd5e1; }
  </style>
</head>
<body>
  <header>
    <h1>Artifact Workbench</h1>
    <p class="workspace">${escapeHtml(workspacePath)}</p>
  </header>
  <main>
    ${htmlSection(info.files.html, info.htmlChecks)}
    ${listSection('Markdown', info.files.markdown, 'markdown')}
    ${imageSection(info.files.images)}
    ${listSection('Assets', info.files.assets, 'assets')}
    ${metadataSection(info.metadata)}
    ${uploadSetSection(info.uploadFiles)}
    ${htmlChecksSection(info.htmlChecks)}
  </main>
</body>
</html>`;
}

function send(res, statusCode, body, contentType = 'text/plain; charset=utf-8', headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(body);
}

function sendFile(res, filePath) {
  send(res, 200, fs.readFileSync(filePath), contentTypeFor(filePath));
}

function notFound(res) {
  send(res, 404, 'Not found\n');
}

function routeWorkspaceRequest(target, req, res) {
  const requestUrl = new URL(req.url, 'http://127.0.0.1');
  const pathname = decodePathname(requestUrl.pathname);
  if (!pathname) return notFound(res);
  if (pathname === '/') {
    const info = discoverWorkspace(target.workspacePath);
    return send(res, 200, buildIndexHtml({ workspacePath: target.workspacePath, slug: target.slug, info }), 'text/html; charset=utf-8');
  }
  if (pathname.startsWith('/preview/html/')) {
    if (path.extname(pathname).toLowerCase() !== '.html') return notFound(res);
    try {
      return sendFile(res, safeResolve(path.join(target.workspacePath, 'html'), pathname.replace(/^\/preview\/html\//, '')));
    } catch {
      return notFound(res);
    }
  }
  if (pathname.startsWith('/preview/')) return notFound(res);
  const routes = [
    { prefix: '/html/', root: path.join(target.workspacePath, 'html') },
    { prefix: '/markdown/', root: path.join(target.workspacePath, 'markdown') },
    { prefix: '/images/', root: path.join(target.workspacePath, 'images') },
    { prefix: '/assets/', root: path.join(target.workspacePath, 'assets') },
  ];
  for (const route of routes) {
    if (pathname.startsWith(route.prefix)) {
      try {
        return sendFile(res, safeResolve(route.root, pathname.slice(route.prefix.length)));
      } catch {
        return notFound(res);
      }
    }
  }
  if (pathname === '/metadata.md') {
    try {
      const metadataPath = safeResolve(target.workspacePath, 'metadata.md');
      return send(res, 200, fs.readFileSync(metadataPath), 'text/plain; charset=utf-8');
    } catch {
      return notFound(res);
    }
  }
  return notFound(res);
}

function routeSingleHtmlRequest(target, req, res) {
  const requestUrl = new URL(req.url, 'http://127.0.0.1');
  const pathname = decodePathname(requestUrl.pathname);
  if (!pathname) return notFound(res);
  if (pathname === '/') {
    return send(res, 302, '', 'text/plain; charset=utf-8', { Location: `/${encodeURI(target.fileName)}` });
  }
  try {
    return sendFile(res, safeResolve(target.rootPath, pathname));
  } catch {
    return notFound(res);
  }
}

function createServer(target) {
  return http.createServer((req, res) => {
    try {
      if (req.method !== 'GET') return send(res, 405, 'Method not allowed\n');
      if (target.mode === 'workspace') return routeWorkspaceRequest(target, req, res);
      return routeSingleHtmlRequest(target, req, res);
    } catch {
      return notFound(res);
    }
  });
}

function warningCount(info) {
  return info.htmlChecks.reduce((count, check) => count + check.warnings.length, 0);
}

function startupReport(target, url) {
  if (target.mode === 'single-html') {
    return [
      'Artifact workbench',
      `File: ${target.filePath}`,
      `URL: ${url}`,
      `Asset root: ${target.rootPath} (any file under this directory is reachable while running)`,
      'Mode: read-only single HTML preview',
      '',
    ].join('\n');
  }
  const info = discoverWorkspace(target.workspacePath);
  const warnings = warningCount(info);
  return [
    'Artifact workbench',
    `Workspace: ${target.workspacePath}`,
    `URL: ${url}`,
    `HTML: ${info.files.html.length}`,
    `Markdown: ${info.files.markdown.length}`,
    `Images: ${info.files.images.length}`,
    `Assets: ${info.files.assets.length}`,
    `Metadata: ${info.metadata ? 'yes' : 'no'}`,
    `HTML checks: ${warnings} warning${warnings === 1 ? '' : 's'}`,
    'Mode: read-only local preview',
    '',
  ].join('\n');
}

function openUrl(url, options = {}) {
  const platform = options.platform || process.platform;
  const runner = options.runner || execFile;
  const warn = options.warn || ((message) => process.stderr.write(`${message}\n`));
  let cmd = null;
  let args = [];
  if (platform === 'darwin') {
    cmd = 'open';
    args = [url];
  } else if (platform === 'linux') {
    cmd = 'xdg-open';
    args = [url];
  } else if (platform === 'win32') {
    cmd = 'cmd';
    args = ['/c', 'start', '""', url];
  } else {
    warn(`Warning: --open is not supported on ${platform}; open ${url} manually`);
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    runner(cmd, args, (error) => {
      if (error) {
        warn(`Warning: could not open browser via ${cmd}: ${error.message}`);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port || 0, HOST, () => {
      server.off('error', reject);
      resolve(server.address().port);
    });
  });
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const target = resolveTarget(args.target);
    const server = createServer(target);
    const port = await listen(server, args.port);
    const url = target.mode === 'single-html'
      ? `http://${HOST}:${port}/${encodeURI(target.fileName)}`
      : `http://${HOST}:${port}/`;
    process.stdout.write(startupReport(target, url));
    if (args.open) await openUrl(url);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  ARTIFACT_DIRS,
  HOST,
  buildIndexHtml,
  contentTypeFor,
  createServer,
  discoverWorkspace,
  htmlChecksAnchor,
  listen,
  openUrl,
  parseArgs,
  resolveTarget,
  safeResolve,
  scanHtmlReferences,
  startupReport,
};

if (require.main === module) main();
