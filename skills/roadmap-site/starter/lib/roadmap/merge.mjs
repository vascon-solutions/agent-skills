import { STATUSES } from "./parse.mjs";

/*
 * Three-way plan for `sync pull`. `repo` maps item id to the repo file's status; `pending` holds the site's page edits
 * ({ id, status, base }); `prefer` maps a conflicted or orphaned id to "repo" or "page".
 */
export function planPull({ repo, pending, prefer = new Map() }) {
  const plan = { apply: [], discard: [], conflicts: [], orphans: [], converged: [], ignoredPrefers: [] };
  const used = new Set();
  for (const edit of pending) {
    const choice = prefer.get(edit.id);
    if (!repo.has(edit.id)) {
      if (choice === "repo") {
        plan.discard.push(edit);
        used.add(edit.id);
      } else plan.orphans.push(edit);
      continue;
    }
    const current = repo.get(edit.id);
    const pageChanged = edit.status !== edit.base;
    const repoChanged = current !== edit.base;
    if (edit.status === current) plan.converged.push(edit);
    else if (pageChanged && !repoChanged) plan.apply.push({ id: edit.id, from: current, to: edit.status, edit });
    else if (!pageChanged) plan.discard.push(edit);
    else if (choice) {
      used.add(edit.id);
      if (choice === "page") plan.apply.push({ id: edit.id, from: current, to: edit.status, edit });
      else plan.discard.push(edit);
    } else plan.conflicts.push({ id: edit.id, base: edit.base, repo: current, page: edit.status });
  }
  for (const id of prefer.keys()) if (!used.has(id)) plan.ignoredPrefers.push(id);
  return plan;
}

/*
 * After a push, a pending edit is cleared only when the new repo status equals it. The rest stay pending with their
 * original base, so an edit made between pull and push is still compared against what it started from.
 */
export function clearPending(states, snapshotItems) {
  const repo = new Map(snapshotItems.map((item) => [item.id, item.status]));
  const clear = [];
  const keep = [];
  for (const state of states) {
    if (state.status == null) continue;
    if (repo.get(state.itemId) === state.status) clear.push(state);
    else keep.push(state);
  }
  return { clear, keep };
}

const LIMIT = 4000;

export function validateSnapshot(snapshot) {
  const errors = [];
  const text = (value, field, optional = true) => {
    if (value == null && optional) return;
    if (typeof value !== "string" || value.length > LIMIT) errors.push(`${field} must be a string of at most ${LIMIT} characters`);
  };
  if (!snapshot || typeof snapshot !== "object") return ["snapshot must be an object"];
  if (!/^[0-9a-f]{7,64}$/.test(snapshot.commit || "")) errors.push("snapshot.commit must be a commit sha");
  text(snapshot.author, "snapshot.author", false);
  text(snapshot.generatedAt, "snapshot.generatedAt", false);
  if (!Array.isArray(snapshot.groups)) return [...errors, "snapshot.groups must be an array"];
  const ids = new Set();
  snapshot.groups.forEach((group, g) => {
    text(group.title, `groups[${g}].title`, false);
    text(group.outcome, `groups[${g}].outcome`);
    if (!Array.isArray(group.items)) return errors.push(`groups[${g}].items must be an array`);
    group.items.forEach((item, i) => {
      const where = `groups[${g}].items[${i}]`;
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(item.id || "") || ids.has(item.id)) errors.push(`${where}.id is malformed or duplicated`);
      ids.add(item.id);
      if (!STATUSES.includes(item.status)) errors.push(`${where}.status is not a known status`);
      text(item.item, `${where}.item`, false);
      text(item.outcome, `${where}.outcome`);
      text(item.note, `${where}.note`);
      text(item.link, `${where}.link`);
    });
  });
  return errors;
}

export function snapshotItems(snapshot) {
  return snapshot.groups.flatMap((group) => group.items);
}
