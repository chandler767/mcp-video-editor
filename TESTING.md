# Testing Guide

This document describes all available tests for the MCP Video Editor.

## Test Suite Overview

The MCP Video Editor has comprehensive test coverage for all major features:

- **Basic Video Operations** - Trim, resize, concatenate, extract audio/frames
- **Text Overlays & Animations** - Static text, animated text, subtitle burning
- **Timeline System** - Undo/redo, operation tracking, jump-to-point
- **Multi-Take Editing** - Project management, take analysis, best-take selection
- **Transcript Operations** - Speech-to-text, script matching
- **Vision Analysis** - Frame analysis, visual search, object tracking, scene comparison

## Running Tests

### Prerequisites

1. Build the project first:
```bash
npm run build
```

2. For transcript tests, set OpenAI API key:
```bash
export OPENAI_API_KEY=your_api_key_here
```

### Available Test Commands

```bash
# Generate test video files
npm run test:generate

# Run basic video operation tests
npm run test:run

# Run transcript operation tests (requires OpenAI API key)
npm run test:transcript

# Run new features tests (text, timeline, multi-take)
npm run test:new

# Run vision analysis tests (requires OpenAI API key)
npm run test:vision

# Run all tests except transcript/vision (no API key needed)
npm test

# Run ALL tests including transcript and vision tests (requires API key)
npm run test:all
```

## Test Coverage Summary

✅ **17 tests** for new features (text, timeline, multi-take)
✅ **11 tests** for basic video operations
⚠️  **6 tests** for transcript features (require OpenAI API key)
⚠️  **5 tests** for vision analysis (require OpenAI API key, incur API costs)

**Total: 39 test cases**

## Important Notes

### Vision Analysis Tests
Vision tests use GPT-4 Vision API which **incurs API costs** (approximately $0.01-0.05 per test run).
- Each test analyzes 2-5 frames from test videos
- Total cost per test run: ~$0.05
- These tests are separate and can be skipped without affecting other features

### API Key Requirements
Both transcript and vision tests require an OpenAI API key:
```bash
export OPENAI_API_KEY=your_api_key_here
```

Or configure it in the tool:
```bash
# Using the MCP client
set_config({ openaiApiKey: "your_key_here" })
```
