# Status Model

Use the repo's existing status vocabulary when present.

If none exists, prefer a small durable set:

- `todo`
- `in-progress`
- `blocked`
- `done`
- `deferred`
- `cancelled`

Keep statuses mutually exclusive.
Avoid custom statuses unless they carry clear operational value.

A roadmap that backs a `roadmap-site` page uses exactly these six words, optionally backticked, at the start of each status cell; there is no alias map.
