# MCP Video Editor - Project Structure

## Directory Layout

```
mcp-editor/
├── src/                      # Source TypeScript files
│   ├── index.ts             # Main MCP server & tool handlers
│   ├── config.ts            # Config management system
│   ├── ffmpeg-utils.ts      # FFmpeg detection/bundling
│   └── video-operations.ts  # Core video editing operations
│
├── test/                     # Testing infrastructure
│   ├── generate-test-video.ts  # Creates test video files
│   ├── test-mcp-client.ts     # Automated test suite
│   ├── manual-test.sh         # Interactive testing helper
│   ├── videos/                # Generated test videos (gitignored)
│   └── output/                # Test output files (gitignored)
│
├── build/                    # Compiled JavaScript (gitignored)
│   ├── src/                 # Compiled source files
│   └── test/                # Compiled test files
│
├── package.json             # Dependencies & scripts
├── tsconfig.json            # TypeScript configuration
├── README.md                # Main documentation
├── TESTING.md               # Comprehensive testing guide
├── QUICK_TEST.md            # Quick start testing
└── .mcp-video-config.json   # Per-project config (gitignored)
```

## Key Files

### Source Files

**src/index.ts** (525 lines)
- MCP server setup & initialization
- 11 tool definitions with schemas
- Tool handler implementations
- Error handling

**src/video-operations.ts** (272 lines)
- VideoOperations class
- 8 core video editing methods
- FFmpeg command building
- Promise-based async operations

**src/ffmpeg-utils.ts** (73 lines)
- FFmpegManager class
- System FFmpeg detection
- Bundled FFmpeg fallback
- Version checking

**src/config.ts** (63 lines)
- ConfigManager class
- JSON-based config storage
- Default settings
- Load/save/reset operations

### Test Files

**test/generate-test-video.ts** (82 lines)
- Generates 5 test videos
- Uses FFmpeg testsrc pattern
- Creates audio tracks
- Ensures test directory structure

**test/test-mcp-client.ts** (192 lines)
- Full MCP client test suite
- Tests all 11 tools
- Creates output files
- Validates results

**test/manual-test.sh** (51 lines)
- Interactive testing script
- Launches MCP Inspector
- Provides example parameters

## npm Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `build` | `tsc` | Compile TypeScript to JavaScript |
| `watch` | `tsc --watch` | Compile in watch mode |
| `test` | `test:generate && test:run` | Full test suite |
| `test:generate` | `node build/test/generate-test-video.js` | Generate test videos |
| `test:run` | `node build/test/test-mcp-client.js` | Run MCP tests |
| `inspector` | `npx @modelcontextprotocol/inspector node build/index.js` | Launch GUI tester |

## MCP Tools Provided

| Tool | Input Parameters | Output |
|------|-----------------|--------|
| get_video_info | filePath | Video metadata JSON |
| trim_video | input, output, startTime, endTime/duration | Trimmed video file |
| concatenate_videos | inputs[], output | Joined video file |
| extract_audio | input, output | Audio file |
| convert_video | input, output, format, codec, quality, preset | Converted video |
| resize_video | input, output, width, height, scale | Resized video |
| extract_frames | input, output, timestamps/fps | Image files |
| adjust_speed | input, output, speed | Speed-adjusted video |
| get_config | - | Current config JSON |
| set_config | config_fields | Success message |
| reset_config | - | Success message |

## Dependencies

### Production
- `@modelcontextprotocol/sdk` ^1.0.4 - MCP protocol implementation
- `@ffmpeg-installer/ffmpeg` ^1.1.0 - Bundled FFmpeg binary
- `fluent-ffmpeg` ^2.1.3 - FFmpeg wrapper library

### Development
- `@types/fluent-ffmpeg` ^2.1.24 - TypeScript types
- `@types/node` ^20.11.0 - Node.js types
- `typescript` ^5.3.3 - TypeScript compiler

## Configuration Files

### tsconfig.json
- Target: ES2022
- Module: Node16
- Strict mode enabled
- Includes: src/, test/
- Output: build/

### package.json
- Type: module (ES modules)
- Binary: mcp-video-editor
- Prepare hook: Auto-build on install

### .mcp-video-config.json (user-created)
```json
{
  "defaultOutputFormat": "mp4",
  "defaultQuality": "23",
  "defaultCodec": "libx264",
  "defaultAudioCodec": "aac",
  "defaultAudioBitrate": "192k",
  "defaultPreset": "medium"
}
```

## Lines of Code

| Category | Files | Lines |
|----------|-------|-------|
| Source | 4 | ~1,000 |
| Tests | 3 | ~325 |
| Documentation | 4 | ~800 |
| Config | 3 | ~50 |
| **Total** | **14** | **~2,175** |

## Feature Completeness

✅ **8 Core Video Operations**
- All MVP features implemented
- Full error handling
- Configurable quality settings

✅ **Config Management**
- Per-project configuration
- Get/Set/Reset operations
- Persistent JSON storage

✅ **Testing Infrastructure**
- Automated test suite
- MCP Inspector integration
- Test video generation
- Manual testing tools

✅ **Documentation**
- Comprehensive README
- Testing guide
- Quick start guide
- API documentation

## Build Output

After running `npm run build`:
- Source files → `build/src/*.js`
- Test files → `build/test/*.js`
- Type declarations → `build/**/*.d.ts`
- All imports use .js extensions (ES modules)

## Usage Patterns

### As MCP Server
```bash
node build/index.js
# Communicates via stdio using MCP protocol
```

### With Claude Desktop
```json
{
  "mcpServers": {
    "video-editor": {
      "command": "node",
      "args": ["path/to/build/index.js"]
    }
  }
}
```

### Programmatic Testing
```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
const client = new Client(...);
await client.callTool({ name: 'trim_video', arguments: {...} });
```

## Development Workflow

1. Make changes to `src/*.ts`
2. Run `npm run build` (or `npm run watch`)
3. Test with `npm test` or `npm run inspector`
4. Update documentation if needed
5. Commit changes

## Extension Points

To add new features:

1. **Add video operation** in `src/video-operations.ts`
2. **Add tool definition** in `src/index.ts`
3. **Add tool handler** in `src/index.ts`
4. **Add test case** in `test/test-mcp-client.ts`
5. **Update README** with new tool

## Security Considerations

- File paths are user-provided (no injection protection needed in MVP)
- FFmpeg commands use fluent-ffmpeg (escapes arguments)
- No network operations
- No sensitive data in configs
- Config files are local JSON (not executable)

## Performance Characteristics

- Synchronous: Tool schema validation
- Async: All FFmpeg operations
- Parallel: Multiple test videos generation
- Streaming: FFmpeg processes video in chunks
- Memory: Minimal (FFmpeg handles streaming)

## Error Handling

All tools catch and return errors as:
```json
{
  "content": [{"type": "text", "text": "Error: message"}],
  "isError": true
}
```

Common errors:
- File not found
- FFmpeg failure
- Invalid parameters
- Disk space issues
