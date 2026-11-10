export const STALE_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;

export function parseEditorEmails(value) {
  return new Set(
    String(value || "")
      .split(/[\s,;]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

/* Public name only: the sign-in full name, else the part of the email before "@". Never the email itself. */
export function publicName(user) {
  if (!user) return null;
  const full = (user.fullName || "").trim();
  if (full) return full;
  return String(user.email || "").split("@")[0] || "Signed-in user";
}

export function viewerFor(user, editors) {
  if (!user || !user.userId || !user.email) return { signedIn: false, isEditor: false, name: null, userId: null };
  return {
    signedIn: true,
    isEditor: editors.has(String(user.email).toLowerCase()),
    name: publicName(user),
    userId: user.userId,
  };
}

/* Returns null when allowed, else { status, error } for the response. */
export function authorize(viewer, action, comment) {
  if (!viewer.signedIn) return { status: 401, error: "Sign in to continue." };
  if (action === "comment") return null;
  if (action === "write") return viewer.isEditor ? null : { status: 403, error: "Only editors can change status, note and link." };
  if (action === "delete-comment") {
    if (viewer.isEditor || (comment && comment.authorId === viewer.userId)) return null;
    return { status: 403, error: "Only the comment's author or an editor can delete it." };
  }
  return { status: 403, error: "Not allowed." };
}

export function checkVersion(currentVersion, sentVersion) {
  if (Number(sentVersion) === currentVersion) return null;
  return { status: 409, error: "This item changed since you opened it. It has been reloaded; review and save again." };
}

function sameSecret(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function authorizeSync(sentToken, configuredToken) {
  if (!configuredToken) return { status: 503, error: "ROADMAP_SYNC_TOKEN is not configured on this site." };
  return sameSecret(sentToken, configuredToken) ? null : { status: 401, error: "Missing or wrong sync token." };
}

export function snapshotAge(pushedAt, now = Date.now()) {
  if (!pushedAt) return null;
  const ms = Math.max(0, now - Date.parse(pushedAt));
  return { days: Math.floor(ms / DAY), stale: ms > STALE_DAYS * DAY };
}

const PAGE_KINDS = new Set(["status", "note", "link", "comment"]);

/*
 * The read payload. Built from explicit fields so that no email or user id can reach a reader; `viewer.userId` is used
 * only to compute `canDelete`.
 */
export function projectRoadmap({ snapshot, states, comments, activity, viewer, now = Date.now() }) {
  const stateById = new Map(states.map((state) => [state.itemId, state]));
  const commentsById = new Map();
  for (const comment of comments) {
    const list = commentsById.get(comment.itemId) || [];
    list.push({
      id: comment.id,
      author: comment.authorName,
      body: comment.body,
      at: comment.createdAt,
      canDelete: authorize(viewer, "delete-comment", comment) === null,
    });
    commentsById.set(comment.itemId, list);
  }
  let pendingCount = 0;
  const groups = (snapshot ? snapshot.groups : []).map((group) => ({
    title: group.title,
    outcome: group.outcome || null,
    items: group.items.map((item) => {
      const state = stateById.get(item.id);
      const pageStatus = state && state.status != null && state.status !== item.status ? state.status : null;
      if (pageStatus) pendingCount += 1;
      return {
        id: item.id,
        item: item.item,
        outcome: item.outcome || null,
        repoStatus: item.status,
        status: pageStatus || item.status,
        pending: Boolean(pageStatus),
        conflict: pageStatus && state.base !== item.status ? { repo: item.status, page: pageStatus } : null,
        repoNote: item.note || "",
        taskDoc: item.link || null,
        note: state ? state.note : "",
        link: state ? state.link : "",
        version: state ? state.version : 0,
        comments: commentsById.get(item.id) || [],
      };
    }),
  }));
  const pageChange = activity.find((entry) => PAGE_KINDS.has(entry.kind));
  return {
    viewer: { signedIn: viewer.signedIn, isEditor: viewer.isEditor, name: viewer.name },
    snapshot: snapshot
      ? { commit: snapshot.commit, author: snapshot.author, generatedAt: snapshot.generatedAt, pushedAt: snapshot.pushedAt, age: snapshotAge(snapshot.pushedAt, now) }
      : null,
    groups,
    pendingCount,
    lastPageChange: pageChange ? pageChange.at : null,
    activity: activity.map((entry) => ({ id: entry.id, at: entry.at, kind: entry.kind, itemId: entry.itemId, actor: entry.actorName, detail: entry.detail })),
  };
}
