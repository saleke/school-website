#!/usr/bin/env bash

set -e

# ============================================================
# Lumosel + Claude Code / Codex Setup Script
# macOS / Linux
# ============================================================

clear

echo "============================================================"
echo "        Lumosel AI Gateway Setup"
echo "============================================================"
echo
echo "This script will:"
echo "  1. Install NVM"
echo "  2. Install Node.js 22"
echo "  3. Install Claude Code or Codex"
echo "  4. Apply your custom Lumosel API Profile"
echo
echo "============================================================"
echo

# ------------------------------------------------------------
# Helper functions
# ------------------------------------------------------------

error_exit() {
    echo
    echo "============================================================"
    echo "ERROR: $1"
    echo "============================================================"
    echo
    exit 1
}

pause() {
    echo
    read -r -p "Press Enter to continue..."
}

# ------------------------------------------------------------
# Check operating system
# ------------------------------------------------------------

OS="$(uname -s)"

case "$OS" in
    Darwin)
        SHELL_CONFIG="$HOME/.zshrc"
        ;;
    Linux)
        if [ -f "$HOME/.bashrc" ]; then
            SHELL_CONFIG="$HOME/.bashrc"
        elif [ -f "$HOME/.zshrc" ]; then
            SHELL_CONFIG="$HOME/.zshrc"
        else
            SHELL_CONFIG="$HOME/.bashrc"
        fi
        ;;
    *)
        error_exit "This script supports macOS and Linux only."
        ;;
esac

# ------------------------------------------------------------
# Check curl
# ------------------------------------------------------------

if ! command -v curl >/dev/null 2>&1; then
    error_exit "curl is not installed. Please install curl and run this script again."
fi

# ------------------------------------------------------------
# Install NVM
# ------------------------------------------------------------

echo
echo "============================================================"
echo "Step 1: Installing NVM"
echo "============================================================"
echo

if [ -s "$HOME/.nvm/nvm.sh" ]; then
    echo "NVM appears to already be installed."
else
    echo "Installing NVM..."
    echo

    curl -o- https://githubusercontent.com | bash \
        || error_exit "NVM installation failed."

    echo
    echo "NVM installation completed."
fi

# ------------------------------------------------------------
# Load NVM into the current shell
# ------------------------------------------------------------

export NVM_DIR="$HOME/.nvm"

if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck disable=SC1090
    source "$NVM_DIR/nvm.sh"
else
    error_exit "NVM was installed, but nvm.sh could not be found."
fi

if ! command -v nvm >/dev/null 2>&1; then
    error_exit "NVM could not be loaded into the current shell."
fi

echo
echo "NVM version:"
nvm --version

# ------------------------------------------------------------
# Install Node.js 22
# ------------------------------------------------------------

echo
echo "============================================================"
echo "Step 2: Installing Node.js 22"
echo "============================================================"
echo

nvm install 22 || error_exit "Node.js 22 installation failed."

echo
echo "Switching to Node.js 22..."

nvm use 22 || error_exit "Could not switch to Node.js 22."

# Set Node 22 as the default for future shells.
nvm alias default 22 >/dev/null 2>&1 || true

# ------------------------------------------------------------
# Confirm Node/npm installation
# ------------------------------------------------------------

echo
echo "============================================================"
echo "Step 3: Confirming Node.js and npm"
echo "============================================================"
echo

NODE_VERSION="$(node -v)" || error_exit "Node.js is not available."
NPM_VERSION="$(npm -v)" || error_exit "npm is not available."

echo "Node.js: $NODE_VERSION"
echo "npm:     $NPM_VERSION"

echo

# ------------------------------------------------------------
# Select CLI
# ------------------------------------------------------------

echo "============================================================"
echo "Step 4: Choose your AI coding CLI"
echo "============================================================"
echo
echo "1) Claude Code"
echo "2) Codex"
echo

while true; do
    read -r -p "Enter your choice [1-2]: " CLI_CHOICE

    case "$CLI_CHOICE" in
        1)
            CLI="claude"
            break
            ;;
        2)
            CLI="codex"
            break
            ;;
        *)
            echo "Invalid choice. Please enter 1 or 2."
            ;;
    esac
done

