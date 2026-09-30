# Role Dispatch Defaults

<!-- Generated from agents/tiers.yaml and agents/*.md by `bin/link-agents.sh --dispatch-reference`. Do not edit by hand. -->

Resolve model and effort before dispatch: an explicit prompt setting, then the repository (`AGENTS.md`, then `.agent/delivery-policy.json` `role_overrides`), then these defaults. Resolve model and effort independently. [Orchestration](orchestration.md) owns the dispatch rules.

## Tiers

| Tier | Claude Code | Codex |
| --- | --- | --- |
| `fast` | `haiku` | `gpt-5.6-luna` |
| `standard` | `sonnet` | `gpt-5.6-terra` |
| `deep` | `opus` | `gpt-5.6-sol` |

Escalation moves one step along `fast` → `standard` → `deep`; `deep` has no next tier.

Default effort: Codex `medium`, supplied as the spawn `reasoning_effort`. Claude Code: omit effort unless an explicit user or repository override is resolved.

## Roles

| Role | Mode | Owning skill | Default tier | Coverage tiers | Extra brief fields |
| --- | --- | --- | --- | --- | --- |
| `auditor` | `ui` | `audit-ui` | `standard` | rollout: `deep` | `candidate_url`, `environment`, `actors_and_credential_source`, `fixtures`, `allowed_mutations`, `startup_commands`, `cleanup` |
| `auditor` | `api` | `audit-api` | `standard` | rollout: `deep` | `candidate_url`, `environment`, `actors_and_credential_source`, `fixtures`, `allowed_mutations`, `startup_commands`, `cleanup` |
| `auditor` | `a11y` | `audit-ui` | `standard` | rollout: `deep` | `candidate_url`, `environment`, `actors_and_credential_source`, `fixtures`, `allowed_mutations`, `startup_commands`, `cleanup`, `accessibility_criteria` |
| `reviewer` | `implementation` | `review-implementation` | `deep` | none | `validation_evidence`, `audit_evidence`, `prior_decisions` |
| `reviewer` | `doc` | `review-doc-changes` | `deep` | none | `prior_decisions` |
| `reviewer` | `spec` | `review-task-docs` | `deep` | none | `prior_decisions` |
| `scout` | `research` | role instructions | `standard` | none | none |
| `scout` | `inventory` | role instructions | `standard` | none | none |
| `watcher` | `pr` | role instructions | `fast` | none | `previous_snapshot`, `pr_identity`, `read_helper` |
| `watcher` | `ci` | role instructions | `fast` | none | `previous_snapshot`, `pr_identity` |

## Enforcement

Record these per boundary in `RoleRun.enforcement`. Probe evidence may narrow a value; never widen an instructional one to enforced.

| Role | Runtime | Tools | Filesystem | GitHub | Delegation |
| --- | --- | --- | --- | --- | --- |
| `auditor` | Claude Code | enforced: allowlist Read, Glob, Grep, Bash, Write, Skill; Agent omitted and denied | instructional: Bash and Write granted | instructional: Bash granted | enforced for the Agent tool; instructional: agent command-line clients remain reachable through Bash |
| `auditor` | Codex | instructional: developer_instructions only; no tool allowlist | runtime sandbox and approval settings inherited from the parent; role limit instructional | instructional | instructional: no role-specific control; the client's own agent depth setting may also withhold spawn tools |
| `reviewer` | Claude Code | enforced: allowlist Read, Glob, Grep, Bash, Skill; Agent omitted and denied | instructional: Bash granted | instructional: Bash granted | enforced for the Agent tool; instructional: agent command-line clients remain reachable through Bash |
| `reviewer` | Codex | instructional: developer_instructions only; no tool allowlist | runtime sandbox and approval settings inherited from the parent; role limit instructional | instructional | instructional: no role-specific control; the client's own agent depth setting may also withhold spawn tools |
| `scout` | Claude Code | enforced: allowlist Read, Glob, Grep, Bash; Agent omitted and denied | instructional: Bash granted | instructional: Bash granted | enforced for the Agent tool; instructional: agent command-line clients remain reachable through Bash |
| `scout` | Codex | instructional: developer_instructions only; no tool allowlist | runtime sandbox and approval settings inherited from the parent; role limit instructional | instructional | instructional: no role-specific control; the client's own agent depth setting may also withhold spawn tools |
| `watcher` | Claude Code | enforced: allowlist Read, Bash; Agent omitted and denied | instructional: Bash granted | instructional: Bash granted | enforced for the Agent tool; instructional: agent command-line clients remain reachable through Bash |
| `watcher` | Codex | instructional: developer_instructions only; no tool allowlist | runtime sandbox and approval settings inherited from the parent; role limit instructional | instructional | instructional: no role-specific control; the client's own agent depth setting may also withhold spawn tools |
