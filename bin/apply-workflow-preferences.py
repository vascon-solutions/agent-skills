#!/usr/bin/env python3
"""Apply portable workflow routing to installed Superpowers entrypoints."""
import argparse
import hashlib
import json
import re
from pathlib import Path

ROUTES = {
    'brainstorming': 'brainstorm for research and unsettled design; task-doc-intake for delivery scope',
    'writing-plans': 'task-doc for a durable implementation handoff',
    'executing-plans': 'task-doc-delivery-loop for authorized execution',
    'subagent-driven-development': 'task-doc-delivery-loop for execution and bounded delegation when authorized',
    'verification-before-completion': 'the active owned workflow and its validation evidence',
    'requesting-code-review': 'review-implementation for independent implementation review',
    'receiving-code-review': 'address-review-findings for the current findings batch',
    'finishing-a-development-branch': 'publish-branch for the requested publication endpoint',
    'writing-skills': 'the host skill-authoring capability, if available, with focused validation',
}
SPECIALISTS = {
    'systematic-debugging': 'deep diagnosis of a difficult failure',
    'dispatching-parallel-agents': 'bounded independent investigations or tasks',
}
ROOTS = ('.agents/skills', '.codex/skills', '.claude/skills', '.cursor/skills', '.gemini/config/skills')
MARKER = '<!-- owned-workflow-routing:v1 -->'


def apply(home, force=False):
    seen = set()
    updated = 0
    for folder in ROOTS:
        for name in (*ROUTES, *SPECIALISTS):
            entry = home / folder / name / 'SKILL.md'
            if not entry.is_file():
                continue
            entry = entry.resolve()
            if entry in seen:
                continue
            seen.add(entry)
            original = entry.read_text()
            wrapped = re.search(r'<!-- owned-workflow-routing:v[^>]+ -->', original) is not None
            if MARKER in original and not force:
                continue
            reference = entry.parent / 'superpowers-original.md'
            if wrapped:
                if not reference.is_file():
                    raise ValueError(f'Cannot refresh wrapper without preserved original: {entry}')
                original = reference.read_text()
                if 'owned-workflow-routing:' in original:
                    raise ValueError(f'Preserved original is itself a wrapper: {reference}')
            if not original.startswith('---\n') or '\n---' not in original[4:]:
                raise ValueError(f'Unrecognized skill frontmatter: {entry}')
            digest = hashlib.sha256(original.encode()).hexdigest()
            backup = home / 'agent-skills-backups' / 'superpowers' / digest / name / 'SKILL.md'
            backup.parent.mkdir(parents=True, exist_ok=True)
            backup.write_text(original)
            reference = entry.parent / 'superpowers-original.md'
            reference.parent.mkdir(exist_ok=True)
            reference.write_text(original)
            if name in SPECIALISTS:
                description = f'Use only when the user explicitly requests {name} for {SPECIALISTS[name]}. Do not select automatically.'
                instructions = (
                    f'Use this specialist only when the user explicitly requests `{name}` or this Superpowers specialist. '
                    'An automatic match, another skill reference, or a generic request to fix or implement something is not an explicit request. '
                    'Otherwise continue the owned workflow. Ordinary debugging uses '
                    '`task-doc-delivery-loop/references/debugging.md` in the shared agent-skills repository.\n\n'
                    'For an explicit request, read [the specialist reference](superpowers-original.md) '
                    'and apply its relevant techniques within the existing task. Preserve authorization and the delivery endpoint. '
                    'Use evidence that still applies; do not add compulsory planning, review, or finishing workflows. '
                    'For parallel work, establish independence, file ownership, and the combined verification scope before dispatch. '
                    'For debugging, scale investigation to uncertainty and reassess failed hypotheses without assuming an architectural defect.'
                )
            else:
                description = f'Legacy Superpowers workflow; prefer {ROUTES[name]}. Do not select this legacy workflow automatically.'
                instructions = (
                    f'Default to {ROUTES[name]}. Resolve owned skills by name in the shared skill installation. '
                    'Small authorized work can proceed directly without creating a task document. '
                    'Do not start the legacy process because a generic trigger or another external skill mentions it.\n\n'
                    'The [original instructions](superpowers-original.md) are retained for explicit user requests '
                    'to inspect or use this legacy Superpowers workflow. Load them only for that request. '
                    'Preserve existing decisions, authorization, validation evidence, and the agreed endpoint; '
                    'do not automatically chain other external workflows. If a preferred skill is unavailable, '
                    'continue within the current task using available capabilities.'
                )
            entry.write_text(f'---\nname: {name}\ndescription: {json.dumps(description)}\n---\n\n{MARKER}\n\n# {name}\n\n{instructions}\n')
            updated += 1
            print(f'Updated {entry}')
    print(f'{updated} updated; {len(seen)} unique installed entrypoints checked.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--home', type=Path, default=Path.home(), help='Agent installation home directory')
    parser.add_argument('--force', action='store_true', help='Refresh existing wrappers while preserving upstream originals')
    args = parser.parse_args()
    apply(args.home.expanduser().resolve(), force=args.force)
