# Invite Flow QA Handoff

## Summary

QA should verify invite lifecycle, endpoint permissions, and role boundaries across admin and member users.

## States

- Draft: invite has not been sent.
- Sent: invite email is queued and token is active.
- Accepted: member account is linked.
- Expired: token can no longer be used.

## Endpoints

| Method | Path | Expected |
|---|---|---|
| GET | `/api/invites/:id` | Returns invite details for authorized users |
| POST | `/api/invites` | Creates and sends invite |
| DELETE | `/api/invites/:id` | Revokes pending invite |

## Roles

- Admin: can create, resend, and revoke invites.
- Member: can view only their accepted invite.

## Checklist

- [ ] Verify expired token message.
- [ ] Verify member cannot revoke invite.
