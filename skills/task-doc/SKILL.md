---
name: task-doc
description: Create a durable task document from a bounded brief, spec, issue, or approved intake. Use for work needing a delivery handoff, not small immediate fixes.
---

# Task Doc

Create a durable source of truth for implementation. This skill authors the task document; it does not implement its contents. A calling workflow may continue separately when implementation is already authorized.

## Fit And Source

Use for multi-file/module/session work or a task needing explicit scope, contracts, verification, or teammate/agent handoff. An approved `task-doc-intake` classification of improvement or feature-grade is sufficient; do not re-litigate size.

For a small immediate fix, recommend a short session plan instead. If the user already asked for the fix, return control to normal implementation rather than ending their task at the downshift. Honor an explicit need for a durable handoff even when the diff is small.

Choose the source mode: roadmap, issue, PRD, brief, or codebase-derived. For source-specific guidance read [source modes](references/source-modes.md) only when needed. Transform authoritative bounded material without adding scope; synthesize incomplete inputs with clearly labeled assumptions. Reuse accepted specs and decisions, verifying drift-prone code claims instead of reopening settled discovery.

## Author

Use [task template](references/task-template.md), adapting to an established repo format. Preserve its information contract rather than adding empty ceremony. Include:

- Objective and authoritative source/design references; `Source Spec` for spec-derived work.
- Intended system boundary and architecture, with code evidence for current behavior.
- Scope, explicit exclusions, and current behavior/contracts to preserve.
- Prerequisites, likely inspection/write targets, and unresolved decisions.
- Deliverables and observable completion verification, with checks proportional to risk.

File paths and symbols ground current-code claims; likely files are orientation, not orders to edit them all. Missing source information stays unknown rather than becoming invented architecture. Material unresolved decisions identify realistic options, implications, and who or what resolves them. They block affected implementation until resolved, not unrelated work.

Do not turn the task into a line-by-line implementation recipe. Add dependent-phase ordering only when correctness needs it. Split only for independently shippable outcomes with materially distinct dependencies, risk, or verification, not for every component or test. Propose separate tasks unless the user already requested their creation.

Keep excluded and future work out of current deliverables and completion gates. Add approval gates only for specific unresolved consequential decisions/actions; work touching auth, finance, or infrastructure does not by itself cancel existing authorization. Do not require repeated approval of already accepted scope.

## Save And Check

Use the user's path, then repo instructions, then an existing task-doc directory/naming convention. If none exists, provide the content in conversation instead of inventing a task location. This is a delivery-task placement rule: exploratory `brainstorm` specs have a separate `docs/specs/` fallback and remain valid input without becoming task docs. Output-only requests stay in conversation. Update an active matching task document instead of creating duplicates.

Check that another agent can execute the task without hidden chat history, claims are grounded, scope and exclusions are clear, material decisions are explicit, and completion proves current-task outcomes. Use [examples](references/examples.md) only when the needed shape is unclear.

Return the document or its path with unresolved decisions when present. Do not append mandatory companion offers or start implementation/commits on your own. If the caller already authorized creation and delivery, hand back the completed doc and existing authorization so it can continue without another approval prompt.
