# Transcript Feature Examples

## Quick Start

### 1. Configure OpenAI API Key

```bash
# In Claude, use the set_config tool:
set_config({
  "openaiApiKey": "sk-your-api-key-here"
})
```

### 2. Extract a Transcript

```bash
extract_transcript({
  "input": "video.mp4",
  "format": "json"
})
```

## Real-World Use Cases

### Remove Filler Words
"Remove all the 'um's and 'uh's from my interview"

### Edit to Script
"I have a written script and a recording - edit the video to match the script"

### Remove Mistakes
"Remove the part where I said 'Project Nightingale'"

### Create Highlights
"Extract only the parts where I talk about AI and machine learning"

### Find Timestamps
"When did I mention 'video editing' in this recording?"

See [TRANSCRIPT_FEATURES.md](../TRANSCRIPT_FEATURES.md) for complete guide!
