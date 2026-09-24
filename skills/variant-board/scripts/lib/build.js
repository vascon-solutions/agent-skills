'use strict';

const fs = require('fs');
const { STARTER_PATH } = require('./board');

/*
 * Assemble a board from the starter by replacing the example content. Used for fixtures and pilots; hand-editing
 * the starter is the ordinary authoring path. Everything outside the replaced blocks (chrome tokens, runtime,
 * primitives) is left exactly as the starter ships it, which is what the verifier checks.
 */
function buildBoard(spec, starterHtml = fs.readFileSync(STARTER_PATH, 'utf8')) {
  let html = starterHtml;
  html = html.replace(/<html lang="en" data-board-id="BOARD_ID" data-board-version="1" data-board-issued="false">/, `<html lang="en" data-board-id="${spec.id}" data-board-version="${spec.version || 1}" data-board-issued="false">`);
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escape(spec.title)} — variant board</title>`);
  html = html.replace(/  :root \{\n    --app-background[\s\S]*?\n  \}\n/, `  :root {\n${Object.keys(spec.appTokens).map((k) => `    ${k}: ${spec.appTokens[k]};`).join('\n')}\n  }\n`);
  if (spec.appDarkTokens) {
    html = html.replace(/(  \/\* Host dark-mode rules)/, `  [data-app-scheme="dark"] {\n${Object.keys(spec.appDarkTokens).map((k) => `    ${k}: ${spec.appDarkTokens[k]};`).join('\n')}\n  }\n$1`);
  }
  const facts = spec.facts;
  const masthead = `  <header class="masthead">
    <p class="eyebrow">${escape(spec.eyebrow)}</p>
    <h1>${escape(spec.title)}</h1>
    <p class="lede">${spec.lede}</p>
    <dl class="facts">
      <div><dt>Source of truth</dt><dd data-fact="source-of-truth"><code>${escape(facts.sourceOfTruth)}</code></dd></div>
      <div><dt>Read against</dt><dd data-fact="read-against"><code>${escape(facts.readAgainst)}</code></dd></div>
      <div><dt>Theme source</dt><dd data-fact="theme-source"><code>${escape(facts.themeSource)}</code></dd></div>
      <div><dt>Version</dt><dd data-fact="version"><span class="stamp" data-issued="false">v${spec.version || 1} · ${facts.date} · working</span></dd></div>
      <div><dt>Status</dt><dd data-fact="status">${escape(facts.status)}</dd></div>
      <div><dt>Design tokens</dt><dd data-fact="tokens">${escape(facts.tokens)}</dd></div>
    </dl>
  </header>`;
  html = html.replace(/  <header class="masthead">[\s\S]*?<\/header>/, masthead);
  html = html.replace(/  <!-- One <section class="board-section"[\s\S]*?<\/section>\n(?=\n  <section class="board-section" id="revisions">)/, `${spec.sectionsHtml.trimEnd()}\n`);
  const revisions = spec.revisions.map((r) => `      <li data-version="${r.version}" data-type="${r.type}" data-date="${r.date}" data-author="${escape(r.author)}"${r.waives ? ` data-waives="${r.waives}"` : ''}><b>v${r.version}</b> · ${r.date} · <span class="who">${escape(r.author)}</span> · ${r.type}${r.amends ? ` (amends ${escape(r.amends)})` : ''} — ${r.text}</li>`).join('\n');
  html = html.replace(/    <ol class="revision-list" data-board-part="revisions">[\s\S]*?<\/ol>/, `    <ol class="revision-list" data-board-part="revisions">\n${revisions}\n    </ol>`);
  html = html.replace(/  <footer class="colophon"[\s\S]*?<\/footer>/, `  <footer class="colophon" id="colophon" data-board-part="colophon">
    <p>${spec.colophon.sources}</p>
    <p>Design tokens: <span data-colophon="tokens">${spec.colophon.tokens}</span>.</p>
    <p>File names, people and references are example fixtures. Prototype markup is a discussion aid, not an implementation.</p>
  </footer>`);
  html = html.replace(/<script type="application\/json" id="board-scenarios">[\s\S]*?<\/script>/, `<script type="application/json" id="board-scenarios">\n${JSON.stringify(spec.definition, null, 2)}\n</script>`);
  html = html.replace(/<!-- Board-specific tables and renderers[\s\S]*?<\/script>\n<\/body>/, `<!-- Board-specific tables and renderers. -->\n<script>\n${spec.script.trim()}\n</script>\n</body>`);
  return html;
}

function escape(value) {
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderTokenMap({ boardId, repo, themeFile, revision, rows, intro }) {
  const lines = [`# Token map — ${boardId}`, '', intro || 'Produced from the theme source; the board\'s `--app-*` block equals this table.', '', `- Repo: \`${repo}\``, `- Theme file: \`${themeFile}\``, `- Revision: \`${revision}\``, '', '| Board token | Source token | File | Mode | Revision | Value | Status | Note |', '|---|---|---|---|---|---|---|---|'];
  rows.forEach((r) => lines.push(`| \`${r.boardToken}\` | \`${r.sourceToken}\` | \`${r.file || themeFile}\` | ${r.mode || 'light'} | \`${r.revision || revision}\` | \`${r.value}\` | ${r.status} | ${r.note || ''} |`));
  return `${lines.join('\n')}\n`;
}

function renderBrief(brief) {
  const lines = [`# Board brief — ${brief.title}`, '', `- Board id: \`${brief.id}\``, `- Product: ${brief.product}`, `- Repo path: \`${brief.repo}\``, `- Surface: \`${brief.surface}\``, `- Source of truth: \`${brief.sourceOfTruth}\``, `- Read against: \`${brief.readAgainst}\``, `- Purpose: ${brief.purposes.join(', ')}`, `- Theme source: \`${brief.themeSource}\``, `- Open questions: ${brief.openQuestions || 'none'}`, `- Predecessors: ${brief.predecessors || 'none'}`, '', '## Sections', '', '| Section id | Heading | Purpose |', '|---|---|---|'];
  brief.sections.forEach((s) => lines.push(`| \`${s.id}\` | ${s.heading} | ${s.purposes.join(', ')} |`));
  lines.push('', '## Scenarios', '', '| Section | Scenario | Expected visible result |', '|---|---|---|');
  (brief.scenarios || []).forEach((s) => lines.push(`| \`${s.section}\` | \`${s.hash}\` | ${s.expected} |`));
  if (brief.themeEvidence) lines.push('', '## Theme evidence', '', brief.themeEvidence);
  if (brief.notes) lines.push('', '## Notes', '', brief.notes);
  return `${lines.join('\n')}\n`;
}

module.exports = { buildBoard, renderBrief, renderTokenMap };
