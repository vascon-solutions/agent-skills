# UI Audit Evidence And Verdicts

## Evidence Selection

Use the smallest credible combination of:

- visible DOM and accessible state
- URL or navigation state
- persisted state after reload
- created record identifiers
- related list/detail/relationship surfaces
- downloaded artifacts
- relevant console or network evidence
- a critical screenshot when it materially improves understanding

A screenshot is not required for every checkpoint. Default to at most 12 and use
descriptive `<scenario>-<checkpoint>.png` names. Record traces only after a
failure reproduces and video only when no smaller evidence explains it.

Treat screenshots, traces, downloads, console, and network logs as sensitive.
Never retain passwords, access tokens, cookies, session/local storage values,
secret-file contents, or unrelated personal data.

## Failure Classes

| Class | Meaning |
| --- | --- |
| `environment` | Service, dependency, database, or configuration unavailable |
| `authentication` | Missing credentials, rejected session, or actor access |
| `test-data` | Missing prerequisite, conflict, or consumed workflow state |
| `functional` | Required application behavior is incorrect |
| `ux` | Behavior works but materially confuses, delays, or misleads |
| `automation` | Browser tooling cannot operate an otherwise valid control |
| `external` | Third-party or asynchronous boundary prevents progress |

Keep "not tested" distinct from "tested and failed." A failed required behavior
is functional even when the screen also has UX problems.

## Severity

| Severity | Meaning |
| --- | --- |
| `blocker` | Required flow cannot complete, critical safety/security issue, or invalid audit evidence |
| `major` | Required behavior is wrong or repeated high-impact UX friction |
| `moderate` | Recoverable defect, inconsistency, or material bounded friction |
| `minor` | Low-impact usability or visual polish issue |

## Verdict Precedence

Apply in this order:

1. `FAIL` when any exercised required behavior is proven incorrect.
2. `PASS` when every required check is proven and none failed.
3. `BLOCKED` when no meaningful required coverage completed because access,
   environment, tooling, or prerequisites prevented execution.
4. `PARTIAL` when meaningful coverage completed but a required check remains
   blocked or unverified and no exercised requirement failed.

Focused verdicts cover only named checks. Rollout mode cannot pass with an
unverified required scenario.

## Finding Evidence

A functional finding includes severity, actor/screen/step, expected and actual
behavior, concise reproduction, evidence links, and release impact.

A UI/UX recommendation includes the user problem, affected screen and actor,
checkpoint reference, concrete proposed change, expected impact, and a screenshot
only when it demonstrates the issue.

