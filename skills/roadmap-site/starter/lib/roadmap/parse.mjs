export const STATUSES = ["todo", "in-progress", "blocked", "done", "deferred", "cancelled"];

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SEPARATOR_CELL = /^:?-+:?$/;

// GFM splits cells on every unescaped pipe, including pipes inside code spans.
function splitRow(line) {
  const cells = [];
  let i = line.search(/\S/);
  if (line[i] === "|") i += 1;
  let start = i;
  for (; i < line.length; i += 1) {
    if (line[i] === "\\") i += 1;
    else if (line[i] === "|") {
      cells.push({ start, raw: line.slice(start, i) });
      start = i + 1;
    }
  }
  if (line.slice(start).trim()) cells.push({ start, raw: line.slice(start) });
  return cells.map((cell) => ({ ...cell, text: cell.raw.trim() }));
}

function isTableLine(line) {
  return /^\s*\|/.test(line);
}

function isSeparator(line) {
  if (!isTableLine(line)) return false;
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((cell) => SEPARATOR_CELL.test(cell.text));
}

export function unbacktick(text) {
  return text.replace(/^`+|`+$/g, "").trim();
}

function headerKey(text) {
  return unbacktick(text.replace(/\*\*/g, "")).toLowerCase();
}

function emptyCell(text) {
  return !text || /^[—–-]+$/.test(text);
}

function linkTarget(text) {
  if (emptyCell(text)) return null;
  const markdown = /^\[[^\]]*\]\(([^)\s]+)\)$/.exec(text);
  return markdown ? markdown[1] : unbacktick(text);
}

/*
 * Returns the status word and its offset inside the raw cell, so a sync can replace that word and nothing else.
 */
export function parseStatusCell(raw) {
  const lead = raw.length - raw.trimStart().length;
  const text = raw.trim();
  if (!text) return { error: "status cell is empty" };
  let word;
  let offset;
  let rest;
  const ticked = /^`([^`]*)`/.exec(text);
  if (ticked) {
    word = ticked[1].trim();
    offset = lead + 1 + (ticked[1].length - ticked[1].trimStart().length);
    rest = text.slice(ticked[0].length);
  } else {
    const plain = /^[A-Za-z0-9][A-Za-z0-9_-]*/.exec(text);
    word = plain ? plain[0] : "";
    offset = lead;
    rest = text.slice(word.length);
  }
  const allowed = STATUSES.join(", ");
  if (!STATUSES.includes(word)) {
    if (ticked || !rest.trim()) return { error: `unknown status "${word || text}"; use one of ${allowed}` };
    return { error: `free-text status "${text}"; the cell must start with one of ${allowed}` };
  }
  return { status: word, offset, note: rest.replace(/^[\s—–:;,-]+/, "").trim() };
}

function tableColumns(headerCells) {
  const keys = headerCells.map((cell) => headerKey(cell.text));
  const find = (...names) => keys.findIndex((key) => names.includes(key));
  return {
    id: find("id", "#"),
    item: find("item"),
    status: find("status"),
    outcome: find("outcome"),
    link: find("task doc", "link"),
  };
}

/*
 * Parses the minimum source format. Never drops a row silently: every item-table row either becomes an item or an error
 * that names its line and id.
 */
export function parseRoadmap(text) {
  const lines = text.split("\n");
  const groups = [];
  const items = [];
  const errors = [];
  const seen = new Map();
  let group = null;
  let fence = null;
  let outcomeOpen = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].replace(/\r$/, "");
    const fenceMark = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      if (fenceMark && fenceMark[1][0] === fence[0] && fenceMark[1].length >= fence.length) fence = null;
      continue;
    }
    if (fenceMark) {
      fence = fenceMark[1];
      continue;
    }
    const heading = /^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/.exec(line);
    if (heading) {
      if (heading[1].length === 2 || heading[1].length === 3) {
        group = { title: heading[2], outcome: null, line: i + 1, items: [] };
        groups.push(group);
        outcomeOpen = true;
      }
      continue;
    }
    if (outcomeOpen && line.trim()) {
      outcomeOpen = false;
      const outcome = /^Outcome:\s*(.*\S)\s*$/.exec(line.trim());
      if (outcome && group) {
        group.outcome = outcome[1];
        continue;
      }
    }
    if (!isTableLine(line) || !isSeparator(lines[i + 1] || "")) continue;

    const columns = tableColumns(splitRow(line));
    let end = i + 2;
    while (end < lines.length && isTableLine(lines[end])) end += 1;
    const headerLine = i + 1;
    const rowIndexes = [];
    for (let r = i + 2; r < end; r += 1) rowIndexes.push(r);
    i = end - 1;

    if (columns.id < 0 || columns.item < 0) continue;
    if (columns.status < 0) {
      errors.push(`line ${headerLine}: table has ID and Item columns but no Status column`);
      continue;
    }
    if (!group) {
      errors.push(`line ${headerLine}: item table has no level 2 or 3 heading above it`);
      continue;
    }
    for (const r of rowIndexes) {
      const raw = lines[r].replace(/\r$/, "");
      const cells = splitRow(raw);
      const cell = (index) => (index >= 0 && cells[index] ? cells[index].text : "");
      const id = unbacktick(cell(columns.id));
      const where = `line ${r + 1} (row "${id}")`;
      if (!ID_PATTERN.test(id)) {
        errors.push(`${where}: malformed id; ids match [A-Za-z0-9][A-Za-z0-9._-]*`);
        continue;
      }
      if (seen.has(id)) {
        errors.push(`${where}: duplicate id, first used on line ${seen.get(id)}`);
        continue;
      }
      seen.set(id, r + 1);
      const statusCell = cells[columns.status];
      const status = statusCell ? parseStatusCell(statusCell.raw) : { error: "status cell is missing" };
      if (status.error) {
        errors.push(`${where}: ${status.error}`);
        continue;
      }
      const outcome = cell(columns.outcome);
      const item = {
        id,
        item: cell(columns.item),
        outcome: emptyCell(outcome) ? null : outcome,
        status: status.status,
        note: status.note,
        link: linkTarget(cell(columns.link)),
        line: r + 1,
        statusOffset: statusCell.start + status.offset,
      };
      group.items.push(item);
      items.push(item);
    }
  }

  return {
    groups: groups.filter((g) => g.items.length).map(({ title, outcome, items: groupItems }) => ({ title, outcome, items: groupItems })),
    items,
    errors,
  };
}

/* Replaces status words only; every other byte of the file is preserved. */
export function rewriteStatuses(text, changes) {
  const parsed = parseRoadmap(text);
  if (parsed.errors.length) throw new Error(`roadmap does not pass check:\n${parsed.errors.join("\n")}`);
  const lines = text.split("\n");
  for (const item of parsed.items) {
    if (!changes.has(item.id)) continue;
    const next = changes.get(item.id);
    if (!STATUSES.includes(next)) throw new Error(`unknown status "${next}" for ${item.id}`);
    const line = lines[item.line - 1];
    lines[item.line - 1] = line.slice(0, item.statusOffset) + next + line.slice(item.statusOffset + item.status.length);
  }
  return lines.join("\n");
}

export function snapshotGroups(parsed) {
  return parsed.groups.map((group) => ({
    title: group.title,
    outcome: group.outcome,
    items: group.items.map(({ id, item, outcome, status, note, link }) => ({ id, item, outcome, status, note, link })),
  }));
}
