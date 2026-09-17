# Documentation Policy

Use this policy when auditing, rewriting, or reviewing repository docs, and when moving project knowledge out of agent instructions.

## Placement

Honor an explicit destination, then established repository and package conventions. With no convention, place new general project docs under `docs/` with lowercase descriptive filenames. Keep platform- or release-tool files such as `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, and license files where their consumers expect them. Preserve legitimate package-local docs and scoped agent instruction files.

Do not move an existing file solely to normalize casing or location. For a justified move or merge, update incoming links, anchors, navigation, scripts, and tooling references in scope. Identify external consumers that cannot be updated locally. Edit generated documentation at its maintained source and use its generator when appropriate.

## Source Authority

- **Implemented behavior.** Verify against active code paths, configuration, and relevant tests. Package names or environment variables alone do not prove an integration is active.
- **Requirements and domain rules.** Cite user instructions, accepted specifications, maintained policy/domain sources, or attributed domain-owner input. They can be authoritative without being implemented.
- **Decision rationale.** Preserve relevant architectural decisions and their status. Historical rationale is not a claim about current behavior.
- **Inference or unknown.** Label the inference and its basis, or state the missing source. Do not turn an unverified legacy claim into an authoritative requirement.

When implementation conflicts with an accepted rule, document the discrepancy and preserve both sources. Do not silently rewrite the rule to match code or claim the rule is enforced. Verify external requirements from their authoritative sources when the task requires it; do not invent compliance claims from the repository's industry.

## Authorized Edits And Preservation

Stay within the requested docs and established cleanup scope. An audit verdict proposes an edit; it does not itself authorize one. A request to apply cleanup does authorize the necessary scoped edits without another blanket approval gate.

Check tracked, staged, unstaged, untracked, and relevant ignored content before replacing or removing it. A tracked path can still contain changes absent from Git history. Preserve unrelated work and unique content needed after consolidation.

Before an authorized removal or overwrite, ensure the latest content is recoverable from an exact Git revision or a verified recovery copy, and retain it through handoff. Do not silently discard untracked or uncommitted content. If recovery cannot be ensured and that specific loss is not already authorized, ask about the affected file; continue independent edits. Report recovery locations for removed content that was absent from Git history.

Keep recovery copies in durable local storage outside the repository and outside publishable artifact workspaces. Default to `~/agent-artifacts/.recovery/<repo-name>/<unique-run-id>/`, preserving relative paths and verifying copied bytes before removal. Do not overwrite an earlier recovery set or use a system temp directory as the only recovery location. Retain copies through handoff and leave cleanup to a separate authorized action.

## Verification

Check changed links and anchors, named paths and symbols, relevant commands/configuration, and references to moved or removed files. Use existing doc checks or a documentation build when applicable. Inspect potentially destructive commands rather than running migrations, deploys, or live operations merely to validate prose.

Reuse relevant check evidence and run only missing checks proportionate to the change. Distinguish source inspection, commands actually executed, and unavailable runtime verification. Report evidence limits without treating unexecuted tests as passing.
