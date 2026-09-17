#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEXT_EXTENSIONS = new Set([".md", ".mdx", ".markdown", ".txt", ".rst"]);
const DEFAULT_MAX_WORDS = 30;

const word = (list) => new RegExp(`\\b(?:${list.join("|")})\\b`, "gi");

const LINE_RULES = [
  { id: "no-em-dash", message: "em dash, en dash, or double hyphen; end the sentence or use a comma", pattern: /—|–|(?<!-)--(?!-)/g },
  { id: "no-arrow-speak", message: "arrow in prose; write the verb", pattern: /->|→|=>/g },
  { id: "straight-quotes", message: "curly quote; use straight quotes", pattern: /[“”‘’]/g },
  { id: "no-slash-or", message: "and/or or (s) plural; write the alternatives out", pattern: /\band\/or\b|\(s\)/gi },
  {
    id: "no-filler",
    message: "filler phrase; delete or shorten",
    pattern: word([
      "in order to", "it is important to note( that)?", "it'?s worth noting( that)?", "it should be noted( that)?",
      "as (previously )?mentioned( above)?", "at the end of the day", "please note( that)?", "due to the fact that",
      "in the event that", "for all intents and purposes", "needless to say", "basically", "essentially",
    ]),
  },
  {
    id: "no-hedge-stack",
    message: "stacked hedge; keep one, or state the uncertainty",
    pattern: /\b(?:could|might|may)\s+(?:potentially|possibly)\b|\bpotentially possibly\b|\bit (?:could|might) be argued\b/gi,
  },
  {
    id: "no-ai-vocab",
    message: "AI vocabulary; use the plain word",
    pattern: word([
      "delve(?:s|d)?", "leverag(?:e|es|ed|ing)", "utiliz(?:e|es|ed|ing)", "seamless(?:ly)?", "crucial(?:ly)?", "pivotal",
      "showcas(?:e|es|ed|ing)", "foster(?:s|ed|ing)?", "garner(?:s|ed)?", "tapestry", "testament", "vibrant", "intricate",
      "elevat(?:e|es|ed|ing)", "empower(?:s|ed|ing)?", "holistic", "cutting-edge", "game-changer", "myriad", "realm",
      "enhanc(?:e|es|ed|ing)", "facilitat(?:e|es|ed|ing)", "numerous",
    ]),
  },
  {
    id: "no-metaphor-noun",
    message: "metaphor noun; name the concrete thing",
    pattern: word(["substrate", "north star", "flywheel", "bedrock", "nexus", "paradigm", "endgame"]),
  },
  { id: "no-not-just", message: "'not just X but Y'; state the point", pattern: /\bnot (?:just|only|merely)\b[^.!?\n]{1,80}?\bbut(?: also)?\b/gi },
  { id: "plain-is", message: "fancy 'is'; say is or has", pattern: /\b(?:serves as|stands as|boasts|acts as)\b/gi },
  {
    id: "no-chatbot",
    message: "chatbot phrase; delete",
    pattern: /\bI hope this helps\b|\blet me know if\b|\bfeel free to\b|\bhappy to help\b|(?:^|\s)(?:Certainly|Of course|Absolutely)!/gi,
  },
  {
    id: "no-sycophancy",
    message: "praise of the question or reader; respond to the content",
    pattern: /\b(?:great|excellent|good) (?:question|point|catch)\b|\byou(?:'re| are) absolutely right\b/gi,
  },
  {
    id: "no-narration",
    message: "session narration; describe the result, not the steps",
    pattern: /(?:^|[.!?]\s+)(?:Let me|Let's|Now I(?:'ll| will)?|I(?:'ll| will) now|First,? I|Next,? I|I(?:'ve| have) now|Going ahead|I(?:'ll| will) go ahead)\b/g,
    afterMarker: true,
  },
  { id: "bold-leadin-only", message: "bold label with colon; use a sentence or a bold lead-in ending in a period", pattern: /\*\*[^*\n]{1,60}:\*\*|\*\*[^*\n]{1,60}\*\*:/g },
  { id: "active-voice", message: "passive with named actor; make the actor the subject", pattern: /\b(?:is|are|was|were|been|being)\s+\w+(?:ed|en)\s+by\b(?!\s+default\b)/gi },
  { id: "no-decorative-emoji", message: "emoji in a heading or bullet; remove", pattern: /\p{Extended_Pictographic}|\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3/gu, markerLinesOnly: true },
];

const FENCE = /^[ \t]*(`{3,}|~{3,})(.*)$/;
const MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/;
const HEADING = /^\s*#{1,6}\s+/;
const TABLE_ROW = /^\s*\|/;
const THEMATIC_BREAK = /^ {0,3}(?:(?:-\s*){3,}|(?:_\s*){3,}|(?:\*\s*){3,})$/;

function stripInlineCode(line) {
  let out = "";
  let index = 0;
  while (index < line.length) {
    if (line[index] !== "`") { out += line[index]; index += 1; continue; }
    let length = 0;
    while (line[index + length] === "`") length += 1;
    let cursor = index + length;
    let close = -1;
    while (cursor < line.length) {
      if (line[cursor] !== "`") { cursor += 1; continue; }
      let run = 0;
      while (line[cursor + run] === "`") run += 1;
      if (run === length) { close = cursor; break; }
      cursor += run;
    }
    if (close === -1) { out += line.slice(index, index + length); index += length; continue; }
    out += " ".repeat(close + length - index);
    index = close + length;
  }
  return out;
}

function stripLinkDestinations(line) {
  let brackets = 0;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === "\\") { index += 1; continue; }
    if (line[index] === "[") brackets += 1;
    if (line[index] !== "]" || brackets === 0) continue;
    brackets -= 1;
    if (line[index + 1] !== "(") continue;
    let depth = 1;
    let quote = null;
    let angle = false;
    for (let cursor = index + 2; cursor < line.length; cursor += 1) {
      const char = line[cursor];
      if (char === "\\") { cursor += 1; continue; }
      if (quote) { if (char === quote) quote = null; continue; }
      if (angle) { if (char === ">") angle = false; continue; }
      if (char === "<") { angle = true; continue; }
      if ((char === '"' || char === "'") && /\s/.test(line[cursor - 1])) { quote = char; continue; }
      if (char === "(") depth += 1;
      if (char !== ")" || --depth !== 0) continue;
      line = line.slice(0, index + 1) + " ".repeat(cursor - index) + line.slice(cursor + 1);
      index = cursor;
      break;
    }
  }
  return line;
}

