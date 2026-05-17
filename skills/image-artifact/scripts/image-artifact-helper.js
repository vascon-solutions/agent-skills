#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const KIND_FILENAMES = {
  'summary-card': 'summary',
  'comparison-board': 'comparison-board',
  'ui-variant-board': 'variant-board',
  'architecture-diagram': 'architecture',
  'api-flow': 'api-flow',
  'concept-poster': 'poster',
  'decision-board': 'decision-board',
  'prompt-pack': 'image-prompts',
};

function usage(exitCode = 0) {
  const out = exitCode === 0 ? process.stdout : process.stderr;
  out.write(`Usage:
  image-artifact-helper.js prompt-pack <source.md> [--workspace <slug-or-path>] [--out <path>] [--kind <kind>] [--variants <n>] [--format png|svg] [--repo-design <summary>]
  image-artifact-helper.js prompt-plan <source.md> [--workspace <slug-or-path>] [--out <path>] [--kind <kind>] [--variants <n>] [--format png|svg] [--repo-design <summary>]
  image-artifact-helper.js metadata <workspace> --source <source.md> --output <image-or-prompt> --kind <kind> [--tool <name>] [--repo-design <summary>]
  image-artifact-helper.js validate <image-file> [<image-file>...]

Deterministic helper for image-artifact. It does not generate images.
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') usage(0);
  const command = argv[0];
  const positionals = [];
  const flags = {};
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') usage(0);
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
    } else {
      positionals.push(arg);
    }
  }
  return { command, positionals, flags };
}

function die(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function expandHome(value) {
  if (!value) return value;
  if (value === '~') return process.env.HOME;
  if (value.startsWith('~/')) return path.join(process.env.HOME, value.slice(2));
  return value;
}

function slugify(value) {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/-{2,}/g, '-');
  return slug || `artifact-${new Date().toISOString().slice(0, 10)}`;
}

function extractTitle(markdown, fallback) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

function readSource(sourceArg) {
  const sourcePath = path.resolve(expandHome(sourceArg));
  if (!fs.existsSync(sourcePath)) die(`Source file not found: ${sourcePath}`);
  return {
    sourcePath,
    markdown: fs.readFileSync(sourcePath, 'utf8'),
    stem: path.basename(sourcePath, path.extname(sourcePath)),
  };
}

function sourceWorkspace(sourcePath) {
  const parts = sourcePath.split(path.sep);
  const marker = parts.indexOf('agent-artifacts');
  const markdownIndex = parts.indexOf('markdown');
  if (marker >= 0 && markdownIndex === marker + 2) {
    return path.sep + path.join(...parts.slice(1, marker + 2));
  }
  return null;
}

function findRepoRoot(sourcePath) {
  let dir = fs.statSync(sourcePath).isDirectory() ? sourcePath : path.dirname(sourcePath);
  while (dir && dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

function resolveWorkspace(flags, sourcePath, markdown) {
  if (flags.workspace) {
    const raw = expandHome(flags.workspace);
    if (raw.includes('/') || raw.startsWith('.') || raw.startsWith('~')) return path.resolve(raw);
    return path.join(process.env.HOME, 'agent-artifacts', raw);
  }
  const fromSource = sourceWorkspace(sourcePath);
  if (fromSource) return fromSource;
  const repoRoot = findRepoRoot(sourcePath);
  if (repoRoot) {
    const repoName = path.basename(repoRoot);
    const sourceStem = path.basename(sourcePath, path.extname(sourcePath));
    return path.join(process.env.HOME, 'agent-artifacts', slugify(`${repoName}-${sourceStem}`));
  }
  return path.join(process.env.HOME, 'agent-artifacts', slugify(extractTitle(markdown, path.basename(sourcePath, path.extname(sourcePath)))));
}

function inferKind(markdown, explicitKind) {
  if (explicitKind) return explicitKind;
  const text = markdown.toLowerCase();
  const hasUi = /\b(ui|component|screen|flow|responsive|state|props?)\b/.test(text);
  const hasVariants = /\b(variant|option|approach|tradeoff|comparison|alternative|state)\b/.test(text);
  if (hasUi && hasVariants) return 'ui-variant-board';
  if (hasUi) return 'summary-card';
  if (/\b(endpoint|route|request|response|actor|api)\b/.test(text)) return 'api-flow';
  if (/\b(architecture|service|queue|database|data flow|integration|system)\b/.test(text)) return 'architecture-diagram';
  if (/\b(option|tradeoff|comparison|alternative|decision)\b/.test(text)) return 'comparison-board';
  if (/\b(product|business|campaign|concept|idea)\b/.test(text)) return 'concept-poster';
  return 'summary-card';
}

function targetBaseName(stem, kind) {
  return `${stem}-${KIND_FILENAMES[kind] || kind}`;
}

function outputExtension(flags) {
  const format = flags.format || 'png';
  if (!['png', 'svg'].includes(format)) die(`Unsupported --format: ${format}`);
  return format;
}

function resolvePromptOutput(flags, source, workspace, command) {
  const out = flags.out ? path.resolve(expandHome(flags.out)) : null;
  const defaultName = command === 'prompt-pack' ? `${source.stem}-image-prompts.md` : `${source.stem}-prompt-plan.md`;
  if (!out) return path.join(workspace, 'images', defaultName);
  if ((fs.existsSync(out) && fs.statSync(out).isDirectory()) || out.endsWith(path.sep)) {
    return path.join(out, defaultName);
  }
  return out;
}

function extractBullets(markdown, limit) {
  return markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim())
    .filter(Boolean)
    .slice(0, limit);
}

function variantNames(markdown, flags, kind) {
  const requested = Math.min(Number(flags.variants || 0) || 0, 6);
  const headings = [...markdown.matchAll(/^#{2,3}\s+(Variant|Option|Approach)\s*([A-Z0-9-]*)?\s*[-:–]?\s*(.+)?$/gim)]
    .map((match, index) => `${match[1]} ${match[2] || String.fromCharCode(65 + index)}${match[3] ? ` - ${match[3].trim()}` : ''}`.trim());
  if (headings.length) return headings.slice(0, requested || headings.length);
  if (requested) return Array.from({ length: requested }, (_, index) => `Variant ${String.fromCharCode(65 + index)}`);
  if (kind === 'ui-variant-board') return ['Variant A', 'Variant B', 'Variant C'];
  return [];
}

function visualStyle(kind, repoDesign) {
  const base = {
    'summary-card': 'clean editorial summary card with strong hierarchy and minimal text',
    'comparison-board': 'structured comparison board with clear option columns and concise labels',
    'ui-variant-board': 'UI variant board with distinct layouts, states, and tradeoff labels',
    'architecture-diagram': 'architecture diagram with labeled services, data flow arrows, and restrained styling',
    'api-flow': 'API flow diagram with actors, requests, responses, and state transitions',
    'concept-poster': 'concept poster with one strong message and supporting visual cues',
    'decision-board': 'decision board with options, criteria, recommendation, and risks',
    'prompt-pack': 'prompt pack',
  }[kind] || 'clean visual artifact';
  return repoDesign ? `${base}; repo design context: ${repoDesign}` : base;
}

function buildPromptPlan(source, kind, flags) {
  const title = extractTitle(source.markdown, source.stem);
  const bullets = extractBullets(source.markdown, 6);
  const variants = variantNames(source.markdown, flags, kind);
  const repoDesign = flags['repo-design'] || 'not scanned or not provided';
  const extension = outputExtension(flags);
  const assumptions = [];
  if (!flags.kind) assumptions.push(`Output kind inferred as \`${kind}\`.`);
  if (repoDesign === 'not scanned or not provided') assumptions.push('Neutral visual direction; no repo design context applied.');
  if (extension === 'svg') assumptions.push('Static exact-text output should be hand-written as deterministic SVG with real SVG text.');
  const lines = [
    `# ${title} Image Prompt Plan`,
    '',
    `## Source File`,
    '',
    `\`${source.sourcePath}\``,
    '',
    `## Output Kind`,
    '',
    kind,
    '',
    `## Target Audience`,
    '',
    'Readers of the source Markdown who need a faster visual summary.',
    '',
    `## Key Message`,
    '',
    bullets[0] || title,
    '',
    `## Visual Style`,
    '',
    visualStyle(kind, repoDesign),
    '',
    `## Required Elements`,
    '',
    ...(bullets.length ? bullets.map((item) => `- ${item}`) : ['- Title and central message from the source Markdown']),
    '',
    `## Optional Elements`,
    '',
    '- Icons or simple shapes when supported by the active image tool',
    '- Short labels instead of paragraphs',
    '',
    `## Text To Avoid Or Keep Minimal`,
    '',
    '- Avoid dense paragraphs inside the generated image',
    '- Keep detailed explanation in Markdown or HTML companions',
    '',
    `## Assumptions`,
    '',
    ...(assumptions.length ? assumptions.map((item) => `- ${item}`) : ['- None']),
    '',
    `## Suggested Filenames`,
    '',
    `- \`${targetBaseName(source.stem, kind)}.${extension}\``,
    '',
  ];
  if (variants.length) {
    lines.push('## Variants', '');
    variants.forEach((name) => {
      lines.push(`### ${name}`, '', '- Purpose:', '- Visual emphasis:', '- Layout:', '- Tradeoff:', '');
    });
  }
  return lines.join('\n');
}

