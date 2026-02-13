# Vision Analysis Features

The MCP Video Editor now includes powerful vision analysis capabilities using GPT-4 Vision API. This allows you to see what's actually in your videos and perform intelligent operations based on visual content.

## Capabilities

### 1. Analyze Video Content
Extract and analyze frames throughout your video to understand what's happening.

```javascript
analyze_video_content({
  input: "video.mp4",
  interval: 5,  // Analyze every 5 seconds
  // OR
  count: 10,    // Analyze 10 evenly-spaced frames
  // OR
  timestamps: [2, 5, 10, 15]  // Analyze specific moments
})
```

**Use cases:**
- Get a summary of what happens in a video
- Understand the flow and content without watching
- Document video content automatically
- Find key moments or scenes

### 2. Search for Visual Content
Find specific objects, people, scenes, or text in your video.

```javascript
search_visual_content({
  input: "video.mp4",
  query: "person wearing a red shirt",
  interval: 2  // Check every 2 seconds for accuracy
})
```

**Use cases:**
- "Find all moments showing the product"
- "Locate frames with visible text"
- "Find scenes with people"
- "Search for specific objects or logos"

### 3. Describe Specific Scenes
Get detailed descriptions of what's happening at any timestamp.

```javascript
describe_scene({
  input: "video.mp4",
  timestamp: 45.5,
  detailLevel: "comprehensive"  // brief, detailed, or comprehensive
})
```

**Returns:**
- Overall description
- Objects detected
- Actions/activities happening
- Setting/environment

**Use cases:**
- Understand what's happening at a specific moment
- Generate captions or descriptions
- Verify content at timestamps
- Document video content frame-by-frame

### 4. Track Objects in Video
Track when specific objects, people, or things appear throughout the video.

```javascript
find_objects_in_video({
  input: "video.mp4",
  targetDescription: "laptop computer",
  interval: 2
})
```

**Returns:**
- Time segments where object appears
- Total duration visible
- Descriptions of each appearance

**Use cases:**
- Track product placement
- Find when specific people appear
- Monitor object visibility
- Analyze screen time for elements

### 5. Compare Frames
Detect what changed between two moments in the video.

```javascript
compare_video_frames({
  input: "video.mp4",
  timestamp1: 10,
  timestamp2: 30
})
```

**Use cases:**
- Detect scene changes
- Identify what moved or changed
- Compare before/after states
- Understand transitions

## Advanced Use Cases

### Content Moderation
Search for specific content types to verify video appropriateness:
```javascript
search_visual_content({ query: "text or logos", ... })
```

### Smart Editing Based on Visual Content

#### Hide Objects Behind Text
1. Find where object appears:
```javascript
const appearances = await find_objects_in_video({
  input: "video.mp4",
  targetDescription: "company logo"
})
```

2. Add text overlay at those timestamps:
```javascript
for (const segment of appearances) {
  await add_text_overlay({
    text: "Covered Content",
    startTime: segment.start,
    endTime: segment.end,
    box: true,
    boxOpacity: 1.0  // Fully opaque to hide content
  })
}
```

#### Remove Clips Showing Specific Things
1. Search for the content:
```javascript
const results = await search_visual_content({
  input: "video.mp4",
  query: "person using phone"
})
```

2. Calculate inverse segments (keep everything except matches):
```javascript
// Pseudo-code - calculate segments to KEEP
const segmentsToKeep = calculateInverseSegments(
  results.segments,
  videoDuration
)
```

3. Extract and concatenate:
```javascript
// Extract segments that don't contain the target
for (const segment of segmentsToKeep) {
  await trim_video({ startTime: segment.start, endTime: segment.end })
}
await concatenate_videos({ inputs: [...] })
```

### Multi-Take Analysis with Visual Quality
Combine vision analysis with multi-take editing to select takes based on visual quality:
- Check for proper framing
- Verify visibility of key elements
- Detect technical issues (blur, darkness, etc.)
- Ensure consistent visual appearance across takes