function stripUrls(line) {
  return stripLinkDestinations(line).replace(/\bhttps?:\/\/\S+/g, (match) => " ".repeat(match.length));
}

function quoteContent(raw, limit = Infinity) {
  let text = raw;
  let depth = 0;
  while (depth < limit) {
    const marker = text.match(/^ {0,3}>[ \t]?/);
    if (!marker) break;
    text = text.slice(marker[0].length);
    depth += 1;
  }
  return { text, depth };
}

function proseLines(lines) {
  const result = [];
  let fence = null;
  let listIndents = [];
  let listQuoteDepth = 0;
  const frontmatterEnd = lines[0]?.trim() === "---"
    ? lines.findIndex((line, index) => index > 0 && line.trim() === "---")
    : -1;
  for (const [index, raw] of lines.entries()) {
    if (index <= frontmatterEnd) continue;
    if (fence) {
      const content = quoteContent(raw, fence.quoteDepth);
      const indent = content.text.match(/^[ \t]*/)[0].length;
      if (content.depth < fence.quoteDepth || (content.text.trim() && indent < fence.indent)) {
        fence = null;
      } else {
        const close = content.text.slice(fence.indent).match(FENCE);
        if (close && close[1][0] === fence.char && close[1].length >= fence.length && close[2].trim() === "") fence = null;
        continue;
      }
    }
    const content = quoteContent(raw);
    const indent = content.text.match(/^[ \t]*/)[0].length;
    if (content.depth !== listQuoteDepth) listIndents = [];
    listQuoteDepth = content.depth;
    if (content.text.trim()) {
      while (listIndents.length && indent < listIndents.at(-1)) listIndents.pop();
    }
    const listMarker = content.text.match(MARKER);
    if (listMarker) listIndents.push(listMarker[0].length);
    const fenceText = listMarker ? content.text.slice(listMarker[0].length) : content.text;
    const match = fenceText.match(FENCE);
    if (match && !(match[1][0] === "`" && match[2].includes("`"))) {
      fence = {
        char: match[1][0], length: match[1].length, quoteDepth: content.depth,
        indent: listIndents.at(-1) ?? (indent > 3 ? indent : 0),
      };
      continue;
    }
    if (THEMATIC_BREAK.test(raw)) continue;
    const text = stripUrls(stripInlineCode(raw));
    result.push({ line: index + 1, raw, text, heading: HEADING.test(raw), table: TABLE_ROW.test(raw), marker: MARKER.test(raw) });
  }
  return result;
}

