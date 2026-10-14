# Agent script contract and delivery hygiene

## Objective

Give every adopting repository the same four agent-facing commands: changed-file fix, changed-file lint, final gate, and owned acceptance serving. Make the delivery skills use them. Three avoidable session behaviours become hard to repeat:

- formatting the whole repository;
- rerunning the full gate before confirming the failed step passes;
- leaving started servers running.

Also stop sessions from polling files while they wait for a subagent.

This is one improvement-grade delivery in `vascon-solutions/agent-skills`, targeting `main`. Adoption in each repository is a separate task (see Follow-ups).

## Source Context

Codebase findings from the BE-01-01-q2 delivery in `bolamark-erp` (2026-10-06), reviewed with Dee:

- A whole-repo `pnpm exec ultracite fix` changed an unrelated evidence file. The session reverted it, then ran a whole-repo check for more than 10 minutes before killing it.
- After a lint fix, Biome printed nothing and the session went straight to the full gate. Gate-2 failed on lint after 166s.
- The rendered-check web server ran for about 3 hours because the `pkill` pattern did not match its command line.
- The session waited for the reviewer subagent with a foreground `until grep -q done <wrong file>` loop: about 6.8 minutes of dead wait.

**Repository survey (2026-10-06).** In every repository, the easiest formatter command is whole-tree:

| Repository | Whole-tree defaults | Existing changed-file tooling |
| --- | --- | --- |
| bolamark-erp | `format: biome format --write .` | none |
| taf-marketplace | `fix: ultracite fix`; lint-staged runs `ultracite fix` on staged files | lint-staged (commit time only) |
| ncdmb-procurement-ui | `fix: ultracite fix`; `AGENTS.md` instructs "Run `pnpm exec ultracite fix` to auto-fix formatting before committing"; lint-staged as taf | `AGENTS.md` changed-file `ultracite check <changed files>` guidance; `validate:affected` (receipt-backed) |
| ncdmb-procurement-api | `lint: eslint "{src,apps,libs,test}/**/*.ts" --fix`; `format: prettier --write …` | `validate:changed` (read-only ESLint `--max-warnings=0` on changed files, build when triggered, `jest --findRelatedTests`) |

Dee chose a cross-repository contract, a reference script copied into each repository, skill rules, and a user-level hook.

## Design Reference

None external. This task defines the contract. Companion tasks:

- `docs/tasks/2026-10-06-delivery-ledger-opt-in.md` and `docs/tasks/2026-10-06-delivery-ledger-ergonomics.md`
- `docs/tasks/2026-10-06-delivery-audit-and-review-defaults.md`
- Per-repository adoption: `.agent/tasks/agent-script-contract-adoption.md` in taf-marketplace, ncdmb-procurement-ui, ncdmb-procurement-api and bolamark-erp.

## Architecture Summary

A dependency-free Node script, `agent-scripts.mjs`, implements four subcommands, configured from a `package.json` `agentScripts` key. Repositories expose them as `pnpm agent:fix`, `agent:lint`, `agent:gate` and `agent:serve`.

- **Fix and lint** resolve the delivery's changed paths and run ordered tool steps, each with its own extension filter and working directory.
- **Gate** runs ordered gate steps.
- **Serve** starts named commands with per-command ports and port-derived environment. It blocks until they are ready (`--detach`) or stays in the foreground. It records every child process group, and `--stop` verifies that the ports are released.

The canonical copy and its tests live in agent-skills. Repositories copy it with a self-verifying version header and exclude it from their own formatters. Delivery skills refer to the command names, not to repository tools. A user-level Claude Code `PreToolUse` hook refuses whole-tree fixer invocations, with a reason that fits each repository.

## Code Evidence

