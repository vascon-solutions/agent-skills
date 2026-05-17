# Review: file.ts rename

## Review Context

Small refactor renaming a helper. Reviewer wants severity-tagged findings before merging.

## Files Or Diff Scope

- `src/file.ts` — single-line change

## Summary Verdict

Approve with one major comment about error handling.

## Annotated Findings

### Finding 1

Diff:

```diff
diff --git a/file.ts b/file.ts
@@ -1 +1 @@
-old
+new
```

Severity: Major. The renamed helper now swallows errors silently — callers that used to see the original throw won't notice.

## Severity Legend

- Critical: blocks merge
- Major: must address before merge
- Minor: nice-to-have
- Note: informational

## Suggested Reviewer Path

Skim the diff, read finding 1, decide whether to require the change or accept with a follow-up issue.

## Follow-Up Checks

- Confirm error-handling change is covered by tests.

## HTML Artifact Notes

Render as `diff-annotation`. Diff in `<pre>`, annotation rail with severity badge.

## Open Questions

- Is there an existing pattern for re-raising in this module?

## Next Recommended Artifact Or Action

Reply on the PR with the major finding and one suggested fix.
