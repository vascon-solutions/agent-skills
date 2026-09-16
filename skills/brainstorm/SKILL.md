---
name: brainstorm
description: Explore unsettled ideas and product or technical questions through discussion and research, with an optional design spec. Use before delivery scope is chosen, not for executing an approved task.
---

# Brainstorm

Help the user understand a question, compare credible approaches, and decide what is worth doing. A useful endpoint may be a recommendation, research brief, design spec, further investigation, or a decision not to proceed.

## Scope And Routing

- Use for exploratory research and design when the problem, opportunity, or approach is unsettled. A simple factual question does not need this workflow.
- Use `task-doc-intake` when the user wants to define a bounded change for delivery. Keep ordinary implementation choices there; do not bounce between skills for each uncertainty.
- An existing approved spec or task doc is context to preserve, not a reason to restart discovery. Revisit decisions only when the user asks or new evidence materially challenges them.
- This skill owns exploration and specification. Do not automatically create task docs, implementation plans, code, commits, or PRs. If the user requests those next, hand off with the existing decisions and authorization intact.

## Explore Proportionately

Start from the user's question, supplied material, constraints, and intended audience. Inspect relevant code or documents before making claims about current behavior; avoid broad repository tours without a research need.

Ask questions whose answers change the investigation or design. During a guided interview, ask one focused question at a time. Accept complete notes and established decisions without repeating the interview or requiring a minimum number of turns. While waiting on a decision, continue independent research where useful.

If the brief contains independent problems, identify their relationship and propose a manageable scope before diving into details. Do not turn every subproblem into a separate artifact.

For meaningful choices, compare two or three credible approaches against the user's constraints and lead with a reasoned recommendation. Do not manufacture alternatives for settled or obvious decisions. Include the status quo when it is a viable option; challenge unnecessary features and unsupported assumptions.

Use diagrams, mockups, or other visuals when they help resolve a question. They are optional discussion aids, not a required stage or source of authority.

For requested prototypes or visual comparison, reuse the current spec or capture a concise Markdown brief with `markdown-artifact`; no task doc is required. Use `html-artifact` for clickable flows and `image-artifact` for static directions. Put derived files in one matching `~/agent-artifacts/<topic>/` workspace with explicit output paths, while preserving any repo spec as the authoritative source. Use `artifact-workbench` to serve the requested preview, with `--live` for iteration and `--capture-selections` for requested browser choices. A request to create and preview authorizes this sequence without separate companion approvals. Read recorded choices alongside chat feedback and update the spec's decisions. Prototype code is a discussion aid; it does not authorize production implementation.

## Research Discipline

- Prefer primary sources and inspect the underlying material before citing it. Verify current or uncertain technical claims using relevant documentation, code, or available research tools.
- Separate sourced facts, code observations, inferences, assumptions, and user decisions. Cite external claims with links and code claims with file/symbol references. Never present an unrun experiment as evidence.
- Look for evidence that could disprove the preferred approach. Explain conflicting sources, applicability limits, and important gaps rather than hiding them behind confident recommendations.
- Keep research bounded by the decision: stop when more searching is unlikely to change the recommendation, or identify the specific unanswered question and what would resolve it. Do not imply exhaustive coverage.

## Develop And Close

Check consequential product or architecture choices with the user when they remain unresolved. Carry settled decisions forward without approval after every section. Distinguish a proposed design from one the user has accepted.

Choose an output proportional to the request:

- **Recommendation:** the decision, reasons, tradeoffs, and remaining uncertainty.
- **Research brief:** the question, evidence, competing explanations or approaches, findings, and open questions.
- **Design spec:** the problem and objectives, scope and exclusions, agreed or proposed approach, relevant behavior and system boundaries, risks, alternatives, and unresolved decisions. Include validation criteria where they help assess the design, not a line-by-line implementation recipe.

Before presenting a spec, check contradictions, unsupported assumptions, ambiguous behavior, missing boundaries, and whether the evidence supports its claims. Resolve what the evidence permits; label remaining questions rather than inventing answers.

Keep short exploration and recommendations in conversation. Save a developed design spec or substantial research brief automatically unless the user requests chat-only/output-only. Use the user's specified path first; for repo-bound work, use the existing relevant spec convention, otherwise `docs/specs/<topic>.md`. For cross-repository or repo-independent research, use `~/agent-artifacts/<topic>/markdown/spec.md` or `research-brief.md` as appropriate. This fallback is for exploratory specs and briefs, not delivery task documents; `task-doc` preserves the repository task-location policy when the spec is handed off. Use a descriptive topic slug and avoid creating empty companion folders.

Update the same artifact as discussion develops; inspect an existing matching file before editing and avoid overwriting unrelated work. Mark the document proposed or accepted based on actual user decisions, record unresolved questions, and return its path. Saving is not approval and does not authorize a commit, task doc, or implementation.

Finish when the requested exploration or artifact is complete, stating the recommendation and any unresolved decisions. Creating a task doc is not a completion requirement. If delivery is subsequently requested, pass the spec and decision context to `task-doc-intake`; it checks codebase fit, drift, and delivery boundaries without repeating settled exploration.
