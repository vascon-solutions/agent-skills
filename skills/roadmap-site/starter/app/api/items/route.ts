import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { activity, itemState } from "@/db/schema";
import { authorize, checkVersion } from "@/lib/roadmap/access.mjs";
import { nextItemState, pageView, snapshotItems } from "@/lib/roadmap/merge.mjs";
import { STATUSES } from "@/lib/roadmap/parse.mjs";
import { type ActivityEntry, currentViewer, failure, json, loadRoadmap, loadSnapshot, readJson, requestGuard } from "@/lib/roadmap/server";

export const dynamic = "force-dynamic";

const TEXT_LIMIT = 2000;

export async function PUT(request: Request) {
  const viewer = await currentViewer();
  const denied = requestGuard(request) || authorize(viewer, "write");
  if (denied) return failure(denied);
  const body = await readJson(request);
  if (!body || typeof body.id !== "string") return json({ error: "Send the item id." }, 400);
  for (const field of ["note", "link"] as const) {
    if (body[field] !== undefined && (typeof body[field] !== "string" || body[field].length > TEXT_LIMIT)) {
      return json({ error: `${field} must be text of at most ${TEXT_LIMIT} characters.` }, 400);
    }
  }
  if (body.status !== undefined && !STATUSES.includes(body.status as string)) return json({ error: "Unknown status." }, 400);

  const db = getDb();
  const snap = await loadSnapshot(db);
  const item = snap && snapshotItems(snap).find((entry: { id: string }) => entry.id === body.id);
  if (!item) return json({ error: "Unknown item." }, 404);
  const [state] = await db.select().from(itemState).where(eq(itemState.itemId, item.id));
  const version = state ? state.version : 0;
  const stale = checkVersion(version, body.version);
  if (stale) return failure(stale);

  const displayed = pageView(state, item.status).status;
  const next = nextItemState(state, item.status, body.status as string | undefined);
  const status = next.status ?? item.status;
  const updatedAt = new Date().toISOString();
  const values = {
    ...next,
    note: ((body.note as string | undefined) ?? state?.note ?? "").trim(),
    link: ((body.link as string | undefined) ?? state?.link ?? "").trim(),
    version: version + 1,
    editorName: viewer.name,
    updatedAt,
  };
  const actorName = viewer.name as string;
  const entries: ActivityEntry[] = [];
  if (status !== displayed) entries.push({ kind: "status", itemId: item.id, actorName, detail: `${displayed} → ${status}` });
  if (values.note !== (state?.note ?? "")) entries.push({ kind: "note", itemId: item.id, actorName, detail: "Updated the note" });
  if (values.link !== (state?.link ?? "")) entries.push({ kind: "link", itemId: item.id, actorName, detail: "Updated the link" });

  // The activity rows are inserted only if this request's write landed, so a lost version race records nothing.
  const written = sql`${itemState.itemId} = ${item.id} and ${itemState.version} = ${version + 1} and ${itemState.updatedAt} = ${updatedAt}`;
  const write = state
    ? db.update(itemState).set(values).where(and(eq(itemState.itemId, item.id), eq(itemState.version, version)))
    : db.insert(itemState).values({ itemId: item.id, ...values }).onConflictDoNothing();
  const [result] = await db.batch([
    write,
    ...entries.map((entry) =>
      db.insert(activity).select(sql`select null, ${updatedAt}, ${entry.kind}, ${entry.itemId}, ${entry.actorName}, ${entry.detail} from ${itemState} where ${written}`),
    ),
  ]);
  if (!result.meta.changes) return failure(checkVersion(-1, version)!);
  return json(await loadRoadmap(viewer));
}
