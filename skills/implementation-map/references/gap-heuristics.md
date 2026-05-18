# Gap And Refactoring Heuristics

Surface gaps conservatively. Every gap must be tied to either a concrete code signal *or* a repo-convention violation. Repo-convention claims require having read `AGENTS.md`, `CLAUDE.md`, README, and any architecture/contributing docs first — without that step, do not file convention-violation gaps.

Label confidence:

- **High** — direct code evidence and a clear signal.
- **Review** — pattern smells, ambiguity, or low-confidence signals that deserve a second look.

Use review-candidate wording for low-confidence signals. Never use defect language without high-confidence evidence.

## High-Confidence Signals

### TODOs Tied To Shipped Behavior

- `TODO`, `FIXME`, or `XXX` comments next to behavior the feature relies on.
- Cite file and line. Include the comment text in the map.

### Untested Behavior In A Tested Area

- Hooks, reducers, workflow helpers, or API helpers with no test file, in a feature area where other surfaces are tested.
- Cite the untested file and at least one nearby tested file to show the area is otherwise covered.

### Dense Responsibility In A Single File

- Component that owns route loading, mutation, filtering, dialogs, and navigation simultaneously.
- Backend service that owns validation, persistence, policy, orchestration, and external calls.
- Cite the file and list the responsibilities you observed.

### Duplicated Logic

- Duplicate request helpers, DTO/schema/validation logic, or domain rules across layers.
- Cite at least two files and show what is duplicated.

### Bypassed Public Barrels Or App-To-App Imports

- Deep imports into a feature folder that violate the repo's barrel/module convention.
- App-to-app imports in monorepos where a shared package is the expected bridge.
- Requires reading repo conventions first to claim this as a violation.

### Missing Disabled-State Or Error-State Reasoning

- Guarded actions (buttons, endpoints) that don't expose a disabled reason or error message when the guard fails.
- Cite the guard and the action surface.

### Inconsistent Guards Or Error Handling

- Same kind of action protected differently across siblings — one with route-level guard, another with render-time guard.
- Different error response shapes for the same kind of failure.
- Cite the inconsistent files side by side.

### Unclear Transaction, Retry, Or Idempotency Behavior

- Jobs or transactions where retry, rollback, or idempotency is not documented and not enforced by code.
- Cite the job/transaction file and the missing safeguard.

### Stale Docs

- Docs that contradict current code — endpoint paths, status names, query keys, payload shapes.
- Cite both the doc and the code.

### Render-Time Guards Where Route-Level Guards Are Required

- Repo convention requires route guards; a guarded screen implements the check inside render.
- Requires reading repo conventions first.

## Review-Confidence Signals

Phrase these as questions or candidates, not findings.

- Large component or service file with many responsibilities, but not yet dense enough to call out as a high-confidence smell.
- Two helpers that look related but live in different files — possible extraction candidate.
- A test file that exercises one surface and skips an adjacent one — possible coverage gap.
- A hook whose name doesn't match its behavior — possible rename candidate.
- An exported symbol with no consumers — possible dead code, but verify before claiming.

## Anti-Patterns (Do Not File These)

- "This file should use a different framework / library / pattern" without a repo-convention citation.
- "Code style could be cleaner" without a measurable signal.
- "This should be tested more" without naming the missing surface.
- Architecture preferences that come from training data rather than the repo.
- Gap claims based on a feature-folder spot-check without reading the broader convention docs.

## Output Format

Render gaps in the map as:

```markdown
| Candidate | Signal | Files | Confidence |
|---|---|---|---|
| <short title> | <concrete evidence> | `<paths>` | high / review |
```

Each row must be defensible without chat context. If you can't cite a file or convention, drop the row.