function buildPromptPack(source, kind, flags) {
  const plan = buildPromptPlan(source, kind, flags);
  const variants = variantNames(source.markdown, flags, kind);
  const prompts = variants.length ? variants : [kind];
  const extension = outputExtension(flags);
  const promptLines = prompts.map((name, index) => {
    const label = variants.length ? name : kind;
    return [
      `## Prompt ${index + 1} - ${label}`,
      '',
      `Create a ${kind} from the source Markdown. Use the key message, required elements, assumptions, and visual style from the prompt plan. Keep text concise and preserve Markdown as the source of truth.`,
      '',
      `Suggested filename: \`${variants.length ? `${source.stem}-${slugify(label)}.${extension}` : `${targetBaseName(source.stem, kind)}.${extension}`}\``,
      '',
    ].join('\n');
  });
  return `${plan}\n## Image Prompts\n\n${promptLines.join('\n')}`;
}

function writePromptArtifact(command, args) {
  if (args.positionals.length < 1) usage(1);
  const source = readSource(args.positionals[0]);
  const explicitKind = args.flags.kind === 'prompt-pack' ? null : args.flags.kind;
  const kind = inferKind(source.markdown, explicitKind);
  const workspace = resolveWorkspace(args.flags, source.sourcePath, source.markdown);
  const outPath = resolvePromptOutput(args.flags, source, workspace, command);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, command === 'prompt-pack' ? buildPromptPack(source, kind, args.flags) : buildPromptPlan(source, kind, args.flags));
  process.stdout.write(`Written: ${outPath} (${command})\n`);
}

