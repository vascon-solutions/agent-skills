# Billing Architecture

## Overview

Billing uses events from orders and subscriptions to produce invoices and ledger entries.

## Event Flow

### Order Completed

The order service emits `order.completed`, then billing creates a draft invoice.

### Subscription Renewed

The subscription worker emits `subscription.renewed`, then billing appends recurring charges.

## Operational Notes

### Retry Behavior

Failed ledger writes retry with idempotency keys.

```sql
select * from billing_events where status = 'failed';
```
