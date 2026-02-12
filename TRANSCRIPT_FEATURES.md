# Transcript Features Guide

The MCP Video Editor now includes powerful transcript-based editing features using OpenAI's Whisper API. These features allow you to edit videos based on what is said in them.

## Setup

### 1. Get an OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Copy the key (starts with `sk-...`)

### 2. Configure the API Key

```bash
# Using the MCP tool
set_config with:
{
  "openaiApiKey": "sk-your-api-key-here"
}
```

Or manually edit `.mcp-video-config.json`:
```json
{
  "openaiApiKey": "sk-your-api-key-here"
}
```

## Features

### 1. Extract Transcript

Extract text transcript with word-level timestamps from any video.

**Tool**: `extract_transcript`

**Parameters**:
- `input` (required): Path to video file
- `language` (optional): Language code (e.g., 'en', 'es', 'fr'). Auto-detects if not provided.
- `format` (optional): Output format - 'json' (default), 'text', or 'srt'

**Example**:
```typescript
{
  "input": "interview.mp4",
  "language": "en",
  "format": "json"
}
```

**Output** (JSON format):
```json
{
  "text": "Full transcript text...",
  "segments": [
    {
      "text": "Hello and welcome to the show.",
      "start": 0.5,
      "end": 3.2,
      "words": [
        { "word": "Hello", "start": 0.5, "end": 0.8 },
        { "word": "and", "start": 0.9, "end": 1.0 },
        ...
      ]
    }
  ],
  "duration": 120.5,
  "language": "en"
}
```

**Output** (SRT format):
```
1
00:00:00,500 --> 00:00:03,200
Hello and welcome to the show.

2
00:00:03,200 --> 00:00:07,100
Today we're talking about video editing.
```

### 2. Find Text in Transcript

Search for specific text in a previously extracted transcript and get timestamps.

**Tool**: `find_in_transcript`

**Parameters**:
- `videoPath` (required): Path to video (identifies which transcript to search)
- `searchText` (required): Text to search for

**Example**:
```typescript
{
  "videoPath": "interview.mp4",
  "searchText": "video editing"
}
```

**Output**:
```json
{
  "matches": [
    {
      "text": "video editing",
      "start": 5.2,
      "end": 6.1,
      "confidence": 1.0
    },
    {
      "text": "video editing",
      "start": 45.8,
      "end": 46.7,
      "confidence": 1.0
    }
  ],
  "count": 2
}
```

### 3. Remove by Transcript

Remove all parts of the video where specific text is spoken.

**Tool**: `remove_by_transcript`

**Parameters**:
- `input` (required): Input video path
- `output` (required): Output video path
- `textToRemove` (required): Text/phrase to remove from video

**Example**:
```typescript
{
  "input": "interview.mp4",
  "output": "interview_edited.mp4",
  "textToRemove": "um you know"
}
```

This will:
1. Extract transcript (if not already cached)
2. Find all occurrences of "um you know"
3. Remove those segments from the video
4. Join the remaining parts seamlessly

**Use Cases**:
- Remove filler words ("um", "uh", "you know")
- Remove confidential information
- Remove mistakes or retakes
- Clean up interviews

### 4. Trim to Script

Keep only the parts of the video that match a provided script.

**Tool**: `trim_to_script`

**Parameters**:
- `input` (required): Input video path
- `output` (required): Output video path
- `script` (required): Script text to match

**Example**:
```typescript
{
  "input": "raw_recording.mp4",
  "output": "final_edit.mp4",
  "script": "Welcome to my channel.\nToday I'm showing you how to edit videos.\nThanks for watching!"
}
```

This will:
1. Extract transcript from the video
2. Find segments matching each line of the script
3. Keep only those matching segments
4. Join them together in order

**Use Cases**:
- Edit a recording to match a prepared script
- Remove off-script content
- Create highlight reels from specific quotes
- Extract only relevant parts from long recordings

## Complete Workflow Examples

### Example 1: Clean Up a Podcast

Remove filler words and mistakes:

