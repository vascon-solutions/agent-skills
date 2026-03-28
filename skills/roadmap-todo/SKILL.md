---
name: roadmap-todo
description: Create and maintain a durable roadmap or todo file for feature-grade work across repos. Use when backlog items need consistent status, ordering, sizing, and links to task docs instead of living as ad hoc notes.
---

# Roadmap Todo

## Purpose

Create or maintain a durable roadmap or todo artifact for feature-grade work.

This skill keeps a backlog structured enough for humans and coding agents to share.
It is not for tiny personal scratch notes, and it should link major items to task docs rather than stuffing execution detail into the roadmap itself.

## When To Use

Use when:

- the user wants a stable roadmap or todo file for features, milestones, or major changes
- backlog items need statuses, priorities, sequencing, or ownership cues
- the repo has recurring feature work that should be tracked durably across sessions
- roadmap items should point to task docs for execution detail

## When Not To Use

Do not use when:

- the user only needs a quick temporary checklist for the current session
- the backlog is tiny and informal notes are enough
- the task is to write a single task doc rather than maintain a roadmap
  Use `task-doc`

## Required Inputs

You need:

- the existing roadmap or todo file, if one exists
- the source items to add, update, split, reorder, or close

Optional but useful:

- status conventions already used by the team
- numbering scheme or filename convention
- linked task docs or issue references

Read [references/status-model.md](references/status-model.md) when the repo has no existing status scheme.

## Decision Rules

- Keep roadmap entries short; execution detail belongs in task docs
- Feature-grade items belong in the roadmap; tiny implementation steps usually do not
- If a roadmap item becomes too detailed or risky, recommend a linked task doc
- If an item is too broad to estimate or track, split it into smaller roadmap items
- Preserve existing numbering and status conventions unless the user asks to normalize them
- Prefer explicit statuses over ambiguous prose like "maybe done" or "partly started"

## Workflow

1. Read the current roadmap or todo artifact if one exists.
2. Identify the operation: add, update, split, reorder, archive, or normalize.
3. Keep the roadmap concise and durable using [references/roadmap-template.md](references/roadmap-template.md) as a guide.
4. Flag entries that should become task docs instead of growing inside the roadmap.
5. Normalize statuses and ordering without rewriting the whole roadmap unnecessarily.
6. Output the updated roadmap content or apply the requested file change.

## Output

Produce one or more of the following:

- an updated roadmap or todo file
- a normalized set of roadmap items
- a recommendation that specific items should be turned into task docs

## Cautions / Common Failure Modes

- turning the roadmap into a full implementation spec
- tracking tiny engineering steps as first-class roadmap items
- changing numbering or status schemes without reason
- duplicating task-doc content inside backlog entries

