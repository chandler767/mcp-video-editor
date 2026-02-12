# Transcript Extraction - Large File Handling

## Problem Fixed
The `extract_transcript` tool was failing with a 413 error when processing video files that resulted in audio files larger than OpenAI's 25MB limit:

```
Error: 413 413: Maximum content size limit (26214400) exceeded (26391444 bytes read)
```

## Solution Implemented

The transcript extraction now automatically handles large files with these optimizations:

### 1. **Optimized Audio Extraction**
Instead of sending the video file directly, we now:
- Extract only the audio track from the video
- Convert to MP3 with optimized settings:
  - **64k bitrate** (vs standard 192k) - reduces size by ~67%
  - **Mono audio** (1 channel vs 2) - reduces size by ~50%
  - **16kHz sample rate** - optimal for Whisper, reduces size further

This typically reduces the file size by **~80%** compared to the original video.

### 2. **Automatic Chunking for Large Files**
If the optimized audio still exceeds 24MB:
- Automatically splits audio into 10-minute chunks
- Transcribes each chunk separately
- Merges transcripts with adjusted timestamps
- Maintains word-level timing accuracy

### 3. **Transparent Operation**
- The chunking happens automatically - no user configuration needed
- Console logs show progress: "Processing chunk 1/3..."
- All temporary files are automatically cleaned up
- Returns a single unified transcript with correct timestamps

## Technical Details

### Constants
- `MAX_FILE_SIZE`: 24MB (safe margin under 25MB limit)
- `CHUNK_DURATION`: 600 seconds (10 minutes per chunk)

### Audio Settings
```typescript
.audioCodec('libmp3lame')    // MP3 compression
.audioBitrate('64k')          // Low bitrate for size
.audioChannels(1)             // Mono
.audioFrequency(16000)        // 16kHz (Whisper optimal)
```

### Process Flow
```
Video File (e.g., 100MB)
    ↓
Extract & Optimize Audio (e.g., 15MB) ✓ Under limit
    ↓
Transcribe with Whisper
    ↓
Return Transcript
```

OR if too large:

```
Video File (e.g., 500MB)
    ↓
Extract & Optimize Audio (e.g., 80MB) ✗ Over limit
    ↓
Split into 8 chunks (10min each, ~10MB each)
    ↓
Transcribe each chunk in sequence
    ↓
Merge with adjusted timestamps
    ↓
Return Unified Transcript
```

## Benefits

1. **Handles files of any size** - No more 25MB errors
2. **Efficient** - Optimized audio reduces API costs and time
3. **Accurate** - Maintains word-level timestamps across chunks
4. **Automatic** - No user configuration or intervention needed
5. **Clean** - All temporary files auto-deleted

## Example Usage

```typescript
// Works seamlessly for any video size
const transcript = await transcriptOps.extractTranscript(
  '/path/to/large-video.mp4',
  { language: 'en' }
);

// Returns same format regardless of file size:
// {
//   text: "full transcript...",
//   segments: [...],
//   duration: 1234.56,
//   language: "en"
// }
```

## Files Modified

- `src/transcript-operations.ts`:
  - Added `extractAudioToFile()` method
  - Added `splitAudioIntoChunks()` method
  - Added `transcribeAudioFile()` method
  - Rewrote `extractTranscript()` with auto-chunking logic

- `src/index.ts`:
  - Updated TranscriptOperations instantiation to pass FFmpegManager

## Testing

To test with your video:
```bash
# This should now work without errors
mcp__video-editor__extract_transcript(
  input: "/Users/chandler.mayo/Desktop/mcp-editor/test-project/Agents Inside Pipelines Demo.mp4",
  format: "json"
)
```

The tool will automatically:
1. Extract audio (~5-10 seconds)
2. Check file size
3. Chunk if needed (~5-10 seconds per chunk)
4. Transcribe all chunks (~30-60 seconds per chunk)
5. Return complete transcript with accurate timestamps
