# Delegated Publication

Use only when delegation is requested or authorized and materially useful. One worker owns staging, commit, push, and PR mutations; no competing publisher or nested delegation.

Supply repository/checkout, requested endpoint and authorization, intended files or validated candidate OID, excluded dirty scope, verified branch/upstream/PR base, existing PR if any, applicable validation evidence, hook requirements, and working authentication setup. Preserve explicit model/effort choices; otherwise inherit runtime settings.

Use the task's existing safe checkout. If isolation is needed, resolve it before handing over mutations and verify sibling dependencies there. The worker follows the normal publish scope rules or exact-candidate restrictions as applicable.

Return created commit/OID, pushed remote ref, PR URL/base/head/draft state, actual checks/hooks, excluded changes, and remaining blockers. The coordinator independently verifies remote identity and requested endpoint; it need not rerun the worker's unchanged validation suite. Preserve partial results and the worktree for continuation.
