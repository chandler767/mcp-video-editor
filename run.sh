#!/bin/bash

# MCP Video Editor Desktop - Quick Start Script

echo "🎬 MCP Video Editor Desktop"
echo "================================"
echo ""

# Check if binary exists
if [ ! -f "bin/mcp-video-editor-desktop" ]; then
    echo "❌ Binary not found. Building..."
    go build -o bin/mcp-video-editor-desktop main.go
    if [ $? -ne 0 ]; then
        echo "❌ Build failed!"
        exit 1
    fi
    echo "✅ Build complete!"
    echo ""
fi

# Check for API keys
if [ -z "$OPENAI_API_KEY" ] && [ -z "$CLAUDE_API_KEY" ]; then
    echo "⚠️  Warning: No API key found!"
    echo ""
    echo "Please set one of these environment variables:"
    echo "  export OPENAI_API_KEY=\"sk-...\""
    echo "  export CLAUDE_API_KEY=\"sk-ant-...\""
    echo ""
    echo "Or create ~/.mcp-video-config.json with your keys."
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check FFmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "⚠️  Warning: FFmpeg not found!"
    echo "Install it with: brew install ffmpeg"
    echo ""
fi

# Show configuration
echo "Configuration:"
if [ ! -z "$OPENAI_API_KEY" ]; then
    echo "  ✅ OpenAI API Key: ${OPENAI_API_KEY:0:7}...${OPENAI_API_KEY: -4}"
fi
if [ ! -z "$CLAUDE_API_KEY" ]; then
    echo "  ✅ Claude API Key: ${CLAUDE_API_KEY:0:7}...${CLAUDE_API_KEY: -4}"
fi
if [ -f ~/.mcp-video-config.json ]; then
    echo "  ✅ Config file: ~/.mcp-video-config.json"
fi
echo ""

# Run the app
echo "🚀 Launching MCP Video Editor..."
echo ""
./bin/mcp-video-editor-desktop