| Behavior | Source |
| --- | --- |
| A failed check needs a rerun after its cause is addressed; no rule to rerun the failed step alone first | `skills/task-doc-delivery-loop/references/validation.md:21` |
| Validation is general ("smallest relevant check", "read the actual result"); nothing on changed-path formatting or process cleanup | `validation.md:8`, `:30` |
| NUL-delimited Git output for file lists | `validation.md:19` |
| Dispatch progress check every 60 seconds "with the runtime's waiting facilities"; agents may run in the background and the owner waits for the completion notification | `references/orchestration.md:51`, `:46` |
| Report paragraph (shipped, evidence, gaps, preserved files) | `SKILL.md:60` |
| Owner cleanup is defined only for devbox environments | `SKILL.md:40`; `skills/docker-app-verify/SKILL.md:32` |
| Skills install by symlink; no hook installer | `bin/link-skills.sh`, `bin/install.sh` |
| Repository facts in the survey table | each repository's `package.json`, `AGENTS.md`, `.husky/pre-commit`; `ncdmb-procurement-api/scripts/validate-changed.mjs:250`, `:263` |
| Node floors: bolamark `>=24 <25`; taf `>=22`; ncdmb UI and API have no `engines` (CI uses Node 24) | each `package.json`, CI config |
| Three of the four are Biome repositories with different quote styles (bolamark and taf `single`, ncdmb-ui default `double`), and none excludes `tools/` or `scripts/` | each `biome.jsonc` |

## Current Behavior To Preserve

- **Tooling choices.** Ultracite/Biome repositories keep Ultracite; ncdmb-api keeps ESLint (with Prettier through ESLint). The script runs configured tools and never chooses one.
- **Existing scripts.** `agent:*` are additions: `check`, `lint`, `fix`, `validate:affected`, `validate:changed` and lint-staged keep their behaviour.
- **Gates.** Repository gates keep their lanes, receipts and heavy-command locks. `agent:gate` invokes them and never reimplements them.
- **Portability.** Skills stay portable: without `agent:*`, the delivery loop falls back to the general rules.
- **Dirty scope.** Unrelated working-tree changes are never formatted or staged.

## Prerequisites

Current `main`. Node 20+ is the script's floor; every adopter runs Node 22 or 24.

**Landing order for the four 2026-10-06 tasks:** delivery-audit-and-review-defaults, then delivery-ledger-opt-in, then this task, then delivery-ledger-ergonomics. Each task rebases onto the previous one's edits to `SKILL.md` and `references/orchestration.md` instead of merging ad hoc.

## Scope

### Reference script

- **Location.** `templates/agent-scripts/agent-scripts.mjs` plus `templates/agent-scripts/README.md`. A single file, no dependencies, argv arrays only, never `shell: true`.
- **Version header.**
  - Line 1 is `// agent-scripts v<N> sha256:<hash>`, where the hash covers the file bytes after line 1.
  - `--verify` recomputes it and reports match or drift.
  - `agentScripts.schema` is the config schema version. The script refuses unknown versions.
- **Changed paths.**
  - The base is `--base REF`, then `agentScripts.base`, then `.agent/delivery-policy.json` `defaultBase`. An unresolvable base fails with a clear message unless `--working-tree-only` is given.
  - Default discovery is the merge base with `HEAD`, plus staged, unstaged and untracked paths (`--exclude-standard`, which honours `.git/info/exclude`), from NUL-delimited Git output only. This set can include working-tree edits the delivery does not own, so it is a fallback, not the guarantee.
  - Deletions are excluded. Paths are filtered by `extensions` and `ignore`.
  - **Delivery-owned paths.** `--paths-from FILE` (NUL- or newline-delimited) replaces discovery, and `--exclude PATH` (repeatable) removes paths from either source. The skill rule below makes the delivery owner supply `--paths-from` from the content manifest, whose exclusions already carry the `dirty_scope` decision, whenever the working tree holds unrelated changes. Before running any `fix` step, the script prints the final path list to stderr, so a wrong set is visible before anything is written.
