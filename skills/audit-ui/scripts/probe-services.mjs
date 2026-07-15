#!/usr/bin/env node

import { fileURLToPath } from "node:url";

class UsageError extends Error {}

function parseDefinition(value, required) {
  const separator = value.indexOf("=");
  if (separator <= 0 || separator === value.length - 1) {
    throw new UsageError("Service definitions must use nonblank name=url values.");
  }
  const name = value.slice(0, separator).trim();
  const rawUrl = value.slice(separator + 1);
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UsageError("Service definitions require absolute HTTP(S) URLs.");
  }
  if (!name || !["http:", "https:"].includes(url.protocol)) {
    throw new UsageError("Service definitions require unique names and absolute HTTP(S) URLs.");
  }
  return { name, rawUrl, required };
}

export function parseArgs(argv) {
  const services = [];
  let timeoutMs = 5000;
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--service" || flag === "--optional-service") {
      const value = argv[index + 1];
      if (!value) throw new UsageError(`${flag} requires name=url.`);
      services.push(parseDefinition(value, flag === "--service"));
      index += 1;
      continue;
    }
    if (flag === "--timeout-ms") {
      const value = argv[index + 1];
      if (!value || !/^\d+$/.test(value)) {
        throw new UsageError("--timeout-ms requires an integer from 250 to 30000.");
      }
      timeoutMs = Number(value);
      if (timeoutMs < 250 || timeoutMs > 30000) {
        throw new UsageError("--timeout-ms requires an integer from 250 to 30000.");
      }
      index += 1;
      continue;
    }
    throw new UsageError("Unknown argument. Use --service, --optional-service, or --timeout-ms.");
  }
  if (services.length === 0) {
    throw new UsageError("At least one service definition is required.");
  }
  const names = new Set();
  for (const service of services) {
    if (names.has(service.name)) throw new UsageError("Service names must be unique.");
    names.add(service.name);
  }
  return { services, timeoutMs };
}

export function toDisplayUrl(rawUrl) {
  const url = new URL(rawUrl);
  url.username = "";
  url.password = "";
  for (const key of [...url.searchParams.keys()]) {
    url.searchParams.set(key, "[REDACTED]");
  }
  return url.href;
}

function requestDetails(rawUrl) {
  const url = new URL(rawUrl);
  const headers = {};
  if (url.username || url.password) {
    const username = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password);
    headers.authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
    url.username = "";
    url.password = "";
  }
  return { url, headers };
}

function classifyError(error) {
  if (error?.name === "TimeoutError" || error?.name === "AbortError") return "timeout";
  const code = error?.cause?.code ?? error?.code;
  if (["ENOTFOUND", "EAI_AGAIN"].includes(code)) return "dns";
  if (["ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ENETUNREACH"].includes(code)) {
    return "connection";
  }
  if (typeof code === "string" && /CERT|TLS|SSL/.test(code)) return "tls";
  return "unknown";
}

export async function probeOne(service, timeoutMs, dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const now = dependencies.now ?? Date.now;
  const startedAt = now();
  const { url, headers } = requestDetails(service.rawUrl);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    await response.body?.cancel();
    const reachable = response.status >= 200 && response.status <= 399;
    return {
      name: service.name,
      displayUrl: toDisplayUrl(service.rawUrl),
      required: service.required,
      reachable,
      status: response.status,
      durationMs: Math.max(0, now() - startedAt),
      error: reachable ? null : "http",
    };
  } catch (error) {
    return {
      name: service.name,
      displayUrl: toDisplayUrl(service.rawUrl),
      required: service.required,
      reachable: false,
      status: null,
      durationMs: Math.max(0, now() - startedAt),
      error: classifyError(error),
    };
  }
}

export async function probeServices(config) {
  const services = await Promise.all(
    config.services.map((service) => probeOne(service, config.timeoutMs))
  );
  return {
    ok: services.every((service) => !service.required || service.reachable),
    services,
  };
}

export async function runCli(argv, dependencies = {}) {
  const stdout = dependencies.stdout ?? process.stdout;
  const stderr = dependencies.stderr ?? process.stderr;
  const probe = dependencies.probeServices ?? probeServices;
  try {
    const config = parseArgs(argv);
    const result = await probe(config);
    stdout.write(`${JSON.stringify(result)}\n`);
    return result.ok ? 0 : 1;
  } catch (error) {
    if (error instanceof UsageError) {
      stderr.write(`Invalid service probe input: ${error.message}\n`);
      return 2;
    }
    stderr.write("Service probe runtime failure prevented a valid result.\n");
    return 3;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await runCli(process.argv.slice(2));
}

