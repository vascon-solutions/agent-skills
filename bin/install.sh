#!/bin/sh
set -eu

# Install the agent-skills pack to ~/agent-skills and link skills into
# ~/.claude/skills, ~/.codex/skills, ~/.cursor/skills, and ~/.agents/skills.
#
# Usage:
#   # via curl (recommended for first install):
#   curl -fsSL https://raw.githubusercontent.com/vascon-solutions/agent-skills/main/bin/install.sh | bash
#
#   # or clone manually, then run:
#   git clone git@github.com:vascon-solutions/agent-skills.git ~/agent-skills
#   ~/agent-skills/bin/link-skills.sh

REPO_SSH="git@github.com:vascon-solutions/agent-skills.git"
REPO_HTTPS="https://github.com/vascon-solutions/agent-skills.git"
INSTALL_DIR="$HOME/agent-skills"

echo "Agent Skills Pack — Installer"
echo ""

# ── Already installed ─────────────────────────────────────────────────────────

if [ -d "$INSTALL_DIR/.git" ]; then
  echo "Already installed at $INSTALL_DIR"
  echo ""
  echo "To update:"
  echo "  cd $INSTALL_DIR && git pull && bin/link-skills.sh"
  exit 0
fi

if [ -d "$INSTALL_DIR" ]; then
  echo "ERROR: $INSTALL_DIR exists but is not a git repo." >&2
  echo "Move or remove it first, then re-run this script." >&2
  exit 1
fi

# ── Clone ─────────────────────────────────────────────────────────────────────

echo "Installing to: $INSTALL_DIR"
echo ""

# Prefer SSH; fall back to HTTPS if SSH agent is not available
if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
  git clone "$REPO_SSH" "$INSTALL_DIR"
else
  git clone "$REPO_HTTPS" "$INSTALL_DIR"
fi

# ── Link ──────────────────────────────────────────────────────────────────────

echo ""
echo "Linking skills..."
"$INSTALL_DIR/bin/link-skills.sh"

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
echo "Done."
echo ""
echo "Skills are linked into:"
echo "  ~/.claude/skills/    (Claude Code)"
echo "  ~/.codex/skills/     (OpenAI Codex)"
echo "  ~/.cursor/skills/    (Cursor)"
echo "  ~/.agents/skills/    (agents.sh and compatible tools)"
echo ""
echo "To update later:"
echo "  cd ~/agent-skills && git pull && bin/link-skills.sh"
