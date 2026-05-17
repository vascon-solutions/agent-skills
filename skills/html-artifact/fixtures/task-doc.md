# Checkout Refactor Task

## Summary

Refactor checkout validation so API, UI, and background jobs share the same decision path.

## Scope

- Move validation rules into `CheckoutValidationService`.
- Keep payment capture unchanged.
- Add tests for expired carts and blocked accounts.

## Decisions Required

- Resolved: validation belongs in the service layer, not the controller.
- Unresolved: whether guest checkout should support saved addresses.
- Blocked: final fraud-review threshold from operations.

## Likely Files To Touch

- `src/checkout/checkout.controller.ts`
- `src/checkout/checkout-validation.service.ts`
- `src/jobs/cart-expiry.job.ts`

## Code Evidence

```ts
await checkoutValidationService.validate(cartId, accountId);
```