```typescript
// 1. Extract transcript first (optional, but faster for multiple operations)
extract_transcript({
  "input": "podcast_episode_1.mp4"
})

// 2. Find all "um" instances (optional, to see what will be removed)
find_in_transcript({
  "videoPath": "podcast_episode_1.mp4",
  "searchText": "um"
})

// 3. Remove filler words
remove_by_transcript({
  "input": "podcast_episode_1.mp4",
  "output": "podcast_cleaned.mp4",
  "textToRemove": "um"
})

// 4. Remove more filler words
remove_by_transcript({
  "input": "podcast_cleaned.mp4",
  "output": "podcast_final.mp4",
  "textToRemove": "you know"
})
```

### Example 2: Edit to Match Script

Record yourself speaking, then edit to match your written script:

```typescript
// Your script
const script = `
Welcome to my tutorial on video editing.
First, we'll extract a transcript.
Then, we'll edit based on that transcript.
Thanks for watching!
`;

// Trim recording to match script
trim_to_script({
  "input": "tutorial_recording.mp4",
  "output": "tutorial_final.mp4",
  "script": script
})
```

### Example 3: Remove Sensitive Information

Remove parts where confidential info was mentioned:

```typescript
remove_by_transcript({
  "input": "meeting_recording.mp4",
  "output": "meeting_public.mp4",
  "textToRemove": "Project Nightingale"
})
```

### Example 4: Create Highlight Reel

Extract only specific quotes:

```typescript
const highlights = `
It's going to be revolutionary.
This changes everything.
I've never seen anything like it.
`;

trim_to_script({
  "input": "full_interview.mp4",
  "output": "highlights.mp4",
  "script": highlights
})
```

## Technical Details

### Accuracy

- Uses OpenAI's Whisper model (highly accurate for clear speech)
- Word-level timestamps (precise editing)
- Supports 99+ languages
- Works best with:
  - Clear audio
  - Minimal background noise
  - Single speakers or well-separated voices

### Performance

- Transcription time: ~1-2 minutes per hour of video (varies by API)
- Transcripts are cached in memory (persists during session)
- Re-extracting transcript not needed for multiple operations on same video

### Costs

- OpenAI Whisper API pricing: $0.006 per minute of audio
- Example: 1 hour video = $0.36
- See https://openai.com/api/pricing/ for current rates

### Limitations

- Requires internet connection (uses OpenAI API)
- Requires OpenAI API key (costs money)
- May not be perfect for:
  - Heavy accents
  - Technical jargon
  - Multiple overlapping speakers
  - Very poor audio quality

### Transcript Caching

Transcripts are cached in memory during your session:
- First operation extracts transcript (~1-2 min per hour)
- Subsequent operations on same video are instant
- Cache persists until you restart the MCP server
- Future: Could add disk caching for persistence

## Privacy & Security

- Video files are sent to OpenAI's API for transcription
- Transcripts are stored temporarily in memory
- API key is stored in local config file
- Never commit config files with API keys to version control

## Troubleshooting

### "Transcript features are disabled"

Set your OpenAI API key:
```json
{
  "openaiApiKey": "sk-your-key-here"
}
```

### "Text not found in transcript"

- Check spelling and exact wording
- Try shorter phrases
- Extract transcript first to see exact wording
- Remember: searches are case-insensitive

### "No matching content found"

When using `trim_to_script`:
- Script might not match what was actually said
- Try extracting transcript first to see actual wording
- Break script into smaller chunks
- Be flexible with exact wording

### Poor transcription quality

- Check audio quality
- Specify the correct language code
- Remove background noise before processing
- Consider re-recording with better audio

## Future Enhancements

Potential features for future versions:
- Local Whisper support (no API costs)
- Disk-based transcript caching
- Fuzzy matching for scripts
- Speaker diarization (identify different speakers)
- Automatic filler word detection
- Batch processing multiple videos
- Custom vocabulary/terminology

## API Reference

All 4 new tools:

1. **extract_transcript** - Extract transcript with timestamps
2. **find_in_transcript** - Search for text in transcript
3. **remove_by_transcript** - Remove parts where text is spoken
4. **trim_to_script** - Keep only parts matching script

Combined with existing tools (trim, concatenate, etc.), you now have powerful script-based video editing capabilities!
