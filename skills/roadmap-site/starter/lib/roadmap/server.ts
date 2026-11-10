import { env } from "cloudflare:workers";
import { desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { activity, comments, itemState, snapshot } from "@/db/schema";
import { browserWriteRefusal, parseEditorEmails, projectRoadmap, viewerFor } from "./access.mjs";

export type Viewer = ReturnType<typeof viewerFor>;
export type Db = ReturnType<typeof getDb>;
export type Snapshot = {
  commit: string;
  author: string;
  generatedAt: string;
  pushedAt: string;
  roadmapPath?: string;
  groups: { title: string; outcome: string | null; items: { id: string; item: string; outcome: string | null; status: string; note: string; link: string | null }[] }[];
};

export function runtimeValue(name: string): string | undefined {
  return (env as unknown as Record<string, string | undefined>)[name];
}

export async function currentViewer(): Promise<Viewer> {
  return viewerFor(await getChatGPTUser(), parseEditorEmails(runtimeValue("ROADMAP_EDITOR_EMAILS")));
}

export async function loadSnapshot(db: Db): Promise<Snapshot | null> {
  const [row] = await db.select().from(snapshot).where(eq(snapshot.id, 1));
  if (!row) return null;
  return { ...JSON.parse(row.data), commit: row.commitSha, author: row.author, generatedAt: row.generatedAt, pushedAt: row.pushedAt };
}

export async function loadRoadmap(viewer: Viewer) {
  const db = getDb();
  const [snap, states, commentRows, activityRows] = await Promise.all([
    loadSnapshot(db),
    db.select().from(itemState),
    db.select().from(comments).orderBy(comments.id),
    db.select().from(activity).orderBy(desc(activity.id)).limit(300),
  ]);
  return projectRoadmap({ snapshot: snap, states, comments: commentRows, activity: activityRows, viewer });
}

export type ActivityEntry = { kind: string; itemId?: string | null; actorName: string; detail?: string };

export function activityInsert(db: Db, entries: ActivityEntry[]) {
  const at = new Date().toISOString();
  return db.insert(activity).values(entries.map((entry) => ({ at, itemId: null, detail: "", ...entry })));
}

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function failure(denied: { status: number; error: string }) {
  return json({ error: denied.error }, denied.status);
}

export function requestGuard(request: Request) {
  return browserWriteRefusal({
    fetchSite: request.headers.get("sec-fetch-site"),
    origin: request.headers.get("origin"),
    requestOrigin: new URL(request.url).origin,
    contentType: request.headers.get("content-type"),
  });
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
