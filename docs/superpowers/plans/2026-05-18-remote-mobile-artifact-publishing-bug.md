# Remote-Mobile Artifact Publishing Bug Task

## Objective

Fix the artifact publishing workflow so a user on a remote/mobile Codex session can get a reachable link to generated Markdown or HTML artifacts without being handed an unusable `localhost` URL or forced into a slow GitHub Pages setup.

## Source Context

Source mode: issue.

This task comes from a live failure while sharing an `html-artifact` output from a remote Codex session:

- Generated artifact in `alphadigital-edge/taf-marketplace`: `docs/app-wiring.html`
- Local preview URL worked only on the remote host: `http://127.0.0.1:4317/docs/app-wiring.html`
- User was on mobile through a remote Codex connection and could not open the URL
- GitHub Pages fallback was too slow because Pages was not configured and no `gh-pages` branch existed
- Portable incident handoff: `/private/tmp/agent-artifacts/artifact-publishing-remote-mobile-handoff/markdown/report-brief.md`

## Design Reference

- Source incident handoff: `/private/tmp/agent-artifacts/artifact-publishing-remote-mobile-handoff/markdown/report-brief.md`
- `docs/superpowers/specs/2026-05-17-artifact-routing-design.md`
- `docs/superpowers/specs/2026-05-17-publish-artifact-destinations-design.md`
- `docs/superpowers/specs/2026-05-17-publish-artifact-google-drive-design.md`
- `skills/html-artifact/SKILL.md`
- `skills/markdown-artifact/SKILL.md`
- `skills/publish-artifact/SKILL.md`

## Architecture Summary

Treat this as a publishing and decision-routing bug, not an HTML rendering bug. The skills should distinguish local preview from shareable publishing, detect or ask when the user needs a link reachable from another device, and prefer a configured external destination such as Google Drive or S3/gist before attempting GitHub Pages. GitHub Pages and GitHub Wiki should become deliberate destinations with clear preflight checks, explicit approval gates, and isolated publish workspaces that never stage unrelated repo changes.

## Code Evidence

| Behavior | Source |
|---|---|
| `html-artifact` creates self-contained HTML companions but does not own remote sharing or hosting. | `skills/html-artifact/SKILL.md` |
| `publish-artifact` supports S3, GitHub Wiki, ClickUp, Google Docs, and Google Drive destinations. | `skills/publish-artifact/SKILL.md` |
| Google Drive publishing currently requires local Google auth for non-dry-run CLI publishing. | `skills/publish-artifact/SKILL.md`, `skills/publish-artifact/scripts/common/google-auth.js` |
| Wiki publishing exists as a destination driver. | `skills/publish-artifact/scripts/destinations/wiki.js` |
| Google Drive raw upload exists as a destination driver. | `skills/publish-artifact/scripts/destinations/google-drive.js` |
| Existing artifact routing spec distinguishes artifact generation from destination routing. | `docs/superpowers/specs/2026-05-17-artifact-routing-design.md` |

## Current Behavior To Preserve

- `html-artifact` remains a deterministic renderer and should not silently publish artifacts.
- `publish-artifact` remains explicit-command only.
- S3 publishing must never make a bucket public.
- Secret scanning and output redaction in `publish-artifact` must remain intact.
- GitHub Wiki publishing should keep atomic commit/push behavior.
- Google Drive and Google Docs publishing should keep existing auth safety checks.
- Publishing must not stage, commit, push, or mutate unrelated dirty worktree changes.

## Prerequisites

- Existing `publish-artifact` destination work remains in progress in this repo; recheck current branch state before implementing.
- Decide whether this bug should patch the current in-progress publish-artifact changes or wait until they are merged.

## Scope

- Add guidance to `html-artifact` and/or `publish-artifact` that remote/mobile users cannot use remote `localhost` URLs as share links.
- Add a preflight decision path for "local preview" versus "shareable link".
- Add or refine `publish-artifact` behavior for quick mobile-accessible sharing of Markdown and HTML artifacts.
- Make Google Drive a preferred quick-share path when configured and available.
- Clarify GitHub Wiki versus GitHub Pages: wiki is documentation publishing, Pages is static HTML hosting.
- Add safe GitHub Pages support or a task-blocking message that explains Pages is not yet supported and recommends Drive/S3/gist instead.
- Add tests for the remote/mobile sharing decision and any new Pages/wiki/Drive behavior.
- Update `skills/publish-artifact/SKILL.md`, related specs/plans, and README usage guidance.

## Excluded