- **Steps.** `fix` and `lint` are ordered lists of steps, `{command[], extensions?, cwd?, appendPaths?}`.
  - Each step gets the changed paths matching its own extensions, made relative to its `cwd`, in chunks under the OS argument limit.
  - A step with a `cwd` gets only the matching paths under that directory.
  - `appendPaths: false` runs the step once with no paths. Use it for affected-project runners.
  - Each step runs over all its chunks before the next step starts.
  - `fix` stops on the first failure. `lint` runs every step and exits non-zero if any failed. `lint` steps must not mutate files.
  - With no matching paths, print `agent-scripts: no changed files` and exit 0.
- **Gate.** `gate` is an ordered list of `{command[], env?}` steps that stops on the first failure and returns the failing exit status.
- **Serve config.** `serve.commands[{name, command[], cwd?, env?, ports{<portName>: {default}}, ready, default?}]`, plus `readyTimeoutSeconds` and `stopTimeoutSeconds`.
  - Port names are unique across commands, each owned by one command.
  - `{port:<name>}` placeholders resolve in argv elements, env values and `ready` URLs. This covers `nx serve web --port {port:web}` and `VITE_API_ORIGIN=http://localhost:{port:api}`.
  - `serve [name…]` starts the named commands, or those marked `default: true`.
  - `--port name=value` overrides a port.
- **Serve runtime.**
  - Each command is spawned detached (its own process group). Logs go to `<git-dir>/agent-serve/<name>.log`, and state to `<git-dir>/agent-serve/state.json` as `{supervisor_pid, started_at, children: [{name, pid, pgid, start_time, command, ports}]}`. `start_time` is the kernel's process start time read right after spawn (the pre-implementation probe chooses how on each OS). A PID plus its recorded start time is the **process-instance identity**; a PID alone is never one.
  - `<git-dir>` is the per-worktree Git directory, so parallel worktrees don't collide.
  - Before starting, refuse when any effective port has a listener, and name it.
  - **Foreground** (`serve`): wait for readiness, relay signals, and stop every group on exit.
  - **Detached** (`serve --detach`): block until every `ready` URL responds, then exit 0, leaving the children recorded. If `readyTimeoutSeconds` passes first, stop the groups and exit non-zero with each log's tail. Agents use this form, so there is no readiness polling.
  - Serve env defaults to `NX_DAEMON=false` and `NX_TUI=false`. This reduces, but does not eliminate, Nx work escaping the groups.
- **`serve --stop`.**
  1. **Verify every instance before any signal.** For each recorded child, read the current start time of its PID and compare it with the recorded `start_time`. A mismatch or a missing process means the PID is stale (exited, possibly reused): record it as already gone and send nothing to it or its recorded group, because a reused PID can sit in a group that is not ours. Only children whose instance identity matches are signalled.
  2. Snapshot the descendants of each verified child, as `{pid, start_time}` pairs from the live process table. Then send TERM, and KILL after `stopTimeoutSeconds`, to each verified child's group. Afterwards, kill and report any snapshotted descendant whose PID still carries the snapshotted start time. A process that escaped before the snapshot and does not listen on a port cannot be detected. This limit is stated in the README.
  3. Probe each recorded port for a listener (one portable probe, chosen in pre-implementation) and read the listener's PID and start time.
  4. A remaining listener is killed only when its process-instance identity (PID and start time) matches a verified child or a snapshotted descendant. Nothing else counts as ownership: not the same user, not a later start time, and not an identical executable, arguments and working directory, because another session can restart the same command on the same port. Any other listener makes `--stop` exit non-zero and names it with PID, command and start time, for the owner to decide.

  `--stop` works whether or not the supervisor is still alive.
- **`serve --status`** reports `live`, `stale` or `none` per child.

### Repository adoption contract

The README states what each adoption must do:

- vendor the file unmodified;
- add the `agentScripts` config and the four `agent:*` scripts;
- **exclude the vendored path** from the repository's formatter, linter and lint-staged globs, so its bytes and hash survive commits (for example `!tools/agent-scripts.mjs` in Biome `files.includes`);
- name the commands in `AGENTS.md`.

### Skill rules

