# Proposed delivery review improvements

Status: research complete; pilot selected for task authoring. Reviewed on 18 October 2026 against agent-skills commit `970d4a9` and local Claude Code `2.1.302`.

The [pilot task](../tasks/2026-10-18-delivery-review-pilot.md) defines the selected implementation boundary. Broader recommendations below remain proposals. The current authorization covers publishing these documents after review, not implementing their contents.

Keep the existing task-doc delivery workflow. Improve its security coverage, finding verification, and feedback from completed work. The current pack already supplies bounded review, validation ownership, candidate identity, remediation batches, and runtime acceptance gates. Adding more mandatory review agents would duplicate much of that work.

## What the Anthropic article contributes

Anthropic describes verification before PR review, separate security review, risk-based human attention, and recovery after release. Its reviewer improvement process uses confirmed incidents and clean changes to measure missed defects and harmful false positives. Re-review is bounded and narrows to new changes. These are reported internal practices, not evidence that copying the process will produce the same results here. [Article](https://claude.dev/blog/solving-code-review-at-anthropic/)

The managed Code Review service verifies and ranks findings but does not itself approve or block merging. Repository enforcement is separate. [Service documentation](https://code.claude.com/docs/en/code-review)

## What the current pack already covers

| Practice | Existing owner | Assessment |
| --- | --- | --- |
| Verify before publication and reuse valid evidence | [Validation guidance](../../skills/task-doc-delivery-loop/references/validation.md) | Preserve the single validation owner, input identity, and rerun rules. |
| Independent assessment when required | [Delivery loop](../../skills/task-doc-delivery-loop/SKILL.md), section 3 | Preserve the independence gate and explicit limits on fallback. |
| Bounded review and focused remediation | [Review policy](../../skills/task-doc-delivery-loop/references/review-policy.md), lines 22 to 64 | Already has one to three cycles, separate delegate limits, and explicit extensions. |
| Fix a defect's equivalent instances | [Risk classes](../../skills/review-implementation/references/risk-classes.md) | Already requires a scoped sweep before pushing remediation. |
| Evaluate findings rather than obey them | [Address review findings](../../skills/address-review-findings/SKILL.md), lines 24 to 31 | Already classifies invalid, unclear, duplicate, and out-of-scope findings. |
| Runtime evidence for approved acceptance criteria | [Orchestration](../../skills/task-doc-delivery-loop/references/orchestration.md), lines 29 to 36 | Already blocks completion when required acceptance is unverified. |
| Permanent tests need a durable risk | [Test audit](../../skills/test-audit/SKILL.md), lines 28 to 71 | Preserve this instead of adopting blanket coverage demands. |

The review policy's mechanical cycle allowance depends on file and package counts. Review guidance separately says to scale inspection to risk. The missing piece is a concise, explicit connection from a change's risk to the coverage the reviewer must provide.

## What is actually present locally

Three different implementations must be kept distinct.

| Local material | Observed behavior | Implication |
| --- | --- | --- |
| Legacy marketplace `code-review` command | Five review agents, per-finding confidence scoring, an 80-point cutoff, draft and trivial-PR skips, and automatic PR comments. | Treat it as reference material. It has no matching entry in the inspected installed-plugin manifest or enabled-plugin settings. |
| Bundled code-review in Claude Code `2.1.302` | Contains multiple effort-dependent methods, including removed-behavior analysis, caller tracing, and confirmed/plausible/refuted verification. Other branches use inline review without independent verification. | Do not infer a fixed agent count or verification method from the command name. The actual selected runtime branch was not exercised. |
| Bundled security-review in the same binary | Researches the threat model, traces inputs across privilege boundaries, then filters each candidate vulnerability. Reports an exploit scenario and remediation. | Reuse these reasoning requirements within the owned delivery workflow. |

The bundled code-review command is documented as report-only without `--fix`; `--comment` adds external posting. Its default comparison uses upstream, with fallbacks. It reads `CLAUDE.md`, not `REVIEW.md`. [Local review documentation](https://code.claude.com/docs/en/code-review-local)

The local legacy command has several poor fits for this pack. It can skip draft PRs, ignores real issues on unchanged lines, assumes CI will run, and suppresses general security or coverage concerns unless instructions demand them. Its confidence rubric mixes certainty, impact, and frequency. Its instruction to stop when no findings survive also conflicts with its later clean-review output example. The inspected source is `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/code-review/commands/code-review.md`, lines 11 to 42 and 76 to 84. Its sibling README describes a different agent arrangement from the command itself. These are historical local observations, not prerequisites for executing the pilot.

The bundled security prompt also needs adaptation. It uses `origin/HEAD...` for its supplied diff, which does not establish the intended PR base or include uncommitted content. It excludes documentation, denial-of-service issues, and outdated dependencies, and includes broad trust assumptions about environment variables, URLs, and shell scripts. Some may be reasonable exclusions when another verified control owns them. They are unsuitable as universal rules for application repositories, CI tooling, or this skill pack.

The security prompt's assertion that Rust cannot contain memory-safety defects is too broad because unsafe code and foreign interfaces exist. Its blanket treatment of prompt content also cannot substitute for tracing an agent's privileges and tool access. These are reasons to adopt its evidence method while defining a repository-specific threat model.

Local binary evidence comes from `~/.local/share/claude/versions/2.1.302`, SHA-256 `5262ce9de86243fed0d21edc39b271555d56780d0112e2b194439fe1c6662d37`. The security prompt begins at byte 100883751; bundled review source strings occur around bytes 230639000 to 230670000. This was static inspection, not an executed review or a claim about every feature-flag path.

## What recent sessions suggest

These are sampled session records, not a measurement of overall delivery quality or fresh reviews of the linked PRs.

| Session evidence | Consequence for the proposal |
| --- | --- |
| Contract-search delivery reported synchronized Shared dependencies, 23 focused e2e tests, and a clean independent review for an API PR. | Preserve focused verification and dependency identity. More mandatory agents are not justified by this example. |
| The tender-milestone session reported that API implementation exposed missing duplicate-ID validation and remainder-allocation support in merged Shared work, addressed by a follow-up Shared PR. | Give cross-repository changes an explicit consumer scenario before declaring the provider contract sufficient. Reconstruct timing before classifying this as a reviewer miss. |
| "Review PR 443 implementation" reproduced confirmation state carrying across orders and stale approved actions after cancellation. Its remediation report still identified real-API acceptance as unverified. | These are strong evaluation candidates. Also check that runtime gaps survive handoff and remain completion blockers when required. A completed findings batch is not full delivery completion. |
| "Address PR 438 review findings" corrected local-only design references and required role-gate coverage in the task plan. | Documentation can control security-relevant behavior. Do not exclude it categorically; route it to the existing documentation or spec reviewer. |

## Proposed changes in priority order

### 1. Add explicit security coverage under the delivery owner

At bootstrap, briefly identify sensitive boundaries changed by the task. Relevant examples include tenant scope, role enforcement, protected downloads, credentials, file handling, untrusted input, migrations, CI, and release tooling. Record what coverage each boundary needs, using existing task and delivery-summary locations.

For security-sensitive work, use an owned security review method with a bounded brief and a report-only result. It should identify the actor, controlled input, entry point, trust boundary, sensitive operation, existing defenses, and concrete consequence. The method can be a focused reference initially. A reusable sibling `security-review` skill and reviewer mode are justified if this recurs across projects.

Every reviewer adapter must receive the verified target base and candidate identity. For local-only work, include the intended uncommitted and untracked content. Never substitute upstream or `origin/HEAD` for the delivery target without checking it. This matters for deliveries targeting `develop` and for branches already pushed to their own upstream.

A coverage decision does not automatically require another agent. Any separate assessor remains owner-dispatched, respects the existing concurrency and delegate limits, and cannot delegate recursively. Define how its work consumes the review budget before adding the mode. It must not provide an uncounted route around exhausted review limits.

Preserve explicit model and effort overrides. Risk determines the required inspection and evidence; it does not silently change the model, merge authority, or number of review cycles. Existing repository human-approval requirements remain binding.

Likely owners are the delivery-loop bootstrap, review policy, implementation reviewer, and risk-class reference. A new security mode would also affect the role definition and generated dispatch configuration.

### 2. Make every reported finding survive a concrete verification step

Extend the existing finding contract with a failure scenario and verification status. Use `confirmed`, `plausible`, and `refuted` as evidence states, separate from severity. A plausible critical issue needs a named missing check; it must not disappear because a model assigns it a low confidence number.

Before reporting, inspect the claimed trigger, relevant callers, existing guards, and the authoritative requirement. For a claimed instruction violation, cite the actual applicable rule. Distinguish newly introduced defects, existing defects newly exposed by the change, and unrelated pre-existing problems. A changed caller can make unchanged code fail.

Add two explicit inspection prompts to the current reviewer. For removed code, identify which invariant it enforced and where that invariant now lives. For changed contracts, trace the callers and consumers that depend on them. Shared/API/UI deliveries should include one concrete consumer scenario, including dependency revision and generated output where relevant.

Verification is a reasoning requirement, not a mandatory agent per finding. Reserve additional independent investigation for disputed consequential findings within the existing bounds. Do not suppress confirmed material defects to satisfy an output cap, and do not require a minimum finding count.

Minor cleanup should stay advisory unless it violates an accepted requirement. Clarify which findings block each verdict so `pass-with-fixes` cannot be mistaken for completed remediation.

Likely owners are `review-implementation`, `agents/reviewer.md`, and `address-review-findings`. Preserve the existing test-admission checks and the reviewer's prohibition on rerunning delivery gates.

### 3. Define how repository review rules are loaded

A short root review guide could name the repository's important failure modes, sensitive paths, evidence requirements, and justified exclusions. Scoped additions can cover distinct domains. The skill pack itself needs rules about authorization drift, workflow contradictions, unsupported completion claims, and portability across runtimes.

Adoption requires an explicit loading rule in the owned reviewer. Merely adding `REVIEW.md` will not make local Claude code-review consume it. The managed service does consume it and selects a copy from the base or default branch according to protection rules. [Customization documentation](https://code.claude.com/docs/en/code-review-customize)

For the owned workflow, pin the review policy from the verified base, or an explicitly accepted policy revision. Treat proposed instruction changes as review subjects. A PR must not weaken its own review by changing exclusions in the candidate. Preserve higher-priority user instructions and existing authorization.

Start with one repository-specific guide. Keep general rules in the shared reviewer and link existing domain standards instead of duplicating them everywhere.

### 4. Build a small reviewer evaluation set from confirmed outcomes

Start with approximately six to ten labeled cases drawn from actual work. Include buggy candidates, their fixes, clean candidates, and rejected suggestions that would have caused harm. Preserve the reviewed base, head, requirements, expected mechanism, and accepted disposition. Keep private application code within its permitted repository or use a sanitized reproduction.

PR 443 supplies two candidate mechanisms. PR 438 supplies documentation and authorization-planning cases. Neither should enter the evaluation set until its expected result and exact candidate are verified. The Shared follow-up needs more context before assigning a miss to a particular reviewer.

Evaluate changes to review prompts, tools, or models against this set. Measure confirmed defects found, actionable false positives, harmful proposed fixes on clean cases, remediation cycles, and review time. Add escaped defects as they occur. Initially use a documented manual evaluation; build a runner only if repeated use warrants it.

Reviewer evaluations are separate from application regression tests. They do not justify another permanent test layer for the same product behavior. Repeated mechanical findings should become a focused check where appropriate; domain reasoning belongs in the review guide or skill. Skill-pack changes remain separately authorized work.

### 5. Carry acceptance gaps and recovery information into the PR

Add concise risk and recovery information when it matters. State affected users or data, rollback or disablement steps, dependency ordering, and anything a revert cannot undo. A migration or destructive operation needs more than a generic instruction to revert its commit.

Keep existing required acceptance gates visible across review and remediation handoffs. PR 443 illustrates why passing focused tests cannot replace a required real-API checkpoint. For an authorized findings-only batch, report its successful completion separately from outstanding delivery acceptance.

Preserve the distinction between a ready PR and merge readiness. The agreed publication endpoint does not authorize merge, monitoring, rollout, or incident response. Existing branch protection and required human approvals cannot be replaced by an AI verdict.

Also preserve the current thread-resolution rule. `address-review-findings` leaves rejected or out-of-scope threads unresolved without explicit direction. Adopting Anthropic's reason-and-resolve approach would be a deliberate policy change, not an incidental cleanup.

## Pilot and decision boundary

The smallest useful pilot changes the implementation-review method and adds a security reference, then tests them against a few verified past candidates. Keep the current one-owner workflow, optional ledger, bounded cycles, evidence reuse, and explicit publication endpoint.

A second phase can add a repository review guide and routine outcome collection once the pilot shows better detection without excessive false positives. Broader GitHub automation, approval-policy changes, and release controls are separate repository work.

The proposed direction is to improve the evidence and coverage inside the current loop. The linked pilot task owns the selected scope; this research does not change delivery skills, role definitions, installed Claude files, GitHub settings, or automation.