function relativeToWorkspace(workspace, filePath) {
  const resolved = path.resolve(expandHome(filePath));
  const rel = path.relative(workspace, resolved);
  return rel.startsWith('..') ? resolved : rel;
}

function updateMarkdownArtifactTable(metadata, sourceRel, outputRel) {
  const lines = metadata.split('\n');
  const headerIndex = lines.findIndex((line) => /\|\s*Type\s*\|\s*Markdown\s*\|\s*HTML\s*\|\s*Images\s*\|/.test(line));
  if (headerIndex < 0) return null;
  let insertIndex = headerIndex + 2;
  for (let i = headerIndex + 2; i < lines.length; i += 1) {
    if (!lines[i].trim().startsWith('|')) break;
    insertIndex = i + 1;
    const cells = lines[i].split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells[1] && cells[1].replace(/`/g, '') === sourceRel) {
      const existing = cells[3].replace(/`/g, '');
      const outputs = existing ? existing.split(',').map((item) => item.trim()).filter(Boolean) : [];
      if (!outputs.includes(outputRel)) outputs.push(outputRel);
      cells[3] = outputs.map((item) => `\`${item}\``).join(', ');
      lines[i] = `| ${cells.join(' | ')} |`;
      return lines.join('\n');
    }
  }
  lines.splice(insertIndex, 0, `| image-artifact | \`${sourceRel}\` | | \`${outputRel}\` |`);
  return lines.join('\n');
}

