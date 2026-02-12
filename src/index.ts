#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { FFmpegManager } from './ffmpeg-utils.js';
import { ConfigManager, VideoConfig } from './config.js';
import { VideoOperations } from './video-operations.js';
import { TranscriptOperations, Transcript } from './transcript-operations.js';

const server = new Server(
  {
    name: 'mcp-video-editor',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const ffmpegManager = new FFmpegManager();
const configManager = new ConfigManager();
let videoOps: VideoOperations;
let transcriptOps: TranscriptOperations;

// Store transcripts in memory (could be extended to disk cache)
const transcriptCache = new Map<string, Transcript>();

// Initialize FFmpeg and config on startup
async function initialize() {
  const ffmpegInfo = await ffmpegManager.initialize();
  if (!ffmpegInfo.available) {
    console.error('FFmpeg is not available. Please install FFmpeg or check the bundled version.');
    process.exit(1);
  }

  await configManager.load();
  const config = configManager.get();
  videoOps = new VideoOperations(ffmpegManager, config);
  transcriptOps = new TranscriptOperations(config.openaiApiKey, ffmpegManager);

  console.error(`FFmpeg initialized: ${ffmpegInfo.version} at ${ffmpegInfo.path}`);
  if (config.openaiApiKey) {
    console.error('Transcript features enabled (OpenAI API key configured)');
  } else {
    console.error('Transcript features disabled (no OpenAI API key). Set openaiApiKey in config to enable.');
  }
}

// Define available tools
const tools: Tool[] = [
  {
    name: 'get_video_info',
    description: 'Get metadata and information about a video file (duration, resolution, codecs, bitrate, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the video file',
        },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'trim_video',
    description: 'Cut/trim a video by specifying start time and end time or duration',
    inputSchema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Input video file path',
        },
        output: {
          type: 'string',
          description: 'Output video file path',
        },
        startTime: {
          type: ['string', 'number'],
          description: 'Start time in seconds or HH:MM:SS format',
        },
        endTime: {
          type: ['string', 'number'],
          description: 'End time in seconds or HH:MM:SS format (optional if duration is specified)',
        },
        duration: {
          type: ['string', 'number'],
          description: 'Duration in seconds or HH:MM:SS format (optional if endTime is specified)',
        },
      },
      required: ['input', 'output', 'startTime'],
    },
  },
  {
    name: 'concatenate_videos',
    description: 'Join multiple videos together into a single video file',
    inputSchema: {
      type: 'object',
      properties: {
        inputs: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of input video file paths to concatenate',
        },
        output: {
          type: 'string',
          description: 'Output video file path',
        },
      },
      required: ['inputs', 'output'],
    },
  },
  {
    name: 'extract_audio',
    description: 'Extract audio track from a video file and save as audio file',
    inputSchema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Input video file path',
        },
        output: {
          type: 'string',
          description: 'Output audio file path',
        },
      },
      required: ['input', 'output'],
    },
  },
  {
    name: 'convert_video',
    description: 'Convert video to different format, codec, or quality settings',
    inputSchema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Input video file path',
        },
        output: {
          type: 'string',
          description: 'Output video file path',
        },
        format: {
          type: 'string',
          description: 'Output format (e.g., mp4, webm, mov)',
        },
        codec: {
          type: 'string',
          description: 'Video codec (e.g., libx264, libx265, libvpx-vp9)',
        },
        quality: {
          type: 'string',
          description: 'CRF quality value (lower = better, 18-28 is reasonable)',
        },
        preset: {
          type: 'string',
          description: 'Encoding preset (ultrafast, superfast, veryfast, faster, fast, medium, slow, slower, veryslow)',
        },
        videoBitrate: {
          type: 'string',
          description: 'Video bitrate (e.g., "2M", "5000k")',
        },
        audioBitrate: {
          type: 'string',
          description: 'Audio bitrate (e.g., "192k", "320k")',
        },
      },
      required: ['input', 'output'],
    },
  },
  {
    name: 'resize_video',
    description: 'Resize or scale video to different dimensions',
    inputSchema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Input video file path',
        },
        output: {
          type: 'string',
          description: 'Output video file path',
        },
        width: {
          type: 'number',
          description: 'Target width in pixels',
        },
        height: {
          type: 'number',
          description: 'Target height in pixels',
        },
        scale: {
          type: 'string',
          description: 'FFmpeg scale filter string (e.g., "1920:1080", "iw/2:ih/2")',
        },
        maintainAspectRatio: {
          type: 'boolean',
          description: 'Maintain aspect ratio when only width or height is specified (default: true)',
        },
      },
      required: ['input', 'output'],
    },
  },
  {
    name: 'extract_frames',
    description: 'Extract frames from video as images at specific timestamps or intervals',
    inputSchema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Input video file path',
        },
        output: {
          type: 'string',
          description: 'Output image file path pattern (use %d for frame number, e.g., "frame-%d.png")',
        },
        timestamps: {
          type: 'array',
          items: { type: 'number' },
          description: 'Specific timestamps in seconds to extract frames',
        },
        fps: {
          type: 'number',
          description: 'Frames per second to extract (e.g., 1 = 1 frame per second)',
        },
        startTime: {
          type: 'number',
          description: 'Start time in seconds',
        },
        duration: {
          type: 'number',
          description: 'Duration in seconds',
        },
      },
      required: ['input', 'output'],
    },
  },
  {
    name: 'adjust_speed',
    description: 'Speed up or slow down video playback',
    inputSchema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Input video file path',
        },
        output: {
          type: 'string',
          description: 'Output video file path',
        },
        speed: {
          type: 'number',
          description: 'Speed multiplier (0.5 = half speed, 2.0 = double speed). Range: 0.5-2.0',
        },
      },
      required: ['input', 'output', 'speed'],
    },
  },
  {
    name: 'transcode_for_web',
    description: 'Optimize video for web sharing with smart compression. Balances file size and quality for portability. Uses modern H.264 codec and AAC audio for maximum compatibility.',
    inputSchema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Input video file path',
        },
        output: {
          type: 'string',
          description: 'Output video file path',
        },
        quality: {
          type: 'string',
          enum: ['high', 'medium', 'low'],
          description: 'Compression quality preset. high=larger file/better quality, medium=balanced (default), low=smaller file/lower quality',
        },
        maxResolution: {
          type: 'string',
          enum: ['4k', '1080p', '720p', '480p'],
          description: 'Maximum output resolution. Video will be scaled down if larger. Maintains aspect ratio.',
        },
      },
      required: ['input', 'output'],
    },
  },
  {
    name: 'get_config',
    description: 'Get current video editing configuration settings',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'set_config',
    description: 'Set video editing configuration settings for the current project',
    inputSchema: {
      type: 'object',
      properties: {
        defaultOutputFormat: {
          type: 'string',
          description: 'Default output format (e.g., mp4, webm)',
        },
        defaultQuality: {
          type: 'string',
          description: 'Default CRF quality value (18-28)',
        },
        defaultCodec: {
          type: 'string',
          description: 'Default video codec (e.g., libx264, libx265)',
        },
        defaultAudioCodec: {
          type: 'string',
          description: 'Default audio codec (e.g., aac, mp3)',
        },
        defaultAudioBitrate: {
          type: 'string',
          description: 'Default audio bitrate (e.g., 192k)',
        },
        defaultVideoBitrate: {
          type: 'string',
          description: 'Default video bitrate (e.g., 2M)',
        },
        defaultPreset: {
          type: 'string',
          description: 'Default encoding preset (medium, fast, slow, etc.)',
        },
        workingDirectory: {
          type: 'string',
          description: 'Working directory for temporary files',
        },
      },
    },
  },
  {
    name: 'reset_config',
    description: 'Reset configuration to default values',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'extract_transcript',
    description: 'Extract transcript from video with word-level timestamps using OpenAI Whisper',
    inputSchema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Input video file path',
        },
        language: {
          type: 'string',
          description: 'Language code (e.g., en, es, fr). Optional, will auto-detect if not provided.',
        },
        format: {
          type: 'string',
          enum: ['json', 'text', 'srt'],
          description: 'Output format for transcript (default: json with timestamps)',
        },
      },
      required: ['input'],
    },
  },
  {
    name: 'find_in_transcript',
    description: 'Find specific text in a previously extracted transcript and get timestamps',
    inputSchema: {
      type: 'object',
      properties: {
        videoPath: {
          type: 'string',
          description: 'Path to video (to identify which transcript to search)',
        },
        searchText: {
          type: 'string',
          description: 'Text to search for in the transcript',
        },
      },
      required: ['videoPath', 'searchText'],
    },
  },
  {
    name: 'remove_by_transcript',
    description: 'Remove parts of video where specific text is spoken',
    inputSchema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Input video file path',
        },
        output: {
          type: 'string',
          description: 'Output video file path',
        },
        textToRemove: {
          type: 'string',
          description: 'Text/phrase to remove from video (will remove all occurrences)',
        },
      },
      required: ['input', 'output', 'textToRemove'],
    },
  },
  {
    name: 'trim_to_script',
    description: 'Keep only parts of video that match a provided script',
    inputSchema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Input video file path',
        },
        output: {
          type: 'string',
          description: 'Output video file path',
        },
        script: {
          type: 'string',
          description: 'Script text to match (keeps only parts where this text is spoken)',
        },
      },
      required: ['input', 'output', 'script'],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    if (!args) {
      throw new Error('Arguments are required');
    }

    switch (name) {
      case 'get_video_info': {
        const info = await videoOps.getVideoInfo(args.filePath as string);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(info, null, 2),
            },
          ],
        };
      }

      case 'trim_video': {
        const result = await videoOps.trim({
          input: args.input as string,
          output: args.output as string,
          startTime: args.startTime as string | number,
          endTime: args.endTime as string | number | undefined,
          duration: args.duration as string | number | undefined,
        });
        return {
          content: [
            {
              type: 'text',
              text: `Video trimmed successfully: ${result}`,
            },
          ],
        };
      }

      case 'concatenate_videos': {
        const result = await videoOps.concatenate({
          inputs: args.inputs as string[],
          output: args.output as string,
        });
        return {
          content: [
            {
              type: 'text',
              text: `Videos concatenated successfully: ${result}`,
            },
          ],
        };
      }

      case 'extract_audio': {
        const result = await videoOps.extractAudio(
          args.input as string,
          args.output as string
        );
        return {
          content: [
            {
              type: 'text',
              text: `Audio extracted successfully: ${result}`,
            },
          ],
        };
      }

      case 'convert_video': {
        const result = await videoOps.convert({
          input: args.input as string,
          output: args.output as string,
          format: args.format as string | undefined,
          codec: args.codec as string | undefined,
          quality: args.quality as string | undefined,
          preset: args.preset as string | undefined,
          videoBitrate: args.videoBitrate as string | undefined,
          audioBitrate: args.audioBitrate as string | undefined,
        });
        return {
          content: [
            {
              type: 'text',
              text: `Video converted successfully: ${result}`,
            },
          ],
        };
      }

      case 'resize_video': {
        const result = await videoOps.resize({
          input: args.input as string,
          output: args.output as string,
          width: args.width as number | undefined,
          height: args.height as number | undefined,
          scale: args.scale as string | undefined,
          maintainAspectRatio: args.maintainAspectRatio as boolean | undefined,
        });
        return {
          content: [
            {
              type: 'text',
              text: `Video resized successfully: ${result}`,
            },
          ],
        };
      }

      case 'extract_frames': {
        const result = await videoOps.extractFrames({
          input: args.input as string,
          output: args.output as string,
          timestamps: args.timestamps as number[] | undefined,
          fps: args.fps as number | undefined,
          startTime: args.startTime as number | undefined,
          duration: args.duration as number | undefined,
        });
        return {
          content: [
            {
              type: 'text',
              text: `Frames extracted successfully: ${result}`,
            },
          ],
        };
      }

      case 'adjust_speed': {
        const speed = args.speed as number;
        if (speed < 0.5 || speed > 2.0) {
          throw new Error('Speed must be between 0.5 and 2.0');
        }
        const result = await videoOps.adjustSpeed({
          input: args.input as string,
          output: args.output as string,
          speed,
        });
        return {
          content: [
            {
              type: 'text',
              text: `Video speed adjusted successfully: ${result}`,
            },
          ],
        };
      }

      case 'transcode_for_web': {
        const quality = (args.quality as 'high' | 'medium' | 'low' | undefined) || 'medium';
        const maxResolution = args.maxResolution as '4k' | '1080p' | '720p' | '480p' | undefined;

        const result = await videoOps.transcodeForWeb({
          input: args.input as string,
          output: args.output as string,
          quality,
          maxResolution,
        });

        const info = await videoOps.getVideoInfo(result);
        const fileSizeMB = (info.size / (1024 * 1024)).toFixed(2);

        return {
          content: [
            {
              type: 'text',
              text: `Video transcoded for web successfully!\n` +
                    `Output: ${result}\n` +
                    `Resolution: ${info.width}x${info.height}\n` +
                    `File size: ${fileSizeMB} MB\n` +
                    `Quality preset: ${quality}`,
            },
          ],
        };
      }

      case 'get_config': {
        const config = configManager.get();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(config, null, 2),
            },
          ],
        };
      }

      case 'set_config': {
        await configManager.save(args as Partial<VideoConfig>);
        // Reload operations with new config
        const config = configManager.get();
        videoOps = new VideoOperations(ffmpegManager, config);
        transcriptOps = new TranscriptOperations(config.openaiApiKey, ffmpegManager);
        return {
          content: [
            {
              type: 'text',
              text: 'Configuration updated successfully',
            },
          ],
        };
      }

      case 'reset_config': {
        await configManager.reset();
        const config = configManager.get();
        videoOps = new VideoOperations(ffmpegManager, config);
        transcriptOps = new TranscriptOperations(config.openaiApiKey, ffmpegManager);
        return {
          content: [
            {
              type: 'text',
              text: 'Configuration reset to defaults',
            },
          ],
        };
      }

      case 'extract_transcript': {
        if (!transcriptOps || !configManager.get().openaiApiKey) {
          return {
            content: [
              {
                type: 'text',
                text: 'Transcript features are disabled. Please set openaiApiKey in config using set_config tool.',
              },
            ],
            isError: true,
          };
        }

        const transcript = await transcriptOps.extractTranscript(args.input as string, {
          language: args.language as string | undefined,
        });

        // Cache the transcript
        transcriptCache.set(args.input as string, transcript);

        const format = (args.format as string) || 'json';
        let output: string;

        if (format === 'srt') {
          output = transcriptOps.formatTranscriptAsSRT(transcript);
        } else if (format === 'text') {
          output = transcriptOps.formatTranscriptAsText(transcript);
        } else {
          output = JSON.stringify(transcript, null, 2);
        }

        return {
          content: [
            {
              type: 'text',
              text: output,
            },
          ],
        };
      }

      case 'find_in_transcript': {
        const videoPath = args.videoPath as string;
        const searchText = args.searchText as string;

        const transcript = transcriptCache.get(videoPath);
        if (!transcript) {
          return {
            content: [
              {
                type: 'text',
                text: 'No transcript found for this video. Please run extract_transcript first.',
              },
            ],
            isError: true,
          };
        }

        const matches = transcriptOps.findTextInTranscript(transcript, searchText);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ matches, count: matches.length }, null, 2),
            },
          ],
        };
      }

      case 'remove_by_transcript': {
        if (!transcriptOps || !configManager.get().openaiApiKey) {
          return {
            content: [
              {
                type: 'text',
                text: 'Transcript features are disabled. Please set openaiApiKey in config.',
              },
            ],
            isError: true,
          };
        }

        const input = args.input as string;
        const output = args.output as string;
        const textToRemove = args.textToRemove as string;

        // Get or extract transcript
        let transcript = transcriptCache.get(input);
        if (!transcript) {
          transcript = await transcriptOps.extractTranscript(input);
          transcriptCache.set(input, transcript);
        }

        // Find segments to remove
        const segmentsToRemove = transcriptOps.calculateTimestampsToRemove(transcript, textToRemove);

        if (segmentsToRemove.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Text "${textToRemove}" not found in transcript.`,
              },
            ],
            isError: true,
          };
        }

        // Remove the segments
        const result = await videoOps.removeSegments({
          input,
          output,
          segments: segmentsToRemove,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Video processed successfully. Removed ${segmentsToRemove.length} segment(s) containing "${textToRemove}". Output: ${result}`,
            },
          ],
        };
      }

      case 'trim_to_script': {
        if (!transcriptOps || !configManager.get().openaiApiKey) {
          return {
            content: [
              {
                type: 'text',
                text: 'Transcript features are disabled. Please set openaiApiKey in config.',
              },
            ],
            isError: true,
          };
        }

        const input = args.input as string;
        const output = args.output as string;
        const script = args.script as string;

        // Get or extract transcript
        let transcript = transcriptCache.get(input);
        if (!transcript) {
          transcript = await transcriptOps.extractTranscript(input);
          transcriptCache.set(input, transcript);
        }

        // Find segments that match the script
        const segmentsToKeep = transcriptOps.calculateTimestampsToKeep(transcript, script);

        if (segmentsToKeep.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No matching content found in transcript for the provided script.',
              },
            ],
            isError: true,
          };
        }

        // Keep only matching segments
        const result = await videoOps.keepSegments({
          input,
          output,
          segments: segmentsToKeep,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Video trimmed to script successfully. Kept ${segmentsToKeep.length} segment(s). Output: ${result}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  await initialize();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('MCP Video Editor Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
