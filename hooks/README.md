# Hooks

## block-whole-tree-fixers

`block-whole-tree-fixers.mjs` is a Claude Code `PreToolUse` hook for the `Bash` tool. It refuses formatter and linter fix runs that would rewrite the whole tree. Such a run can change files a task does not own.

It splits the command on `&&`, `||`, `;`, `|`, `&` and newlines, retaining the operators. It strips environment assignments and `env`, `exec`, `nohup`, `time` and `command` prefixes, and unwraps the runners `pnpm exec`, `pnpm dlx`, `pnpm run`, `pnpm <script>` and `npx`. It follows `cd <dir>` and `pnpm -C <dir>` against the hook input's `cwd`. Conditional commands are checked in each possible directory after earlier commands succeed, fail or are skipped. Pipeline and background directory changes stay within their subshells.

**Denied:**

- `ultracite fix` with no path arguments, `.`, or only directories;
- `biome check|format|lint` with `--write` (or `--fix`, `--apply`, `--apply-unsafe`) and no paths, `.`, or only directories, unless `--staged` or `--changed` limits it;
- `eslint --fix` with no paths, or only directories or globs;
- `prettier --write` (`-w`) with no paths, or only directories or globs;
- a `pnpm` script, resolved from the nearest `package.json` above the effective directory, whose body is one of the above after appending the forwarded arguments (followed through up to three nested `pnpm` scripts).

**Allowed:** path-scoped invocations, and anything the hook cannot read. Commands needing shell evaluation (`bash -c`, `sh -c`, `eval`, `$(…)`, backticks, subshells, groups, here-documents), `pnpm --filter`/`-r` script runs, unreadable input, and other tools all pass through. These are stated limits, not guarantees: the hook catches the common mistake, not a determined bypass.

**Reason.** When the nearest `package.json` defines `agent:fix`, the deny reason says to use `pnpm agent:fix` (see [agent-scripts](../templates/agent-scripts/README.md)). Otherwise it says to pass the explicit changed paths.

The hook prints `{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "…"}}` and exits 0 to deny. To allow, it prints nothing and exits 0.

### Install

Add this to `~/.claude/settings.json`, using the absolute path of your agent-skills checkout:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "node /ABSOLUTE/PATH/agent-skills/hooks/block-whole-tree-fixers.mjs" }
        ]
      }
    ]
  }
}
```

Merge it into any existing `hooks.PreToolUse` array instead of replacing it. A hook that times out or crashes does not block the command.

### Rollout order

Install the hook only after the agent-script adoption tasks have landed in the repositories you work in. Until then, those repositories' `AGENTS.md` files still prescribe whole-tree commands such as `pnpm exec ultracite fix`, which the hook would deny. In repositories without `agent:fix`, the deny reason asks for explicit changed paths.
