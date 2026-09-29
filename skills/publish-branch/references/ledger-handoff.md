# Publishing Under A Delivery Ledger

Use when the caller supplies a [delivery ledger](../../task-doc-delivery-loop/references/delivery-ledger.md). Without one, the normal standalone flow applies unchanged.

- Work under the caller's claim: pass its runtime, session, claim ID and current revision to every helper write. Never claim again, and never change the endpoint or any other authorization.
- Publish only the frozen candidate (`candidate.oid`) in exact-candidate mode. If a hook changes tracked content, the index or HEAD, stop and hand back to validation: the owner begins a change and freezes again.
- Before each external write, append a `prepared` publication event with the kind-specific target and intended value. For the first push to the delivery branch, `precondition.head_oid` is the expected remote state: the adopted OID, or `null` for an absent ref. Run `check --stage frozen` right before pushing so a moved or unexpected remote ref stops the write.
- After each write, read the specific remote object back, then append `verified` only if it matches. Otherwise append `uncertain`, `mismatch` or `failed` with the reason. On an uncertain result, inspect remote state and link the object that exists instead of writing again. Finish each item before starting the next.
- A partial success stays recorded when a later step fails. Report the remaining step rather than undoing the earlier one.
- Build the PR body with `summary-body`, which appends or replaces only this delivery's `agent-delivery-summary` block and preserves every other byte. Compare the current body hash immediately before writing, then read the body back. Send it with `--body-file` per [GitHub transport](github-transport.md).
- Hand back the verified event IDs for the owner's completion evidence, and the new PR observation for `record-context`.
