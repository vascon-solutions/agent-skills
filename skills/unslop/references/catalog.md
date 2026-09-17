# Rule Catalog

Stable ids. Cite by id. `scripts/scan.mjs` checks the ids marked (scan). The rest need judgment. The examples in this file trip the scanner on purpose, so do not scan it.

## Structure

- `reader-over-rule`. The rules serve the reader. When a rule makes the text worse, fix it another way or leave it alone. Vary sentence length; one idea per sentence does not mean one length per sentence.
- `outcome-first`. The first sentence states what was done, found, or decided.
- `gaps-first`. Unverified, failed, and skipped items follow the outcome, before any detail.
- `no-narration` (scan, partial). No description of the session: what you tried, read, ran, or will do next. "Let me", "First I looked at", "Now I'll", "I have now" are the usual tells.
- `omit-derivable`. Do not restate the diff, list every touched file, explain what the reader knows, or repeat the request.
- `no-repeat`. State a fact once, in the section that owns it.
- `surface-budget` (scan, with `--budget`). Stay inside the shape and word ceiling in [surfaces](surfaces.md).
- `no-overcompression`. Whole sentences with articles and verbs. No fragments, symbol-speak, or unexplained abbreviations. "Parser rejects bad date, exit 2" becomes "The parser rejects a bad date and exits with code 2."

## Evidence

- `evidence-not-adjectives`. Replace "thoroughly", "carefully", "robust", "significantly" with the command, the result, the location, or the number.
- `say-unverified`. A claim without evidence is labelled unverified, not softened with a hedge.
- `no-vague-attribution`. "Experts believe", "it is widely known", "best practice says". Name the source or delete.
- `generic-sentence`. A sentence that could appear unchanged in another project's report says nothing about this one. Cut it.

## Formatting

- `list-parallel`. Bullets for parallel items, one or two sentences each, never a paragraph.
- `numbers-in-table`. In replies and reports, several measurements or counts go in a table; a single number can sit in its sentence. Include a number only when it changes what the reader does.
- `bold-leadin-only` (scan). Bold a lead-in only when new detail follows. `**Performance:** performance improved` is a tell. `**Schema in TypeScript.** Tables live in one file.` is fine.
- `no-headers-short`. In replies and reports, no headers under about 500 words and at most three above it. Docs, specs, and references keep the headings their structure needs.
- `no-decorative-emoji` (scan). No emoji in headings or bullets.
- `code-in-blocks`. Multi-line commands, snippets, and error text go in fenced blocks. A short identifier, flag, path, or single command may sit inline in code font.
- `names-sparingly`. Name a file, symbol, or flag when the reader has to open it or when the relationship between names is the point. Describe the rest in words; a sentence dense with names restates the diff.

## Sentences

- `one-idea` (scan, `--max-words`). One idea per sentence, about 20 words, with a verb. Split the sentence that carries two thoughts.
- `active-voice` (scan, partial). Name the actor. "The compiler validates queries", not "queries are validated". Passive only when the actor is unknown or irrelevant.
- `plain-word` (scan). Use, help, many, if, because. Not utilize, facilitate, numerous, in the event that, due to the fact that.
- `keep-articles`. "Remove backup file" reads two ways. "Remove the backup file" reads one.
- `one-name`. One name per thing for the whole text. Do not cycle synonyms.
- `modifier-placement`. "Only" and "not" sit next to the word they change.
- `clear-referent`. Every "it", "this", "they" points at one obvious noun. Repeat the noun when in doubt. Never point "this" at a whole clause.
- `no-noun-string`. Break up strings of three or more nouns: "the script that checks the proto-import budget", not "the proto import budget check script".
- `no-adverb-prop`. An adverb propping a weak verb means the verb is wrong. "Runs quickly" becomes "is fast" or the number.

## Punctuation

- `no-em-dash` (scan). No em dashes, en dashes as dashes, or double hyphens. End the sentence or use a comma.
- `no-arrow-speak` (scan). No `->` or `→` in prose. Spell out "becomes", "then", "returns".
- `no-colon-connector`. A colon introduces a list or an example. It does not join two clauses.
- `no-slash-or` (scan, partial). "a, b, or both", not "a/b" or "and/or". No "(s)" plurals. The scanner flags literal "and/or" and "(s)". Other slash-separated alternatives, such as "yes/no" or "JSON/YAML", need contextual review to distinguish them from paths and units.
- `straight-quotes` (scan). Straight quotes and apostrophes.
- `no-semicolon`. Use a period.

## Vocabulary

- `no-filler` (scan). "In order to" is "to". "It is important to note that", "it's worth noting", "as mentioned above", "at the end of the day", "please note" are deleted.
- `no-hedge-stack` (scan). "Could potentially possibly" is "may". One hedge at most, and only when the uncertainty is real.
- `no-ai-vocab` (scan, partial). Delve, leverage, utilize, seamless, crucial, pivotal, showcase, foster, garner, tapestry, testament, vibrant, intricate, enhance, elevate, empower, holistic, cutting-edge, game-changer, realm, myriad. Use the plain word. Contextual review covers robust (of prose), landscape (abstract), underscore (verb), harness (verb), unlock (figurative), and journey (abstract). The scanner does not flag those contextual terms.
- `no-metaphor-noun` (scan, partial). Substrate, nexus, bedrock, north star, flywheel, paradigm, endgame. Name the concrete thing. Contextual review covers wedge (metaphor), vector (non-math), scaffolding (metaphor), ratchet (metaphor), and primitive (noun, outside its technical sense). The scanner does not flag those contextual terms.
- `no-not-just` (scan). "Not just X, but Y" and "not only X but also Y". State the point.
- `plain-is` (scan, partial). "Serves as", "stands as", "boasts", and "acts as" mean "is" or "has" and are scanned. Contextual review covers "features" used as a verb meaning "has". The scanner leaves that term unflagged because it can also be a noun.
- `no-rule-of-three`. Do not force ideas into groups of three. Use the real number.
- `no-false-range`. "From X to Y" only when X and Y sit on a real scale.
- `no-superficial-ing`. Trailing "highlighting", "ensuring", "showcasing", "reflecting" phrases add nothing. Delete or replace with the mechanism.
- `no-mannered`. No aphorisms, personified code, figurative verbs, or stock framing. "A dial worth turning" is "a parameter worth varying".

## Chat

- `no-chatbot` (scan). "I hope this helps", "let me know if", "feel free to", "happy to help", "Certainly!", "Of course!". Delete.
- `no-sycophancy` (scan). "Great question", "you're absolutely right", "excellent point". Respond to the content.
- `no-closing-offer`. Stop when the content stops. No offer of further help, no restatement.
- `no-self-commentary`. Do not describe your own reasoning, announce that no tools were needed, or apologise for length.
