# agent-scripts

`agent-scripts.mjs` gives every adopting repository the same four agent-facing commands:

| Script | Runs | Purpose |
| --- | --- | --- |
| `pnpm agent:fix` | `node tools/agent-scripts.mjs fix` | Run the configured fixers on the delivery's changed files only |
| `pnpm agent:lint` | `node tools/agent-scripts.mjs lint` | Run the configured read-only checks on the changed files |
| `pnpm agent:gate` | `node tools/agent-scripts.mjs gate` | Run the repository's final gate steps in order |
| `pnpm agent:serve` | `node tools/agent-scripts.mjs serve` | Start, check and stop the servers used for acceptance, with owned-process cleanup |

It is a single dependency-free file for Node 20 or later. It runs the tools a repository configures; it never chooses one. Every command is spawned from an argv array, never through a shell.

## Version header

Line 1 is `// agent-scripts v<N> sha256:<hash>`, where the hash covers the file's bytes after line 1.

- `node tools/agent-scripts.mjs --verify` reports `matches` (exit 0) or `drift` (exit 1) for the file itself; `--verify FILE` checks another copy.
- `--stamp` rewrites the header after editing the **canonical** copy in agent-skills. Never re-stamp a vendored copy: that hides drift instead of fixing it.

## Configuration

Configuration lives under `agentScripts` in the repository root's `package.json` (`--config FILE` reads another file). Unknown keys are refused, and `schema` must be a version this script supports (currently `1`).

```json
{
  "scripts": {
    "agent:fix": "node tools/agent-scripts.mjs fix",
    "agent:lint": "node tools/agent-scripts.mjs lint",
    "agent:gate": "node tools/agent-scripts.mjs gate",
    "agent:serve": "node tools/agent-scripts.mjs serve"
  },
  "agentScripts": {
    "schema": 1,
    "base": "origin/main",
    "extensions": [".ts", ".tsx", ".js", ".json"],
    "ignore": ["tools/agent-scripts.mjs", "**/generated/**"],
    "fix": [{ "command": ["pnpm", "exec", "ultracite", "fix"] }],
    "lint": [
      { "command": ["pnpm", "exec", "ultracite", "check"] },
      { "command": ["pnpm", "exec", "eslint", "--max-warnings=0"], "cwd": "apps/api", "extensions": [".ts"] },
      { "command": ["pnpm", "nx", "affected", "-t", "typecheck"], "appendPaths": false }
    ],
    "gate": [{ "command": ["pnpm", "validate:affected"], "env": { "CI": "1" } }],
    "serve": {
      "readyTimeoutSeconds": 180,
      "stopTimeoutSeconds": 10,
      "commands": [
        { "name": "api", "command": ["pnpm", "nx", "serve", "api"], "env": { "PORT": "{port:api}" }, "ports": { "api": { "default": 3000 } }, "ready": "http://localhost:{port:api}/health", "default": true },
        { "name": "web", "command": ["pnpm", "nx", "serve", "web", "--port", "{port:web}"], "env": { "VITE_API_ORIGIN": "http://localhost:{port:api}" }, "ports": { "web": { "default": 4200 } }, "ready": "http://localhost:{port:web}/", "default": true }
      ]
    }
  }
}
```

| Key | Meaning |
| --- | --- |
| `schema` | Config schema version. Required. |
| `base` | Default comparison base for changed-path discovery. |
| `extensions` | Default extension filter for steps without their own. Omit to pass every changed path. |
| `ignore` | Globs (`*`, `**`, `?`; a match on a directory covers its contents) removed from every path list. |
| `fix`, `lint` | Ordered steps: `{command, extensions?, cwd?, appendPaths?}`. |
| `gate` | Ordered steps: `{command, env?}`. |
| `serve` | `{commands, readyTimeoutSeconds?, stopTimeoutSeconds?}`; each command is `{name, command, cwd?, env?, ports, ready, default?}`. |

## fix and lint

**Changed paths.** The base is `--base REF`, then `agentScripts.base`, then `defaultBase` in `.agent/delivery-policy.json`. An unresolvable or missing base is an error unless `--working-tree-only` is given, which compares with `HEAD` instead.

Default discovery includes committed, staged and unstaged changes since the merge base of the base and `HEAD`. It also includes untracked files Git does not ignore (`.gitignore`, `.git/info/exclude` and the global excludes file all apply). Deleted paths and symlinks are dropped; a rename counts as its new path. Supplied paths through linked directories are rejected when the resolved file is outside the repository. All Git output is read NUL-delimited, so names with spaces or newlines are safe.

