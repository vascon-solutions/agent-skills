---
name: roadmap-todo
description: Create and maintain a durable roadmap or todo file for feature-grade work across repos. Keeps entries concise and pushes execution detail into task docs. Does not implement.
---

# Roadmap Todo

## Purpose

Create or maintain a durable roadmap or todo artifact for feature-grade work.

This skill produces or updates a roadmap document. Do not implement any roadmap item. Do not start coding.

It keeps a backlog structured enough for humans and coding agents to share. It is not for tiny scratch notes, and it should link major items to task docs rather than stuffing execution detail into the roadmap itself.

## When To Use

Use when:

- the user wants a stable roadmap or todo file for features, milestones, or major changes
- backlog items need statuses, priorities, sequencing, or ownership cues
- the repo has recurring feature work that should be tracked durably across sessions

## When Not To Use

Do not use when:

- the user only needs a quick temporary checklist for the current session
- the task is to write a single task doc — use `task-doc`

## Constraints

- **Do not implement.** This skill maintains the roadmap only. Do not write code, create implementation files, or begin work on any roadmap item.
- **Keep entries concise.** A roadmap entry is a title, status, and optional link. If an entry needs more than 2-3 lines, it should become a linked task doc instead. Agents default to expanding entries — this skill must override that.
- **Feature-grade items only.** Tiny implementation steps, sub-tasks, and obvious sequencing do not belong as top-level roadmap items. If it wouldn't be tracked independently, it doesn't get a row.
- **Do not rewrite what you weren't asked to change.** When adding or updating items, preserve the rest of the roadmap. Agents default to normalizing and reformatting entire files — only touch what the user asked you to touch.
- **Defer to task docs for execution detail.** When an entry grows beyond a concise summary, recommend creating a linked task doc with `task-doc` instead of expanding the roadmap entry.

## Required Inputs

You need:

- the existing roadmap or todo file, if one exists
- the source items to add, update, split, reorder, or close

Optional: status conventions, numbering scheme, linked task docs or issue references.

Read [references/status-model.md](references/status-model.md) when the repo has no existing status scheme.

## Workflow

1. Read the current roadmap if one exists. Respect its existing format.
2. Apply the requested change: add, update, split, reorder, archive, or normalize.
3. Flag any entry that has grown too detailed — recommend a linked task doc.
4. Output the updated roadmap. Use [references/roadmap-template.md](references/roadmap-template.md) only when starting from scratch.

Do not implement. Do not start coding.

## Output

Produce one or more of:

- an updated roadmap or todo file
- a recommendation that specific items should become task docs

## Cautions

- Turning the roadmap into a full implementation spec
- Tracking tiny engineering steps as first-class roadmap items
- Changing numbering or status schemes the user didn't ask to change
- Duplicating task-doc content inside backlog entries
- Rewriting the entire roadmap when only one item was requested
