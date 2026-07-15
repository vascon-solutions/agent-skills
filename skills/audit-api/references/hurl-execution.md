# Hurl And Curl Execution

## Hurl Eligibility

Use Hurl for dependent requests only when version 6.1 or newer is available, or
a local capability probe confirms secret variables and capture redaction. Run
from the external audit workspace. Keep each dependent journey in one scenario;
keep independent scenarios separate.

Use this baseline:

```bash
hurl --test --jobs 1 --no-output \
  --connect-timeout <seconds> --max-time <seconds> \
  --secret actor_password="$ACTOR_PASSWORD" \
  scenarios/journey.hurl
```

- Inject reusable credentials with `--secret` or a permission-restricted
  secrets file. Never put values in the scenario, URL, command history, or report.
- Capture every dynamic token, cookie, CSRF value, signed URL, or reusable auth
  value with the `redact` modifier.
- Capture nonsecret record IDs normally and use them for persistence checks.
- Use `--test --jobs 1` for stateful journeys. Do not generate HTML or JSON
  reports by default; they can retain raw response material.
- Treat stdout/stderr as sensitive until reviewed and sanitized. Avoid verbose
  modes unless diagnosing a bounded blocker.
- Keep TLS verification on. Use a supplied CA where needed; use `--insecure`
  only for an explicitly approved local fixture and disclose it.

## Retry, Idempotency, And Polling

- Do not use global `--retry` in a scenario containing a mutation.
- A safe independent read may be retried once after a transport or transient
  server failure.
- Retry a mutation only when the contract supplies idempotency and the brief
  authorizes it. Reuse the same key and reconcile before resending.
- For uncertain non-idempotent mutations, stop and look up the intended resource
  using a returned identifier or documented stable key.
- Poll only documented status endpoints, with a brief-defined interval, timeout,
  success states, and failure states. Record the terminal response, not every poll.

## Redirects

Do not enable automatic redirect following for authenticated requests by
default. Inspect the status and `Location`; verify scheme, origin, method
semantics, and whether credentials may be reused. Never forward credentials to a
different origin without explicit authorization.

## Hardened Curl Fallback

Start every curl invocation with `--disable` so user configuration cannot alter
the audit. Restrict protocols and avoid automatic redirects:

```bash
curl --disable --proto '=http,https' --proto-redir '=http,https' \
  --config "$PRIVATE_CONFIG" --silent --show-error \
  --connect-timeout <seconds> --max-time <seconds> \
  --output "$RAW_TEMP" --write-out '%{http_code}' "$URL"
```

- Reject URL userinfo. Put sensitive headers in a `0600` temporary config that
  is deleted during cleanup; keep the value out of argv.
- Do not use `--location` by default. Reissue an approved same-origin redirect
  manually after inspecting it.
- Keep `--fail-with-body` optional because negative cases need their bodies and
  statuses. Bound raw output, sanitize selected fields into evidence, then delete it.
- Apply the same retry, idempotency, polling, TLS, and reconciliation rules as Hurl.
