# Record detail host

This module is the complete detail host for the caller. The caller invokes `visit` whenever it selects a record, including cached records, and uses only the exported methods. It reuses the host between selections. `read` supplies render state and must be treated as read-only by the caller.

Cancellation needs an open confirmation and a trimmed nonblank reason. The first selection of each record starts with a closed confirmation and empty reason. Returning to a previously selected record can retain that record's own input and pending state. Pending requests block duplicate confirmation. A pending request belongs to the record where it began, even if selection changes. A recoverable rejection preserves that record's reason and releases its pending state. Confirmation for the current record must still work after navigation.

`cancelRecord(id, reason)` rejects on failure and resolves on success. Supplied record objects are immutable and have stable string IDs. Assume a single-threaded JavaScript runtime and valid record objects. Rendering and server authorization are outside this module.
