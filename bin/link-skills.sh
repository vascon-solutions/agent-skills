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
repo-docs-audit
rewrite-docs-from-code
repair-agent-files
review-doc-changes
review-task-docs
repo-skill-scan
roadmap-todo
scaffold-repo-skill
task-doc
vascon-bits-usage
"

# Skills removed in this version — unlink them if they still exist as symlinks
DEPRECATED_SKILL_NAMES="
streamline-agents-md
align-claude-and-agents
agent-doc-handoff-review
"

TARGET_DIRS="
$HOME/.codex/skills
$HOME/.claude/skills
$HOME/.agents/skills
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
