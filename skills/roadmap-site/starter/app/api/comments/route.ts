import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { comments } from "@/db/schema";
import { authorize } from "@/lib/roadmap/access.mjs";
import { snapshotItems } from "@/lib/roadmap/merge.mjs";
import { activityInsert, currentViewer, failure, json, loadRoadmap, loadSnapshot, readJson, requestGuard } from "@/lib/roadmap/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const viewer = await currentViewer();
  const denied = requestGuard(request) || authorize(viewer, "comment");
  if (denied) return failure(denied);
  const body = await readJson(request);
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text || text.length > 2000) return json({ error: "A comment is 1 to 2000 characters of plain text." }, 400);
  const db = getDb();
  const snap = await loadSnapshot(db);
  const item = snap && snapshotItems(snap).find((entry: { id: string }) => entry.id === body?.itemId);
  if (!item) return json({ error: "Unknown item." }, 404);
  await db.batch([
    db.insert(comments).values({
      itemId: item.id,
      authorId: viewer.userId as string,
      authorName: viewer.name as string,
      body: text,
      createdAt: new Date().toISOString(),
    }),
    activityInsert(db, [{ kind: "comment", itemId: item.id, actorName: viewer.name as string, detail: "Commented" }]),
  ]);
  return json(await loadRoadmap(viewer), 201);
}

export async function DELETE(request: Request) {
  const viewer = await currentViewer();
  const guarded = requestGuard(request) || authorize(viewer, "comment");
  if (guarded) return failure(guarded);
  const body = await readJson(request);
  const db = getDb();
  const [comment] = await db.select().from(comments).where(eq(comments.id, Number(body?.id)));
  if (!comment) return json({ error: "Unknown comment." }, 404);
  const denied = authorize(viewer, "delete-comment", comment);
  if (denied) return failure(denied);
  await db.delete(comments).where(eq(comments.id, comment.id));
  return json(await loadRoadmap(viewer));
}
