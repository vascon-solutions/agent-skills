import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import test from "node:test";

import { runCli } from "./probe-services.mjs";

const script = new URL("./probe-services.mjs", import.meta.url);

async function withServer(handler, fn) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

function run(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script.pathname, ...args]);
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

test("reports required and optional reachability with exact ok semantics", async () => {
  await withServer((request, response) => {
    if (request.url === "/ok") {
      response.writeHead(204).end();
      return;
    }
    response.writeHead(503).end("down");
  }, async (baseUrl) => {
    const result = await run([
      "--service",
      `app=${baseUrl}/ok`,
      "--optional-service",
      `docs=${baseUrl}/down`,
    ]);

    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.equal(result.stdout.trim().split("\n").length, 1);
    const output = JSON.parse(result.stdout);
    assert.equal(output.ok, true);
    assert.deepEqual(
      output.services.map(({ name, required, reachable, status, error }) => ({
        name,
        required,
        reachable,
        status,
        error,
      })),
      [
        {
          name: "app",
          required: true,
          reachable: true,
          status: 204,
          error: null,
        },
        {
          name: "docs",
          required: false,
          reachable: false,
          status: 503,
          error: "http",
        },
      ]
    );
  });
});

test("returns one when a required service is unavailable", async () => {
  await withServer((_request, response) => {
    response.writeHead(500).end("no");
  }, async (baseUrl) => {
    const result = await run(["--service", `api=${baseUrl}/health`]);
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stdout).ok, false);
  });
});

test("follows an ordinary redirect", async () => {
  await withServer((request, response) => {
    if (request.url === "/redirect") {
      response.writeHead(302, { location: "/ok" }).end();
      return;
    }
    response.writeHead(200).end("ok");
  }, async (baseUrl) => {
    const result = await run(["--service", `app=${baseUrl}/redirect`]);
    assert.equal(result.status, 0);
    assert.equal(JSON.parse(result.stdout).services[0].status, 200);
  });
});

test("does not follow a cross-origin redirect", async () => {
  await withServer((request, response) => {
    response.writeHead(200).end("elsewhere");
  }, async (otherUrl) => {
    await withServer((request, response) => {
      response.writeHead(302, { location: `${otherUrl}/ok` }).end();
    }, async (baseUrl) => {
      const result = await run(["--service", `app=${baseUrl}/redirect`]);
      assert.equal(result.status, 1);
      const service = JSON.parse(result.stdout).services[0];
      assert.equal(service.reachable, false);
      assert.equal(service.error, "http");
    });
  });
});

test("redacts URL credentials and query values while authenticating", async () => {
  await withServer((request, response) => {
    const expected = `Basic ${Buffer.from("user:secret").toString("base64")}`;
    response.writeHead(request.headers.authorization === expected ? 200 : 401).end();
  }, async (baseUrl) => {
    const url = new URL(`${baseUrl}/health?token=top-secret&plain=value`);
    url.username = "user";
    url.password = "secret";
    const result = await run(["--service", `secure=${url.href}`]);

    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stdout, /top-secret|user|secret|plain=value/);
    const displayUrl = JSON.parse(result.stdout).services[0].displayUrl;
    assert.match(displayUrl, /token=%5BREDACTED%5D/);
    assert.match(displayUrl, /plain=%5BREDACTED%5D/);
  });
});

test("classifies timeouts", async () => {
  await withServer((_request, response) => {
    setTimeout(() => response.writeHead(200).end("late"), 400);
  }, async (baseUrl) => {
    const result = await run([
      "--service",
      `slow=${baseUrl}/slow`,
      "--timeout-ms",
      "250",
    ]);
    assert.equal(result.status, 1);
    const service = JSON.parse(result.stdout).services[0];
    assert.equal(service.error, "timeout");
    assert.equal(service.status, null);
  });
});

test("rejects malformed and duplicate definitions without echoing URLs", async () => {
  const secretUrl = "http://example.test/health?token=secret-value";
  const malformed = await run(["--service", secretUrl]);
  assert.equal(malformed.status, 2);
  assert.equal(malformed.stdout, "");
  assert.doesNotMatch(malformed.stderr, /secret-value/);

  const duplicate = await run([
    "--service",
    "app=http://example.test/a",
    "--optional-service",
    "app=http://example.test/b",
  ]);
  assert.equal(duplicate.status, 2);
  assert.match(duplicate.stderr, /unique/i);
});

test("returns three when the probe runtime cannot produce a result", async () => {
  let stdout = "";
  let stderr = "";
  const code = await runCli(["--service", "app=http://example.test"], {
    probeServices: async () => {
      throw new Error("runtime failed");
    },
    stdout: { write: (value) => (stdout += value) },
    stderr: { write: (value) => (stderr += value) },
  });

  assert.equal(code, 3);
  assert.equal(stdout, "");
  assert.match(stderr, /runtime failure/i);
  assert.doesNotMatch(stderr, /example\.test/);
});
