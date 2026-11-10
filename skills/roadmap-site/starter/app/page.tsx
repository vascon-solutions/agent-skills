import config from "../roadmap-site.config.json";
import { currentViewer, loadRoadmap } from "@/lib/roadmap/server";
import { chatGPTSignInPath, chatGPTSignOutPath } from "./chatgpt-auth";
import RoadmapView from "./roadmap-view";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || "";
  const data = await loadRoadmap(await currentViewer());
  return (
    <RoadmapView
      initial={data}
      config={config}
      initialStatus={first(params.status)}
      initialQuery={first(params.q)}
      signInPath={chatGPTSignInPath("/")}
      signOutPath={chatGPTSignOutPath("/")}
    />
  );
}
