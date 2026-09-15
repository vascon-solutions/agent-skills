---
name: forms-rhf-zod-standard
description: Design or review React Hook Form and Zod form behavior, validation, and submit contracts. Not for incidental label or styling changes.
---

# Forms RHF Zod Standard

Apply the rules relevant to the requested boundary. Full template requirements apply to template creation or an explicit standards audit, not every ordinary edit. Reuse existing validation evidence; choose affected checks using [validation guidance](../task-doc-delivery-loop/references/validation.md).

## Core Rules

Use React Hook Form for form state and Zod for non-trivial validation. Keep schemas close to the feature unless they are shared contracts.

- Put feature-only schemas in `src/features/<feature>/schemas/` or the nearest established feature folder.
- Put cross-app or frontend/backend contracts in the shared package used by the repo, then import the schema from there.
- Derive form values from schemas with `z.infer<typeof schema>` instead of duplicating types.
- Use a resolver such as `zodResolver` when the form is schema-backed, and make sure the resolver dependency is pinned.
- Keep shared field wrappers responsible for labels, descriptions, required markers, error text, and accessibility wiring.

## Form Behavior

- Type `useForm` with the submit payload or schema-inferred values.
- Set explicit default values so controlled fields do not drift between uncontrolled and controlled state.
- Map API errors close to the feature form. Prefer field-level errors for validation issues and form-level messages for request or permission failures.
- Disable submit while submitting or while a mutation is pending.
- Preserve user-entered values after recoverable API errors unless clearing is intentional.
- Keep local form state in React Hook Form; do not put ordinary field state in TanStack Query.

## Validation

- Validate coercion and transforms at the schema boundary.
- Keep client validation helpful, but do not treat it as a security boundary.
- Match backend-required fields, enums, and formats when a shared contract exists.
- For optional fields, normalize empty strings intentionally before submit if the API expects `undefined` or `null`.

## Tests

Add focused tests for meaningful forms:

- Required and invalid field errors render.
- Submit uses the typed, normalized payload.
- Submit controls expose loading or disabled states.
- API validation errors map to the right field or form message.
- Shared wrappers preserve meaningful accessible label/error associations; do not freeze incidental label wording or DOM structure in tests.

Run focused form/contract checks and repo-required gates, reusing applicable evidence rather than repeating the full suite.
