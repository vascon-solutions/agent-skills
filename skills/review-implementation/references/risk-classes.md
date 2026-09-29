# Review Risk Classes

Apply relevant risks to the whole intended candidate diff and named equivalent
touched paths. These are review prompts, not a requirement for unrelated tests.

For stateful UI (dialogs, forms, drafts, retry or idempotency tokens):

- **Identity change (`identity-reset`):** a component the router or parent reuses across records (for example a route param change) drops dialogs, form values, and attempt tokens, so an action opened for one record cannot run against the next.
- **Async prerequisites (`async-prerequisite`):** distinguish loading, failure and absence; allow independent input where safe, but block dependent actions until required reads succeed.
- **Version conflicts (`version-conflict-recovery`):** block blind retries; refresh and reset or explicitly reconcile edits against the new version before resubmission.

For protected reads and mutations:

- **Authorization (`authorization-leak`):** verify server-enforced actor, tenant, and object scope; UI hiding is not enforcement. Include stale-permission, wrong-actor, and denied-transition behavior where relevant.

Also consider `stale-cache-after-mutation` for affected cached reads and
`batch-publication-verification` for per-item publication identity and read-back.
The vocabulary is deliberately short and may grow. Give every finding a shape,
including a proposed new label when none fits. Keep proposals in the delivery
ledger; promotion to this checklist requires user acceptance and separate
authorized skill-pack work. A product delivery never edits the global pack.

Before pushing remediation, search the whole intended candidate diff and named
equivalent touched paths for every shape fixed in the batch. Record search scope,
zero or more siblings, fixes and validation evidence in `defect_shapes`. Fix and
validate in-scope siblings; do not expand into unrelated existing defects.
A re-review checks the shapes, not just the reported lines.