## API Costs & Performance

**Costs:**
- GPT-4 Vision: ~$0.01 per image analyzed
- Typical analysis: 10-20 frames = $0.10-0.20
- Search operations: Cost scales with interval (smaller interval = more frames)

**Performance Tips:**
1. **Use appropriate intervals:**
   - Quick scan: 5-10 second intervals
   - Detailed search: 2-3 second intervals
   - Precise tracking: 1 second intervals

2. **Use targeted timestamps:**
   - If you know roughly where to look, specify timestamps array
   - Much faster and cheaper than full video scan

3. **Start with brief descriptions:**
   - Use `detailLevel: "brief"` for initial exploration
   - Switch to "comprehensive" only when needed

4. **Batch operations:**
   - Analyze once, cache results
   - Reuse analysis for multiple searches

## Requirements

- **OpenAI API Key** with GPT-4 Vision access
- Configure via:
  ```bash
  export OPENAI_API_KEY=your_key_here
  ```
  Or use `set_config` tool

## Limitations

- **Frame-based analysis:** Analyzes individual frames, not motion
- **API rate limits:** OpenAI has rate limits on Vision API
- **Cost:** Each frame analyzed incurs API costs
- **Accuracy:** AI-based, may not be 100% accurate for complex queries
- **Language:** Works best with English descriptions

## Tips for Best Results

1. **Be specific in queries:**
   - ❌ "something interesting"
   - ✅ "person holding a microphone"

2. **Use descriptive language:**
   - ❌ "the thing"
   - ✅ "red corporate logo in top-right corner"

3. **Adjust intervals based on content:**
   - Fast-paced content: smaller intervals
   - Static content: larger intervals

4. **Combine with transcript:**
   - Use vision to verify what transcript describes
   - Cross-reference audio and visual content

## Examples

### Example 1: Content Inventory
```javascript
// Get comprehensive analysis
const analysis = await analyze_video_content({
  input: "marketing-video.mp4",
  count: 20  // 20 frames across entire video
})

// Review summary and frame descriptions
console.log(analysis.summary)
```

### Example 2: Privacy Protection
```javascript
// Find faces or identifying information
const faces = await search_visual_content({
  input: "video.mp4",
  query: "person's face or identifying features",
  interval: 2
})

// Blur or remove those segments
for (const segment of faces.segments) {
  // Apply blur filter or remove segment
}
```

### Example 3: Product Highlight Reel
```javascript
// Find all product appearances
const product = await find_objects_in_video({
  input: "demo-video.mp4",
  targetDescription: "laptop computer on desk",
  interval: 2
})

// Extract those segments to create highlight reel
const highlights = []
for (const appearance of product.appearances) {
  await trim_video({
    startTime: appearance.start,
    endTime: appearance.end,
    output: `highlight-${i}.mp4`
  })
  highlights.push(`highlight-${i}.mp4`)
}

await concatenate_videos({
  inputs: highlights,
  output: "product-highlights.mp4"
})
```

## Troubleshooting

**"Vision analysis requires OpenAI API key"**
- Set `OPENAI_API_KEY` environment variable or use `set_config` tool

**"Rate limit exceeded"**
- Reduce analysis frequency (larger intervals)
- Add delays between operations
- Check OpenAI API limits for your account

**"No matches found" when you expect results**
- Try more general search terms
- Reduce interval to check more frames
- Verify frame quality (extract a frame manually to check)

**High costs**
- Use larger intervals (5-10 seconds)
- Target specific timestamps instead of full scans
- Use `count` parameter for fixed number of samples

## Future Enhancements

Potential future additions:
- Motion detection and tracking
- Face recognition and blur
- Automatic scene segmentation
- Visual similarity search
- Object tracking across frames
- Style and color analysis
- Text extraction (OCR)
- Custom model fine-tuning
