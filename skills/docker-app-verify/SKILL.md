---
name: docker-app-verify
description: Run selected configured application components in Docker for real UI or API verification, retain audit evidence, and clean up owned resources. Use for runtime acceptance of changed behavior; not every code edit or production deployment.
---

# Docker Application Verification

Use the installed agent-devbox runner and protected machine project catalog. This skill owns lifecycle coordination; [audit-ui](../audit-ui/SKILL.md) and [audit-api](../audit-api/SKILL.md) retain interaction and verdict ownership. Preserve the caller's delivery endpoint and authorization.

## Resolve The Run

Read the tested repository's instructions and relevant acceptance criteria. Locate the runner from supplied context or the machine's `agent-devbox` command; the maintained local installation may be at `~/Code/agent-devbox/src/cli.mjs`. Do not install or provision it implicitly. Use `node <runner>/src/cli.mjs help` to confirm capabilities.

Run `discover --ui <absolute-worktree>` to resolve `~/.config/agent-devbox/projects.json` by canonical Git repository identity. Confirm selected component, worktree, shared inputs, existing API, and artifact destination against the task. A repository without a unique mapping is unsupported: report the missing configuration or use an explicitly supplied protected config. Never guess an API, choose by directory basename, or create a second registry to avoid queuing.

Read [the lifecycle guide](references/lifecycle.md) when executing. Current reviewed adapters are NCDMB procurement frontend plus its selected shared build input, and Vascon Bits Storybook. Those default components start no APIs, databases or Redis. For NCDMB API-only checks, `up --ui <worktree> --component api` starts a gateway to the configured existing API without a frontend build; confirm this component appears in the selected runner’s discovery/help before using it, since older VPS releases do not have it. It requires the existing Node image and reports API source identity as unverified. API reads currently cover only unauthenticated NCDMB schema and missing-route checks; they do not establish authenticated endpoint or persistence correctness. Local NCDMB `managed-api`/`managed-stack` components build and run the API against disposable audit data on existing local Postgres/Redis when the protected config enables them. A persistent NCDMB base stack (golden data, three apps, `*.test` names) is the default target: use `route` to choose between the base and a golden copy (see the lifecycle guide). Other unsupported runtime/data needs remain explicit gaps, not implicit provisioning authority.

## Audit And Close

Supply a focused brief with source receipt, intended change, URLs seen from the auditor's location, allowed operations, protected credential reference if needed, evidence directory, and cleanup owner. Add the task-specific scenarios to the generated brief. Readiness does not prove served source or application behavior.

Use the runner's Docker browser with `audit-ui`; never replace required Docker browser evidence with host-only screenshots. Use `audit-api` for the bounded API checks when they cover the requested contract. Keep UI audits in visible application flows. Never use raw API calls to manufacture UI state.

Always preserve `report.md`, source/image receipts, selected observations, and cleanup outcome, including failed/blocked runs. In a finally-style cleanup path, end the current audit with its exact token, stop the exact environment, wait for `stopped`, and inspect `cleanup.json` and the registry. An uncertain logout quarantines the account; do not force reset, change aliases, or treat browser closure as logout. Recovery is allowed only after the runner confirms the exact supervisor is dead. Leave unrelated services and existing sessions untouched.

No remote installation, transfer, public preview exposure, migrations or fixture writes are implied. `up` accepts only verified Storybook source bundles, with explicit protected config and an independently retained digest. NCDMB bundles remain verification-only. A source bundle has no Git history or staging state and cannot resume an editable task. Use the runner's VPS proposal for remaining remote integration and approvals; preserve existing CLIs and tmux sessions.
