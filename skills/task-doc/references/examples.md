# Examples

## Prompt Examples

Use prompts like these to trigger the skill cleanly:

- `Turn this PRD into a task doc.`
- `Create a durable task doc for this feature brief.`
- `Generate a task file for this roadmap item.`
- `Should this feature be one task or multiple sub tasks? Create the right task doc structure.`
- `Write this task doc to .agent/tasks/042-sample-feature.md.`
- `Output the task doc only. Do not write a file.`
- `Review whether this change deserves a task doc or should stay in normal plan mode.`

## Example 1: Good Fit

User request:

`Turn this feature brief into a task doc we can hand to another agent next week.`

Why it fits:

- the work is durable and handoff-oriented
- the source material exists
- the task doc adds value beyond a one-session plan

## Example 2: Roadmap-Derived

User request:

`Create the execution task file for roadmap item 12 without changing the roadmap.`

Why it fits:

- the source is authoritative and bounded
- the task doc is a stable execution artifact
- `transform-only` is the right generation style

Output behavior:

- if the user provides a path, write the task file there
- if the repo has an established task-doc location, follow that convention
- otherwise provide the task doc content directly

## Example 3: Output Only

User request:

`Turn this issue into a task doc, but output the markdown only. Do not create any files.`

Why it fits:

- the user wants a durable task artifact
- the output mode is explicit
- the skill should return the task doc content only

Output behavior:

- do not write any files
- return the completed task doc content directly

## Example 4: Write File

User request:

`Write this task doc to docs/tasks/auth-session-hardening.md.`

Why it fits:

- the output path is explicit
- the skill should create the task file in the requested location

Output behavior:

- write the file at the requested path
- do not invent another location

## Example 5: Reject and Use Plan Mode

User request:

`Fix the spacing in the dashboard header and align the icon.`

Why it should be rejected:

- the work is too small
- a durable task artifact adds no real value
- normal plan mode is enough

## Example 6: Populated Implementation-Oriented Task

User request:

`Create a task doc for moving API clients from the legacy auth header to bearer tokens.`

Abbreviated output:

```markdown
# Bearer Token API Client Migration

## Objective

Move internal API clients from the legacy `x-api-token` header to standard bearer-token authentication without changing endpoint authorization semantics.

## Source Context

Source mode: `brief`.

This task is synthesized from a user request and codebase findings in the API client and auth middleware.

## Design Reference

- Source Spec: `docs/api-auth-migration.md`
- `docs/security.md`

## Architecture Summary

The API already validates bearer tokens at the shared middleware boundary. This task updates internal clients to send the existing access token through the standard `Authorization` header while preserving the same downstream permission checks.

## Code Evidence

| Behavior | Source |
|---|---|
| Bearer tokens are parsed by shared auth middleware | `src/auth/jwt.strategy.ts#JwtStrategy` |
| Legacy clients still set `x-api-token` | `src/clients/internal-api.client.ts#InternalApiClient` |

## Current Behavior To Preserve

- Endpoint authorization and permission semantics must not change.
- Existing response handling and retry behavior must remain unchanged.
- Server-side support for `x-api-token` must remain available until the follow-up removal task.

## Prerequisites

- Existing access tokens are available to internal clients.

## Scope

- Update internal API clients to send `Authorization: Bearer <token>`.
- Remove legacy header use from updated clients.
- Add tests proving the new header is sent.

## Excluded

- Do not remove server support for `x-api-token`.
- Do not change token signing, session validation, or permissions.

## Pre-Implementation Verification

- Confirm bearer-token middleware still exists.
- Confirm each client still has access to the token source before changing it.

## Likely Files To Touch

- `src/clients/internal-api.client.ts`
- `src/clients/internal-api.client.spec.ts`

## Decisions Required Before Implementation

None.

## Execution Rules

- Preserve existing response handling and retry behavior.
- Do not broaden endpoint access while changing headers.

## Deliverables

- Updated client header behavior.
- Focused tests for the changed client.

## Completion Verification

- Tests fail before the client change and pass after it.
- No client sends both old and new headers unless explicitly required by compatibility code.

## Approval Gates

None. Security review applies to the follow-up task that removes server support for `x-api-token`.

## Completion Criteria

The task is complete when internal clients send bearer tokens and focused tests pass.

## Follow-ups

- Separate task to remove server-side legacy header support after clients deploy.
```

## Example 7: Task With Open Decisions

Use this shape when implementation is blocked by a real product, security, or architecture choice:

```markdown
## Decisions Required Before Implementation

- **Token rotation cadence**
  - Options: (a) rotate per session, (b) rotate every 24 hours, (c) rotate only on privilege change.
  - Implications: (a) shortest exposure window with more Redis writes and more frequent client refreshes; (b) balanced operational cost and risk; (c) lowest runtime overhead but longest exposure window if a token leaks.
  - Resolver: security review and platform auth owner.

- **Public key distribution**
  - Options: (a) JWKS endpoint with cache headers, (b) static public key through deployment config.
  - Implications: (a) supports key rotation without redeploying every verifier; (b) simpler rollout but key rotation requires coordinated config deployment.
  - Resolver: platform architecture decision before implementation starts.
```
