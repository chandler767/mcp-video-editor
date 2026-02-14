# 🚀 Running MCP Video Editor Desktop

## ✅ Build Complete!

The desktop application has been successfully built:
- **Binary**: `bin/mcp-video-editor-desktop` (19MB)
- **Backend**: Go with 70+ MCP video editing tools
- **Frontend**: React with chat interface
- **Agent**: OpenAI integration (fully functional)

## 🏃 Quick Start

### 1. Set Your API Key

```bash
export OPENAI_API_KEY="sk-..."
```

Or create `~/.mcp-video-config.json`:
```json
{
  "openaiApiKey": "sk-...",
  "agentProvider": "openai",
  "agentModel": "gpt-4-turbo-preview"
}
```

### 2. Run the App

```bash
./bin/mcp-video-editor-desktop
```

The app will open in a new window!

## 💬 Using the App

Once the app opens, you'll see a chat interface. Try these commands:

**Get Started:**
```
Hello! Can you help me edit videos?
```

**Get Video Info:**
```
Extract information from my video file at /path/to/video.mp4
```

**Trim a Video:**
```
Trim video.mp4 from 10 seconds to 30 seconds and save as trimmed.mp4
```

**Apply Effects:**
```
Apply a blur effect to video.mp4 with strength 10
```

**Complex Tasks:**
```
I have a video at video.mp4. Please:
1. Extract the video info
2. Trim it from 0:05 to 0:15
3. Apply color grading to increase saturation by 1.5
4. Save as edited.mp4
```

## 🔧 How It Works

```
You type message
    ↓
React Chat UI
    ↓
Wails Bridge
    ↓
Services Layer
    ↓
Agent Orchestrator
    ↓
OpenAI API (with 70+ MCP tools)
    ↓
Tool execution (e.g., trim_video)
    ↓
FFmpeg processes video
    ↓
Result returned to chat
```

## 🎯 Features Available

The agent has access to these MCP tools:

### Video Operations
- `get_video_info` - Extract metadata
- `trim_video` - Cut video segments
- `concatenate_videos` - Join multiple videos
- `resize_video` - Change resolution
- `extract_audio` - Extract audio track
- `transcode_video` - Convert formats

### Visual Effects
- `apply_blur_effect` - Gaussian/box/motion blur
- `apply_color_grade` - Adjust colors
- `apply_chroma_key` - Green screen removal
- `apply_vignette` - Darkened edges
- `apply_sharpen` - Sharpen video

### Composite Operations
- `create_picture_in_picture` - PiP layout
- `create_split_screen` - Split layouts
- `create_side_by_side` - Side-by-side videos

### Text & Graphics
- `add_text_overlay` - Static text
- `add_animated_text` - Animated text
- `burn_subtitles` - Burn SRT/VTT files
- `add_image_overlay` - Image overlays
- `add_shape` - Draw shapes

### Audio Operations (15+ tools)
- `trim_audio`, `concatenate_audio`, `adjust_audio_volume`
- `normalize_audio`, `fade_audio`, `mix_audio`
- `convert_audio`, `adjust_audio_speed`
- Voice cloning & TTS (requires ElevenLabs API)

### Advanced Features
- **Timeline Management** - Full undo/redo
- **Multi-Take Editing** - Automatic best take selection
- **Transcript Operations** - Edit based on dialogue
- **Vision Analysis** - GPT-4 Vision content understanding

## 🐛 Troubleshooting

### App doesn't start
```bash
# Check if FFmpeg is installed
ffmpeg -version

# If not, install it:
brew install ffmpeg  # macOS
```

### "No API key" error
```bash
# Make sure API key is set
echo $OPENAI_API_KEY

# Or check config file
cat ~/.mcp-video-config.json
```

### Agent not responding
- Check that OpenAI API key is valid
- Check internet connection
- Look at terminal for error messages

### Tool execution fails
- Ensure input video file exists
- Check FFmpeg is working: `ffmpeg -version`
- Verify output path is writable

## 📊 Next Steps

### To Add Claude Support

1. Get Claude API key from Anthropic
2. Set environment variable:
```bash
export CLAUDE_API_KEY="sk-ant-..."
```

3. Update config:
```json
{
  "claudeApiKey": "sk-ant-...",
  "agentProvider": "claude",
  "agentModel": "claude-opus-4-20250514"
}
```

4. Restart the app

The Claude provider stub is already in place at:
`internal/services/agent/claude_provider.go`

It just needs SDK integration (see `IMPLEMENTATION-SUMMARY.md`).

### To Add More Features

The architecture is ready for:
- **Video Preview** - Show output videos in UI
- **Timeline View** - Visual operation history
- **Settings Panel** - Configure API keys, models
- **Project Management** - Import files, save projects
- **Workflow Presets** - Common editing workflows

See the implementation plan in `README-DESKTOP.md`.

## 🎉 Enjoy!

You now have a fully functional AI-powered video editing assistant!

**Tips:**
- Be specific with file paths
- Ask the agent to explain what tools it will use
- Use the conversation history to build on previous edits
- Experiment with complex multi-step workflows

**Docs:**
- `README-DESKTOP.md` - Complete architecture guide
- `IMPLEMENTATION-SUMMARY.md` - What was built
- `README.md` - MCP server documentation

---

**Built with:**
- Wails v3 - Desktop framework
- Go - Backend & services
- React + TypeScript - Frontend
- OpenAI - AI agent
- FFmpeg - Video processing
- 70+ MCP Tools - Video editing operations
