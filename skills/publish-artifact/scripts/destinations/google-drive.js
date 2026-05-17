const fs = require('fs');
const path = require('path');

const { getAccessToken } = require('../common/google-auth.js');

const FOLDER_MIME = 'application/vnd.google-apps.folder';

function escapeQueryValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function contentTypeFor(relativePath) {
  const ext = path.extname(relativePath).toLowerCase();
  if (ext === '.md') return 'text/markdown; charset=utf-8';
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.txt') return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}

function buildMultipartBody(metadata, contentType, buffer, boundary) {
  return Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
}

function fileListWithMetadata(files, workspacePath) {
  const out = [...files];
  const metadataPath = path.join(workspacePath, 'metadata.md');
  if (fs.existsSync(metadataPath) && !out.some((file) => file.relativePath === 'metadata.md')) {
    out.push({ fullPath: metadataPath, relativePath: 'metadata.md', size: fs.statSync(metadataPath).size });
  }
  return out.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

async function searchFile(httpClient, headers, { name, parentId, mimeType }) {
  const clauses = [
    `name='${escapeQueryValue(name)}'`,
    `'${escapeQueryValue(parentId)}' in parents`,
    'trashed=false',
  ];
  if (mimeType) clauses.push(`mimeType='${escapeQueryValue(mimeType)}'`);
  else clauses.push(`mimeType!='${FOLDER_MIME}'`);
  const q = encodeURIComponent(clauses.join(' and '));
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType,webViewLink)`;
  const res = await httpClient.request(url, { method: 'GET', headers });
  const data = await res.json();
  return (data.files || [])[0] || null;
}

async function ensureFolder(httpClient, headers, { name, parentId }) {
  const existing = await searchFile(httpClient, headers, { name, parentId, mimeType: FOLDER_MIME });
  if (existing) return { id: existing.id, url: existing.webViewLink || `https://drive.google.com/drive/folders/${existing.id}`, created: false };
  const res = await httpClient.request('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parents: [parentId], mimeType: FOLDER_MIME }),
  });
  const data = await res.json();
  return { id: data.id, url: data.webViewLink || `https://drive.google.com/drive/folders/${data.id}`, created: true };
}

async function ensureParentFolder(httpClient, headers, cache, rootFolderId, dirName) {
  if (!dirName || dirName === '.') return rootFolderId;
  const parts = dirName.split('/').filter(Boolean);
  let parentId = rootFolderId;
  let key = '';
  for (const part of parts) {
    key = key ? `${key}/${part}` : part;
    if (!cache.has(key)) {
      const folder = await ensureFolder(httpClient, headers, { name: part, parentId });
      cache.set(key, folder.id);
    }
    parentId = cache.get(key);
  }
  return parentId;
}

async function uploadNewFile(httpClient, headers, file, parentId) {
  const name = path.posix.basename(file.relativePath);
  const contentType = contentTypeFor(file.relativePath);
  const boundary = 'publish_artifact_drive_' + Math.random().toString(16).slice(2);
  const metadata = { name, parents: [parentId], mimeType: contentType };
  const body = buildMultipartBody(metadata, contentType, fs.readFileSync(file.fullPath), boundary);
  const res = await httpClient.request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  const data = await res.json();
  return { id: data.id, url: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view` };
}

async function updateExistingFile(httpClient, headers, file, existing) {
  const contentType = contentTypeFor(file.relativePath);
  await httpClient.request(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existing.id)}?uploadType=media&supportsAllDrives=true`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': contentType },
    body: fs.readFileSync(file.fullPath),
  });
  return { id: existing.id, url: existing.webViewLink || `https://drive.google.com/file/d/${existing.id}/view` };
}

const driver = {
  name: 'google-drive',

  requiredEnv() { return []; },

  validateFlags(flags) {
    if (!flags.googleFolder) {
      throw new Error('google-drive destination requires --google-folder <drive-folder-id> (or GOOGLE_DRIVE_PARENT_ID)');
    }
  },

  async publish({ workspace, files, flags, ctx }) {
    const uploadFiles = fileListWithMetadata(files, workspace.workspacePath);
    if (flags.dryRun) {
      return { dryRun: true, folderName: workspace.slug, parentFolder: flags.googleFolder, planned: uploadFiles };
    }

    const token = await getAccessToken({
      env: ctx.env,
      workspacePath: workspace.workspacePath,
      scriptDir: ctx.scriptDir,
      runner: ctx.runner,
      httpClient: ctx.httpClient,
      now: ctx.now || new Date(),
      signJwt: ctx.signJwt,
    });
    const headers = { Authorization: `Bearer ${token}` };
    const rootFolder = await ensureFolder(ctx.httpClient, headers, { name: workspace.slug, parentId: flags.googleFolder });
    const folderCache = new Map();
    const uploaded = [];
    const updated = [];
    const skipped = [];

    for (const file of uploadFiles) {
      const parentId = await ensureParentFolder(ctx.httpClient, headers, folderCache, rootFolder.id, path.posix.dirname(file.relativePath));
      const name = path.posix.basename(file.relativePath);
      const existing = await searchFile(ctx.httpClient, headers, { name, parentId });
      if (existing && !flags.force) {
        skipped.push({ relativePath: file.relativePath, reason: 'File exists; pass --force to update', url: existing.webViewLink });
        continue;
      }
      const result = existing
        ? await updateExistingFile(ctx.httpClient, headers, file, existing)
        : await uploadNewFile(ctx.httpClient, headers, file, parentId);
      const entry = { relativePath: file.relativePath, url: result.url };
      if (existing) updated.push(entry);
      else uploaded.push(entry);
    }

    const metadataLines = [
      `- Google Drive folder: ${rootFolder.url}`,
      `- Last published: \`${(ctx.now || new Date()).toISOString().slice(0, 16).replace('T', ' ')}Z\``,
    ];
    for (const file of uploaded) metadataLines.push(`- Uploaded \`${file.relativePath}\` — ${file.url}`);
    for (const file of updated) metadataLines.push(`- Updated \`${file.relativePath}\` — ${file.url}`);
    for (const file of skipped) metadataLines.push(`- Skipped \`${file.relativePath}\` — ${file.reason}`);

    return { folderUrl: rootFolder.url, uploaded, updated, skipped, metadataLines };
  },

  formatReport(result) {
    if (result.dryRun) {
      const lines = [`[dry-run] Google Drive folder: ${result.folderName} under ${result.parentFolder}`];
      for (const file of result.planned) lines.push(`[dry-run] - would upload raw file ${file.relativePath}`);
      return lines;
    }
    const lines = [`Google Drive folder: ${result.folderUrl}`];
    if (result.uploaded.length > 0) {
      lines.push('Google Drive files uploaded:');
      for (const file of result.uploaded) lines.push(`- ${file.relativePath} — ${file.url}`);
    }
    if (result.updated.length > 0) {
      lines.push('Google Drive files updated:');
      for (const file of result.updated) lines.push(`- ${file.relativePath} — ${file.url}`);
    }
    if (result.skipped.length > 0) {
      lines.push('Google Drive files skipped:');
      for (const file of result.skipped) lines.push(`- ${file.relativePath} (${file.reason})`);
    }
    return lines;
  },
};

module.exports = driver;
