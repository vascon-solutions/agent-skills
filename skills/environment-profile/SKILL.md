---
name: environment-profile
description: Use when an audit, screenshot walkthrough or live browser walkthrough targets a deployed non-production environment (dev, staging, UAT) and needs its origins, accounts, credential references, session rules, mail sandbox, build confirmation or known traps, or when a repo's environment profile must be created, checked or updated. Not for local Docker environments (docker-app-verify) or production.
---

# Environment Profile

## Purpose

Each project keeps one profile doc per deployed environment, next to its code, at `docs/environments/<env>.md`. The profile holds that environment's facts and credential references. This skill holds what every profile shares:
- the profile format;
- the default rules;
- the allowed kinds of credential reference;
- a brief stub;
- a checker.

This skill owns environment facts and defaults only:
- `audit-ui` and `audit-api` own interaction, evidence and verdicts;
- `walkthrough-artifact` owns capture rules and the manifest;
- `docker-app-verify` owns local Docker environments.

## Find the profile

Look in this order and stop at the first hit:

1. A profile path and commit named in the brief.
2. `docs/environments/<env>.md` in the current repo.
3. A row or pointer in the repo's `AGENTS.md` naming an environment profile. It may point to a sibling repo. When the local checkout is behind, read the profile at the remote integration branch, for example `git show origin/develop:docs/environments/dev.md`.
4. Otherwise, ask the owner once. Without an answer, work from the brief alone and say so in the report.

Refuse when the profile's `classification` is `production`, or when a target origin is production.

## Load it

- Record `<repo>/<path>@<sha>` in the brief, report or manifest.
- Apply the rules in this order: [references/defaults.md](references/defaults.md), then the profile, then the brief. A brief can only narrow the profile: it may drop personas, origins or allowed changes, never add them. Widening needs the owner.
- Use credentials only through the profile's references, as described in [references/credential-references.md](references/credential-references.md). Never print, echo, write or screenshot a value.

## Verify at run start

- Before any sign-in, run the profile's build confirmation and record the commit shas and run ids. Write "not fingerprinted" when the build cannot be identified.
- When a profile fact turns out wrong (an origin moved, a persona fails, a trap no longer applies), record it in the report under **Profile drift** and propose the profile edit. Do not work around it silently.

## Write a brief

Start from the profile's own Brief template section. If it has none, use [templates/brief-stub.md](templates/brief-stub.md). The brief lists only the served builds, checkpoints, personas, allowed changes and deviations. Everything else is "per profile".

## Create or update a profile

1. Copy [templates/environment-profile.md](templates/environment-profile.md) to `docs/environments/<env>.md` in the repo that hosts the app. Keep the section headings.
2. Fill it from repo docs, code, deploy workflows and earlier briefs. Never copy a credential value. Move each value to `~/.config/<project>/<env>.json` (mode 600) and reference its key.
3. Add the profile to the repo's `AGENTS.md` doc table, and add a one-line pointer in any sibling repo whose agents audit the same environment.
4. Run the checker (below) and fix every error.
5. Land it as a normal docs change. On every edit, update `last-verified`, `verified-by` and the Changelog.

## Check

```bash
node <skill>/scripts/check-profile.mjs profile docs/environments/dev.md
node <skill>/scripts/check-profile.mjs scan <run-folder> --values ~/.config/<project>/<env>.json
```

`<skill>` is this skill's folder.
- `profile` checks the front matter, the required sections, https origins and the age of `last-verified`. It rejects anything that looks like a secret.
- `scan` looks for every value in the credentials file across a run folder before the folder is kept or shared. It prints file names, key names and counts, never values.

Both exit 1 on a finding.
