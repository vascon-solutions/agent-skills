# Skill Review: `review-implementation` and `address-review-findings`

## Purpose

Independent review of the two uncommitted skills in `~/agent-skills/skills/` against the installed `requesting-code-review` and `receiving-code-review` skills, plus the pack's existing conventions. Captures verdicts, specific findings, and recommended edits so the work can be applied (or contested) deliberately.

## Audience

Pack maintainer (Dee). Assumes familiarity with the `~/agent-skills` pack layout, the superpowers skill set, and the SKILL.md frontmatter contract.

## Source Context

- New skills under review:
  - `~/agent-skills/skills/review-implementation/SKILL.md`
  - `~/agent-skills/skills/address-review-findings/SKILL.md`
- Adjacent installed skills:
  - `~/.claude/skills/requesting-code-review/SKILL.md` + `code-reviewer.md`
  - `~/.claude/skills/receiving-code-review/SKILL.md`
- Pack wiring:
  - `~/agent-skills/bin/link-skills.sh` (entries present, lines 31-32)
  - `~/agent-skills/README.md` (entries present, lines 24-25, 53-54, 161-164)
- Sibling style references:
  - `~/agent-skills/skills/review-task-docs/SKILL.md`
  - `~/agent-skills/skills/review-doc-changes/SKILL.md`
  - `~/agent-skills/skills/qa-triage-and-fix/SKILL.md`

## Assumptions

- `receiving-code-review` and `requesting-code-review` from the superpowers pack are reliably present in Dee's environment, so "fallback when unavailable" branches will rarely fire in practice.
- The pack's editorial style is "Purpose first, terse, framework-agnostic, optionally a worked example" — confirmed by the sibling skills listed above.
- Severity vocabulary should align with the superpowers `code-reviewer.md` template (Critical / Important / Minor) for cross-skill interoperability.

## Verdict Summary

| Skill | Verdict | Headline Issue |
| --- | --- | --- |
| `review-implementation` | pass-with-fixes | Mixes "review only" and "dispatch a reviewer" modes in one flow; remediation section bleeds into a review-only scope. |
| `address-review-findings` | pass-with-fixes | Heavy overlap with `receiving-code-review`; three sections describe one flow; missing source routing for QA findings. |

Neither skill is invalid or duplicative of the superpowers pair — they occupy a distinct niche (spec/plan-anchored review and remediation). The friction is editorial clarity, not concept.

## Relationship to Existing Code-Review Skills

| Skill | Niche | Trigger surface |
| --- | --- | --- |
| `requesting-code-review` (superpowers) | Dispatches a generic `code-reviewer` subagent against a diff; plan-agnostic. | "Review this diff." |
| `receiving-code-review` (superpowers) | Behavioral rules for evaluating reviewer feedback: no performative agreement, push back, YAGNI grep, verify before implementing. | "I got review feedback — how do I act on it?" |
| `review-implementation` (new) | Review code **against a referenced plan/spec/task doc/PRD**; report-only. | "Did this branch match the task doc?" |
| `address-review-findings` (new) | Orchestration entrypoint for the full *review-and-fix* loop. | "Review against the spec and fix valid findings." |

The two new skills fill a real gap: spec-anchored review and review-then-fix orchestration. The SKILL.md text does not currently make this distinction loud enough, which is the root cause of the perceived overlap.

## Findings — `review-implementation`

### Critical

None.

### Important

1. **Dual-mode confusion between "review only" and "dispatch a reviewer."**
   - Where: `SKILL.md:8-11` declares "Review implemented code as a work product … Report findings first. Do not edit files during the review." But `SKILL.md:30` (Workflow step 4) and `SKILL.md:36-67` (Delegated Review Prompt) describe dispatching a subagent.
   - Why it matters: A reader cannot tell whether this skill *is* the reviewer or *invokes* one. Two mental models inside one skill.
   - Smallest fix: Add an explicit `## Mode` decision rule near the top — *direct review* vs *delegated review* — with a single trigger per branch. Or move the dispatch prompt into `address-review-findings`'s orchestration role and keep this skill strictly "I review, I report."

