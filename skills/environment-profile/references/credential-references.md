# Credential references

A profile names how to obtain each credential and never the credential itself. Use one of these kinds per account group.

| Kind | Form in the profile | Use |
| --- | --- | --- |
| `repo-doc` | `repo-doc: <repo-relative path> § <heading>` | Non-secret facts only, such as account lists and which persona does what. Never a password. |
| `local-file` | `local-file: <key>` | A key in `~/.config/<project>/<env>.json`. The file is mode 600 and lives outside every repo. `<project>` is the profile's `project` front matter value. |
| `vault` | `vault: <project>-<env>-<role>` | An agent-browser auth profile. For live guided walkthroughs only. |
| `ask` | `ask: owner` | The owner supplies the value for each session. Nobody stores it. |

## The local file

- Create the folder with mode 700 and the file with mode 600. Store one flat JSON object of string values. The checker treats every key as a credential except the metadata keys `note`, `sources`, `project`, `environment`, `created` and `updated`.
- Never `cat` the file or run `jq` on it to look at it. Read one key at a time, straight into the command that needs it.

## Using a `local-file` key without printing it

The command text names the key or a variable, never the value.

Browser audit (`audit-ui`, playwright-cli). Put the value in a variable, then fill the field with the variable:

```bash
PW="$(jq -r .internalPassword ~/.config/<project>/<env>.json)"
playwright-cli fill <password-ref> "$PW"
unset PW
```

The page snapshot taken after typing can hold the value. Delete the run folder's `.playwright-cli/` before you finish.

HTTP audit (`audit-api`, curl or hurl):

```bash
export HURL_SECRET_actor_password="$(jq -r .internalPassword ~/.config/<project>/<env>.json)"
TOKEN="$(jq -n --arg p "$HURL_SECRET_actor_password" '{email:"<account>",password:$p}' \
  | curl -s -H 'Content-Type: application/json' --data @- <api-origin>/<login-path> | jq -r '<token-path>')"
```

Hurl redacts `HURL_SECRET_*` variables in its output. Keep `TOKEN` in the shell only. Redact `Authorization` in saved logs.

Live walkthrough (`agent-browser`):

```bash
jq -r .internalPassword ~/.config/<project>/<env>.json \
  | agent-browser auth save <project>-<env>-<role> --url <login-url> --username <account> --password-stdin
agent-browser auth login <project>-<env>-<role>
```

Check `agent-browser auth list` before saving. Verify a new profile signs in before relying on it. Log out through the UI at the end of the walkthrough.

Basic auth (mail sandbox). Never put the credential in a URL, because browser logs keep URLs. Use the tool's HTTP credentials option, or a header built from variables:

```bash
MU="$(jq -r .mailpitUser ~/.config/<project>/<env>.json)"; MP="$(jq -r .mailpitPassword ~/.config/<project>/<env>.json)"
curl -s -u "$MU:$MP" "<mail-origin>/api/v1/search?query=..." ; unset MU MP
```

## Checking for leaks

Before a run folder is kept or shared:

```bash
node <skill>/scripts/check-profile.mjs scan <run-folder> --values ~/.config/<project>/<env>.json
```

The scan reports file names, key names and counts only.
