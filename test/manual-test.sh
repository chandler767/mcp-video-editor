#!/bin/bash

# Manual testing script for MCP Video Editor
# This script demonstrates how to test individual features

set -e

echo "🧪 MCP Video Editor - Manual Testing"
echo "====================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

TEST_DIR="$(cd "$(dirname "$0")" && pwd)/videos"
OUTPUT_DIR="$(cd "$(dirname "$0")" && pwd)/output"

# Ensure directories exist
mkdir -p "$OUTPUT_DIR"

# Check if test videos exist
if [ ! -f "$TEST_DIR/test-1080p.mp4" ]; then
    echo "⚠️  Test videos not found. Run: npm run test:generate"
    exit 1
fi

echo -e "${BLUE}Testing with MCP Inspector...${NC}"
echo "This will open an interactive GUI to test all tools."
echo ""
echo "To test manually:"
echo "1. The inspector will start in your browser"
echo "2. Select a tool from the dropdown"
echo "3. Fill in the parameters"
echo "4. Click 'Run Tool'"
echo ""
echo "Example tool calls:"
echo ""
echo -e "${GREEN}Get Video Info:${NC}"
echo "  filePath: $TEST_DIR/test-1080p.mp4"
echo ""
echo -e "${GREEN}Trim Video:${NC}"
echo "  input: $TEST_DIR/test-1080p.mp4"
echo "  output: $OUTPUT_DIR/trimmed.mp4"
echo "  startTime: 2"
echo "  duration: 5"
echo ""
echo -e "${GREEN}Resize Video:${NC}"
echo "  input: $TEST_DIR/test-1080p.mp4"
echo "  output: $OUTPUT_DIR/resized.mp4"
echo "  width: 854"
echo "  height: 480"
echo ""
echo -e "${GREEN}Extract Frames:${NC}"
echo "  input: $TEST_DIR/test-1080p.mp4"
echo "  output: $OUTPUT_DIR/frame-%d.png"
echo "  timestamps: [1, 3, 5]"
echo ""
echo "Press ENTER to launch the MCP Inspector, or Ctrl+C to cancel"
read

npm run inspector
