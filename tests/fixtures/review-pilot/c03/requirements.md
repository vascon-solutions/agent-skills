# Protected record download

This module is the complete server entry point. Middleware authenticates the supplied actor and verifies its `active`, `tenantId` and `role` claims; it does not enforce object authorization. A request caller controls `id`, including known IDs from other tenants. `repository.find(id)` performs a global lookup and returns an immutable record with `tenantId` and `contents`, or no record.

Only an active actor with role `reader` in the record's tenant may receive its contents. Preserve successful downloads for these readers. Inactive actors receive 401 and absent records receive 404. Denied downloads must not return record contents. No client gate, downstream filter or additional middleware supplies this check. The endpoint handles application authorization only; cryptography and HTTP transport are outside this module.
