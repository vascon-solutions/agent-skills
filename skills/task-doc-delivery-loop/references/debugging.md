# Focused Debugging

Use when a failure or unexpected behavior needs investigation, including standalone fixes. Keep the investigation proportional to the uncertainty.

1. Read the error and reproduce the symptom with the smallest practical check. Inspect relevant changes, environment, and dependency identity. If reproduction is unavailable, record that limit and gather evidence rather than claiming a confirmed cause.
2. Trace the failing value or operation to the responsible boundary. Compare a relevant working path when useful. Add temporary, redacted instrumentation only where existing evidence is insufficient; never dump credentials or whole environments.
3. Form a specific hypothesis supported by the evidence. Test it with a minimal experiment before piling on further changes. An obvious, well-supported cause does not require four separate ceremonial phases.
4. Fix the cause within the authorized scope and verify the original symptom plus affected invariants. Retain a regression test when it protects a durable behavior. Separate unrelated failures from the requested change.
5. When attempts fail, update the hypothesis using the new evidence. Repeated ineffective fixes call for reassessment or a bounded fresh review, not automatic architectural expansion or an arbitrary declaration that the architecture is wrong.

Resolve routine missing dependencies, configuration mistakes, and local test failures when authorized. Ask only for a real product/scope decision, unavailable access, unsafe action, or a blocker that cannot be resolved with available evidence. Continue independent work where possible. For external or intermittent failures, report the evidence and remaining uncertainty; do not add retries or new infrastructure speculatively.
