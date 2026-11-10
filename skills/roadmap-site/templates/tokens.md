# Token map — <project> roadmap site

Keep this file beside the site config at `~/agent-artifacts/<project>/sites/<slug>/tokens.md`. `build` turns it into the `--app-*` block of the site stylesheet; status colours, spacing and the type scale are fixed and are not mapped.

- Repo: `~/Code/<org>/<repo>`
- Theme file: `packages/ui/src/styles.css`
- Revision: `<short-sha>`
- Mode: light (the site is always light)

| Site token | Source token | File | Mode | Revision | Value | Status | Note |
|---|---|---|---|---|---|---|---|
| `--app-primary` | `--color-primary` | `packages/ui/src/styles.css` | light | `<sha>` | `<value>` | unresolved | header band, primary buttons, focus ring |
| `--app-primary-foreground` | `--color-primary-foreground` | `packages/ui/src/styles.css` | light | `<sha>` | `<value>` | unresolved | text on the header band and primary buttons |
| `--app-background` | `--color-background` | `packages/ui/src/styles.css` | light | `<sha>` | `<value>` | unresolved | |
| `--app-foreground` | `--color-foreground` | `packages/ui/src/styles.css` | light | `<sha>` | `<value>` | unresolved | |
| `--app-muted` | `--color-muted-foreground` | `packages/ui/src/styles.css` | light | `<sha>` | `<value>` | unresolved | secondary text |
| `--app-border` | `--color-border` | `packages/ui/src/styles.css` | light | `<sha>` | `<value>` | unresolved | |
| `--app-radius` | `--radius-md` | `packages/ui/src/styles.css` | light | `<sha>` | `<value>` | unresolved | |
| `--app-font` | `body { font-family }` | `packages/ui/src/styles.css` | light | `<sha>` | `<value>` | unresolved | full stack verbatim; a web font is substituted with a system stack |

Status meanings, as in `variant-board`'s token map:

- `resolved` — the literal value from the theme source, aliases followed, never converted.
- `substituted` — a local stand-in for something the site cannot load, such as a web font replaced by a system stack. Named in the page colophon.
- `waived` — the owner decided this role keeps the shell default; the Note says why. Named in the page colophon.
- `unresolved` — missing evidence. `build` refuses while any row is unresolved.

Every one of the eight tokens needs exactly one row.
