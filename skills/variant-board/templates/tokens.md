# Token map — <board>

Keep this file at `~/agent-artifacts/<topic>/markdown/<board>-tokens.md`. The board's `--app-*` block is produced from this table and the verifier compares the two; `resolved` values are re-read from the theme file at the recorded revision when the repo is available.

- Repo: `~/Code/<org>/<repo>`
- Theme file: `packages/ui/src/styles.css`
- Revision: `<short-sha>`
- Mode: light (add `dark` rows only when the app ships a dark mode; the mock's Scheme control swaps them)

| Board token | Source token | File | Mode | Revision | Value | Status | Note |
|---|---|---|---|---|---|---|---|
| `--app-background` | `--color-background` | `packages/ui/src/styles.css` | light | `<sha>` | `oklch(1 0 0)` | resolved | |
| `--app-foreground` | `--color-foreground` | `packages/ui/src/styles.css` | light | `<sha>` | `oklch(0.145 0.015 285.823)` | resolved | |
| `--app-border` | `--color-default` | `packages/ui/src/styles.css` | light | `<sha>` | `oklch(0.922 0.005 285.823)` | resolved | alias of `--color-border` |
| `--app-primary` | `--color-primary` | `packages/ui/src/styles.css` | light | `<sha>` | `#0e9384` | resolved | |
| `--app-font` | `body { font-family }` | `packages/ui/src/styles.css` | light | `<sha>` | `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` | resolved | full stack verbatim |
| `--app-radius-md` | `--radius-md` | `packages/ui/src/styles.css` | light | `<sha>` | `0.5rem` | resolved | |
| `--app-display-font` | `Inter (Google Fonts)` | `apps/web/app.css` | light | `<sha>` | `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` | substituted | web font cannot be embedded; system stack stands in |
| `--app-chart-1` | `--color-chart-1` | `packages/ui/src/styles.css` | light | `<sha>` | `#888888` | waived | owner decision in revision notes: charts are out of this board's scope |

Status meanings:

- `resolved` — the literal value from the theme source, aliases followed, never converted.
- `substituted` — a local stand-in for something that cannot be embedded; named in the masthead facts and the colophon.
- `waived` — the board owner recorded in the revision notes (`data-type="decision" data-waives="--app-…"`) that this role may stay unresolved, and why; named in the masthead facts and the colophon.
- `unresolved` — missing evidence. Any unresolved row makes the board a draft and blocks issuance.

Every `--app-*` token declared in the board needs a row, and every non-unresolved row needs a matching declaration.