# ------------------------------------------------------------
# Claude Code / Codex Installation
# ------------------------------------------------------------

if [ "$CLI" = "claude" ]; then

    echo
    echo "============================================================"
    echo "Installing Claude Code"
    echo "============================================================"
    echo

    npm install -g @anthropic-ai/claude-code@latest \
        || error_exit "Claude Code installation failed."

    echo
    echo "Claude Code version:"
    claude --version || error_exit "Claude Code was installed but could not be executed."

else
    echo
    echo "============================================================"
    echo "Installing Codex"
    echo "============================================================"
    echo
    npm install -g codex || error_exit "Codex installation failed."
fi

# --------------------------------------------------------
# Set Custom Lumosel Settings Variables
# --------------------------------------------------------

ANTHROPIC_BASE_URL="https://api.lumosel.vip"
ANTHROPIC_AUTH_TOKEN="lumo_live_7b6d4c1015d73732e2ea482bb0e5fa4fd33bfba8"
ANTHROPIC_MODEL="claude-opus-5"
ANTHROPIC_SMALL_FAST_MODEL="claude-sonnet-4.5"

# --------------------------------------------------------
# Configure Official Lumosel JSON settings.json Structure
# --------------------------------------------------------

echo
echo "Configuring Claude Code JSON settings..."
echo

CLAUDE_SETTINGS_DIR="$HOME/.claude"
CLAUDE_SETTINGS_FILE="$CLAUDE_SETTINGS_DIR/settings.json"

# Ensure directory structure exists
mkdir -p "$CLAUDE_SETTINGS_DIR"

# Backup existing file if present
if [ -f "$CLAUDE_SETTINGS_FILE" ]; then
    cp "$CLAUDE_SETTINGS_FILE" "${CLAUDE_SETTINGS_FILE}.bak"
fi

# Apply the strict parameters required for the Lumosel Gateway
cat << EOF > "$CLAUDE_SETTINGS_FILE"
{
  "env": {
    "ANTHROPIC_BASE_URL": "${ANTHROPIC_BASE_URL}",
    "ANTHROPIC_AUTH_TOKEN": "${ANTHROPIC_AUTH_TOKEN}",
    "ANTHROPIC_MODEL": "${ANTHROPIC_MODEL}",
    "ANTHROPIC_SMALL_FAST_MODEL": "${ANTHROPIC_SMALL_FAST_MODEL}"
  }
}
EOF

# --------------------------------------------------------
# Configure Environment Variables in Shell Config Profile
# --------------------------------------------------------

echo "Configuring environment variables in $SHELL_CONFIG..."
echo

# Remove existing config block to avoid overlapping configuration rows
if [ -f "$SHELL_CONFIG" ]; then
    sed -i.bak '/# AgentRouter Config/,/# End AgentRouter Config/d' "$SHELL_CONFIG" 2>/dev/null || \
    sed -i '' '/# AgentRouter Config/,/# End AgentRouter Config/d' "$SHELL_CONFIG" 2>/dev/null || true
   
    sed -i.bak '/# Lumosel Config/,/# End Lumosel Config/d' "$SHELL_CONFIG" 2>/dev/null || \
    sed -i '' '/# Lumosel Config/,/# End Lumosel Config/d' "$SHELL_CONFIG" 2>/dev/null || true
fi

# Write environment configuration tags to system shell profile
cat << EOF >> "$SHELL_CONFIG"

# Lumosel Config
export ANTHROPIC_BASE_URL="${ANTHROPIC_BASE_URL}"
export ANTHROPIC_AUTH_TOKEN="${ANTHROPIC_AUTH_TOKEN}"
export ANTHROPIC_MODEL="${ANTHROPIC_MODEL}"
export ANTHROPIC_SMALL_FAST_MODEL="${ANTHROPIC_SMALL_FAST_MODEL}"
# End Lumosel Config
EOF

echo "============================================================"
echo "Lumosel Integration Complete!"
echo "============================================================"
echo "1. Saved parameters to: $CLAUDE_SETTINGS_FILE"
echo "2. Fixed shell configuration syntax inside: $SHELL_CONFIG"
echo
echo "To initialize the gateway config right away, execute:"
echo "   source $SHELL_CONFIG"
echo "============================================================"