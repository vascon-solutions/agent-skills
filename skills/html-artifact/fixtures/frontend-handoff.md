# Patient Search Frontend Handoff

## Summary

Frontend needs updated route state, API mapping, and removal of the legacy patient search dependency.

## API Surface

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/patients/search` | Query patients by name, MRN, or phone |

## Implementation Checklist

- [ ] Wire search box to debounced route state.
- [ ] Render empty, loading, and error states.
- [ ] Preserve selected patient after refresh.

## Retired Dependencies

- Remove `legacyPatientLookup`.
- Remove `useOldSearchParams`.
