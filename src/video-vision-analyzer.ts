import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { VideoOperations } from './video-operations.js';
import { FFmpegManager } from './ffmpeg-utils.js';
import { VideoConfig } from './config.js';

export interface FrameAnalysis {
  timestamp: number;
  frameNumber: number;
  imagePath: string;
  description: string;
  detectedObjects?: string[];
  detectedText?: string[];
  sceneType?: string;
  confidence?: number;
}

export interface VideoSceneAnalysis {
  videoPath: string;
  duration: number;
  frames: FrameAnalysis[];
  summary: string;
}

export interface VisualSearchResult {
  found: boolean;
  matches: Array<{
    timestamp: number;
    frameNumber: number;
    description: string;
    confidence: number;
  }>;
  segments?: Array<{
    start: number;
    end: number;
  }>;
}

export interface FrameExtractionOptions {
  interval?: number; // Extract frame every N seconds
  timestamps?: number[]; // Extract at specific timestamps
  count?: number; // Extract N evenly-spaced frames
}

export class VideoVisionAnalyzer {
  private openai: OpenAI | null = null;
  private videoOps: VideoOperations;
  private tempDir: string;

  constructor(
    apiKey: string | undefined,
    ffmpegManager: FFmpegManager,
    config: VideoConfig
  ) {
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
    this.videoOps = new VideoOperations(ffmpegManager, config);
    this.tempDir = path.join(process.cwd(), '.mcp-video-vision-temp');
  }

