# Example Shop roadmap

Status words: `todo`, `in-progress`, `blocked`, `done`, `deferred`, `cancelled`.

## Milestone summary

| Milestone | Window | Status |
|---|---|---|
| 1 | Q1 | done |
| 2 | Q2 | in progress, mostly |

## Milestone 1: Foundations
Outcome: The team can deploy a signed-in shell.

| ID | Item | Status | Task doc |
|---|---|---|---|
| 1.4 | Sign-in and session refresh | `done` | `.agent/tasks/1.4-sign-in.md` |
| 00-02 | Deploy pipeline for the **web** app | done — shipped with `v0.2` | — |

### Backend

| id | Item | Outcome | Status | Owner | Link |
|---|---|---|---|---|---|
| BE-03B | Catalog API: products and prices | Products can be created and priced | `in-progress` — PR open | api team | [PR](https://example.test/pr/12) |
| 03-04A | Inventory reservations | Stock prevents overselling | `blocked`: waiting on 1.4 follow-up | api team | — |

## Decisions

| ID | Decision | Status |
|---|---|---|
| D-1 | Use one database per environment | accepted |

## Milestone 2: Storefront

| # | Item | Status |
|---|---|---|
| 2.1 | Product listing page | todo |
| 2.2 | Saved carts | deferred |
| 2.3 | Gift cards | `cancelled` |

```markdown
| ID | Item | Status |
|---|---|---|
| X.1 | Example inside a code fence | nonsense |
```
