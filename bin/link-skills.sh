#!/bin/sh
set -eu

# Link shared skills into ~/.codex, ~/.claude, and ~/.agents without duplicating them.
#
# Usage:
#   ./bin/link-skills.sh
#   ./bin/link-skills.sh /path/to/agent-skills
#
# The canonical layout is expected to be:
#   <root>/skills/<skill-name>/SKILL.md

ROOT="${1:-$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)}"
SKILLS_DIR="$ROOT/skills"

if [ ! -d "$SKILLS_DIR" ]; then
  echo "Skills directory not found: $SKILLS_DIR" >&2
  exit 1
fi

SKILL_NAMES="
audit-api
audit-ui
prepare-frontend-handoff
prepare-qa-handoff
qa-triage-and-fix
publish-branch
repo-docs-audit
rewrite-docs-from-code
repair-agent-files
review-doc-changes
review-task-docs
review-implementation
address-review-findings
implementation-map
repo-skill-scan
roadmap-todo
task-doc
task-doc-intake
task-doc-delivery-loop
audit-logging-standard
forms-rhf-zod-standard
migration-discipline
nestjs-api-standard
nx-monorepo-standard
tanstack-fe-standard
tanstack-start-standard
ultracite-standard
html-artifact
markdown-artifact
image-artifact
artifact-workbench
repo-design-context
publish-artifact
"

# Skills removed in this version — unlink them if they still exist as symlinks
DEPRECATED_SKILL_NAMES="
streamline-agents-md
align-claude-and-agents
agent-doc-handoff-review
scaffold-repo-skill
task-first-implementation
"

TARGET_DIRS="
$HOME/.codex/skills
$HOME/.claude/skills
$HOME/.cursor/skills
$HOME/.agents/skills
$HOME/.gemini/config/skills
"

echo "Canonical skills root: $ROOT"

for target in $TARGET_DIRS; do
  mkdir -p "$target"
  echo "Linking into: $target"

  # Remove deprecated symlinks
  for skill in $DEPRECATED_SKILL_NAMES; do
    dst="$target/$skill"
    if [ -L "$dst" ]; then
      rm "$dst"
      echo "  unlinked (deprecated) $skill"
    fi
  done

  # Link current skills
  for skill in $SKILL_NAMES; do
    src="$SKILLS_DIR/$skill"
    dst="$target/$skill"

    if [ ! -d "$src" ]; then
      echo "Missing skill source: $src" >&2
      exit 1
    fi

    if [ -L "$dst" ]; then
      current="$(readlink "$dst" || true)"
      if [ "$current" = "$src" ]; then
        echo "  ok    $skill"
        continue
      fi
      echo "  skip  $skill (existing symlink points elsewhere: $current)" >&2
      continue
    fi

    if [ -e "$dst" ]; then
      echo "  skip  $skill (path already exists: $dst)" >&2
      continue
    fi

    ln -s "$src" "$dst"
    echo "  link  $skill"
  done
done

echo "Done."
