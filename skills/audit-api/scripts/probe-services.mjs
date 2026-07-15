#!/usr/bin/env node

import { fileURLToPath } from "node:url";

class UsageError extends Error {}

function parseDefinition(value, required) {
  const separator = value.indexOf("=");
  if (separator <= 0 || separator === value.length - 1) throw new UsageError("Service definitions must use nonblank name=url values.");
  const name = value.slice(0, separator).trim();
  let url;
  try { url = new URL(value.slice(separator + 1)); }
  catch { throw new UsageError("Service definitions require absolute HTTP(S) URLs."); }
  if (!name || !["http:", "https:"].includes(url.protocol)) throw new UsageError("Service definitions require unique names and absolute HTTP(S) URLs.");
  if (url.username || url.password) throw new UsageError("Embedded URL credentials are not accepted.");
  return { name, rawUrl: url.href, required };
}

export function parseArgs(argv) {
  const services = [];
  const allowedQueries = [];
  let timeoutMs = 5000;
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--service" || flag === "--optional-service") {
      if (!value) throw new UsageError(`${flag} requires name=url.`);
      services.push(parseDefinition(value, flag === "--service")); index += 1; continue;
    }
    if (flag === "--allow-nonsecret-query") {
      if (!value || !/^[A-Za-z0-9_.~-]+$/.test(value)) throw new UsageError("--allow-nonsecret-query requires a query parameter name.");
      allowedQueries.push(value); index += 1; continue;
    }
    if (flag === "--timeout-ms") {
      if (!value || !/^\d+$/.test(value) || Number(value) < 250 || Number(value) > 30000) throw new UsageError("--timeout-ms requires an integer from 250 to 30000.");
      timeoutMs = Number(value); index += 1; continue;
    }
    throw new UsageError("Unknown service probe argument.");
  }
  if (services.length === 0) throw new UsageError("At least one service definition is required.");
  if (new Set(services.map(({ name }) => name)).size !== services.length) throw new UsageError("Service names must be unique.");
  const allowedSet = new Set(allowedQueries);
  if (allowedSet.size !== allowedQueries.length) throw new UsageError("Allowed query names must be unique.");
  const usedQueries = new Set();
  for (const { rawUrl } of services) {
    for (const key of new URL(rawUrl).searchParams.keys()) {
      usedQueries.add(key);
      if (!allowedSet.has(key)) throw new UsageError("Every query parameter requires explicit nonsecret opt-in.");
    }
  }
  if ([...allowedSet].some((key) => !usedQueries.has(key))) throw new UsageError("Every query opt-in must match a supplied service URL.");
  return { services, timeoutMs };
}

export function toDisplayUrl(rawUrl) {
  const url = new URL(rawUrl);
  for (const key of [...url.searchParams.keys()]) url.searchParams.set(key, "[REDACTED]");
  return url.href;
}

function classifyError(error) {
  if (error?.name === "TimeoutError" || error?.name === "AbortError") return "timeout";
  const code = error?.cause?.code ?? error?.code;
  if (["ENOTFOUND", "EAI_AGAIN"].includes(code)) return "dns";
  if (["ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ENETUNREACH"].includes(code)) return "connection";
  if (typeof code === "string" && /CERT|TLS|SSL/.test(code)) return "tls";
  return "unknown";
}

export async function probeOne(service, timeoutMs, dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const now = dependencies.now ?? Date.now;
  const startedAt = now();
  let current = new URL(service.rawUrl);
  let redirects = 0;
  try {
    while (true) {
      const response = await fetchImpl(current, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(timeoutMs) });
      if (response.status >= 300 && response.status <= 399 && response.headers.get("location")) {
        const next = new URL(response.headers.get("location"), current);
        await response.body?.cancel();
        if (next.origin !== current.origin) return result(service, startedAt, now, false, response.status, "cross-origin-redirect");
        redirects += 1;
        if (redirects > 3) return result(service, startedAt, now, false, response.status, "redirect-limit");
        current = next; continue;
      }
      await response.body?.cancel();
      const reachable = response.status >= 200 && response.status <= 399;
      return result(service, startedAt, now, reachable, response.status, reachable ? null : "http");
    }
  } catch (error) {
    return result(service, startedAt, now, false, null, classifyError(error));
  }
}

function result(service, startedAt, now, reachable, status, error) {
  return { name: service.name, displayUrl: toDisplayUrl(service.rawUrl), required: service.required, reachable, status, durationMs: Math.max(0, now() - startedAt), error };
}

export async function probeServices(config) {
  const services = await Promise.all(config.services.map((service) => probeOne(service, config.timeoutMs)));
  return { ok: services.every((service) => !service.required || service.reachable), services };
}

export async function runCli(argv, dependencies = {}) {
  const stdout = dependencies.stdout ?? process.stdout;
  const stderr = dependencies.stderr ?? process.stderr;
  try {
    const result = await (dependencies.probeServices ?? probeServices)(parseArgs(argv));
    stdout.write(`${JSON.stringify(result)}\n`);
    return result.ok ? 0 : 1;
  } catch (error) {
    if (error instanceof UsageError) { stderr.write(`Invalid service probe input: ${error.message}\n`); return 2; }
    stderr.write("Service probe runtime failure prevented a valid result.\n"); return 3;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = await runCli(process.argv.slice(2));
