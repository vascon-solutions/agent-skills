import { spawnSync } from "node:child_process";

export function executableAvailable(command, env = process.env) {
  const result = spawnSync(command, ["--version"], {
    env,
    stdio: "ignore",
  });
  return !result.error && result.status === 0;
}
