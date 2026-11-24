---
name: environment-profile
description: Use when an audit, screenshot walkthrough or live browser walkthrough targets a deployed non-production environment (dev, staging, UAT) and needs that environment's origins, accounts, credential references, session rules, mail sandbox, build confirmation, allowed changes or known traps. Also use to create, check or update a repo's environment profile, or to scan a run folder for leaked credential values. It supplies facts and rules only; audit-ui, audit-api and walkthrough-artifact still run the work. Not for local Docker environments (docker-app-verify) or production.
---

# Environment Profile

## Purpose

Each project keeps one profile doc per deployed environment, next to its code, at `docs/environments/<env>.md`. The profile holds that environment's facts and credential references. This skill holds what every profile shares:
- the profile format;
- the default rules;
- the allowed kinds of credential reference;
- a brief stub;
- a checker for profiles and run folders.

This skill owns environment facts and defaults only:
- `audit-ui` and `audit-api` own interaction, evidence and verdicts;
- `walkthrough-artifact` owns capture rules and the manifest;
- `docker-app-verify` owns local Docker environments.

## Find the profile

`<env>` is the environment's short name from the request or brief, such as `dev` or `staging`. Look in this order and stop at the first hit:

1. A profile path and commit named in the brief.
2. `docs/environments/<env>.md` in the current repo.
3. A pointer to an environment profile in the repo's agent instructions (`AGENTS.md` or `CLAUDE.md`). It may name a sibling repo.
4. Otherwise, ask the owner once. Without an answer, work from the brief alone and say so in the report.

A working tree can be behind, or on a branch that predates the profile. For steps 2 and 3, run `git fetch` and read the copy on the branch that feeds the environment. That is usually the default branch or `develop`:

```bash
git show origin/<branch>:docs/environments/<env>.md
```

For a sibling repo, add `-C <path-to-that-repo>`. Use that copy when it differs from the working tree. If the environment name is unclear, list `docs/environments/` and pick the profile whose Origins section holds the target origin.

Refuse when the profile's `classification` is `production`, or when a target origin is production. A target origin the profile does not list needs the owner before anything touches it.

## Load it

- Record the profile as `<repo>/<path>@<sha>` in the brief, report or manifest. `<sha>` is the commit you read it at, from `git rev-parse --short <ref>`.
- Layer the rules: [references/defaults.md](references/defaults.md), then the profile, then the brief. A profile may tighten a default, or deviate from one with a recorded reason. A brief can only narrow the profile: it may drop personas, origins or allowed changes, never add them. Widening needs the owner's own instruction.
- When `classification` is `staging`, get the owner's go-ahead for this run before any sign-in.
- When `last-verified` is more than 30 days old, say so in the report and re-check each fact the run depends on.
- Use credentials only through the profile's references, as described in [references/credential-references.md](references/credential-references.md). Never print, echo, write or screenshot a value.

## Verify at run start

- Before any sign-in, run the profile's build confirmation and record the commit shas and run ids. Write "not fingerprinted" when the build cannot be identified.
- A profile fact can turn out wrong: an origin moved, a persona fails, a trap no longer applies. Record it in the report under **Profile drift** and propose the profile edit. Do not work around it silently.

## Write a brief

Start from the profile's Brief template section. If that section says "None.", use [templates/brief-stub.md](templates/brief-stub.md). The brief names only what is specific to the run: mode, served builds, checkpoints, personas, allowed changes with end states, owner approvals, mail expectations and deviations. Everything else is "per profile".

`audit-ui` and `audit-api` have their own brief templates, and those stay the base when they run the work. Put this block in that brief. Answer its environment, actor, credential-source and allowed-mutation fields with "per profile" plus the run's narrowing.

## Create or update a profile

1. Copy [templates/environment-profile.md](templates/environment-profile.md) to `docs/environments/<env>.md` in the repo that hosts the app. Keep the section headings, and write "None." under a section that does not apply.
2. Fill it from repo docs, code, deploy workflows and earlier briefs. Never copy a credential value into it. Each value belongs in `~/.config/<project>/<env>.json`, and the profile names its key. [references/credential-references.md](references/credential-references.md) shows how to set up that file.
3. Point to the profile from the repo's agent instructions (`AGENTS.md` or `CLAUDE.md`). Add a one-line pointer in any sibling repo whose agents audit the same environment.
4. Run the `profile` check below and fix every error.
5. Land it as a normal docs change. Add a Changelog line on every edit. Update `last-verified` and `verified-by` only when a run or review has confirmed the facts again.

## Check

```bash
node <skill>/scripts/check-profile.mjs profile docs/environments/<env>.md
node <skill>/scripts/check-profile.mjs profile docs/environments/<env>.md --values ~/.config/<project>/<env>.json
node <skill>/scripts/check-profile.mjs scan <run-folder> --values ~/.config/<project>/<env>.json
```

`<skill>` is this skill's folder.
- `profile` checks the front matter, the 13 required sections and their order, https origins and the age of `last-verified`. It rejects text that looks like a secret: a password after a label or in a password column, a token, a private key, or credentials in a URL. The pattern rules cannot catch every password, so add `--values` once the credentials file exists. The check then also fails when the profile holds a stored value. `--max-age-days <n>` moves the 30-day staleness warning.
- `scan` searches a run folder for every value in the credentials file before the folder is kept or shared. It also counts JWTs, URLs with embedded credentials and Basic-auth headers built from the stored values. It reads files as stored, so unpack or delete archives and trace bundles first. It skips values that are short common words unless `--include-weak` is set, and it names each key it skipped.

Both print file names, key names, rule names and counts, never a value. Exit code 0 means clean, 1 means a finding and 2 means a usage or read error. A stale `last-verified` is a warning and does not fail the check. To check a copy read with `git show`, write it to a temporary file first.