- Rewriting the HTML renderer.
- Making local preview URLs publicly reachable through tunnels.
- Automatically enabling GitHub Pages without explicit user approval.
- Automatically creating public repositories, public gists, or public buckets.
- Changing S3 public-access settings.
- Replacing Google Drive CLI auth with connector-based upload unless that is explicitly selected as a separate design.
- Solving all daily-assistant publishing behavior; this task may only add a todo link for daily reports.

## Pre-Implementation Verification

1. Check the current `agent-skills` git status and identify any in-progress `publish-artifact` changes.
2. Re-read `skills/publish-artifact/SKILL.md` and the current destination drivers.
3. Re-read Google Drive auth behavior in `skills/publish-artifact/scripts/common/google-auth.js`.
4. Re-read Wiki driver behavior in `skills/publish-artifact/scripts/destinations/wiki.js`.
5. Confirm whether a GitHub Pages driver already exists before adding one.
6. Confirm the preferred durable todo location remains `docs/todo.md`.

## Likely Files To Touch

- `skills/publish-artifact/SKILL.md`
- `skills/publish-artifact/scripts/publish-artifact.js`
- `skills/publish-artifact/scripts/publish-artifact.test.js`
- `skills/publish-artifact/scripts/destinations/wiki.js`
- `skills/publish-artifact/scripts/destinations/google-drive.js`
- `skills/publish-artifact/scripts/destinations/github-pages.js` if Pages support is added
- `skills/html-artifact/SKILL.md`
- `README.md`
- `docs/todo.md`
- relevant `docs/superpowers/specs/` or `docs/superpowers/plans/` documents if the implementation changes workflow contracts

## Decisions Required Before Implementation

### GitHub Pages Support Level

Options:

- Add a full `github-pages` destination to `publish-artifact`.
- Add only explicit guidance that Pages is unsupported and recommend Google Drive, S3/gist, or Wiki.

Implications:

- Full support solves the user request but touches GitHub repo settings, branch publishing, permissions, and deployment timing.
- Guidance-only is safer and faster but leaves Pages as manual work.

Resolver:

- Implementing agent and user, after checking current `publish-artifact` state.

### Default Remote/Mobile Destination

Options:

- Prefer Google Drive when configured.
- Prefer S3 presigned URL and secret gist.
- Ask the user every time.

Implications:

- Google Drive is mobile-friendly and familiar but currently requires local Google auth in the CLI flow.
- S3/gist is already part of the publishing model but may be less friendly for private team handoff.
- Asking every time is safe but slows urgent sharing.

Resolver:

- Implementing agent should choose based on available credentials and document the fallback order.

## Execution Rules

- Do not implement with hidden network side effects.
- Keep all publishing destinations explicit.
- Do not mutate unrelated repo state or dirty files.
- Use temporary directories for branch-based publishing.
- Add tests before or alongside implementation changes.
- Keep destination docs honest about visibility: public, private, inherited, presigned, secret gist, or repo-authenticated.

## Deliverables

1. Updated skill guidance for local preview versus remote/mobile sharing.
2. Updated `publish-artifact` decision flow for shareable Markdown/HTML links.
3. GitHub Pages support or explicit unsupported-path guidance.
4. Tests covering the bug scenario and selected destination behavior.
5. README/SKILL documentation updates.
6. `docs/todo.md` entry linking this task so daily report workflows do not lose it.

## Completion Verification

- [ ] A remote/mobile user is not given `127.0.0.1` or `localhost` as the final share URL.
- [ ] The skill offers or uses a reachable destination for HTML artifacts.
- [ ] If Pages is not configured, the flow asks before creating/configuring Pages or chooses a safer fallback.
- [ ] Dirty worktree files are not staged, committed, pushed, or copied into publish branches.
- [ ] Google Drive or fallback publishing behavior is tested.
- [ ] GitHub Wiki behavior remains atomic and documented as wiki/documentation publishing.
- [ ] Relevant tests pass with the repo's existing test command.

## Approval Gates

- Stop before enabling GitHub Pages on a repository.
- Stop before creating or pushing a `gh-pages` branch.
- Stop before creating any public publishing surface.
- Stop before changing auth, token, credential, or secret-handling behavior.

## Completion Criteria

The artifact publishing skills can guide a remote/mobile user to a reachable artifact link without wasting time on unusable local URLs or implicit GitHub Pages setup, and the behavior is documented, tested, and tracked in the repo todo.

## Follow-ups

- Add connector-backed Google Drive upload support if the local CLI auth requirement remains a blocker.
- Add daily-assistant integration so these publishing failures are automatically captured in daily reports.
- Add a local preview skill only for same-machine desktop workflows.