- **`validation.md`:**
  - Add the changed-path formatting rule: use `agent:fix`/`agent:lint` when present. When the working tree holds changes the delivery does not own (a `dirty_scope` decision, or any unexplained dirty file), pass the content manifest's path list through `--paths-from` so unrelated files are never formatted; default discovery is acceptable only in a tree whose every change belongs to the delivery. Revert only the unrelated edits of a whole-tree fixer that ran by mistake.
  - **Amend `:21` in place:** rerun the failed step alone and confirm exit status 0 before rerunning the full gate (`agent:gate` when present). No output is not a pass.
  - Add the owned-process rule: start servers with `agent:serve --detach` when present. Otherwise record the PID and port, stop by PID, and confirm no listener before release. Report survivors as residue.
- **`orchestration.md:51`:** for the progress check, use the completion notification or a wait facility with a timeout. Never a foreground file or transcript loop.
- **`SKILL.md:60`:** report server residue with the cleanup outcome.

### Guard hook

`hooks/block-whole-tree-fixers.mjs` is a Claude Code `PreToolUse` hook for `Bash`. It works on segments: the command is split on `&&`, `||`, `;` and `|`. It strips env-assignment prefixes and runners (`pnpm exec`, `pnpm dlx`, `pnpm run`, `pnpm`, `npx`), and tracks `cd <dir>` against the hook input `cwd`.

**It denies:**
- `ultracite fix` with no path arguments;
- `biome check|format|lint` with `--write` and no paths, `.`, or only directories;
- `eslint --fix` with no paths, or only directories or globs;
- `prettier --write` with only directories or globs;
- a `pnpm` script whose body, resolved from the effective directory's `package.json`, is one of the above.

**It allows:**
- path-scoped invocations;
- commands it cannot parse (`bash -c`, `eval`, subshells). This is a stated limit.

**The deny reason depends on the repository:** "use `pnpm agent:fix`" when the resolved `package.json` defines `agent:fix`, otherwise "pass the explicit changed paths".

`hooks/README.md` documents the `~/.claude/settings.json` snippet and the rollout order (see Approval Gates).

## Excluded

- Repository adoption, including `AGENTS.md` and formatter-exclusion edits in those repositories.
- Ledger changes.
- A published npm package.
- Codex hooks.
- Replacing `run-affected-validation.mjs` or `validate-changed.mjs`.
- Automatic drift sync (follow-up via `owned-template-sync`).

## Pre-Implementation Verification

- Confirm the current Claude Code `PreToolUse` input fields and deny output (`hookSpecificOutput.permissionDecision: "deny"`) against current documentation.
- Confirm merge-base path discovery on the installed Git version.
- Choose one portable listener probe (`lsof -nP -iTCP:<port> -sTCP:LISTEN` on macOS; `ss -ltnp` on Linux, or an `lsof` fallback) and a way to read process start time on both.
- Scratch-run `nx serve` in one adopting repository with `NX_DAEMON=false` and `NX_TUI=false`. Confirm the process-group stop leaves no listener. If Nx still escapes, the listener fallback must handle it.
- Recheck the evidence table on current `main`.

## Likely Files To Touch

- `templates/agent-scripts/agent-scripts.mjs`, `templates/agent-scripts/README.md`
- `hooks/block-whole-tree-fixers.mjs`, `hooks/README.md`
- `skills/task-doc-delivery-loop/references/validation.md`, `references/orchestration.md`, `SKILL.md`
- `tests/agent-scripts.test.mjs`, `tests/hooks.test.mjs`
- `README.md` (pointer)

## Decisions Required Before Implementation

None blocking. Settled with Dee: cross-repository contract, copied script, user-level hook, skill rules. Defaults the implementer may change only with recorded reasoning:

- Config lives in a `package.json` `agentScripts` key (all adopters are package.json-based).
- The hook denies rather than asks.

## Execution Rules

- Node built-ins only.
- Keep skill additions to the rules listed, amending existing sentences where they overlap.
- Run `node --test tests/*.test.mjs`.

