---
name: audit-logging-standard
description: Use when adding, reviewing, or hardening audit logging for APIs, templates, admin workflows, sensitive mutations, compliance trails, event listeners, or protected audit read surfaces.
---

# Audit Logging Standard

## Purpose

Treat audit logging as a production capability, not a demo. It should explain who did what, to which resource, from where, and with which safe change summary, without storing secrets or exposing audit data to ordinary users.

## Event Contract

Prefer event-driven writes so business code emits intent and the audit module owns persistence. A useful audit payload includes:

- `action`: stable verb or enum value.
- `userId`: actor when known, with explicit system actor handling.
- `ipAddress`: request origin when available.
- `entityType`, `entityId`, and optional `entityTitle`.
- `domain`: bounded area or module name.
- `changes`: redacted structured summary, encrypted when stored.
- `iv` or encryption metadata when encrypted payloads require it.
- `createdAt`: database-owned timestamp.

Keep action names boring and durable. Avoid embedding UI copy or product nouns that will not survive reuse.

## Write Path

- Apply audit logging to at least one real business mutation before calling the template ready.
- If using an interceptor, prove it is attached to routes that mutate business data.
- If using explicit `emitAction()` calls, keep them near the successful state change and after transaction success when possible.
- Do not audit failed validation noise unless the product explicitly needs security-event logging.
- Make repeated emits idempotent only when the operation itself can retry.

## Redaction And Encryption

Never store raw:

- Passwords, password hashes, refresh tokens, JWTs, API keys, reset tokens, session cookies, MFA secrets, or authorization headers.
- Full sensitive profile data unless there is an explicit retention requirement.
- Before/after blobs when a field-level summary is enough.

Validate encryption configuration before encrypting or decrypting. Fail loudly for malformed keys in production-like environments.

## Read Surface

Audit reads are sensitive operational data:

- Require authentication.
- Prefer admin-only or permission-guarded access.
- Support pagination and narrow filters.
- Avoid broad unaudited export endpoints unless explicitly required.
- Document retention expectations and known limitations.

## Tests

Cover:

- Emitting and persisting a normal mutation.
- Redacting secret fields.
- Encrypting and decrypting `changes` where enabled.
- Rejecting unauthenticated or unauthorized audit reads.
- Pagination/filter behavior for audit queries.