Discovery can include working-tree edits the delivery does not own. When the tree holds unrelated changes, pass the delivery's own list instead:

- `--paths-from FILE` replaces discovery with a NUL- or newline-delimited list of repository-relative paths (use NUL for names containing newlines).
- `--exclude PATH` (repeatable) removes a path from either source.

Before any step runs, the final path list is printed to stderr.

**Steps.** Each step receives the changed paths matching its extensions. A step with `cwd` runs in that directory and receives only the matching paths under it, relative to it. Paths that start with `-` are passed as `./-name` so a tool cannot read them as options. Long lists are split into chunks under the argument limit, and a step finishes all its chunks before the next step starts. `appendPaths: false` runs the step once with no paths, for affected-project runners; it still runs only when some changed path matches its filter.

- `fix` stops at the first failing step and returns its exit status.
- `lint` runs every step and returns the first failure's status. Lint steps must not change files. Before and after linting, the script snapshots every tracked file and non-ignored untracked file, including paths excluded from the delivery inputs. It fails on additions, deletions, content or permission changes, and symlink target changes. Ignored untracked caches and build outputs are outside this check.
- With no matching paths at all it prints `agent-scripts: no changed files` and exits 0.

## gate

Runs each step in order from the repository root with the step's extra `env`, stops at the first failure and returns its exit status. Repository gates keep their own lanes, receipts and locks; `gate` only invokes them.

## serve

- `serve [name…]` starts the named commands, or every command with `default: true`. `--port name=value` overrides a port. `{port:<name>}` placeholders resolve in argv elements, `env` values and `ready` URLs. Port names are unique across commands.
- Before starting, it refuses when any effective port already has a listener and names the holder.
- Each command runs in its own process group, with `NX_DAEMON=false` and `NX_TUI=false` by default (a command's `env` can override them). Logs go to `<git-dir>/agent-serve/<name>.log` and state to `<git-dir>/agent-serve/state.json`. `<git-dir>` is the per-worktree Git directory, so parallel worktrees do not collide.
- **Foreground** (`serve`) waits for readiness, relays SIGINT, SIGTERM and SIGHUP, and stops every group when it exits or any command exits.
- **Detached** (`serve --detach`) returns 0 only when every `ready` URL answers with any HTTP response. If `readyTimeoutSeconds` (default 120) passes first, or a command exits, it stops everything and exits 1 with each log's tail. Agents use this form; they never poll for readiness themselves.
- `serve --status` prints `name<TAB>live|stale<TAB>pid=…<TAB>ports=…` per recorded child, or `none`.

**`serve --stop`** works whether or not the starting process is still alive:

1. Each recorded child is identified by its PID **and** its kernel start time (`/proc/<pid>/stat` on Linux, `ps -o lstart=` elsewhere). A missing process or a different start time means the PID is stale; nothing is sent to it or its group.
2. It snapshots the live descendants of each verified child with their start times, sends SIGTERM to each verified group, then SIGKILL after `stopTimeoutSeconds` (default 10). Any snapshotted descendant still carrying its snapshotted start time is then stopped and reported.
3. It probes every recorded port (`ss` on Linux, otherwise `lsof`). A remaining listener is stopped only when its PID and start time match a verified child or snapshotted descendant. Any other listener is left running, named with PID, command and start time, and `--stop` exits 1 for the owner to decide. Same user, same command line or a later start time never count as ownership, because another session can restart the same command on the same port.

**Limits.** A process that leaves the tree before the snapshot (for example by double-forking) and does not listen on a recorded port cannot be found. `NX_DAEMON=false` reduces but does not remove Nx work escaping the groups. Start times from `ps` have one-second resolution. Listener probing needs `lsof` (or `ss` on Linux).

## Adopting it in a repository

1. Copy `agent-scripts.mjs` unmodified to `tools/agent-scripts.mjs` (or another stable path) and confirm `node tools/agent-scripts.mjs --verify` reports `matches`.
2. Add the `agentScripts` config and the four `agent:*` scripts to the root `package.json`. Existing `check`, `lint`, `fix`, `validate:*` scripts and lint-staged stay as they are.
3. Exclude the vendored file from the repository's formatter, linter and lint-staged globs so its bytes, and therefore its hash, survive commits. For Biome, add `"!tools/agent-scripts.mjs"` to `files.includes`; for ESLint, add it to the ignores; for Prettier, add it to `.prettierignore`. Add it to `agentScripts.ignore` as well.
4. Name the four commands in `AGENTS.md`, replacing any instruction to run a fixer over the whole tree.