## Deliverables

The script with contract, README, config schema and version verification; the guard hook with install and rollout notes; the updated skill rules; tests.

## Completion Verification

| Risk | Evidence | Owner |
| --- | --- | --- |
| Changed-path discovery is wrong: untracked, staged, renamed, deleted, ignored or `info/exclude` files; names with spaces or newlines; unresolvable base; `--base` | Temp-repo fixture tests | `tests/agent-scripts.test.mjs` |
| A step gets the wrong paths (per-step extensions or cwd, `appendPaths: false`, chunk-then-step order) | Fixture with two steps and different filters, including a changed path outside a step's `cwd` | same |
| `lint` mutates files, `fix` touches unchanged files, or an exit status is lost | Byte comparisons; failing-tool fixture; `lint` reports every failing step | same |
| `fix` formats an unrelated working-tree edit | Fixture with one delivery-owned file and one unrelated dirty file that the formatter would change: with `--paths-from` naming only the owned file, and separately with `--exclude`, the unrelated file is byte-identical afterwards; the printed path list names only the owned file | same |
| `--stop` kills a process the delivery does not own | Three fixtures. **Same-command restart:** after the recorded child exits, an unrelated process starts the identical command line, working directory and port; `--stop` leaves it running, exits non-zero and names it. **Stale PID:** the state file records a PID whose start time no longer matches the live process (simulated by rewriting `start_time` in the fixture's state file); `--stop` sends no signal to that PID or group and reports it as gone, and a sentinel process planted at that PID survives. **Owned descendant:** a snapshotted descendant with matching start time that holds the port is stopped | same |
| Serve leaves processes or ports behind | Fixture with two commands, one of whose grandchildren is a Node child spawned with `detached: true` (its own process group; macOS has no `setsid` binary, and the pack suite runs there). A non-listening detached descendant present at stop time is killed via the snapshot. After `--stop` no PID or listener remains. Bound-port refusal; ready timeout; `--detach` returns only when ready | same |
| Placeholder resolution in argv, env and ready URLs; `--port` override | Fixture asserting the effective argv and env | same |
| Version drift undetected | `--verify` reports match, then drift after a one-byte edit | same |
| Shell injection | Hostile file names and config values with argv-only assertions | same |
| The hook blocks scoped commands or misses whole-tree ones | Table-driven cases: zero-path forms, globs, `cd` plus segments, env prefixes, runners, `pnpm` script resolution, unparseable allow, both deny-reason variants | `tests/hooks.test.mjs` |
| Pack regressions | `node --test tests/*.test.mjs` | owner |

**Runtime acceptance:** in a scratch clone of bolamark-erp, add a throwaway, uncommitted `agentScripts` block and the four `agent:*` scripts to its `package.json` and copy the reference script in (bolamark's own adoption is a separate task and is not a prerequisite here). Then run:
1. `agent:lint` on a one-file change;
2. `agent:serve --detach api web` on overridden ports;
3. `--stop`, after which no listener is left.

**Test admission:** discovery, step routing, exit status, process cleanup, placeholders, version verification and injection are durable contracts copied into four repositories. A regression here would ship to every adopter. The hook tests protect the deny/allow boundary. No presentation tests.

## Approval Gates

- **Hook installation and timing.** Writing to `~/.claude/settings.json` changes Dee's user configuration, so Dee confirms before it is written. Recommended order: install after the adoption tasks land in the repositories in active use. Before that, the hook would deny commands those repositories' `AGENTS.md` currently prescribe (with the "pass explicit paths" reason).

## Completion Criteria

- The script, hook, rules and tests are in place, and the pack suite passes.
- The scratch-clone runtime acceptance passes.
- An independent review has no unresolved blocking findings.

## Follow-ups

- Adoption tasks in taf-marketplace, ncdmb-procurement-ui, ncdmb-procurement-api and bolamark-erp.
- An `owned-template-sync` check using `--verify`.
- A Codex equivalent of the hook, if Codex gains a pre-tool hook.
