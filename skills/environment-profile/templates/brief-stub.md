# <Scope> brief: <ENV>

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
