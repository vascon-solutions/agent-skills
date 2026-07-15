import { spawnSync } from "node:child_process";

function parseVersion(value) {
  const match = String(value).match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3] ?? 0)];
}

export function versionAtLeast(actual, minimum) {
  const actualVersion = parseVersion(actual);
  const minimumVersion = parseVersion(minimum);
  if (!actualVersion || !minimumVersion) return false;

  for (let index = 0; index < minimumVersion.length; index += 1) {
    if (actualVersion[index] > minimumVersion[index]) return true;
    if (actualVersion[index] < minimumVersion[index]) return false;
  }
  return true;
}

export function executableAvailable(command, env = process.env) {
  const result = spawnSync(command, ["--version"], {
    env,
    stdio: "ignore",
  });
  return !result.error && result.status === 0;
}

export function executableVersionAtLeast(command, minimum, env = process.env) {
  const result = spawnSync(command, ["--version"], {
    encoding: "utf8",
    env,
  });
  if (result.error || result.status !== 0) return false;
  return versionAtLeast(`${result.stdout ?? ""}\n${result.stderr ?? ""}`, minimum);
}
