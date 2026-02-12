# Testing Guide for MCP Video Editor

This guide covers all testing methods for the MCP Video Editor tool.

## Quick Start

```bash
# Run full automated test suite
npm test

# This will:
# 1. Generate test videos
# 2. Test all MCP tools
# 3. Create output files in test/output/
```

## Testing Methods

### 1. Automated Testing (Recommended for CI/Development)

The automated test suite exercises all features:

```bash
npm test
```

**What it tests:**
- ✅ Get video info
- ✅ Trim video
- ✅ Resize video
- ✅ Extract audio
- ✅ Concatenate videos
- ✅ Extract frames
- ✅ Convert video
- ✅ Adjust speed
- ✅ Config management (get/set/reset)

**Expected output:**
```
🚀 Starting MCP Video Editor Tests

✓ Connected to MCP server

📋 Test 1: List Tools
Found 11 tools:
  - get_video_info
  - trim_video
  ...

📊 Test 2: Get Video Info
Result: {
  "format": "mov,mp4,m4a,3gp,3g2,mj2",
  "duration": 10,
  "width": 1920,
  "height": 1080,
  ...
}

✅ All tests completed successfully!
📁 Output files: /path/to/test/output
```

### 2. Interactive Testing with MCP Inspector

The MCP Inspector provides a GUI for manual testing:

```bash
npm run inspector
```

**Features:**
- Web-based interface (opens in browser)
- Interactive parameter forms
- Real-time results
- Error inspection
- Request/response logging

**How to use:**
1. Select a tool from the dropdown
2. Fill in parameters (with autocomplete)
3. Click "Run Tool"
4. View results and any errors

**Example test cases:**

**Get Video Info:**
```json
{
  "filePath": "/path/to/test/videos/test-1080p.mp4"
}
```

**Trim Video:**
```json
{
  "input": "/path/to/test/videos/test-1080p.mp4",
  "output": "/path/to/test/output/my-trim.mp4",
  "startTime": 2,
  "duration": 5
}
```

**Extract Frames:**
```json
{
  "input": "/path/to/test/videos/test-1080p.mp4",
  "output": "/path/to/test/output/frame-%d.png",
  "timestamps": [1, 3, 5, 7]
}
```

### 3. Manual Script Testing

For guided testing with examples:

```bash
./test/manual-test.sh
```

This script:
- Checks for test videos
- Displays example parameter sets
- Launches the MCP Inspector
- Provides copy-paste examples

### 4. Individual Test Commands

Generate test videos only:
```bash
npm run test:generate
```

Run MCP client tests only (requires test videos):
```bash
npm run test:run
```

### 5. Testing with Claude Desktop

After adding to your Claude Desktop config, test by asking Claude:

**Basic queries:**
- "Get info about test/videos/test-1080p.mp4"
- "List all the video editing tools available"

**Operations:**
- "Trim the first 5 seconds from test-1080p.mp4 and save as trimmed.mp4"
- "Convert test-1080p.mp4 to a smaller file with quality 28"
- "Extract frames at 2, 4, and 6 seconds from test-1080p.mp4"
- "Resize test-1080p.mp4 to 720p"
- "Speed up test-short.mp4 by 2x"

**Config management:**
- "Show my current video editing config"
- "Set default quality to 20"
- "Set default preset to fast"

## Test Files

### Generated Test Videos

After running `npm run test:generate`:

| File | Duration | Resolution | Purpose |
|------|----------|------------|---------|
| test-1080p.mp4 | 10s | 1920x1080 | Main test video |
| test-720p.mp4 | 5s | 1280x720 | Alternative resolution |
| test-short.mp4 | 3s | 640x480 | Quick tests |
| test-part1.mp4 | 4s | 1280x720 | Concatenation test |
| test-part2.mp4 | 4s | 1280x720 | Concatenation test |

All videos have:
- Color bars test pattern with timestamp
- 1000Hz sine wave audio
- H.264 video codec
- AAC audio codec

### Expected Output Files

After running tests, `test/output/` should contain:

| File | Description |
|------|-------------|
| trimmed.mp4 | 5s clip from test-1080p.mp4 |
| resized-480p.mp4 | 854x480 version |
| audio.mp3 | Extracted audio track |
| concatenated.mp4 | test-part1.mp4 + test-part2.mp4 |
| frame-1.png to frame-4.png | Extracted frames |
| converted-high-quality.mp4 | Re-encoded with CRF 18 |
| fast-2x.mp4 | 2x speed version |

## Troubleshooting

### FFmpeg Not Found

**Error:** `FFmpeg is not available`

**Solution:**
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Or let the bundled version install
npm install
```

### Test Videos Not Found

**Error:** `Test videos not found`

**Solution:**
```bash
npm run test:generate
```

### MCP Connection Issues

**Error:** `Failed to connect to MCP server`

**Solution:**
1. Ensure the build is up to date: `npm run build`
2. Check that Node.js is in your PATH
3. Try running directly: `node build/index.js`

### Output Files Not Created

**Check:**
1. Permissions on `test/output/` directory
2. Available disk space
3. FFmpeg is working: `ffmpeg -version`
4. Input files exist in `test/videos/`

### Port Already in Use (Inspector)

**Error:** `Port 3000 already in use`

**Solution:**
- Close other applications using port 3000
- Or specify a different port (check Inspector docs)

## Writing Custom Tests

You can create your own test scripts using the MCP SDK:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'node',
  args: ['./build/index.js'],
});

const client = new Client(
  { name: 'my-test', version: '1.0.0' },
  { capabilities: {} }
);

await client.connect(transport);

// Call a tool
const result = await client.callTool({
  name: 'get_video_info',
  arguments: { filePath: 'video.mp4' },
});

console.log(result);

await client.close();
```

## Performance Testing

To test with larger files:

```bash
# Generate a longer test video
ffmpeg -f lavfi -i testsrc=duration=60:size=1920x1080:rate=30 \
       -f lavfi -i sine=frequency=1000:duration=60 \
       -c:v libx264 -preset fast -pix_fmt yuv420p \
       test/videos/test-large.mp4

# Test operations on it
node build/test/test-mcp-client.js
```

## CI/CD Integration

For continuous integration:

```yaml
# .github/workflows/test.yml
- name: Install FFmpeg
  run: sudo apt-get install -y ffmpeg

- name: Run tests
  run: npm test
```

## Cleanup

Remove test files:

```bash
rm -rf test/videos test/output
```

Reset config:

```bash
rm .mcp-video-config.json
```

## Getting Help

If tests fail:

1. Check FFmpeg is installed: `ffmpeg -version`
2. Verify build is up to date: `npm run build`
3. Check logs in the MCP Inspector
4. Run with verbose logging (see main README)
5. Open an issue with test output

## Next Steps

After verifying tests pass:
1. Add to Claude Desktop (see main README)
2. Try real video files
3. Configure defaults with `set_config`
4. Build your video workflows!