2. **No fallback when no plan/spec is referenced.**
   - Where: `SKILL.md:27` — Workflow step 1 always says "Read the referenced plan/spec/task doc."
   - Why it matters: The description triggers on a wide range of inputs ("task doc, spec, plan, roadmap item, PRD, or acceptance criteria"), but the user might invoke it with none of those attached.
   - Smallest fix: Add: *If no plan/spec is referenced, ask once. If the user declines to provide one, do a quality-only pass and label the verdict accordingly.*

3. **"Handling Feedback" section (lines 78-81) violates the skill's own scope.**
   - Where: `SKILL.md:78-81` describes acting on review output later.
   - Why it matters: This is remediation, not review. It belongs in `address-review-findings`. Keeping it here invites scope creep and gives two skills opinions about the same step.
   - Smallest fix: Replace with one line: *To act on findings, use [[address-review-findings]].*

### Minor

4. **Severity alignment with `requesting-code-review/code-reviewer.md` is not called out.**
   - Where: `SKILL.md:70-76`.
   - Why it matters: `code-reviewer.md:70-77` uses the same Critical/Important/Minor scheme. Calling out the deliberate alignment makes findings from either source interchangeable for `address-review-findings`.
   - Smallest fix: One-line note: *Severity matches the `requesting-code-review` code-reviewer template so findings are routable across skills.*

5. **Output Shape is missing the verdict line in the example.**
   - Where: `SKILL.md:85-99`. The delegated prompt mentions `pass / pass-with-fixes / fail` at line 60, but the Output Shape example doesn't enforce it.
   - Smallest fix: Add `Verdict: pass-with-fixes` as the first line of the example block.

6. **No "Don't use for" boundary.**
   - Where: Missing section.
   - Why it matters: Sibling skills (`qa-triage-and-fix`, `review-task-docs`) include this and it prevents misuse.
   - Smallest fix: Add: *Don't use for reviewing the task doc itself before code is written (use `review-task-docs`). Don't use for reviewing recent doc edits (use `review-doc-changes`).*

## Findings — `address-review-findings`

### Critical

None.

### Important

1. **Significant overlap with `receiving-code-review`.**
   - Where: `SKILL.md:38-54` (Fallback Workflow), `56-66` (Pushback Rules), `68-74` (Implementation Rules). These re-derive what `receiving-code-review/SKILL.md` already specifies in more detail (no performative agreement, verify before implementing, YAGNI grep, push back with technical reasoning, one item at a time, test each).
   - Why it matters: Two skills with overlapping prescriptions invite drift and confuse readers about which is canonical.
   - Smallest fix: Pick one — either (a) drop the fallback workflow entirely, declare `receiving-code-review` a required dependency, and keep this skill purely as the orchestration loop entrypoint, or (b) keep a condensed 4-bullet emergency mode and frame the canonical path as delegated.

2. **Three sections describing one flow.**
   - Where: `SKILL.md:18-27` (Review-And-Fix Mode), `30-36` (Delegation), `38-54` (Fallback Workflow).
   - Why it matters: They overlap and the order of operations is ambiguous.
   - Smallest fix: Collapse into a single `## Workflow` with explicit branches: "if `receiving-code-review` available" vs "if not."

3. **"High-effort review agent" is vague.**
   - Where: `SKILL.md:14`, `SKILL.md:23`, `SKILL.md:38` (Delegated Review Prompt usage).
   - Why it matters: The phrase reads like a standard concept; it isn't. A user copy-pasting the example prompt will not know what to type.
   - Smallest fix: Name the actual mechanism (the `Agent` tool with the highest practical reasoning effort, or a specific subagent type) or drop the phrase.

