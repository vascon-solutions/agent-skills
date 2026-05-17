const path = require('path');

const MD_IMAGE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const HTML_IMG = /<img\b([^>]*?)\bsrc=(["'])([^"']+)\2([^>]*)>/g;

function normalizeRelative(from, target) {
  const fromDir = path.posix.dirname(from);
  const joined = path.posix.normalize(path.posix.join(fromDir, target));
  return joined.replace(/^\.\//, '');
}

function rewriteImagePaths(body, { relativeMap, sourceRelative }) {
  const warnings = [];

  function rewriteOne(target) {
    if (/^https?:\/\//.test(target) || target.startsWith('data:')) return target;
    if (path.posix.isAbsolute(target)) return target;
    const key = normalizeRelative(sourceRelative, target);
    if (relativeMap[key]) return relativeMap[key];
    warnings.push(`Image reference left unresolved: ${key} (from ${sourceRelative})`);
    return target;
  }

  let content = body.replace(MD_IMAGE, (full, alt, target) => `![${alt}](${rewriteOne(target)})`);
  content = content.replace(HTML_IMG, (full, pre, quote, target, post) => `<img${pre}src=${quote}${rewriteOne(target)}${quote}${post}>`);

  return { content, warnings };
}

module.exports = { rewriteImagePaths };