function sentences(paragraph) {
  const out = [];
  let start = 0;
  const joined = paragraph.map((entry) => entry.text.replace(MARKER, "").replace(HEADING, "").trim()).join(" ");
  const offsets = [];
  let cursor = 0;
  for (const entry of paragraph) {
    const length = entry.text.replace(MARKER, "").replace(HEADING, "").trim().length;
    offsets.push({ from: cursor, line: entry.line });
    cursor += length + 1;
  }
  const lineAt = (offset) => offsets.reduce((line, item) => (offset >= item.from ? item.line : line), paragraph[0].line);
  const append = (end) => {
    const raw = joined.slice(start, end);
    const leading = raw.search(/\S/);
    if (leading !== -1) {
      out.push({ text: raw.trim(), line: lineAt(start + leading), endLine: lineAt(start + raw.trimEnd().length - 1) });
    }
  };
  const boundary = /[.!?]["'’”)\]}*_]*(?=\s|$)/g;
  let match;
  while ((match = boundary.exec(joined)) !== null) {
    const end = match.index + match[0].length;
    if (match[0][0] === ".") {
      const before = joined.slice(0, match.index + 1);
      const after = joined.slice(end).trimStart();
      if (after && /\b(?:e\.g|i\.e|vs|cf|approx)\.$/i.test(before)) continue;
      // "etc." can end a sentence; lowercase or numeric text signals a continuation.
      if (/\betc\.$/i.test(before) && /^[a-z0-9]/.test(after)) continue;
    }
    append(end);
    start = end;
  }
  append(joined.length);
  return out;
}

const countWords = (text) => (text.match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g) ?? []).length;

export function scanText(text, options = {}) {
  const maxWords = options.maxWords ?? DEFAULT_MAX_WORDS;
  const file = options.file ?? "<stdin>";
  const hits = [];
  const lines = proseLines(text.split(/\r?\n/));

  for (const entry of lines) {
    const subjects = entry.table ? entry.text.split(/(?<!\\)\|/).map((cell) => cell.trim()) : [entry.text];
    for (const text of subjects) {
      for (const rule of LINE_RULES) {
        if (rule.markerLinesOnly && !(entry.marker || entry.heading)) continue;
        const subject = rule.afterMarker ? text.replace(MARKER, "").replace(HEADING, "").trimStart() : text;
        rule.pattern.lastIndex = 0;
        let match;
        while ((match = rule.pattern.exec(subject)) !== null) {
          hits.push({ file, line: entry.line, rule: rule.id, message: rule.message, snippet: match[0].trim() });
          if (!rule.pattern.global) break;
        }
      }
    }
  }

  let words = 0;
  let paragraph = [];
  const flush = () => {
    if (paragraph.length === 0) return;
    for (const sentence of sentences(paragraph)) {
      const count = countWords(sentence.text);
      words += count;
      if (count > maxWords) {
        hits.push({ file, line: sentence.line, endLine: sentence.endLine, rule: "one-idea", message: `${count}-word sentence; split it (limit ${maxWords})`, snippet: `${sentence.text.slice(0, 60)}...` });
      }
    }
    paragraph = [];
  };
  for (const entry of lines) {
    if (paragraph.length > 0 && entry.line !== paragraph.at(-1).line + 1) flush();
    if (entry.table) { flush(); words += countWords(entry.text); continue; }
    if (entry.text.trim() === "") { flush(); continue; }
    if (entry.heading) { flush(); paragraph.push(entry); flush(); continue; }
    if (entry.marker) flush();
    paragraph.push(entry);
  }
  flush();

  if (options.budget && words > options.budget) {
    hits.push({ file, line: 0, rule: "surface-budget", message: `${words} words; budget is ${options.budget}`, snippet: "" });
  }
  hits.sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule));
  return { file, words, hits };
}

function parsePatchPath(header) {
  if (!header.startsWith('"')) return header.split("\t", 1)[0];
  // Git quotes UTF-8 bytes with octal escapes, plus C escapes for control characters.
  const escapes = { a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13, '"': 34, "\\": 92 };
  const bytes = [];
  let index = 1;
  while (index < header.length) {
    const char = header[index];
    if (char === '"') return Buffer.from(bytes).toString("utf8");
    if (char !== "\\") {
      const literal = String.fromCodePoint(header.codePointAt(index));
      bytes.push(...Buffer.from(literal));
      index += literal.length;
      continue;
    }
    index += 1;
    const octal = header.slice(index).match(/^[0-7]{3}/);
    if (octal) {
      bytes.push(parseInt(octal[0], 8));
      index += 3;
    } else if (Object.hasOwn(escapes, header[index])) {
      bytes.push(escapes[header[index]]);
      index += 1;
    } else {
      throw new Error("Invalid escape in Git patch path");
    }
  }
  throw new Error("Unclosed Git patch path");
}

