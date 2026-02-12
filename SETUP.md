# MCP Video Editor Setup Guide

This guide explains how to configure the MCP Video Editor to work with Claude Desktop and Claude Code.

## ✅ Configuration Complete

The MCP Video Editor has been automatically configured for both Claude Desktop and Claude Code.

## Configuration Files

### Claude Desktop
**Location**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "video-editor": {
      "command": "node",
      "args": [
        "/Users/chandler.mayo/Desktop/mcp-editor/build/src/index.js"
      ]
    }
  }
}
```

### Claude Code
**Location**: `~/.claude.json`

The video-editor has been added to:
1. **Global MCP servers** - Available in all projects
2. **Project-specific servers** - Configured for this project

```json
{
  "mcpServers": {
    "video-editor": {
      "command": "node",
      "args": [
        "/Users/chandler.mayo/Desktop/mcp-editor/build/src/index.js"
      ]
    }
  }
}
```

## How to Use

### 1. Restart Claude
- **Claude Desktop**: Quit and restart the application
- **Claude Code**: Restart the CLI (exit and run `claude` again)

### 2. Verify Tools Are Available
After restarting, you should see 16 video editing tools:

#### Core Video Operations
- `get_video_info` - Get video metadata
- `trim_video` - Cut video segments
- `concatenate_videos` - Join multiple videos
- `extract_audio` - Extract audio track
- `convert_video` - Convert format/quality
- `resize_video` - Change resolution
- `extract_frames` - Get screenshots
- `adjust_speed` - Change playback speed
- `transcode_for_web` - Optimize for web sharing

#### Configuration
- `get_config` - View current settings
- `set_config` - Update settings
- `reset_config` - Reset to defaults

#### Transcript Features (requires OpenAI API key)
- `extract_transcript` - Get word-level transcript with timestamps
- `find_in_transcript` - Search for text and get timestamps
- `remove_by_transcript` - Remove spoken text from video
- `trim_to_script` - Edit video to match a written script

### 3. Example Usage

In Claude Desktop or Claude Code, you can ask:

```
"Can you get info about this video: /path/to/video.mp4"

"Trim this video from 10 seconds to 30 seconds"

"Extract the audio from my recording as an MP3"

"Optimize this 4K video for web sharing at 1080p"

"Extract the transcript from my presentation recording"

"Remove all the 'um' and 'uh' from my interview video"
```

## Testing the Connection

Run the connection test:

```bash
npm run build
node build/test/test-connection.js
```

You should see:
```
✅ Successfully connected to MCP server
📋 Found 16 tools
✅ MCP server is working correctly!
```

## Troubleshooting

### Tools Not Showing Up
1. Make sure you've restarted Claude Desktop/Code
2. Check the config file paths are correct
3. Verify the build exists: `ls build/src/index.js`
4. Rebuild if needed: `npm run build`

### Connection Errors
1. Check Node.js is installed: `node --version`
2. Verify FFmpeg is available: `ffmpeg -version`
3. Check the logs in Claude Desktop/Code

### Transcript Features Not Working
1. Set your OpenAI API key in config:
   ```
   set_config({ "openaiApiKey": "sk-..." })
   ```
2. Make sure you have OpenAI API credits
3. See [TRANSCRIPT_FEATURES.md](TRANSCRIPT_FEATURES.md) for details

## Rebuilding After Changes

If you modify the source code:

```bash
npm run build
```

Then restart Claude Desktop/Code to pick up the changes.

## Uninstalling

To remove the MCP Video Editor:

### Claude Desktop
Edit `~/Library/Application Support/Claude/claude_desktop_config.json` and remove the `video-editor` entry.

### Claude Code
Edit `~/.claude.json` and remove the `video-editor` entry from both:
- The global `mcpServers` section
- Any project-specific `mcpServers` sections

## More Information

- [README.md](README.md) - Full feature documentation
- [TRANSCRIPT_FEATURES.md](TRANSCRIPT_FEATURES.md) - Transcript feature guide
- [TESTING.md](TESTING.md) - Testing guide
- [examples/](examples/) - Example usage
