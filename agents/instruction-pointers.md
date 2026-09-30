# Instruction Pointer Templates

`bin/link-agents.sh --repo-pointer DIR` renders these only on an explicit request. It requires an existing `AGENTS.md` and never replaces a non-generated file; it prints a proposed diff instead. A missing pointer does not prove a runtime loaded no instructions.

```md claude
@AGENTS.md
```

Gemini's `GEMINI.md` pointer belongs to rollout step R4.
