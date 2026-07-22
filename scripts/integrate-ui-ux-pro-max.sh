#!/bin/bash
# Script to clone and integrate ui-ux-pro-max-skill into droidperf
# Run from the droidperf project root: bash scripts/integrate-ui-ux-pro-max.sh

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SKILL_DIR="$PROJECT_DIR/ui-ux-pro-max-skill"

echo "=== Step 1: Clone ui-ux-pro-max-skill ==="
if [ -d "$SKILL_DIR" ]; then
    echo "Directory $SKILL_DIR already exists, pulling latest..."
    cd "$SKILL_DIR" && git pull
else
    git clone https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git "$SKILL_DIR"
fi

echo ""
echo "=== Step 2: Install skill dependencies ==="
cd "$SKILL_DIR"
if [ -f package.json ]; then
    npm install
fi

echo ""
echo "=== Step 3: Run build to generate website ==="
if [ -f package.json ] && grep -q '"build"' package.json; then
    npm run build
    echo "Build complete!"
else
    echo "No build script found - templates will be used directly."
fi

echo ""
echo "=== Step 4: Backup existing web UI ==="
WEB_DIR="$PROJECT_DIR/src/web"
if [ -f "$WEB_DIR/index.html" ]; then
    cp "$WEB_DIR/index.html" "$WEB_DIR/index.html.backup"
    echo "Backed up index.html to index.html.backup"
fi
if [ -f "$WEB_DIR/how-it-works.html" ]; then
    cp "$WEB_DIR/how-it-works.html" "$WEB_DIR/how-it-works.html.backup"
    echo "Backed up how-it-works.html to how-it-works.html.backup"
fi

echo ""
echo "=== Step 5: Integration complete ==="
echo ""
echo "Next steps (manual):"
echo "1. Review the built output in: $SKILL_DIR/ (check dist/ or root index.html)"
echo "2. Copy the generated HTML/CSS/JS to $WEB_DIR/"
echo "3. Update src/server.js routes if the new site has different page paths"
echo "4. Merge the droidperf-specific content (audit results, CLI integration) into the new templates"
echo ""
echo "Repo cloned to: $SKILL_DIR"
ls -la "$SKILL_DIR"
