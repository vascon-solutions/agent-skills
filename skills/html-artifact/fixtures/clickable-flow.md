# New-User Onboarding Flow

## Prototype Goal

Walk reviewers through the proposed three-screen onboarding without standing up an environment.

## Users And Scenario

A new user signing up for the first time. They have an email, no payment method yet.

## Screens States Or Steps

### Screen 1 — Welcome

Headline, two CTAs: "I'm here for work" and "I'm here for personal use".

### Screen 2 — Pick a workspace

Either choose an existing workspace by invite code or create a new one.

### Screen 3 — Add your first item

Quick win — one prefilled item to confirm the flow worked.

## Interaction Rules

- Forward navigation only via the CTA on each screen.
- Back navigation via a top-left link.
- Active screen marked with `aria-selected="true"` on its progress pill.

## Controls And Tunable Values

None — this is a navigation prototype, not a parameter sandbox.

## Content And Copy

Short headlines. No more than one paragraph per screen.

## Edge States

- Invite code invalid → inline error on screen 2.
- User skips workspace creation → land on a stub screen 3.

## HTML Artifact Notes

Render as `clickable-flow`. Screens marked `data-screen`, `showScreen()` switches visibility, active state via class plus `aria-selected`.

## Open Questions

- Do we need a dark-mode variant?

## Next Recommended Artifact Or Action

Frontend handoff once copy is final.
