---
env-profile: 1
project: <project-slug>
environment: dev
classification: test
last-verified: YYYY-MM-DD
verified-by: <audit run, walkthrough or PR that last confirmed these facts>
---

# <Project> <ENV> environment profile

<!--
Fixed headings: keep the 13 `##` sections below, in this order. `check-profile.mjs` requires them.
Write "None." under a section that does not apply.
`project` is also the prefix for `vault` profiles and the `~/.config/<project>/` folder.
`environment` is one of dev, staging or uat. `classification` is test or staging; production is refused.
-->

## Purpose and status

- Who uses this profile: agents and people running UI or API audits, screenshot walkthroughs and live walkthroughs on <ENV>.
- It holds facts and credential references only. Never put a password, token, cookie or one-time link here.
- Rules not stated here follow the `environment-profile` skill's defaults.
- Last verified: see the front matter. When a fact is wrong, record it as profile drift in the run's report, and update this file in a docs PR.

## Origins

| Service | Origin | Notes |
| --- | --- | --- |
| <app> | https://… | |
| API | https://… | OpenAPI at `/…`; record its hash per run |
| Mail sandbox | https://… | basic auth; see Credential references |

- Only the origins above may be touched. Start or stop nothing.
- Never touch these sibling environments: <staging or production hosts>.

## Build confirmation

- Branch that feeds this environment: <develop>.
- How to find the served build: <`gh run list --repo <org>/<repo> --branch <branch> --workflow <file> --limit 5 --json databaseId,headSha,conclusion,createdAt`>.
- Which jobs must succeed: <for example Verify, Build, Migrate, Deploy>.
- Fingerprinting: <a version endpoint that returns the commit, or "none, so write not fingerprinted">.
- What a deploy does not do: <for example, it runs migrations but not seeds>.

## Accounts and personas

| Persona | Account | Portal | Use for | Credential |
| --- | --- | --- | --- | --- |
| <role> | <email> | <app> | <workflow step> | local-file: <key> |

- Never use: <accounts reserved for people or other teams, and why>.
- Routing facts that decide which persona can act: <one line each>.

## Credential references

| Key or reference | Covers | How to use |
| --- | --- | --- |
| local-file: <key> | <accounts> | `jq -r .<key> ~/.config/<project>/<env>.json`, piped or put in a variable, never printed |

People without the file: <ask the owner>.

## Sessions

- Session model: <for example, one session per account, and how long it lasts>.
- Release order: <UI logout>, then <API logout with the run token>. Use <the clear-sessions control or route> only as a recorded last resort.
- Parallel runs: give each run its own personas.
- Live walkthroughs: `vault` profiles `<project>-<env>-<role>`: <allowed or not, and why>.

## Mail sandbox

- Product and origin: <Mailpit at …>. Shared with other projects: <yes or no>.
- Search API: <paths>.
- Delivery latency: <observed range>, so wait <N> minutes before recording mail as late.
- Capture: rendered HTML view of the message pane only.

## Data facts

- How to find current data: <list page and filter, fixture tooling>.
- Filters that hide data: <for example, a year selector that defaults to the newest cycle>.
- Long-lived reference records (as of <date>, re-verify before use):

| Record | State | Safe use |
| --- | --- | --- |
| | | |

- Checkpoints not reachable with current data: <list>.

## Domain traps

| Trap | Symptom | What to do |
| --- | --- | --- |
| | | |

## Allowed changes

- Standing authorization: <who, date, scope>.
- Allowed without asking: <for example, demo records marked "<marker>", with the end state recorded>.
- Always needs the owner: <deleting records; users, roles and settings; seed or reset jobs; …>.
- Never: production, and <…>.

## Playbook

- Writing a brief: <project specifics>.
- Parallel UI and API runs: <persona split rules>.
- Walkthrough capture: <project deltas from walkthrough-artifact>.
- Cleanup, with evidence: <project specifics>.
- Tracker or ticket updates: <where results go>.

## Brief template

```markdown
- Environment: per `<repo>/docs/environments/<env>.md` @ `<sha>` (env-profile 1)
- Served builds: <shas and run ids from Build confirmation>
- Checkpoints: …
- Personas for this run only: … Held by parallel runs (do not use): …
- Allowed changes for this run (a subset of the profile): …; marker "<marker>"; end state per record: …
- Deviations from the profile: …
```

## Changelog

| Date | Change |
| --- | --- |
| YYYY-MM-DD | First version. |