  /**
   * Ensure temp directory exists
   */
  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      // Directory exists
    }
  }

  /**
   * Clean up temp directory
   */
  async cleanup(): Promise<void> {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Extract frames from video for analysis
   */
  async extractFrames(
    videoPath: string,
    options: FrameExtractionOptions = {}
  ): Promise<string[]> {
    await this.ensureTempDir();

    const videoInfo = await this.videoOps.getVideoInfo(videoPath);

    let timestamps: number[] = [];

    if (options.timestamps) {
      timestamps = options.timestamps;
    } else if (options.count) {
      // Extract N evenly-spaced frames
      const interval = videoInfo.duration / (options.count + 1);
      for (let i = 1; i <= options.count; i++) {
        timestamps.push(i * interval);
      }
    } else {
      // Extract at regular intervals (default: every 5 seconds)
      const interval = options.interval || 5;
      for (let t = 0; t < videoInfo.duration; t += interval) {
        timestamps.push(t);
      }
    }

    // Extract frames at specified timestamps
    // Note: We use %d pattern which gets replaced with sequential numbers (1, 2, 3...)
    // NOT zero-padded, so frame-1.jpg, frame-2.jpg, etc.
    const outputPattern = path.join(this.tempDir, 'frame-%d.jpg');
    await this.videoOps.extractFrames({
      input: videoPath,
      output: outputPattern,
      timestamps,
    });

    // Generate the actual file paths that were created
    // VideoOperations.extractFrames replaces %d with (index + 1), so: 1, 2, 3...
    const extractedPaths: string[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const framePath = path.join(this.tempDir, `frame-${i + 1}.jpg`);
      extractedPaths.push(framePath);
    }

    return extractedPaths;
  }

  /**
   * Analyze a single frame with GPT-4 Vision
   */
  async analyzeFrame(
    imagePath: string,
    prompt: string = 'Describe what you see in this video frame in detail. Include any visible objects, people, text, actions, and the overall scene.'
  ): Promise<string> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    // Read image and convert to base64
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const imageUrl = `data:image/jpeg;base64,${base64Image}`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: 500,
    });

    return response.choices[0]?.message?.content || 'No description available';
  }

  /**
   * Analyze multiple frames from a video
   */
  async analyzeVideo(
    videoPath: string,
    options: FrameExtractionOptions = {}
  ): Promise<VideoSceneAnalysis> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const videoInfo = await this.videoOps.getVideoInfo(videoPath);
    const framePaths = await this.extractFrames(videoPath, options);

    const frames: FrameAnalysis[] = [];

    // Analyze each frame
    for (let i = 0; i < framePaths.length; i++) {
      const framePath = framePaths[i];
      const timestamp = options.timestamps?.[i] || i * (options.interval || 5);

      const description = await this.analyzeFrame(framePath);

      frames.push({
        timestamp,
        frameNumber: i,
        imagePath: framePath,
        description,
      });
    }

    // Generate overall summary
    const summary = await this.generateSummary(frames);

    return {
      videoPath,
      duration: videoInfo.duration,
      frames,
      summary,
    };
  }

  /**
   * Search for specific visual content in video
   */
  async searchVisualContent(
    videoPath: string,
    query: string,
    options: FrameExtractionOptions = {}
  ): Promise<VisualSearchResult> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const framePaths = await this.extractFrames(videoPath, options);
    const matches: VisualSearchResult['matches'] = [];

    const searchPrompt = `Does this frame contain or show: ${query}?

Respond in this exact JSON format:
{
  "found": true/false,
  "confidence": 0-100,
  "description": "brief description of what matches or why it doesn't match"
}`;

    for (let i = 0; i < framePaths.length; i++) {
      const framePath = framePaths[i];
      const timestamp = options.timestamps?.[i] || i * (options.interval || 5);

      try {
        const response = await this.analyzeFrame(framePath, searchPrompt);

        // Parse JSON response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);

          if (result.found) {
            matches.push({
              timestamp,
              frameNumber: i,
              description: result.description,
              confidence: result.confidence,
            });
          }
        }
      } catch (error) {
        console.error(`Error analyzing frame ${i}:`, error);
      }
    }

    // Group consecutive matches into segments
    const segments: Array<{ start: number; end: number }> = [];
    if (matches.length > 0) {
      let currentSegment = { start: matches[0].timestamp, end: matches[0].timestamp };

      for (let i = 1; i < matches.length; i++) {
        const timeDiff = matches[i].timestamp - matches[i - 1].timestamp;

        if (timeDiff <= (options.interval || 5) * 1.5) {
          // Extend current segment
          currentSegment.end = matches[i].timestamp;
        } else {
          // Start new segment
          segments.push(currentSegment);
          currentSegment = { start: matches[i].timestamp, end: matches[i].timestamp };
        }
      }
      segments.push(currentSegment);
    }

    return {
      found: matches.length > 0,
      matches,
      segments,
    };
  }

  /**
   * Find when specific objects/people/things appear in video
   */
  async findAppearances(
    videoPath: string,
    targetDescription: string,
    options: FrameExtractionOptions = { interval: 2 }
  ): Promise<{
    appearances: Array<{
      start: number;
      end: number;
      description: string;
    }>;
    totalDuration: number;
  }> {
    const searchResult = await this.searchVisualContent(
      videoPath,
      targetDescription,
      options
    );

    const appearances = searchResult.segments?.map(seg => ({
      start: seg.start,
      end: seg.end,
      description: `${targetDescription} appears`,
    })) || [];

    const totalDuration = appearances.reduce(
      (sum, app) => sum + (app.end - app.start),
      0
    );

    return {
      appearances,
      totalDuration,
    };
  }

  /**
   * Get detailed description of a specific moment in video
   */
  async describeScene(
    videoPath: string,
    timestamp: number,
    detailLevel: 'brief' | 'detailed' | 'comprehensive' = 'detailed'
  ): Promise<{
    timestamp: number;
    description: string;
    objects: string[];
    actions: string[];
    setting: string;
  }> {
    await this.ensureTempDir();

    const framePath = path.join(this.tempDir, `scene-${timestamp}.jpg`);
    await this.videoOps.extractFrames({
      input: videoPath,
      output: framePath,
      timestamps: [timestamp],
    });

    const prompts = {
      brief: 'Briefly describe what you see in this frame in 1-2 sentences.',
      detailed: 'Describe this frame in detail. What objects, people, actions, and setting do you see?',
      comprehensive: 'Provide a comprehensive analysis of this frame. Describe: 1) All visible objects and their positions, 2) Any people and their actions, 3) Text or UI elements, 4) The setting/environment, 5) Colors and lighting, 6) Overall composition.'
    };

    const description = await this.analyzeFrame(framePath, prompts[detailLevel]);

    // Extract structured information
    const structuredPrompt = `Based on this frame, list in JSON format:
{
  "objects": ["list of main objects visible"],
  "actions": ["list of actions/activities happening"],
  "setting": "brief description of the location/environment"
}`;

    const structuredResponse = await this.analyzeFrame(framePath, structuredPrompt);

    let objects: string[] = [];
    let actions: string[] = [];
    let setting = '';

    try {
      const jsonMatch = structuredResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        objects = parsed.objects || [];
        actions = parsed.actions || [];
        setting = parsed.setting || '';
      }
    } catch (error) {
      // Fallback to description only
    }

    return {
      timestamp,
      description,
      objects,
      actions,
      setting,
    };
  }

  /**
   * Generate summary from frame analyses
   */
  private async generateSummary(frames: FrameAnalysis[]): Promise<string> {
    if (!this.openai) {
      return 'Summary not available';
    }

    const descriptions = frames
      .map(f => `[${f.timestamp.toFixed(1)}s]: ${f.description}`)
      .join('\n\n');

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: `Based on these video frame descriptions, provide a concise summary of what happens in this video:\n\n${descriptions}`,
        },
      ],
      max_tokens: 300,
    });

    return response.choices[0]?.message?.content || 'No summary available';
  }

  /**
   * Compare two frames to detect changes
   */
  async compareFrames(
    videoPath: string,
    timestamp1: number,
    timestamp2: number
  ): Promise<{
    differences: string;
    changeDetected: boolean;
    changeDescription: string;
  }> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    await this.ensureTempDir();

    // Extract both frames
    const frame1Path = path.join(this.tempDir, `compare-${timestamp1}.jpg`);
    const frame2Path = path.join(this.tempDir, `compare-${timestamp2}.jpg`);

    await this.videoOps.extractFrames({
      input: videoPath,
      output: frame1Path,
      timestamps: [timestamp1],
    });

    await this.videoOps.extractFrames({
      input: videoPath,
      output: frame2Path,
      timestamps: [timestamp2],
    });

    // Analyze both frames
    const desc1 = await this.analyzeFrame(frame1Path, 'Describe what you see.');
    const desc2 = await this.analyzeFrame(frame2Path, 'Describe what you see.');

    // Compare
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: `Compare these two descriptions and identify what changed:\n\nFrame 1: ${desc1}\n\nFrame 2: ${desc2}\n\nProvide a JSON response: {"changeDetected": true/false, "changeDescription": "what changed"}`,
        },
      ],
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    let changeDetected = false;
    let changeDescription = 'Unable to determine changes';

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        changeDetected = parsed.changeDetected;
        changeDescription = parsed.changeDescription;
      } catch (error) {
        // Use raw content as fallback
        changeDescription = content;
      }
    }

    return {
      differences: `Frame 1 (${timestamp1}s): ${desc1}\n\nFrame 2 (${timestamp2}s): ${desc2}`,
      changeDetected,
      changeDescription,
    };
  }
}
