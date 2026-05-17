# Core Design Tokens

## Reference Goal

Make the token set copyable and visible in a single browser file for product engineers who don't have the Figma library installed.

## Token Sources

- `src/tokens/colors.ts`
- `src/tokens/spacing.ts`
- `src/tokens/typography.ts`

## Color Tokens

| Name | Value | Use |
|---|---|---|
| `color.fg.default` | `#0f172a` | body text |
| `color.fg.muted` | `#64748b` | secondary text |
| `color.accent` | `#0066cc` | links, primary action |
| `color.warn` | `#b45309` | warnings |
| `color.danger` | `#dc2626` | destructive action |

## Typography Tokens

| Name | Value |
|---|---|
| `font.sans` | `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` |
| `text.body` | `15px / 1.6` |
| `text.h1` | `2rem / 1.2` |
| `text.h2` | `1.2rem / 1.4` |

## Spacing Radius And Shadows

| Name | Value |
|---|---|
| `space.1` | `4px` |
| `space.2` | `8px` |
| `space.4` | `16px` |
| `radius.sm` | `4px` |
| `radius.md` | `6px` |

## Component Usage Notes

Inputs use `color.fg.muted` for placeholder and `color.fg.default` once filled.

## Copyable Values

Each token value should be copyable with one click in the rendered HTML.

## HTML Artifact Notes

Render as `design-system-tokens`. Token rows with swatches for color tokens, `copyToken()` on click.

## Open Questions

- Should `color.accent` shift in dark mode?

## Next Recommended Artifact Or Action

Wire `--use-repo-design` once the token file landing places stabilize.
