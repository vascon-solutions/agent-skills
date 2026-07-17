# Default Testing Policy

Use this policy when the repository does not provide a testing policy through an advertised delivery contract or its instruction files. Repository policy overrides this default; use this default for points the repository leaves unspecified.

- Add a permanent test only when it protects durable behavior or a contract: authentication, authorization, business or financial rules, API shapes, mutations, persistence, state or workflow transitions, route guards, or error recovery. Every new permanent test must name the risk it protects.
- Treat presentation details—copy, labels, ordering, styling, animation, and DOM structure—as one-time acceptance evidence rather than committed tests, unless the presentation is itself an accessibility, legal, or business contract.
- Write the failing reproduction first for bug fixes and write tests first for critical-tier behavior. For other work, implement first and then run the focused validation named by the task doc.
- Extend the nearest existing affected test file before creating a new one. Do not duplicate stronger coverage, and follow the repository's existing test framework and layout.
