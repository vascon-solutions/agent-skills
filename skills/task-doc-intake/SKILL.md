---
name: task-doc-intake
description: Use when an intended code or product change needs scoped discovery before a task doc. Accept complete notes; downshift small fixes to normal execution.
---

# Task Doc Intake

Ground an intended change in current code, resolve delivery scope, and pass an approved inventory to `task-doc`. Intake authors scope; `task-doc-delivery-loop` implements. Do not start a second external discovery or planning workflow.

For open-ended research before delivery scope is chosen, use `brainstorm`. A research recommendation or spec need not become a task doc. Keep ordinary implementation choices here rather than bouncing between skills. Reuse settled spec decisions and verify codebase fit, drift, and delivery boundaries.

## Classify And Route

Give a brief classification when it helps explain the next step:

- **Small/fix:** bounded immediate work with no material contract, persistent-state, permission, or migration change. Skip the task doc and return control to normal execution. If the user asked for a fix, perform that authorized work rather than ending the turn with a plan.
- **Improvement:** bounded multi-file change/refactor with known desired behavior. A durable task is useful when handoff, risk, or multiple sessions justify it.
- **Feature-grade:** new contracts/state, cross-module workflow, migration, or broad refactor requiring explicit scope and verification.
- **Open decisions:** investigate or interview the gaps before choosing delivery scope; use `brainstorm` only when exploration itself is the user's goal.

Honor explicit no-task-doc and output-only requests. Skipping documentation does not waive actual safety or permission boundaries, but it does not by itself require approval. Flag a material unresolved risk and ask only when it prevents safe execution. Do not turn a simple fix into a feature because adjacent improvements are possible.

Split independent outcomes only when separate delivery boundaries materially help; retain coherent vertical work and its necessary dependencies.

## Discover Only What Is Missing

Use guided interview when the user wants collaboration or behavior is unsettled, notes-first when requirements are supplied, and codebase-derived discovery when requested. Inspect relevant code before asserting current behavior or asking questions it can answer. Do not require a full repo map.

In an interview, ask one focused question at a time and carry answers into the inventory. For complete notes, inspect code and ask only material gaps; the first response may contain the completed inventory or task doc. For meaningful unsettled choices, compare credible options and tradeoffs with a recommendation. Preserve explicit user choices; do not manufacture alternatives or checkpoints.

For UI, cover the relevant route/search state, transitions, data, loading/errors, permissions, and reusable components. For refactors, identify the coupling/problem, preserved behavior, proposed boundary, and evidence that behavior stays intact. Use a visual only when it helps resolve a decision.

## Inventory And Handoff

Keep a compact record of objective, source/user intent, current behavior with file/symbol evidence, proposed scope, preserved contracts, exclusions, likely files, verification, and unresolved decisions. Stay within the requested page/workflow/system boundary.

Present the inventory for approval when scope was newly synthesized or a material decision remains. Already approved complete notes or an explicit instruction to create and implement do not require another approval solely because they passed through intake. If only part is unsettled, pause that part and continue independent discovery.

On approval or existing sufficient authorization, invoke `task-doc`. Intake's classification is authoritative for improvement/feature-grade work; do not repeat the size gate. Update an existing matching document rather than creating a duplicate.

## Authorization Boundary (HARD-GATE)

Intake does not edit implementation code. Document-only requests end with the document and any unresolved decisions. Approval of a spec or task doc alone is not an instruction to implement it. Conversely, explicit creation-and-implementation authorization carries through to `task-doc-delivery-loop` once the task is concrete and material blockers are resolved; do not ask again merely to cross the skill boundary.

Recommend `review-task-docs` when independent checking would materially reduce risk or the user requests it. Do not require an extra review or companion offer for every document. Report the task path and remaining decisions or continue the already-authorized delivery.
