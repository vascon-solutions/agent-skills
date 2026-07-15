import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import test from "node:test";

const script = new URL("./probe-services.mjs", import.meta.url);

async function withServer(handler, fn) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try { await fn(`http://127.0.0.1:${port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

function run(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script.pathname, ...args]);
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

test("reports required and optional services as compact JSON", async () => {
  await withServer((request, response) => response.writeHead(request.url === "/ok" ? 204 : 503).end(), async (base) => {
    const result = await run(["--service", `api=${base}/ok`, "--optional-service", `docs=${base}/down`]);
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim().split("\n").length, 1);
    const output = JSON.parse(result.stdout);
    assert.equal(output.ok, true);
    assert.deepEqual(output.services.map(({ required, reachable, status }) => ({ required, reachable, status })), [
      { required: true, reachable: true, status: 204 },
      { required: false, reachable: false, status: 503 },
    ]);
  });
});

test("rejects userinfo and query parameters unless names are explicitly allowed", async () => {
  const userinfo = await run(["--service", "api=http://user:secret@example.test/health"]);
  assert.equal(userinfo.status, 2);
  assert.doesNotMatch(userinfo.stderr, /user|secret|example\.test/);

  const query = await run(["--service", "api=http://example.test/health?tenant=alpha"]);
  assert.equal(query.status, 2);
  assert.doesNotMatch(query.stderr, /alpha|example\.test/);

  await withServer((_request, response) => response.writeHead(200).end(), async (base) => {
    const allowed = await run([
      "--allow-nonsecret-query", "api",
      "--service", `api=${base}/health?tenant=alpha&locale=en`,
    ]);
    assert.equal(allowed.status, 0, allowed.stderr);
    const display = JSON.parse(allowed.stdout).services[0].displayUrl;
    assert.match(display, /tenant=%5BREDACTED%5D/);
    assert.doesNotMatch(display, /alpha|locale=en/);
  });
});

test("rejects URL fragments without echoing their values", async () => {
  await withServer((_request, response) => response.writeHead(200).end(), async (base) => {
    const result = await run([
      "--service",
      `api=${base}/health#access_token=secret-fragment`,
    ]);

    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.doesNotMatch(result.stderr, /secret-fragment|127\.0\.0\.1/);
  });
});

test("rejects unknown, duplicate, or insufficient query opt-ins", async () => {
  for (const args of [
    ["--allow-nonsecret-query", "missing", "--service", "api=http://example.test/health"],
    ["--allow-nonsecret-query", "api", "--allow-nonsecret-query", "api", "--service", "api=http://example.test/?tenant=a"],
    ["--allow-nonsecret-query", "docs", "--service", "api=http://example.test/?tenant=a"],
  ]) {
    const result = await run(args);
    assert.equal(result.status, 2);
    assert.doesNotMatch(result.stderr, /example\.test|tenant=a|token=b/);
  }
});

test("follows at most three same-origin redirects", async () => {
  await withServer((request, response) => {
    const step = Number(request.url.slice(1) || 0);
    if (step < 3) response.writeHead(302, { location: `/${step + 1}` }).end();
    else response.writeHead(200).end();
  }, async (base) => {
    const ok = await run(["--service", `api=${base}/0`]);
    assert.equal(ok.status, 0, ok.stderr);
  });

  await withServer((request, response) => {
    const step = Number(request.url.slice(1) || 0);
    response.writeHead(302, { location: `/${step + 1}` }).end();
  }, async (base) => {
    const excessive = await run(["--service", `api=${base}/0`]);
    assert.equal(excessive.status, 1);
    assert.equal(JSON.parse(excessive.stdout).services[0].error, "http");
  });
});

test("rejects cross-origin redirects before HTTP classification", async () => {
  await withServer((_request, response) => response.writeHead(302, { location: "http://example.test/next" }).end(), async (base) => {
    const result = await run(["--service", `api=${base}/start`]);
    assert.equal(result.status, 1);
    const service = JSON.parse(result.stdout).services[0];
    assert.equal(service.error, "http");
    assert.equal(service.reachable, false);
  });
});

test("uses exit one for required failure and exit two for bad input", async () => {
  await withServer((_request, response) => response.writeHead(500).end(), async (base) => {
    assert.equal((await run(["--service", `api=${base}/health`])).status, 1);
  });
  const duplicate = await run(["--service", "api=http://example.test/a", "--service", "api=http://example.test/b"]);
  assert.equal(duplicate.status, 2);
  assert.match(duplicate.stderr, /unique/i);
});
