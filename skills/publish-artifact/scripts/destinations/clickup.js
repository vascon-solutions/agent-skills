const fs = require('fs');

const { rewriteImagePaths } = require('../common/markdown-rewrite.js');

const PARENT_TYPES = new Set(['workspace', 'space', 'folder', 'list']);

function parseParent(value) {
  if (!value) return null;
  const colon = value.indexOf(':');
  if (colon === -1) throw new Error('--clickup-parent must be <type>:<id>');
  const type = value.slice(0, colon);
  const id = value.slice(colon + 1);
  if (!PARENT_TYPES.has(type)) throw new Error(`--clickup-parent type must be one of ${Array.from(PARENT_TYPES).join(', ')}`);
  if (!id) throw new Error('--clickup-parent missing id');
  return { type, id };
}

function workspaceIdFromParent(env, parent) {
  if (parent.type === 'workspace') return parent.id;
  if (env.CLICKUP_WORKSPACE_ID) return env.CLICKUP_WORKSPACE_ID;
  throw new Error('CLICKUP_WORKSPACE_ID required when --clickup-parent is not workspace:<id>');
}

const driver = {
  name: 'clickup',
  needsPresignedImages: true,

  requiredEnv() { return ['CLICKUP_API_TOKEN']; },

  validateFlags(flags) {
    if (!flags.clickupParent) {
      throw new Error('clickup destination requires --clickup-parent <type:id> (or CLICKUP_PARENT_TYPE + CLICKUP_PARENT_ID)');
    }
    parseParent(flags.clickupParent);
  },

  async publish({ workspace, files, flags, ctx }) {
    const parent = parseParent(flags.clickupParent);
    const workspaceId = workspaceIdFromParent(ctx.env, parent);
    const baseUrl = 'https://api.clickup.com/api/v3';
    const headers = {
      Authorization: ctx.env.CLICKUP_API_TOKEN,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const mdFiles = files.filter((f) => f.relativePath.startsWith('markdown/') && f.relativePath.endsWith('.md'));
    const htmlFiles = files.filter((f) => f.relativePath.startsWith('html/') && f.relativePath.endsWith('.html'));
    const rewriteEnabled = (flags.to || []).includes('s3') && ctx.presignedByFile;
    const created = [];
    const updated = [];
    const skipped = htmlFiles.map((file) => ({
      relativePath: file.relativePath,
      reason: 'clickup does not ingest HTML',
    }));
    const warnings = [];

    for (const file of mdFiles) {
      const raw = fs.readFileSync(file.fullPath, 'utf8');
      let bodyContent = raw;
      if (rewriteEnabled) {
        const r = rewriteImagePaths(raw, { relativeMap: ctx.presignedByFile, sourceRelative: file.relativePath });
        bodyContent = r.content;
        warnings.push(...r.warnings);
      } else if (/!\[[^\]]*\]\([^)\s]+\)|<img\b/.test(raw)) {
        warnings.push(`Image references in ${file.relativePath} are not rewritten (add --to s3 to mint presigned URLs).`);
      }

      const docName = flags.clickupDoc || workspace.slug;
      if (flags.dryRun) {
        created.push({ relativePath: file.relativePath, dryRun: true, docName });
        continue;
      }

      const searchUrl = `${baseUrl}/workspaces/${encodeURIComponent(workspaceId)}/docs?parent_id=${encodeURIComponent(parent.id)}&parent_type=${encodeURIComponent(parent.type)}`;
      const searchRes = await ctx.httpClient.request(searchUrl, { method: 'GET', headers });
      const searchData = await searchRes.json();
      const existing = (searchData.docs || []).find((d) => d.name === docName);

      if (existing) {
        if (!flags.force) {
          skipped.push({ relativePath: file.relativePath, docName, reason: 'Doc exists; pass --force to update' });
          continue;
        }
        const updateUrl = `${baseUrl}/workspaces/${encodeURIComponent(workspaceId)}/docs/${encodeURIComponent(existing.id)}`;
        const updateRes = await ctx.httpClient.request(updateUrl, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ name: docName, content: bodyContent }),
        });
        const updateData = await updateRes.json();
        updated.push({ relativePath: file.relativePath, docName, url: existing.url || updateData.url });
      } else {
        const createUrl = `${baseUrl}/workspaces/${encodeURIComponent(workspaceId)}/docs`;
        const createRes = await ctx.httpClient.request(createUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: docName, content: bodyContent, parent: { type: parent.type, id: parent.id } }),
        });
        const createData = await createRes.json();
        created.push({ relativePath: file.relativePath, docName, url: createData.url });
      }
    }

    const metadataLines = [
      '- ClickUp destination: Docs',
      `- Last published: \`${(ctx.now || new Date()).toISOString().slice(0, 16).replace('T', ' ')}Z\``,
    ];
    for (const c of created) if (c.url) metadataLines.push(`- Created \`${c.relativePath}\` — ${c.url}`);
    for (const u of updated) metadataLines.push(`- Updated \`${u.relativePath}\` — ${u.url}`);
    for (const s of skipped) metadataLines.push(`- Skipped \`${s.relativePath}\` — ${s.reason}`);

    return { created, updated, skipped, warnings, metadataLines };
  },

  formatReport(result) {
    const lines = [];
    if (result.created.length > 0) {
      lines.push('ClickUp docs created:');
      for (const c of result.created) {
        if (c.dryRun) lines.push(`[dry-run] - ${c.relativePath} would create doc "${c.docName}"`);
        else lines.push(`- ${c.relativePath} — ${c.url}`);
      }
    }
    if (result.updated.length > 0) {
      lines.push('ClickUp docs updated:');
      for (const u of result.updated) lines.push(`- ${u.relativePath} — ${u.url}`);
    }
    if (result.skipped.length > 0) {
      lines.push('ClickUp docs skipped:');
      for (const s of result.skipped) lines.push(`- ${s.relativePath} (${s.reason})`);
    }
    for (const w of result.warnings) lines.push(`Warning: ${w}`);
    return lines;
  },
};

module.exports = driver;
