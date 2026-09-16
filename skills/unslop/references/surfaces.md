# Output Surfaces

Each surface has a shape and a budget. The budget is a ceiling for the routine case, not a target. Shorten by leaving things out. A multi-part task may need more; a gap or failure always gets stated even if it costs words.

## Chat reply and completion report

Budget: 150 words for a routine task, 300 for a multi-part one.

1. Outcome in the first sentence: done, not done, or found. Unverified or failed items in the same paragraph.
2. What changed, as bullets when there are several items. One or two sentences each.
3. What is still open, only if something is.

Omit: the steps you took, tools you ran, files you read, options you did not pursue, and restatements of the request. No closing offer, no summary of the summary.

## Mid-task status

Budget: two lines.

What just finished or what is blocked, and what happens next. No progress narration between tool calls.

## Review findings

Budget: 80 words per finding, ranked most severe first.

Each finding carries location, the claim, and the concrete failure: which input or state produces which wrong result. Severity or category if the review uses them. No praise, no restating what is fine unless the request asked for a full assessment. An empty result says "no findings" and what was checked, in one or two sentences.

## PR description

Budget: 200 words. Title under 70 characters, imperative mood.

1. Problem: what was wrong or missing, one or two sentences.
2. Change: what the reader will see in the diff, in words, not a file list.
3. Validation: the commands run and their results, or the checks that CI runs. Unrun checks are named as unrun.
4. Limitations or out of scope, when any exist.

Omit: session history, abandoned approaches, logs and metric tables (link them), and anything the diff already shows. Do not mention the agent or tooling that wrote it.

## Commit message

Subject under 72 characters, imperative, no trailing period. Body wraps at 72.

The body says why the change exists and any decision a future reader would question. It does not list files or narrate the diff. A one-line commit is fine when the subject carries the whole reason.

## Handoff, task doc, and issue

Keep the owning skill's section structure. Apply the sentence and evidence rules inside each section. State a fact once in the section that owns it; later sections reference, not repeat. Acceptance criteria are checkable statements, not intentions.

## Project docs

Pick one mode per document and keep it:

- How-to: steps to a goal for a competent reader. Action only, no background. Name it by the task.
- Reference: facts for lookup. Describe, do not instruct or persuade. Mirror the structure of the thing described.
- Explanation: one bounded topic and its why. Design decisions, constraints, alternatives. The only mode where an opinion belongs.
- Tutorial: learning by doing. Every step produces a visible result and says what the reader should see.

Headings carry the point, not just the topic. Put the condition before the instruction. Common case first, exceptions after. Introduce a list with a full sentence. Follow the repository's heading case; when it has none, use sentence case.