function updateMetadata(args) {
  const workspace = path.resolve(expandHome(args.positionals[0] || ''));
  if (!workspace || !fs.existsSync(workspace)) die(`Workspace not found: ${workspace}`);
  const source = args.flags.source;
  const output = args.flags.output;
  const kind = args.flags.kind || 'summary-card';
  if (!source || !output) die('metadata requires --source and --output');
  const metadataPath = path.join(workspace, 'metadata.md');
  const sourceRel = relativeToWorkspace(workspace, source);
  const outputRel = relativeToWorkspace(workspace, output);
  let metadata = fs.existsSync(metadataPath) ? fs.readFileSync(metadataPath, 'utf8') : '';
  const updated = updateMarkdownArtifactTable(metadata, sourceRel, outputRel);
  if (updated) {
    metadata = updated;
  } else {
    const tool = args.flags.tool || 'unknown';
    const repoDesign = args.flags['repo-design'];
    const header = metadata.trim() ? `${metadata.trim()}\n\n` : `# Image Artifact Metadata\n\n`;
    const tableHeader = repoDesign
      ? '| Type | Source | Output | Tool | Repo Design |\n|---|---|---|---|---|\n'
      : '| Type | Source | Output | Tool |\n|---|---|---|---|\n';
    const row = repoDesign
      ? `| ${kind} | \`${sourceRel}\` | \`${outputRel}\` | \`${tool}\` | \`${repoDesign}\` |\n`
      : `| ${kind} | \`${sourceRel}\` | \`${outputRel}\` | \`${tool}\` |\n`;
    metadata = `${header}## Artifacts\n\n${tableHeader}${row}`;
  }
  if (args.flags['repo-design'] && /\|\s*Type\s*\|\s*Markdown\s*\|\s*HTML\s*\|\s*Images\s*\|/.test(metadata)) {
    metadata = `${metadata.trim()}\n\nRepo design context: ${args.flags['repo-design']}\n`;
  }
  fs.writeFileSync(metadataPath, metadata.endsWith('\n') ? metadata : `${metadata}\n`);
  process.stdout.write(`Updated: ${metadataPath}\n`);
}

function imageInfo(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length === 0) throw new Error('empty file');
  const textHead = buffer.slice(0, 512).toString('utf8').trimStart();
  if (/^(<\?xml\b[^>]*>\s*)?<svg\b/i.test(textHead)) {
    const text = buffer.toString('utf8');
    const svgTag = text.match(/<svg\b[^>]*>/i);
    const tag = svgTag ? svgTag[0] : '';
    const widthMatch = tag.match(/\bwidth=["']?([0-9.]+)/i);
    const heightMatch = tag.match(/\bheight=["']?([0-9.]+)/i);
    const viewBoxMatch = tag.match(/\bviewBox=["']\s*[-0-9.]+\s+[-0-9.]+\s+([0-9.]+)\s+([0-9.]+)\s*["']/i);
    const width = widthMatch ? Number(widthMatch[1]) : viewBoxMatch ? Number(viewBoxMatch[1]) : null;
    const height = heightMatch ? Number(heightMatch[1]) : viewBoxMatch ? Number(viewBoxMatch[2]) : null;
    return { mime: 'image/svg+xml', width, height };
  }
  if (buffer.length >= 24 && buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length >= 10 && (buffer.slice(0, 6).toString('ascii') === 'GIF87a' || buffer.slice(0, 6).toString('ascii') === 'GIF89a')) {
    return { mime: 'image/gif', width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  if (buffer.length >= 12 && buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') {
    return { mime: 'image/webp', width: null, height: null };
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { mime: 'image/jpeg', width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      }
      offset += 2 + length;
    }
    return { mime: 'image/jpeg', width: null, height: null };
  }
  throw new Error('unrecognized image signature');
}

function validateImages(args) {
  if (!args.positionals.length) usage(1);
  for (const input of args.positionals) {
    const filePath = path.resolve(expandHome(input));
    if (!fs.existsSync(filePath)) die(`Image file not found: ${filePath}`);
    const stat = fs.statSync(filePath);
    const info = imageInfo(filePath);
    if (!info.width || !info.height) {
      process.stdout.write(`Validated: ${filePath} (${info.mime}, ${stat.size} bytes, dimensions unreadable)\n`);
    } else {
      process.stdout.write(`Validated: ${filePath} (${info.mime}, ${stat.size} bytes, ${info.width}x${info.height})\n`);
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'prompt-pack' || args.command === 'prompt-plan') {
    writePromptArtifact(args.command, args);
  } else if (args.command === 'metadata') {
    updateMetadata(args);
  } else if (args.command === 'validate') {
    validateImages(args);
  } else {
    die(`Unknown command: ${args.command}`);
  }
}

main();
