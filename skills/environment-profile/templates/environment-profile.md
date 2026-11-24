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
Numbering (`## 2. Origins`), letter case and extra `###` subsections are free.
Write "None." under a section that does not apply.
`project` is a slug. It names the `~/.config/<project>/` folder and is the default prefix for `vault` profiles.
`environment` is the short name in the file name, such as dev, staging or uat.
`classification` is test for disposable test data, or staging for a pre-production environment, which needs the owner's go-ahead for each run. Production is refused.
Replace every `<...>` placeholder, then delete this comment.
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

- Branch that feeds this environment: <branch>.
- How to find the served build: <`gh run list --repo <org>/<repo> --branch <branch> --workflow <file> --limit 5 --json databaseId,headSha,conclusion,createdAt`>.
- Which jobs must succeed: <for example Verify, Build, Migrate, Deploy>.
- Fingerprinting: <a version endpoint that returns the commit, or "none, so write not fingerprinted">.
- What a deploy does not do: <for example, it runs migrations but not seeds>.

## Accounts and personas

| Persona | Account | App | Use for | Credential |
| --- | --- | --- | --- | --- |
| <role> | <email> | <app> | <workflow step> | local-file: <key> |

- Never use: <accounts reserved for people or other teams, and why>.
- Rules that decide which persona can act at each step: <one line each>.

## Credential references

| Key or reference | Covers | How to use |
| --- | --- | --- |
| local-file: <key> | <accounts> | `jq -er '.<key>' ~/.config/<project>/<env>.json`, piped or put in a variable, never printed |

People without the file: <ask the owner>.

## Sessions

- Session model: <for example, one session per account, and how long it lasts>.
- Release order: <UI logout>, then <API logout with the run token>. Use <the clear-sessions control or route> only as a recorded last resort.
- Parallel runs: give each run its own personas.
- Live walkthroughs: `vault` profiles `<project>-<env>-<role>`: <allowed or not, and why>.

## Mail sandbox

- Product and origin: <for example Mailpit at https://…>. Shared with other projects: <yes or no>.
- Search API: <paths>.
- Delivery latency: <observed range>, so wait <N> minutes before recording mail as late.
- Capture: rendered HTML view of the message pane only.

## Data facts

- How to find current data: <list page and filter, or test-data tooling>.
- Filters that hide data: <for example, a date or status filter whose default hides the test records>.
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
- Environment: per `<repo>/docs/environments/<env>.md` @ `<sha>` (env-profile 1). Every rule not listed here comes from that profile and the `environment-profile` defaults.
- Served builds: <repo> `<sha>` (run `<id>`); <repo> `<sha>` (run `<id>`). Re-check before the first sign-in.
- Mode and skill: <audit-ui | audit-api | walkthrough-artifact | live walkthrough>.
- Checkpoints:
  1. …
- Personas for this run only: … Held by parallel runs, so do not use: …
- Credentials: per the profile's Credential references. Never print a value.
- Allowed changes for this run (a subset of the profile): … Marker: "<marker>". End state per record: …
- Owner approvals: <none | the owner's own words, with who, date and scope>.
- Mail: <messages expected, and how long to wait>.
- Evidence budget: <screenshots, requests>.
- Deviations from the profile: <none | each narrowing, with its reason>.
- Cleanup: per the profile, plus …
- Output: <report path>. If the harness refuses the write, return the whole report in the reply.
- <lines this project always needs, such as tracker rows>
```

## Changelog

| Date | Change |
| --- | --- |
| YYYY-MM-DD | First version. |
