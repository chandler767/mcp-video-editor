# Quick Test Guide

## 30 Second Test

```bash
# 1. Build the project
npm install
npm run build

# 2. Generate test videos (takes ~10 seconds)
npm run test:generate

# 3. Run automated tests (takes ~30-60 seconds)
npm run test:run

# ✅ If all tests pass, you're ready to go!
```

## Quick Manual Test

```bash
# Launch MCP Inspector
npm run inspector

# In the browser:
# 1. Select "get_video_info" tool
# 2. Enter: test/videos/test-1080p.mp4
# 3. Click "Run Tool"
# 4. You should see video metadata
```

## Test with Claude Desktop

1. **Add to config** (`~/Library/Application Support/Claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "video-editor": {
      "command": "node",
      "args": ["/Users/chandler.mayo/Desktop/mcp-editor/build/index.js"]
    }
  }
}
```

2. **Restart Claude Desktop**

3. **Test in Claude:**
   - "What video editing tools do you have?"
   - "Get info about test/videos/test-1080p.mp4"
   - "Trim test/videos/test-1080p.mp4 from 2 to 7 seconds and save as trimmed.mp4"

## Expected Results

✅ **All 11 tools should pass:**
1. get_video_info
2. trim_video
3. concatenate_videos
4. extract_audio
5. convert_video
6. resize_video
7. extract_frames
8. adjust_speed
9. get_config
10. set_config
11. reset_config

✅ **Output files created:**
- `test/output/trimmed.mp4`
- `test/output/resized-480p.mp4`
- `test/output/audio.mp3`
- `test/output/concatenated.mp4`
- `test/output/frame-*.png`
- `test/output/converted-high-quality.mp4`
- `test/output/fast-2x.mp4`

## Troubleshooting

❌ **"FFmpeg not found"**
```bash
brew install ffmpeg  # macOS
```

❌ **"Test videos not found"**
```bash
npm run test:generate
```

❌ **"Cannot find module"**
```bash
npm run build
```

## Next Steps

See [TESTING.md](TESTING.md) for detailed testing guide.