export function parseStagedDiff(diff) {
  const files = new Map();
  let current = null;
  let line = 0;
  let oldRemaining = 0;
  let newRemaining = 0;
  for (const raw of diff.split("\n")) {
    if (raw.startsWith("diff --git ")) {
      current = null;
      oldRemaining = 0;
      newRemaining = 0;
      continue;
    }
    if (oldRemaining === 0 && newRemaining === 0 && raw.startsWith("+++ ")) {
      const name = parsePatchPath(raw.slice(4)).replace(/^b\//, "");
      current = name === "/dev/null" || !TEXT_EXTENSIONS.has(path.extname(name).toLowerCase()) ? null : name;
      if (current) files.set(current, []);
      continue;
    }
    const hunk = raw.match(/^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (hunk) {
      oldRemaining = Number(hunk[1] ?? 1);
      line = Number(hunk[2]);
      newRemaining = Number(hunk[3] ?? 1);
      continue;
    }
    if (oldRemaining === 0 && newRemaining === 0) continue;
    if (raw.startsWith("+")) {
      if (current) files.get(current).push({ line, text: raw.slice(1) });
      line += 1;
      newRemaining -= 1;
    } else if (raw.startsWith("-")) {
      oldRemaining -= 1;
    } else if (raw.startsWith(" ")) {
      line += 1;
      oldRemaining -= 1;
      newRemaining -= 1;
    }
  }
  return files;
}

function runGit(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.error) throw new Error(`git ${args[0]} failed: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`git ${args[0]} failed: ${result.stderr?.trim() || `exit ${result.status}`}`);
  }
  return result.stdout;
}

function readIndexFile(file) {
  return runGit(["show", `:${file}`]);
}

export function scanStaged(diff, readFile, options) {
  const results = [];
  for (const [file, added] of parseStagedDiff(diff)) {
    if (added.length === 0) continue;
    const result = scanText(readFile(file), { ...options, file });
    result.hits = result.hits.filter((hit) => hit.line === 0 || added.some(
      ({ line }) => line >= hit.line && line <= (hit.endLine ?? hit.line),
    ));
    results.push(result);
  }
  return results;
}

export function parseArgs(argv) {
  const options = { files: [], stdin: false, staged: false, json: false, maxWords: DEFAULT_MAX_WORDS, budget: 0 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--stdin") options.stdin = true;
    else if (arg === "--staged") options.staged = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--max-words") options.maxWords = Number(argv[++index]);
    else if (arg === "--budget") options.budget = Number(argv[++index]);
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg.startsWith("--")) throw new Error(`unknown option ${arg}`);
    else options.files.push(arg);
  }
  if (!options.stdin && !options.staged && options.files.length === 0) options.help = true;
  if (!Number.isInteger(options.maxWords) || options.maxWords < 5) throw new Error("--max-words needs an integer of at least 5");
  if (!Number.isInteger(options.budget) || options.budget < 0) throw new Error("--budget needs a non-negative integer");
  return options;
}

const USAGE = `usage: scan.mjs [--max-words N] [--budget N] [--json] (<file>... | --stdin | --staged)

Flags mechanical unslop catalog hits with line numbers. Skips fenced code, inline code, and URLs.\nStaged mode scans each staged text file in full and reports hits whose line range overlaps added lines.
Exit 1 when there are hits, 0 when clean, 2 on a usage or runtime error.`;

function format(results) {
  const lines = [];
  for (const result of results) {
    for (const hit of result.hits) {
      const location = hit.line === 0 ? result.file : `${result.file}:${hit.line}`;
      lines.push(`${location}: ${hit.rule}: ${hit.message}${hit.snippet ? ` | ${hit.snippet}` : ""}`);
    }
  }
  const total = results.reduce((sum, result) => sum + result.hits.length, 0);
  const words = results.reduce((sum, result) => sum + result.words, 0);
  lines.push(`${total} hit${total === 1 ? "" : "s"} in ${words} words`);
  return lines.join("\n");
}

export function runCli(argv, io = {}) {
  const stdout = io.stdout ?? ((text) => process.stdout.write(`${text}\n`));
  const stderr = io.stderr ?? ((text) => process.stderr.write(`${text}\n`));
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    stderr(error.message);
    return 2;
  }
  if (options.help) { stdout(USAGE); return 2; }

  const results = [];
  const scanOptions = { maxWords: options.maxWords, budget: options.budget };
  try {
    for (const file of options.files) {
      results.push(scanText(fs.readFileSync(file, "utf8"), { ...scanOptions, file }));
    }
    if (options.stdin) {
      results.push(scanText(io.readStdin ? io.readStdin() : fs.readFileSync(0, "utf8"), { ...scanOptions, file: "<stdin>" }));
    }
    if (options.staged) {
      const diff = io.readStagedDiff
        ? io.readStagedDiff()
        : runGit(["diff", "--cached", "--no-color", "--unified=0", "--src-prefix=a/", "--dst-prefix=b/"]);
      results.push(...scanStaged(diff, io.readStagedFile ?? readIndexFile, scanOptions));
    }
  } catch (error) {
    stderr(error.message);
    return 2;
  }

  stdout(options.json ? JSON.stringify(results, null, 2) : format(results));
  return results.some((result) => result.hits.length > 0) ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(runCli(process.argv.slice(2)));
}