4. **Description claims "QA review" is in scope, but no QA path exists.**
   - Where: `SKILL.md:3` description includes "QA review." The workflow only references `review-implementation`.
   - Why it matters: A user invoking this for QA findings will land in the wrong loop. The pack already has `qa-triage-and-fix` for that.
   - Smallest fix: Add a Source Routing table near the top:

     | Findings come from | Route to |
     | --- | --- |
     | implementation review / spec compliance | this skill |
     | QA report / bug tracker | `qa-triage-and-fix` |
     | code review without an attached plan | `receiving-code-review` directly |

### Minor

5. **No worked example.**
   - Where: Missing section.
   - Why it matters: Every other "process" skill in the pack (`qa-triage-and-fix`, `review-task-docs`) shows a sample flow. Without one this reads as abstract rules.
   - Smallest fix: Add a short flow walkthrough — e.g.: *user asks to address findings from `docs/tasks/payments.md` against current branch → invoke `review-implementation` → classify 6 findings → ask about the unclear one → fix valid ones, push back on the invalid one → final `review-implementation` for verdict.*

6. **No cross-reference to `verification-before-completion`.**
   - Where: `SKILL.md:74` says "Do not mark review remediation complete until validation has run." That is exactly the `verification-before-completion` skill's job.
   - Smallest fix: Cross-link: *Apply [[verification-before-completion]] to confirm fixes before declaring the loop done.*

7. **README does not surface the delegation hierarchy.**
   - Where: `README.md:161-164` lists the four-step "Reviewing and tracking feature work" sequence accurately but does not say which superpowers skills are assumed present.
   - Smallest fix: Add a one-line note: *Assumes `receiving-code-review` is installed for finding evaluation; uses the bundled workflow otherwise.*

## Cross-Cutting Recommendations

Apply to both skills:

- Add a **Boundaries / Don't Use For** section pointing at the adjacent owner skill. Pack convention.
- Use `[[skill-name]]` cross-links for related skills, matching the convention already in `markdown-artifact` and `task-doc`.
- Add a single concrete worked example per skill. The pack's review skills (`review-task-docs`, `qa-triage-and-fix`) set the bar.
- Align severity vocabulary with `requesting-code-review/code-reviewer.md:70-77` (Critical / Important / Minor) so findings travel cleanly between reviewer and remediator.

## Suggested Edit Plan (if approved)

1. `review-implementation/SKILL.md`
   - Add `## Mode` block at the top splitting *direct review* from *delegated review*.
   - Add "no plan supplied" branch to Workflow step 1.
   - Replace the "Handling Feedback" section with a one-line pointer to `[[address-review-findings]]`.
   - Add severity-alignment note under the Severity section.
   - Add `Verdict:` line to the Output Shape example.
   - Add "Don't Use For" boundary section.

2. `address-review-findings/SKILL.md`
   - Collapse "Review-And-Fix Mode" + "Delegation" + "Fallback Workflow" into a single `## Workflow` with the available/unavailable branches.
   - Reduce fallback content to a 4-bullet emergency mode (or drop entirely and declare `receiving-code-review` required).
   - Replace "high-effort review agent" with concrete mechanism language.
   - Add Source Routing table covering implementation review, QA report, and ad-hoc code review.
   - Add a worked example walkthrough.
   - Add cross-link to `[[verification-before-completion]]`.

3. `README.md`
   - Add one-line note to the "Reviewing and tracking feature work" entry about the `receiving-code-review` dependency assumption.

## Open Questions

- Should the fallback workflow in `address-review-findings` be deleted entirely (treating `receiving-code-review` as a hard dependency), or kept as a condensed emergency mode? This determines how invasive the edit is.
- Should the dispatch-a-reviewer behavior live in `review-implementation` (current state) or move into `address-review-findings`'s orchestration role? Current placement is defensible but blurs the review-only contract.
- Severity scheme is consistent with `code-reviewer.md` — should the verdict scheme (`pass / pass-with-fixes / fail`) also be added to `code-reviewer.md` so all three skills speak the same language?

## Next Recommended Action

Decide on the two open questions above (fallback retention, dispatch placement), then apply the edit plan to both SKILL.md files and the README in a single commit. After edits, re-run a self-review using `review-implementation` against this artifact to confirm the changes resolve the findings listed here.
