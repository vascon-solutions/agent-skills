# Implementation Map Prompt Mode Router Design

Date: 2026-05-21
Status: Draft for user review
Owner: implementation-map skill

## Purpose

Make `implementation-map` usable from short prompts while preserving the right output size for the job.

The skill should not require the user to remember a long instruction block. It should route short requests into the correct map mode, ask only when necessary, and generate companion artifacts only when the prompt calls for them.

## Goals

- Make bare prompts predictable.
- Keep small maps small.
- Make review/dossier prompts produce rich code-review artifacts.
- Support frontend, backend, full-stack, component, touchpoint, and illustrated map requests.
- Keep generated imagery explicit, not automatic.
- Preserve the current evidence-first rule: maps describe discovered code, not imagined architecture.

## Non-Goals

- Do not turn every implementation map into a Route Review Dossier.
- Do not generate visual covers by default.
- Do not let image artifacts replace the Markdown implementation map.
- Do not introduce planning or future-work design behavior into `implementation-map`.
- Do not skip evidence collection because a prompt is short.

## Prompt Grammar

Short prompts should be enough:

```text
$implementation-map Needs Assessment
$implementation-map review Needs Assessment
$implementation-map backend review Needs Assessment
$implementation-map component StatusBadge
$implementation-map touchpoint auth token
$implementation-map illustrated auth flow
$implementation-map visual map vendor onboarding
```

The prompt keywords choose the mode. If the prompt has no mode keyword, default to Standard Implementation Map.

## Mode Router

Decision order:

1. If the target cannot be located, ask one focused question.
2. If the prompt includes `component`, use Component Map.
3. If the prompt includes `touchpoint`, `quick`, or `small`, use Touchpoint or Lightweight Map.
4. If the prompt includes `review` or `dossier`, use a review dossier mode.
5. If review/dossier scope is frontend-only, use Route Review Dossier.
6. If review/dossier scope is backend-only, use Backend Flow Review Dossier.
7. If review/dossier scope crosses frontend and backend, use Full-Stack Review Dossier.
8. If the prompt includes `illustrated`, `illustration`, `visual map`, or `$image-artifact`, add an Image Artifact companion.
9. If no mode keyword is present, use Standard Implementation Map.

Ask only when the mode or target is genuinely ambiguous.

## Modes

### Standard Implementation Map

Trigger:

```text
$implementation-map <thing>
```

Output:

- Markdown implementation map.
- Uses the existing mandatory 9-section structure.
- Artifact decision defaults to `neither` unless code complexity makes HTML useful.
- Best for ordinary feature/module orientation.

### Component Map

Trigger:

```text
$implementation-map component <component-name>
```

Output:

- Focused Markdown map.
- Entry points, imports, props, local state, hooks, shared UI usage, tests, and consumers.
- HTML only if explicitly requested.
- Refuse or downshift if the component is trivial and a short answer is better.

### Touchpoint Map

Trigger:

```text
$implementation-map touchpoint <area>
$implementation-map quick <thing>
$implementation-map small <thing>
```

Output:

- Focused Markdown map.
- Call sites, dependencies, side effects, request helpers, guards, shared packages, and tests.
- No HTML by default.
- Best for narrow questions like auth token handling, validation boundary, cache invalidation, or a shared hook.

### Route Review Dossier

Trigger:

```text
$implementation-map review <frontend-feature>
$implementation-map dossier <frontend-feature>
$implementation-map route review <feature>
$implementation-map frontend review <feature>
```

Output:

- Markdown map first.
- HTML artifact automatically.
- Route-by-route code discovery.
- Component, hook, store, API helper, side effect, and test wiring.
- Colored compact code snippets with file paths and line ranges in HTML.
- Review cards for Decision, Boundary, Refactor, Performance, Testing, and Risk.
- Refactor decision matrix.
- No generated visual cover unless explicitly requested.

### Backend Flow Review Dossier

Trigger:

