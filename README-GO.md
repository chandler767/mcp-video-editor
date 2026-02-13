# MCP Video Editor - Go Implementation

A complete port of the MCP Video Editor from TypeScript to Go, providing professional video editing capabilities through the Model Context Protocol (MCP).

## Overview

This is a Go implementation of the MCP Video Editor, featuring:
- Video operations (trim, concatenate, resize, transcode)
- Visual effects (blur, color grading, chroma key, vignette, sharpen)
- Composite operations (picture-in-picture, split screen)
- Transition effects (fade, wipe, slide, crossfade with audio sync)
- FFmpeg integration for high-quality video processing
- MCP server for AI-assisted video editing

## Architecture

```
mcp-video-editor/
├── cmd/
│   └── mcp-video-editor/     # Main application entry point
│       └── main.go
├── pkg/
│   ├── config/               # Configuration management
│   │   └── config.go
│   ├── ffmpeg/               # FFmpeg wrapper
│   │   └── manager.go
│   ├── video/                # Video operations
│   │   └── operations.go
│   ├── visual/               # Visual effects and composites
│   │   ├── effects.go
│   │   ├── composite.go
│   │   └── transitions.go
│   └── server/               # MCP server
│       ├── server.go
│       └── handlers.go
├── go.mod
├── go.sum
└── bin/
    └── mcp-video-editor      # Compiled binary (5.8MB)
```

## Building

```bash
# Install dependencies
go mod download

# Build the binary
go build -o bin/mcp-video-editor ./cmd/mcp-video-editor

# Or use go run for development
go run ./cmd/mcp-video-editor
```

## Configuration

The editor uses a configuration file at `~/.mcp-video-config.json`:

```json
{
  "openaiKey": "sk-...",
  "ffmpegPath": "/usr/local/bin/ffmpeg",
  "ffprobePath": "/usr/local/bin/ffprobe",
  "defaultQuality": "medium",
  "tempDir": "/tmp/mcp-video"
}
```

Configuration can also be set via environment variables:
- `OPENAI_API_KEY` - OpenAI API key
- `FFMPEG_PATH` - Path to ffmpeg binary
- `FFPROBE_PATH` - Path to ffprobe binary

## MCP Tools

### Video Operations (6 tools)

1. **get_video_info** - Get video metadata (duration, resolution, codec, etc.)
2. **trim_video** - Cut/trim video by time range
3. **concatenate_videos** - Join multiple videos together
4. **resize_video** - Change video resolution
5. **extract_audio** - Extract audio track from video
6. **transcode_video** - Convert video format/codec

### Visual Effects (5 tools)

7. **apply_blur_effect** - Apply blur (gaussian, box, motion, radial)
8. **apply_color_grade** - Adjust colors (brightness, contrast, saturation, etc.)
9. **apply_chroma_key** - Remove green screen
10. **apply_vignette** - Add darkened edges effect
11. **apply_sharpen** - Sharpen video

### Composite Operations (2 tools)

12. **create_picture_in_picture** - Overlay smaller video on main video
13. **create_split_screen** - Create split screen layouts (horizontal, vertical, 2x2, 3x3 grids)

### Transitions (2 tools)

14. **add_transition** - Add transitions between clips (25+ types)
15. **crossfade_videos** - Smooth crossfade with audio sync

## Usage Examples

### Basic Video Operations

```go
// Get video information
info, err := videoOps.GetVideoInfo(ctx, "input.mp4")

// Trim video
err := videoOps.Trim(ctx, video.TrimOptions{
    Input:     "input.mp4",
    Output:    "trimmed.mp4",
    StartTime: 5.0,
    Duration:  &duration, // 10 seconds
})

// Concatenate videos
err := videoOps.Concatenate(ctx, video.ConcatenateOptions{
    Inputs: []string{"video1.mp4", "video2.mp4", "video3.mp4"},
    Output: "combined.mp4",
})
```

### Visual Effects

```go
// Apply blur effect
err := visualFx.ApplyBlur(ctx, visual.BlurOptions{
    Input:    "input.mp4",
    Output:   "blurred.mp4",
    Type:     "gaussian",
    Strength: 5.0,
})

// Color grading
brightness := 0.1
contrast := 0.2
err := visualFx.ApplyColorGrade(ctx, visual.ColorGradeOptions{
    Input:      "input.mp4",
    Output:     "graded.mp4",
    Brightness: &brightness,
    Contrast:   &contrast,
})

// Chroma key (green screen)
err := visualFx.ApplyChromaKey(ctx, visual.ChromaKeyOptions{
    Input:      "greenscreen.mp4",
    Output:     "keyed.mp4",
    KeyColor:   "green",
    Similarity: 0.3,
})
```

