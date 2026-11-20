# Default rules

Every profile inherits these rules. A profile may tighten them or record a deviation with its reason. A brief may only narrow them.

## Environment

- **Production.** Production is always off limits, including reads that need a sign-in.
- **Staging.** Staging needs its own profile and the owner's go-ahead for each run.
- **Allowed origins.** Touch only the origins the profile lists. Start, stop, restart or redeploy nothing on a deployed environment.
- **Served builds.** Confirm what is served before signing in, and re-check before the first sign-in if time has passed. If a newer deploy landed, record it and continue.

## Credentials

- Use only the references listed in [credential-references.md](credential-references.md).
- Never write, print, echo or screenshot a password, token, cookie, basic-auth credential or one-time link. That covers files, reports, filenames, command text and URLs.
- Keep API tokens in shell variables only, and redact `Authorization` and `Cookie` headers in any saved log.
- Browser snapshots and console logs can capture typed passwords and basic-auth URLs. Delete those files before the run folder is kept, then run the `scan` check.

## Sessions

- One run, one set of personas. Concurrent runs use disjoint personas, and each brief names the accounts the other runs hold.
- Never probe a login to see whether an account works: a successful probe can hold the account's session.
- Release each session through the UI's logout, or the API's logout with the run's own token. A "clear all sessions" control or route evicts whoever holds the account; use it only as a recorded last resort.
- Audits (`audit-ui`) use a fresh non-persistent browser session per account. Saved logins (`vault` references) are for live guided walkthroughs only, and those still log out at the end.

## Mail sandbox

- Read only. Do not delete messages, mark them, or change sandbox settings.
- Capture the rendered HTML view of the message pane only, never the list, text, raw, headers or source views. The `walkthrough-artifact` capture reference owns the details.
- A search API may be used to find a message. Record any side effect, such as a message being marked read when opened.
- Delivery can be slow. The brief says how long to wait and what to record if mail does not arrive.

## Data changes

- Mark every free-text field the agent types with the profile's demo marker, for example "Walkthrough demo".
- Each brief names the end state of every record it creates or changes (cancelled, reset, left as draft). The report lists them under Created Records and Cleanup.
- Deleting records, changing users, roles or settings, and dispatching seed or reset jobs always need the owner.
- Do not use raw API calls to push a UI scenario forward, unless the profile allows it for session release.

## Errors

If a step fails, capture it, refresh and retry once, then continue with the checkpoints that do not depend on it.

## Cleanup

1. Log out every account and close every browser session.
2. Restore or cancel each demo record as the brief says, and reload to confirm.
3. Delete browser tool state from the run folder (for example `.playwright-cli/`), then run `check-profile.mjs scan`.
4. Confirm the tested repos match their baseline `git status`.
5. Record everything under Created Records and Cleanup.

## Reports

If the harness refuses to write the report file, return the whole report in the reply. The run owner saves it with a provenance line.