```text
$implementation-map backend review <feature>
$implementation-map backend dossier <feature>
$implementation-map endpoint review <route-or-handler>
$implementation-map service review <service-name>
```

Output:

- Markdown map first.
- HTML artifact automatically.
- Controller, resolver, route, or endpoint entry points.
- Guards, auth, permissions, account boundaries.
- DTOs, schemas, validation, request and response contracts.
- Service/use-case orchestration.
- Repository/model/persistence boundaries.
- Transactions, jobs, queues, events, external services where present.
- Error handling and logging.
- Unit, integration, contract, and e2e test coverage where present.
- Review cards and refactor decision matrix.

Performance signals should include N+1 queries, missing pagination, missing indexes, large payloads, slow jobs, over-fetching, and repeated external calls when visible in code.

### Full-Stack Review Dossier

Trigger:

```text
$implementation-map review <feature>
$implementation-map dossier <feature>
```

When discovered scope crosses frontend and backend.

Output:

- One connected Markdown map.
- One connected HTML artifact automatically.
- Frontend route flow.
- Request helper/API client flow.
- Backend endpoint/service/persistence flow.
- Shared package and contract boundaries.
- Cross-boundary error handling and state transitions.
- Test coverage across UI, API, integration, and contract surfaces.
- Refactor decision matrix that separates frontend, backend, and contract decisions.

If the discovered scope is too large for one useful artifact, ask whether to split frontend and backend before generation.

### Illustrated Companion

Trigger:

```text
$implementation-map illustrated <thing>
$implementation-map illustration of <thing>
$implementation-map visual map <thing>
$implementation-map <thing> $image-artifact
```

Output:

- Markdown implementation map first.
- Image artifact second.
- The image summarizes the discovered implementation.
- The image should be a visual map, architecture diagram, lifecycle diagram, data flow, request flow, dependency map, or refactoring hotspot map.
- Do not invent components, services, or flows not supported by the Markdown map.
- Do not generate a decorative cover by default.

If combined with review/dossier:

```text
$implementation-map illustrated review Needs Assessment
```

Generate Markdown, HTML dossier, then image companion.

## Clarifying Questions

Ask one focused question when needed. Examples:

```text
Which feature, route, component, endpoint, service, or folder should I map?
```

```text
Do you want a standard map, a quick touchpoint map, or a deeper review dossier?
```

```text
This appears to span frontend and backend. Should I create one full-stack dossier or split it?
```

Do not ask if the prompt already provides a clear target and mode.

## Artifact Defaults

| Request Type | Markdown | HTML | Image |
| --- | --- | --- | --- |
| Bare map | yes | no by default | no |
| Component map | yes | no by default | no |
| Touchpoint/quick map | yes | no | no |
| Review/dossier | yes | yes | no |
| Illustrated map | yes | optional only if also review/dossier | yes |
| Illustrated review/dossier | yes | yes | yes |

HTML is for scan-friendly code review: sticky navigation, route/flow sections, syntax-colored snippets, diagrams, review cards, test coverage, and refactor matrix.

Image is for rich visual understanding: low-text, code-grounded, and derived from the completed Markdown map.

## Validation Requirements

Before reporting complete, the skill should verify:

- selected mode is named in the output
- target and entry points are cited
- Markdown map exists before any companion artifact
- review/dossier modes include HTML
- illustrated modes include image artifact
- no visual cover was generated unless explicitly requested
- tests and gaps are included for all non-trivial modes
- snippets are compact and never full source files
- every claim is tied to code evidence or labeled inference
- artifact decision matches the generated companions

## Success Criteria

The user can type:

```text
$implementation-map Needs Assessment
```

and get a standard implementation map.

The user can type:

```text
$implementation-map review Needs Assessment
```

and get the rich review HTML behavior without extra steering.

The user can type:

```text
$implementation-map illustrated backend review Needs Assessment
```

and get Markdown, HTML, and a code-grounded image companion in the correct order.
