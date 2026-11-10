# Roadmap Template

Use the repo's existing format when one already exists.

If starting from scratch, keep the roadmap lean:

- title
- status legend
- grouped sections or phases
- short backlog items
- optional links to task docs or source issues

Each item should answer:

- what is the feature or change
- what status is it in
- what follows from it

Do not pack verification details or execution checklists into the roadmap.

## Example

```markdown
## Auth & Access Control
Outcome: Only the right people reach admin screens.

| # | Item | Outcome | Status | Task doc |
|---|---|---|---|---|
| 1 | Role-based route guards | Admin routes refuse other roles | done | tasks/001-rbac-guards.md |
| 2 | Session token rotation | Stolen sessions expire quickly | in-progress | tasks/002-token-rotation.md |
| 3 | Audit log for permission changes | — | todo | — |
```

The `Outcome:` line and the `Outcome` column are optional: a plain-language result for readers who do not know the item names. This is also the minimum format a `roadmap-site` page reads: a level 2 or 3 heading per group, an `ID` or `#` column, `Item`, `Status` with one of the six status words (text after the word is a note), and optional `Outcome` and `Task doc` or `Link` columns.

