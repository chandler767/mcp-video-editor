# MCP Video Editor

A Model Context Protocol (MCP) server for video editing operations using FFmpeg. Provides a simple interface for common video editing tasks directly from Claude.

## Features

### Core Video Operations
- **Get Video Info** - Extract metadata (duration, resolution, codec, fps, bitrate)
- **Trim/Cut Video** - Cut video segments by start/end time
- **Concatenate Videos** - Join multiple videos together
- **Extract Audio** - Save audio track from video
- **Convert Format** - Convert between formats with custom quality settings
- **Resize/Scale** - Change video resolution/dimensions
- **Extract Frames** - Get screenshots at specific timestamps or intervals
- **Adjust Speed** - Speed up or slow down playback
- **Transcode for Web** - Optimize videos for web sharing with smart compression
- **Config Management** - Per-project configuration for quality, codecs, and defaults

### 🛡️ Source File Protection
- **All operations preserve original files** - Source videos are never modified
- **Automatic overwrite detection** - Prevents accidentally using the same path for input and output
- **Quality matching** - Output videos automatically match input quality and format by default

### 🎙️ NEW: Transcript-Based Editing
- **Extract Transcript** - Get word-level transcripts with timestamps using Whisper
- **Find in Transcript** - Search for specific text and get timestamps
- **Remove by Transcript** - Remove parts where specific text is spoken (e.g., filler words)
- **Trim to Script** - Keep only parts matching a provided script

See [TRANSCRIPT_FEATURES.md](TRANSCRIPT_FEATURES.md) for details.

## Installation

```bash
npm install
npm run build
```

## FFmpeg Requirement

This tool requires FFmpeg. It will:
1. First check if FFmpeg is installed on your system
2. Fall back to a bundled FFmpeg version if not found

To install FFmpeg manually:
- **macOS**: `brew install ffmpeg`
- **Ubuntu/Debian**: `sudo apt-get install ffmpeg`
- **Windows**: Download from [ffmpeg.org](https://ffmpeg.org/download.html)

## Testing

### Quick Test (Automated)

Run the full automated test suite:

```bash
npm test
```

This will:
1. Generate test videos using FFmpeg
2. Run all MCP tools automatically
3. Create output files in `test/output/`

### Manual Testing with MCP Inspector

The MCP Inspector provides a GUI to test tools interactively:

```bash
npm run inspector
```

Or use the manual test script:

```bash
./test/manual-test.sh
```

This opens a web interface where you can:
- Browse available tools
- Fill in parameters with auto-complete
- Execute tools and see results
- Test error handling

### Individual Test Commands

```bash
# Generate test videos only
npm run test:generate

# Run MCP client tests only
npm run test:run

# Launch MCP Inspector
npm run inspector
```

### Test Video Files

After running `npm run test:generate`, you'll have:
- `test/videos/test-1080p.mp4` - 10 second 1080p video
- `test/videos/test-720p.mp4` - 5 second 720p video
- `test/videos/test-short.mp4` - 3 second 480p video
- `test/videos/test-part1.mp4` - 4 second clip for concatenation
- `test/videos/test-part2.mp4` - 4 second clip for concatenation

### Expected Test Output

After running tests, check `test/output/` for:
- `trimmed.mp4` - Trimmed video segment
- `resized-480p.mp4` - Resized video
- `audio.mp3` - Extracted audio
- `concatenated.mp4` - Joined videos
- `frame-1.png`, `frame-2.png`, etc. - Extracted frames
- `converted-high-quality.mp4` - Re-encoded video
- `fast-2x.mp4` - Speed-adjusted video

## Usage with Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "video-editor": {
      "command": "node",
      "args": ["/path/to/mcp-editor/build/index.js"]
    }
  }
}
```

## Available Tools

### 1. get_video_info
Get metadata about a video file.

```typescript
{
  "filePath": "input.mp4"
}
```

Returns:
```json
{
  "format": "mov,mp4,m4a,3gp,3g2,mj2",
  "duration": 120.5,
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "videoCodec": "h264",
  "audioCodec": "aac",
  "bitrate": 5000000,
  "size": 75000000
}
```

### 2. trim_video
Cut a section from a video.

```typescript
{
  "input": "input.mp4",
  "output": "trimmed.mp4",
  "startTime": "00:00:10",  // or 10 (seconds)
  "duration": "00:00:30"     // or use "endTime": "00:00:40"
}
```

### 3. concatenate_videos
Join multiple videos into one.

```typescript
{
  "inputs": ["part1.mp4", "part2.mp4", "part3.mp4"],
  "output": "combined.mp4"
}
```

### 4. extract_audio
Extract audio track from video.

```typescript
{
  "input": "video.mp4",
  "output": "audio.mp3"
}
```

### 5. convert_video
Convert video format or adjust quality settings.

```typescript
{
  "input": "input.mov",
  "output": "output.mp4",
  "codec": "libx264",
  "quality": "23",           // CRF value (lower = better)
  "preset": "medium",        // encoding speed preset
  "videoBitrate": "2M",      // optional
  "audioBitrate": "192k"     // optional
}
```

**Quality Guide**:
- CRF 18-23: High quality (larger files)
- CRF 23-28: Good quality (balanced)
- CRF 28+: Lower quality (smaller files)

**Preset Guide**:
- `ultrafast`, `superfast`, `veryfast`: Fast encoding, larger files
- `medium`: Balanced (default)
- `slow`, `slower`, `veryslow`: Slow encoding, better compression

### 6. resize_video
Resize video dimensions.

```typescript
{
  "input": "input.mp4",
  "output": "resized.mp4",
  "width": 1280,
  "height": 720,
  "maintainAspectRatio": true  // optional, default: true
}