### Composite Operations

```go
// Picture-in-picture
err := composite.CreatePictureInPicture(ctx, visual.PictureInPictureOptions{
    MainVideo: "main.mp4",
    PipVideo:  "webcam.mp4",
    Output:    "pip.mp4",
    Position:  "bottom-right",
})

// Split screen
err := composite.CreateSplitScreen(ctx, visual.SplitScreenOptions{
    Videos: []string{"video1.mp4", "video2.mp4", "video3.mp4", "video4.mp4"},
    Output: "splitscreen.mp4",
    Layout: "grid-2x2",
})
```

### Transitions

```go
// Add transition
duration := 1.5
err := transitions.AddTransition(ctx, visual.TransitionOptions{
    Input1:   "clip1.mp4",
    Input2:   "clip2.mp4",
    Output:   "transition.mp4",
    Type:     "fade",
    Duration: &duration,
})

// Crossfade with audio
err := transitions.Crossfade(ctx, visual.CrossfadeOptions{
    Input1:   "clip1.mp4",
    Input2:   "clip2.mp4",
    Output:   "crossfade.mp4",
    Duration: &duration,
})
```

## Running as MCP Server

The editor runs as an MCP server over stdio, allowing AI assistants to use the video editing tools:

```bash
./bin/mcp-video-editor
```

The server will communicate via JSON-RPC over stdin/stdout. Configure your AI assistant to use this as an MCP server.

## FFmpeg Requirements

This editor requires FFmpeg and FFprobe to be installed:

### macOS
```bash
brew install ffmpeg
```

### Ubuntu/Debian
```bash
sudo apt-get install ffmpeg
```

### Windows
Download from https://ffmpeg.org/download.html

## Supported Transition Types

The editor supports 25+ transition types via FFmpeg's xfade filter:

- **Fades**: fade, fadeblack, fadewhite
- **Wipes**: wipeleft, wiperight, wipeup, wipedown, wipetl, wipetr, wipebl, wipebr
- **Slides**: slideleft, slideright, slideup, slidedown
- **Special**: dissolve, pixelize, diagtl, diagtr, diagbl, diagbr, hlslice, hrslice, vuslice, vdslice, radial, smoothleft, smoothright, smoothup, smoothdown, circlecrop, rectcrop, distance, fadefast, fadeslow

## Performance

- Binary size: ~5.8MB (statically compiled)
- Memory usage: Minimal overhead, scales with video processing
- Processing speed: Depends on FFmpeg and video complexity
- Concurrent operations: Thread-safe, supports multiple requests

## Development

### Project Structure

- `cmd/` - Application entry points
- `pkg/config/` - Configuration management
- `pkg/ffmpeg/` - FFmpeg command execution and management
- `pkg/video/` - Core video operations
- `pkg/visual/` - Visual effects, composites, transitions
- `pkg/server/` - MCP server and tool handlers

### Adding New Tools

1. Define the operation in the appropriate package (video, visual, etc.)
2. Add the tool registration in `pkg/server/server.go`
3. Implement the handler in `pkg/server/handlers.go`
4. Rebuild and test

## Testing

```bash
# Run all tests
go test ./...

# Run tests with coverage
go test -cover ./...

# Test a specific package
go test ./pkg/video/
```

## Comparison with TypeScript Version

| Feature | Go | TypeScript |
|---------|-----|------------|
| Binary Size | 5.8MB | N/A (Node.js) |
| Startup Time | <10ms | ~500ms |
| Memory Usage | Lower | Higher |
| Dependencies | Self-contained | Requires Node.js |
| Performance | Faster | Good |
| Type Safety | Strong | Strong |

## Future Enhancements

- [x] Video operations (trim, concatenate, resize)
- [x] Visual effects (blur, color grading, chroma key)
- [x] Composite operations (PiP, split screen)
- [x] Transition effects
- [ ] Text overlays and animations
- [ ] Transcript-based editing (OpenAI integration)
- [ ] Timeline system with undo/redo
- [ ] Multi-take editing
- [ ] Diagram generation
- [ ] Advanced animations with keyframes

## License

MIT License - See LICENSE file for details

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Support

For issues, questions, or contributions:
- GitHub Issues: https://github.com/chandler-mayo/mcp-video-editor/issues
- Documentation: See TypeScript implementation docs for detailed API reference

---

Built with ❤️ using Go and FFmpeg
