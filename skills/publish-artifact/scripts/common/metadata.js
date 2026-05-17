const fs = require('fs');
const path = require('path');

function readMetadata(workspacePath) {
  const metadataPath = path.join(workspacePath, 'metadata.md');
  return fs.existsSync(metadataPath) ? fs.readFileSync(metadataPath, 'utf8') : null;
}

function replacePublishedSection(existingContent, slug, lines) {
  const section = ['## Published', '', ...lines, ''].join('\n');
  if (!existingContent) {
    return `# ${slug} Metadata\n\n${section}`;
  }
  const normalized = existingContent.endsWith('\n') ? existingContent : `${existingContent}\n`;
  const match = normalized.match(/^## Published$/m);
  if (!match) {
    return `${normalized.replace(/\n*$/, '\n\n')}${section}`;
  }
  const start = match.index;
  const afterStart = start + match[0].length;
  const nextMatch = normalized.slice(afterStart).match(/\n## .*/);
  const end = nextMatch ? afterStart + nextMatch.index : normalized.length;
  return `${normalized.slice(0, start)}${section}${normalized.slice(end)}`;
}

function redactPublishedSection(metadata) {
  const lines = metadata.split('\n');
  let inPublished = false;
  return lines.map((line) => {
    if (line === '## Published') { inPublished = true; return line; }
    if (inPublished && line.startsWith('## ')) { inPublished = false; return line; }
    if (!inPublished) return line;
    if (line.includes('gist.github.com')) {
      return line.replace(/https?:\/\/\S+/, '<gist URL — see local metadata>');
    }
    if (/https?:\/\/\S+/.test(line)) {
      return line.replace(/https?:\/\/\S+/, '<presigned URL — see local metadata>');
    }
    return line;
  }).join('\n');
}

function extractPublishedSection(metadata) {
  const lines = metadata.split('\n');
  const start = lines.findIndex((line) => line === '## Published');
  if (start === -1) return '';
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  return lines.slice(start, end === -1 ? lines.length : end).join('\n');
}

function findExistingGist(metadata, relativePath) {
  if (!metadata) return null;
  const escaped = relativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = metadata.match(new RegExp(`- \`${escaped}\` — (https://gist\\.github\\.com/[^\\s]+)`));
  if (!match) return null;
  const parts = match[1].split('/');
  return { url: match[1], id: parts[parts.length - 1] };
}

module.exports = {
  readMetadata,
  replacePublishedSection,
  redactPublishedSection,
  extractPublishedSection,
  findExistingGist,
};
