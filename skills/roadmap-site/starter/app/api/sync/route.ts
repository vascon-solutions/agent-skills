import { and, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { itemState, snapshot } from "@/db/schema";
import { authorizeSync } from "@/lib/roadmap/access.mjs";
import { clearPending, snapshotItems, validateSnapshot } from "@/lib/roadmap/merge.mjs";
import { failure, json, loadSnapshot, readJson, record, runtimeValue } from "@/lib/roadmap/server";

export const dynamic = "force-dynamic";

function denied(request: Request) {
  return authorizeSync(request.headers.get("x-roadmap-sync-token"), runtimeValue("ROADMAP_SYNC_TOKEN"));
}

const clearState = { status: null, base: null, version: sql`${itemState.version} + 1` };

export async function GET(request: Request) {
  const refused = denied(request);
  if (refused) return failure(refused);
  const db = getDb();
  const snap = await loadSnapshot(db);
  const pending = await db.select().from(itemState).where(isNotNull(itemState.status));
  return json({
    snapshot: snap ? { commit: snap.commit, pushedAt: snap.pushedAt } : null,
    pending: pending.map((state) => ({ id: state.itemId, status: state.status, base: state.base })),
  });
}

export async function POST(request: Request) {
  const refused = denied(request);
  if (refused) return failure(refused);
  const body = await readJson(request);
  const db = getDb();

  if (body?.action === "push") {
    const snap = body.snapshot as { commit: string; author: string; generatedAt: string; roadmapPath?: string; groups: unknown[] };
    const errors = validateSnapshot(snap);
    if (errors.length) return json({ error: errors.join("; ") }, 400);
    const pushedAt = new Date().toISOString();
    const row = {
      commitSha: snap.commit,
      author: snap.author,
      generatedAt: snap.generatedAt,
      pushedAt,
      data: JSON.stringify({ roadmapPath: snap.roadmapPath, groups: snap.groups }),
    };
    await db.insert(snapshot).values({ id: 1, ...row }).onConflictDoUpdate({ target: snapshot.id, set: row });
    const states = await db.select().from(itemState).where(isNotNull(itemState.status));
    const { clear, keep } = clearPending(states, snapshotItems(snap));
    for (const state of clear) {
      await db.update(itemState).set(clearState).where(and(eq(itemState.itemId, state.itemId), eq(itemState.status, state.status as string)));
    }
    await record(db, [{ kind: "push", actorName: snap.author, detail: `Pushed ${snap.commit.slice(0, 7)}; ${clear.length} page change(s) now in the repo` }]);
    return json({ cleared: clear.map((state) => state.itemId), kept: keep.length });
  }

  if (body?.action === "pull") {
    const discard = Array.isArray(body.discard) ? (body.discard as { id: string; status: string }[]) : [];
    const applied = Array.isArray(body.applied) ? body.applied.length : 0;
    const discarded: string[] = [];
    for (const edit of discard) {
      const result = await db
        .update(itemState)
        .set(clearState)
        .where(and(eq(itemState.itemId, String(edit.id)), eq(itemState.status, String(edit.status))))
        .run();
      if (result.meta.changes) discarded.push(String(edit.id));
    }
    const commit = typeof body.commit === "string" ? body.commit.slice(0, 7) : "";
    const author = typeof body.author === "string" && body.author ? body.author.slice(0, 200) : "sync";
    await record(db, [{ kind: "pull", actorName: author, detail: `Pulled at ${commit}: ${applied} applied to the repo file, ${discarded.length} page change(s) discarded` }]);
    return json({ discarded });
  }

  return json({ error: 'Send { "action": "push" } or { "action": "pull" }.' }, 400);
}
