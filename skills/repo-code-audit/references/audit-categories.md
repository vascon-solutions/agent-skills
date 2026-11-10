# Audit Categories

What to look for in each category, and the shape every finding takes. Scale depth to the code in scope. A claim without a location is not a finding; for something missing, the location is the manifest or configuration file where the absence shows, or the paths searched. For example, "probably has N+1 queries" is a guess, "`orders/api.ts:142` issues one query per order item inside a loop" is a finding.

Framework-specific rules belong to the repository's own standards and any installed standards skill. Use them where they apply; do not restate them here.

## Defects

Bugs established by reading the code.

- Errors swallowed, logged and dropped on critical paths, or missing from UI states.
- Unawaited promises, shared state written from concurrent paths, effects and listeners with no cleanup.
- Values asserted non-null that can be null, unchecked indexing, empty-collection and boundary cases.
- Status enums or state machines with unhandled branches, including defaults that silently do nothing.
- Check-then-act on shared resources, multi-write operations without a transaction, retried operations that are not idempotent.
- Clusters of type escapes (`any`, casts, suppressions) on load-bearing code.
- Handles, connections, and subscriptions that are never released.
- Time zone, locale, and money arithmetic assumptions.

## Security

Report only what the code supports. Describe the pattern, the production impact, and the remediation at the level of code, configuration, and tests. Do not include working exploit input.

- Credentials in source, committed environment files, logs, or persisted history. Location and type only.
- Request data reaching SQL, shell, HTML sinks, dynamic evaluation, or filesystem paths without a safe API or validation boundary.
- Endpoints or server actions without a server-side identity check, authorization enforced only in the client, object access by identifier without an ownership or tenant check, state-changing routes without request authenticity.
- API boundaries that trust request bodies without a schema, uploads without type, size, and storage limits, request data assigned wholesale into persistence models.
- Sensitive mutations with no audit trail where the repository otherwise keeps one.
- Critical or high dependency advisories that reach runtime or distribution paths. Skip low-signal audit noise.
- Broad CORS with credentials, cookies missing protective attributes, debug behavior enabled in production configuration.
- Personal or sensitive data in logs, stack traces or internal errors returned to clients.

Standard platform conventions are intended behavior: honoring proxy environment variables, reading a user's credential file, a local developer tool invoking the configured package manager. Report them only when the implementation adds risk beyond the convention.

## Performance

Algorithmic and architectural cost, not micro-optimization.

- A query or request per item inside a loop or per rendered row.
- Repeated scans of one collection where a keyed lookup belongs.
- The same expensive computation or fetch repeated per request or render with no caching boundary.
- Unbounded lists, whole objects fetched where identifiers suffice, large payloads sent to clients.
- Heavy dependencies for trivial use, no code splitting on rarely visited routes, client fetching of data available at render time, request waterfalls.
- Synchronous work on the request path that belongs in a job; query patterns that imply a missing index. Mark index claims `investigate` without schema evidence.
- Continuous integration with no caching, redundant steps, or suites that could run in parallel.

## Untested Risk

The question is which untested code is dangerous, not what the coverage percentage is.

- Critical paths (money, authentication, authorization, data mutation, the feature the repository exists for) with no or trivial coverage.
- High churn with no tests: candidates for characterization tests before any refactor.
- No single command that shows the codebase works.
- Flaky patterns on critical paths: real timers, real network, order dependence.

Leave redundant or low-value tests to `test-audit`. Report a gap only where a named regression would go unnoticed.

## Structure And Debt

- The same logic implemented in three or more places, especially copies that have drifted.
- Layering violations, circular dependencies, catch-all utility modules with high fan-in.
- Dead code: unused modules, fully rolled-out flags still branching, manifest dependencies no longer imported.
- Files far larger than the repository median that everything touches; functions with deep nesting or long parameter lists.
- Several patterns for the same job (data fetching, error handling, styling). Name the one the code most recently converged on.
- Abstractions with one implementation, or a missing abstraction where one change always touches several files in step.

## Dependencies And Migrations

- Major-version lag on the core framework or runtime where staying behind has a real cost: end of life, security-fix cutoff, ecosystem incompatibility.
- Deprecated APIs with an announced removal date.
- Abandoned dependencies on critical paths.
- Two dependencies solving one problem.
- Lockfile and manifest drift, inconsistent pinning across workspaces.

Estimate the number of files a migration touches. That drives effort and whether it is worth recommending.

## Tooling And Developer Experience

- Missing or broken typecheck, lint, format, or pre-commit configuration.
- Feedback loops measured in minutes: slow startup, no watch mode.
- Required environment variables with no example file or declared schema.
- Services with unstructured logs or no request correlation.

Instruction files and documentation, including wrong or incomplete setup instructions, belong to `repair-agent-files` and `repo-docs-audit`. Note the gap in one line and name the owner.

## Direction Signals

What the codebase is evidently trying to become. A suggestion that would fit any project in the category is noise. Ground each one in:

- unfinished intent: TODO clusters on one theme, flags never rolled out, stubbed modules, abandoned work visible in history;
- stated but undelivered: roadmap, spec, or documentation promises with no code, options that do nothing;
- asymmetries: export without import, create without bulk create, a missing operation on an otherwise complete entity;
- capabilities the existing architecture makes unusually cheap;
- work users evidently do by hand around the project.

Never propose something a decision record rejected; note the contradiction instead. Impact here is user or product value, and the evidence class says how well grounded the signal is, not whether it is the right call.

## Finding Format

```markdown
### [CATEGORY-NN] Short imperative title

- **Evidence**: `path/file.ts:123` — what is there, in one sentence. Two to five strongest locations; add "and about N similar sites" when widespread.
- **Impact**: what goes wrong or what it costs, concretely.
- **Effort**: S (hours), M (about a day), L (several days), for the fix including verification.
- **Fix risk**: LOW, MED, or HIGH, with one line on what the fix could break.
- **Evidence class**: verified, inferred, or investigate.
- **Fix sketch**: one to three sentences, enough to judge effort. Not a plan.
- **Prerequisites**: other findings that must land first, or none.
```
