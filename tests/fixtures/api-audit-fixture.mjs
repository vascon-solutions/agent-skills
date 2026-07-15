import { randomUUID } from "node:crypto";
import http from "node:http";

function json(response, status, body, headers = {}) {
  response.writeHead(status, { "content-type": "application/json", ...headers });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) body += chunk;
  try { return body ? JSON.parse(body) : {}; } catch { return null; }
}

export async function startApiAuditFixture() {
  const token = `audit-${randomUUID()}`;
  const items = new Map();
  const idempotency = new Map();
  const jobs = new Map();
  let itemSequence = 0;
  let jobSequence = 0;
  let transientReads = 0;

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://fixture.local");
    if (request.method === "GET" && url.pathname === "/health") return json(response, 200, { status: "ok" });
    if (request.method === "POST" && url.pathname === "/login") return json(response, 200, { token, actor: "auditor" });
    if (request.method === "GET" && url.pathname === "/redirect/same") { response.writeHead(302, { location: "/health" }).end(); return; }
    if (request.method === "GET" && url.pathname === "/redirect/cross") { response.writeHead(302, { location: "http://example.test/health" }).end(); return; }
    if (request.headers.authorization !== `Bearer ${token}`) return json(response, 401, { error: "unauthorized" });

    if (request.method === "GET" && url.pathname === "/protected") return json(response, 200, { actor: "auditor" });
    if (request.method === "POST" && url.pathname === "/items") {
      const body = await readJson(request);
      if (!body?.name) return json(response, 422, { errors: [{ field: "name", message: "required" }] });
      const key = request.headers["idempotency-key"];
      if (key && idempotency.has(key)) return json(response, 201, items.get(idempotency.get(key)));
      const item = { id: `item-${++itemSequence}`, name: body.name };
      items.set(item.id, item); if (key) idempotency.set(key, item.id);
      return json(response, 201, item, { location: `/items/${item.id}` });
    }
    if (request.method === "GET" && url.pathname.startsWith("/items/")) {
      const item = items.get(url.pathname.split("/").at(-1));
      return item ? json(response, 200, item) : json(response, 404, { error: "not_found" });
    }
    if (request.method === "POST" && url.pathname === "/jobs") {
      const id = `job-${++jobSequence}`; jobs.set(id, 0);
      return json(response, 202, { id, status: "pending" }, { location: `/jobs/${id}` });
    }
    if (request.method === "GET" && url.pathname.startsWith("/jobs/")) {
      const id = url.pathname.split("/").at(-1);
      if (!jobs.has(id)) return json(response, 404, { error: "not_found" });
      const reads = jobs.get(id); jobs.set(id, reads + 1);
      return reads === 0 ? json(response, 202, { id, status: "pending" }) : json(response, 200, { id, status: "complete" });
    }
    if (request.method === "GET" && url.pathname === "/transient") {
      transientReads += 1;
      return transientReads === 1 ? json(response, 503, { error: "temporary" }) : json(response, 200, { status: "recovered" });
    }
    return json(response, 404, { error: "not_found" });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    token,
    createdCount: (key) => idempotency.has(key) ? 1 : 0,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}
