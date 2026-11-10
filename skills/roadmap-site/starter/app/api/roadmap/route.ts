import { currentViewer, json, loadRoadmap } from "@/lib/roadmap/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return json(await loadRoadmap(await currentViewer()));
}
