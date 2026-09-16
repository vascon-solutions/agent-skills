---
name: unslop
description: Use when writing or rewriting coding-agent output so a reader who did not watch the session understands it on the first read, including chat replies, completion reports, review findings, PR descriptions, commit messages, handoffs, and docs. Write mode applies while producing output; edit mode rewrites a named target.
---

# Unslop

Write for a reader who was not in the session. They see only this text. They want to know what happened, what it means for them, and what is still open. Everything else is cost.

## Two Modes

**Write mode** applies whenever you produce text a person will read. Pick the surface shape from [surfaces](references/surfaces.md), draft, then check the draft against the rules below. Text that lands in a file or on GitHub (PR body, commit message, doc) also gets the scanner.

**Edit mode** runs on request: `unslop <target>` with optional extra rules such as `no tables` or `under 100 words`. Read the target, identify its surface, rewrite it, run the scanner, and report. Keep every fact and every decision. Do not add facts. If a claim has no support in the source, flag it in the report instead of deleting it or inventing support. Show before and after for short targets and a diff for long ones.

## Rules

Rule ids come from the [catalog](references/catalog.md). Cite them by id when another skill or a review needs to point at one. The rules serve the reader. When a rule makes a sentence or a document worse, fix it another way or leave it alone. Vary sentence length so the text does not read as clipped fragments. (`reader-over-rule`)

**Lead with the outcome.** The first sentence says what was done, found, or decided. Anything unverified, failed, or skipped comes right after, before detail. The reader should be able to stop after the first paragraph. (`outcome-first`, `gaps-first`)

**Cut the narration.** No play-by-play of what you tried, looked at, or are about to do. No "Let me", "First I", "Now I'll". The report describes the result, not the session. (`no-narration`)

**Evidence, not adjectives.** "Tested thoroughly" says nothing. The command and its result, the file and line, the number: these say something. If you cannot point at evidence, say the claim is unverified. (`evidence-not-adjectives`, `say-unverified`)

**Omit what the reader can derive.** Do not restate the diff or list every touched file when the diff shows it. Do not explain a concept the reader knows or repeat context from an earlier section. (`omit-derivable`, `no-repeat`)

**Fit the surface.** Each surface in the reference has a shape and a word budget. Shorten by leaving things out, not by compressing sentences into fragments. (`surface-budget`, `no-overcompression`)

**Structure for scanning.** Bullets for parallel items, one or two sentences each. Prose for an argument. In replies and reports, put several numbers in a table and skip headers below about 500 words; docs and specs keep the structure their mode needs. Bold a lead-in only when new detail follows it. No decorative emoji. (`list-parallel`, `numbers-in-table`, `bold-leadin-only`, `no-decorative-emoji`)

**One idea per sentence.** About 20 words. Active voice: name the actor. Plain words: use, help, many, if. Keep articles and the small words that make a sentence parse one way. (`one-idea`, `active-voice`, `plain-word`, `keep-articles`)

**No crutch punctuation.** No em dashes, no arrows, no mid-sentence colons, no slashes for "or". End the sentence or use a comma. Straight quotes. (`no-em-dash`, `no-arrow-speak`, `no-colon-connector`, `no-slash-or`, `straight-quotes`)

**Drop the tells.** Filler, hedge stacks, AI vocabulary, metaphor nouns, `not just X but Y`, fancy ways to say "is", chatbot sign-offs, and praise of the question or the user. (`no-filler`, `no-hedge-stack`, `no-ai-vocab`, `no-metaphor-noun`, `no-not-just`, `plain-is`, `no-chatbot`, `no-sycophancy`)

**Names belong where the reader must go.** Write the real file, symbol, or flag in code font when the reader has to open it. Also name things when their relationship is the point, such as `loadConfig` reading `config.json`. Describe the rest in words; a sentence dense with names restates the diff. Multi-line commands, snippets, and error text go in fenced blocks. Call each thing by one name throughout. (`names-sparingly`, `code-in-blocks`, `one-name`)

## Scanner

`scripts/scan.mjs` flags the mechanical subset of the catalog with line numbers. It skips fenced code, inline code, and URLs.

```sh
node scripts/scan.mjs pr-body.md
git log -1 --format=%B | node scripts/scan.mjs --stdin
node scripts/scan.mjs --staged
node scripts/scan.mjs --budget 200 --max-words 25 report.md
```

Exit code 1 means hits. Fix them or state why a hit stays. The scanner cannot judge structure, evidence, or omission; those rules are yours to check by reading the draft as the recipient.

## Self-Check

Before sending, read the draft as the recipient and answer:

1. Can they stop after the first paragraph and know the outcome?
2. Is every unverified, failed, or skipped item stated, not softened?
3. Does any sentence describe the session instead of the result?
4. Could any sentence appear unchanged in a different project's report? Cut it.
5. Is it inside the surface budget?

## Boundaries

This skill owns prose. Code comments belong to the code's own conventions. Product UI strings follow product copy rules. Concision never hides a gap: a shorter report that drops a failure is worse than a longer one that states it.