// Or use just width (auto-calculate height):
{
  "input": "input.mp4",
  "output": "resized.mp4",
  "width": 1280
}

// Or use custom scale filter:
{
  "input": "input.mp4",
  "output": "resized.mp4",
  "scale": "iw/2:ih/2"  // half the size
}
```

### 7. extract_frames
Extract frames as images.

```typescript
// Extract frames at specific timestamps
{
  "input": "video.mp4",
  "output": "frame-%d.png",
  "timestamps": [10, 20, 30, 45]  // seconds
}

// Extract 1 frame per second for 10 seconds
{
  "input": "video.mp4",
  "output": "frame-%d.png",
  "fps": 1,
  "startTime": 0,
  "duration": 10
}
```

### 8. adjust_speed
Speed up or slow down video.

```typescript
{
  "input": "input.mp4",
  "output": "fast.mp4",
  "speed": 2.0  // 2x speed (range: 0.5 - 2.0)
}
```

### 9. transcode_for_web
Optimize video for web sharing with smart compression. Automatically uses H.264 video and AAC audio for maximum compatibility.

```typescript
{
  "input": "large-video.mp4",
  "output": "web-optimized.mp4",
  "quality": "medium",      // 'high', 'medium', or 'low'
  "maxResolution": "1080p"  // optional: '4k', '1080p', '720p', or '480p'
}
```

**Quality Settings:**
- `high`: Larger file, better quality (CRF 20, 192k audio)
- `medium`: Balanced (CRF 25, 128k audio) - **default**
- `low`: Smaller file, lower quality (CRF 30, 96k audio)

**Features:**
- Optimized for web streaming (fast start)
- Scales down to maxResolution if needed
- Maintains aspect ratio
- Uses slow preset for better compression
- H.264 + AAC for universal compatibility

### 10. Configuration Management

#### get_config
Get current configuration.

```typescript
{}
```

#### set_config
Set project defaults.

```typescript
{
  "defaultOutputFormat": "mp4",
  "defaultQuality": "23",
  "defaultCodec": "libx264",
  "defaultAudioCodec": "aac",
  "defaultAudioBitrate": "192k",
  "defaultPreset": "medium",
  "workingDirectory": "/path/to/project"
}
```

#### reset_config
Reset to defaults.

```typescript
{}
```

## Configuration File

Settings are stored in `.mcp-video-config.json` in your project directory:

```json
{
  "defaultOutputFormat": "mp4",
  "defaultQuality": "23",
  "defaultCodec": "libx264",
  "defaultAudioCodec": "aac",
  "defaultAudioBitrate": "192k",
  "defaultVideoBitrate": null,
  "defaultPreset": "medium",
  "workingDirectory": "/current/directory"
}
```

## Quality & Source Protection

### Automatic Quality Matching
By default, all editing operations preserve the quality and format of your source video:
- **Codec matching**: Output uses the same video/audio codecs as input
- **Quality preservation**: High-quality CRF settings maintain near-original quality
- **Format detection**: Automatically detects and matches input properties

Example: Trimming a 4K H.265 video will produce a 4K H.265 trimmed video.

### Source File Protection
All operations are designed to be non-destructive:
- **Original files never modified**: Every operation creates a new output file
- **Overwrite prevention**: Tool will error if you try to use the same path for input and output
- **Safe by default**: No need to worry about losing your original footage

```typescript
// ✅ Safe - creates new file
trim_video({ input: "original.mp4", output: "trimmed.mp4", ... })

// ❌ Error - prevents overwriting source
trim_video({ input: "video.mp4", output: "video.mp4", ... })
// Error: Output path cannot be the same as input path
```

### Multiple Inputs or Generated Content
When working with multiple source files that have different properties, or when generating content from scratch (future feature), the tool will:
1. Ask you which format to use, or
2. Use Final Cut Pro style defaults (1080p H.264 with AAC audio)

## Example Workflows

### Create a highlight reel
1. Extract clips: `trim_video` multiple times
2. Join clips: `concatenate_videos`
3. Add effects: `adjust_speed` for slow-motion
4. Export: `convert_video` with desired quality

### Prepare for web
1. Get info: `get_video_info`
2. Resize: `resize_video` to 720p
3. Convert: `convert_video` to WebM with good compression
4. Create thumbnail: `extract_frames` at interesting moment

### Archive footage
1. Extract audio: `extract_audio` for backup
2. Convert: `convert_video` with high CRF for smaller files
3. Extract keyframes: `extract_frames` for preview

## Supported Formats

**Input**: MP4, MOV, AVI, MKV, WebM, FLV, WMV, and most video formats
**Output**: MP4, WebM, MOV, AVI, MKV, etc.

**Common Codecs**:
- Video: libx264 (H.264), libx265 (H.265/HEVC), libvpx-vp9 (VP9)
- Audio: aac, mp3, opus, vorbis

## Error Handling

All tools return descriptive error messages if operations fail. Common issues:
- Invalid file paths
- Unsupported formats
- Invalid time specifications
- Missing FFmpeg

## Development

```bash
# Build
npm run build

# Watch mode
npm run watch

# Test with MCP inspector
npx @modelcontextprotocol/inspector node build/index.js
```

## License

MIT

