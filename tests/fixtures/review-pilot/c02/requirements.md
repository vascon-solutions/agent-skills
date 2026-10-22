# Record detail actions

This module is the complete client detail state for one record. The caller reads it and renders the returned allowed actions. Records have stable IDs and status `approved` or `cancelled`. Cancel and download are available only for an approved record while no cancellation is pending. Calls need a trimmed nonblank reason and must reject duplicate pending cancellation.

`api.cancel(id, reason)` returns the authoritative updated record when successful and rejects when unsuccessful. `api.refresh(id)` returns a current server record or rejects on a transport failure. No external query cache updates this module. Related refresh failure must not undo a successful command's confirmed state. Successful cancellation must remain available when reads succeed; rejected commands must release pending state. Rendering, navigation and server authorization are outside this module.
