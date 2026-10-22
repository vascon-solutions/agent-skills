# Capture and inspection

audit-ui runs every capture. This file says what a walkthrough's audit brief must contain and how to inspect images before they go on a page.

## Audit brief for a walkthrough

Start from audit-ui's own brief template and fill these lines for the walkthrough:

- **Mode.** `journey`.
- **Feature.** "product walkthrough of <scope items>", naming the walkthrough folder it feeds.
- **Candidate identity.** The served builds and how they were confirmed, copied from the manifest.
- **Screenshot maximum.** A range per scope item plus a total, for example "4-8 per item, 40 total". audit-ui's default of 12 is too low for a walkthrough; the brief overrides it.
- **Actors and credential sources.** One task session per account. Name where each password comes from; never write it in the brief.
- **Allowed mutations.** Only the demo records the walkthrough needs, each carrying the marker text from the manifest, such as "Walkthrough demo". Name the end state for each, for example "cancelled after capture".
- **Cleanup requirement.** Release every account (for example logout-all), restore or cancel every demo record, close every browser session, and record all of it in `report.md` under Created Records and Cleanup.
- **Capture rules.** The rules below.

A capture needed after the report is written is a new run under the same audit slug, with its own short brief and report. Do not add files to a finished run.

## Capture rules

- Capture at one viewport for the whole walkthrough, normally 1440x900, unless the brief asks for a phone view.
- Mail sandboxes (Mailpit and similar): capture the rendered HTML view only. Never capture the Text, Raw, Headers, Source or link-check views, which show tokenized links.
- Never capture an address bar, developer tools, a network panel or a page that echoes a token or password back.
- Prefer seeded test accounts and demo records. Keep other people's real data off the screen; if it cannot be avoided, pick another record.
- Name raw captures by scope item and step (`15-02-scheduled.png`); keep failed or extra attempts with an `x` step (`15-x-retry.png`) so they are not mistaken for curated shots.

## Inspection checklist

Open every curated image and confirm each line before it goes on the page:

- [ ] No URL with a token, code, signature or session id is readable, including link previews and toasts.
- [ ] No password, API key or one-time code is visible, even masked fields that reveal their length or a "show" toggle.
- [ ] Every person and email shown is a seeded test account or a demo record named in the manifest.
- [ ] Every hostname shown is under the manifest's allowed origins. No production hostname appears anywhere.
- [ ] The screen matches its caption: the actor, the record and the state named are what the image shows.
- [ ] Nothing is cropped that the page text relies on.

When a line fails, recapture through audit-ui with a narrower view or a different record. Do not blur, crop or paint over pixels; an edited screenshot no longer shows the shipped screen.
