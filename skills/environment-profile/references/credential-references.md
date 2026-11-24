# Credential references

A profile names how to obtain each credential and never the credential itself. Use one of these kinds per account group.

| Kind | Form in the profile | Use |
| --- | --- | --- |
| `repo-doc` | `repo-doc: <repo-relative path> § <heading>` | Non-secret facts only, such as account lists and which persona does what. Never a password. |
| `local-file` | `local-file: <key>` | A key in `~/.config/<project>/<env>.json`. The file is mode 600 and lives outside every repo. `<project>` and `<env>` are the profile's `project` and `environment` front matter values. |
| `vault` | `vault: <project>-<env>-<role>` | An agent-browser auth profile. For live guided walkthroughs only. The profile's Sessions section may name another pattern. |
| `ask` | `ask: owner` | The owner supplies the value for each session. Nobody stores it. |

Write the reference in the Credential column of the profile's Accounts table. When one key covers many accounts, a table of key names in the Credential references section does the same job.

## The local file

The file holds one flat JSON object of string values. Create the folder with mode 700 and the file with mode 600:

```bash
umask 077
mkdir -p ~/.config/<project>
[ -e ~/.config/<project>/<env>.json ] \
  || printf '{\n  "note": "<project> <env> test credentials. Never commit.",\n  "<key>": ""\n}\n' > ~/.config/<project>/<env>.json
chmod 700 ~/.config/<project>
chmod 600 ~/.config/<project>/<env>.json
ls -ld ~/.config/<project> ~/.config/<project>/<env>.json
```

The modes that `ls` prints must start with `drwx------` and `-rw-------`.

- The owner types the values into the file in an editor. An agent never puts a value on a command line, in a chat message or in a here-document, because each of those is logged.
- The checker treats every key as a credential except the metadata keys `note`, `sources`, `project`, `environment`, `created` and `updated`. Keep account emails and other non-secret facts in the profile, because the scan reports every place a stored value appears. A basic-auth user name may sit beside its password.
- To see which keys exist, print the names only with `jq -r 'keys_unsorted[]' ~/.config/<project>/<env>.json`. Never `cat` the file, open it in a viewer or print a value to check it.

## Using a `local-file` key without printing it

- The command text names the key or a variable, never the value.
- Prefer a pipe from `jq` into the command that needs the value. Use a shell variable only when the tool takes the value as an argument, and unset it afterwards.
- Run each snippet in one shell invocation. Many agent shells do not keep variables between calls.
- `jq -e` exits non-zero on a missing key, so the `&&` after it stops the text `null` from being typed as a password.
- Before a new tool sees a real value, run the same command with a dummy value and read what it prints and saves.

Browser audit (`audit-ui`, playwright-cli):

```bash
PW="$(jq -er '.<key>' ~/.config/<project>/<env>.json)" \
  && playwright-cli fill <password-ref> "$PW" 2>&1 | grep -E '^### (Ran Playwright code|Error)'
unset PW
```

`fill` prints the code it ran, with the value in it. The `grep` keeps only the status line. A snapshot taken while the field is filled shows the value too, so submit the form before the next snapshot, and reload the page if the sign-in fails. Snapshot files and console logs under `.playwright-cli/` can still hold the value. Delete that folder from the run folder before you finish.

HTTP audit (`audit-api`, curl or Hurl):

```bash
TOKEN="$(jq '{email: "<account>", password: .<key>}' ~/.config/<project>/<env>.json \
  | curl -sS -H 'Content-Type: application/json' --data @- "<api-origin>/<login-path>" \
  | jq -er '<token-path>')"
```

Shape the body to the API's login contract. The value goes from the file to curl's standard input, so it never appears in an argument list. Keep `TOKEN` in the shell only, and redact `Authorization` in saved logs.

For Hurl, export the value as a secret variable, which Hurl redacts in its output. The `audit-api` Hurl reference owns the rest.

```bash
export HURL_SECRET_actor_password="$(jq -er '.<key>' ~/.config/<project>/<env>.json)"
```

Live walkthrough (`agent-browser`):

```bash
agent-browser auth list
jq -er '.<key>' ~/.config/<project>/<env>.json \
  | agent-browser auth save <project>-<env>-<role> --url "<login-url>" --username "<account>" --password-stdin
agent-browser auth login <project>-<env>-<role>
```

Reuse a profile that `auth list` already shows. Verify that a new profile signs in before relying on it. Log out through the UI at the end of the walkthrough.

Basic auth, for example a mail sandbox:

```bash
jq -r '"user = \(.<user-key> + ":" + .<password-key> | @json)"' ~/.config/<project>/<env>.json \
  | curl -sS -K - "<mail-origin>/<search-path>"
```

curl reads the credential as a config line on standard input. Never put a credential in a URL, because browser and console logs keep URLs. A browser tool that needs HTTP credentials takes them from its own option or config file. Build that file from the credentials file with `jq`, keep it mode 600 and outside the run folder, and delete it at cleanup.

## Checking for leaks

Before a run folder is kept or shared:

```bash
node <skill>/scripts/check-profile.mjs scan <run-folder> --values ~/.config/<project>/<env>.json
```

The scan reports file names, key names and counts only. A `FOUND` line means the named file holds that key's value: delete or redact the file, then scan again.
