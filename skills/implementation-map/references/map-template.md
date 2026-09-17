# Implementation Map Content Guide

Use for a requested durable map after collecting evidence. Scale the headings to the target; combine sections, omit empty topics, and keep a narrow map short. Focused chat explanations do not need this template.

## Identity And Scope

Name the feature, repository, inspected revision or worktree state, date, and boundaries covered. State important omissions without padding the document with irrelevant categories.

## Summary And Start Here

Explain what the feature does and the most useful starting point. A small table can identify the first files to read and why.

| File or symbol | Role |
| --- | --- |
| `<path>:<symbol>` | `<reason to start here>` |

## Runtime Flow

Trace the dominant lifecycle from entry to terminal effect, citing files at each step. Include another flow only when it materially differs. Use prose, numbered steps, or an embedded Mermaid diagram as appropriate.

For a meaningful boundary, explain the contract and owner: route to loader, UI to API, service to persistence, event to job, or package to consumer.

## State And Failure Handling

Include relevant stores, caches, tables, queues, side effects, auth/permission guards, validation, errors, retries, and transactions. Omit this section when these topics are not meaningful to the target. Identify behavior a future maintainer must preserve and cite its source.

## Tests And Uncertainty

| Test file or assertion | Behavior inspected | Execution evidence |
| --- | --- | --- |
| `<path>:<test>` | `<specific assertion or scenario>` | `<not run, or matching command/result>` |

Name uncertain boundaries and possible test gaps with the scope searched, including indirect coverage when present. If no tests were found, say where you looked; do not equate a missing adjacent test file with absence of coverage.

## Maintenance Candidates

Include only concrete signals relevant to the request. Use [gap heuristics](gap-heuristics.md); this is not a task plan.

| Candidate | Signal and consequence | Files | Confidence |
| --- | --- | --- | --- |
| `<candidate>` | `<observed evidence and why it matters>` | `<paths>` | `high` or `review` |

## Navigation And Companions

Add a grouped file index only when it helps beyond the Start Here table. Avoid duplicating the same inventory in multiple sections.

For requested companions, record the formats, source path, destinations, and generated or blocked status using [artifact rules](artifact-decision-rules.md). Plain Markdown maps need no artifact-decision boilerplate.
