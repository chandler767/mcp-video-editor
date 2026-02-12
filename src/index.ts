#!/usr/bin/env node

import path from 'path';
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
import { MultiTakeProjectManager } from './multi-take/multi-take-manager.js';
import { MultiTakeAnalyzer } from './multi-take/multi-take-analyzer.js';
import { BestTakeSelector } from './multi-take/multi-take-selector.js';
import { ReportGenerator } from './utils/report-generator.js';

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
let multiTakeManager: MultiTakeProjectManager;
let multiTakeAnalyzer: MultiTakeAnalyzer;
let bestTakeSelector: BestTakeSelector;
let reportGenerator: ReportGenerator;

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
  multiTakeManager = new MultiTakeProjectManager(process.cwd());
  multiTakeAnalyzer = new MultiTakeAnalyzer(config);
  bestTakeSelector = new BestTakeSelector();
  reportGenerator = new ReportGenerator();

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
  {
    name: 'create_multi_take_project',
    description: 'Create a new multi-take project with a script. The system will analyze multiple takes of the same script and help you assemble the best take.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Project name',
        },
        script: {
          type: 'string',
          description: 'Full script text (will be automatically divided into sections by paragraph breaks)',
        },
        projectRoot: {
          type: 'string',
          description: 'Optional root directory for project (defaults to current directory + project name)',
        },
      },
      required: ['name', 'script'],
    },
  },
  {
    name: 'add_takes_to_project',
    description: 'Add video take files to a multi-take project',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project ID from create_multi_take_project',
        },
        takeFiles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of video file paths to add as takes',
        },
        move: {
          type: 'boolean',
          description: 'Move files instead of copying (default: false)',
        },
      },
      required: ['projectId', 'takeFiles'],
    },
  },
  {
    name: 'analyze_takes',
    description: 'Analyze all takes in a project for audio/video quality, script matching, and coverage. This runs transcript extraction, quality analysis, and issue detection.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project ID',
        },
        parallel: {
          type: 'boolean',
          description: 'Run analysis in parallel for speed (default: true). Set to false for more stability.',
        },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'get_project_analysis',
    description: 'Get detailed analysis results for all takes in a project',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project ID',
        },
        format: {
          type: 'string',
          enum: ['summary', 'detailed', 'coverage', 'issues', 'json'],
          description: 'Report format (default: summary)',
        },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'select_best_takes',
    description: 'Automatically select the best take for each script section based on quality scores',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project ID',
        },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'assemble_best_takes',
    description: 'Extract and concatenate the best take segments to create the final video',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project ID',
        },
        outputPath: {
          type: 'string',
          description: 'Optional output path (defaults to project output directory)',
        },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'export_final_video',
    description: 'Export and transcode the final assembled video for web delivery',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project ID',
        },
        quality: {
          type: 'string',
          enum: ['high', 'medium', 'low'],
          description: 'Export quality preset (default: medium)',
        },
        exportPath: {
          type: 'string',
          description: 'Optional export path (defaults to project exports directory)',
        },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'get_project_issues',
    description: 'List all issues detected across all takes in a project (quality problems, missing coverage, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project ID',
        },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'list_multi_take_projects',
    description: 'List all multi-take projects',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'cleanup_project_temp',
    description: 'Clean temporary files in a project workspace',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project ID',
        },
        force: {
          type: 'boolean',
          description: 'Force delete all temp files regardless of age (default: false)',
        },
      },
      required: ['projectId'],
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

      case 'create_multi_take_project': {
        const name = args.name as string;
        const script = args.script as string;
        const projectRoot = args.projectRoot as string | undefined;

        const project = await multiTakeManager.createProject(name, script, projectRoot);

        return {
          content: [
            {
              type: 'text',
              text: `Multi-take project created successfully!\n\nProject ID: ${project.projectId}\nName: ${project.name}\nScript sections: ${project.script.sections.length}\nProject directory: ${project.directories.root}\n\nNext steps:\n1. Add video takes: add_takes_to_project\n2. Analyze takes: analyze_takes\n3. Select best takes: select_best_takes\n4. Assemble final video: assemble_best_takes`,
            },
          ],
        };
      }

      case 'add_takes_to_project': {
        const projectId = args.projectId as string;
        const takeFiles = args.takeFiles as string[];
        const move = (args.move as boolean) || false;

        const project = await multiTakeManager.loadProject(projectId);
        const result = await multiTakeManager.addTakes(project, takeFiles, move);

        return {
          content: [
            {
              type: 'text',
              text: `Takes added successfully!\n\nCopied: ${result.copied.length} file(s)\nFailed: ${result.failed.length} file(s)\nTotal size: ${(result.totalSize / 1024 / 1024).toFixed(2)} MB\n\n${result.failed.length > 0 ? `Failed files:\n${result.failed.map(f => `- ${f.path}: ${f.error}`).join('\n')}` : ''}`,
            },
          ],
        };
      }

      case 'analyze_takes': {
        const projectId = args.projectId as string;
        const parallel = args.parallel !== undefined ? (args.parallel as boolean) : true;

        if (!configManager.get().openaiApiKey) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: OpenAI API key not configured. Transcript analysis requires OpenAI API access. Set openaiApiKey in config.',
              },
            ],
            isError: true,
          };
        }

        const project = await multiTakeManager.loadProject(projectId);
        await multiTakeManager.updateStatus(project, 'analyzing', 0, 'Starting analysis...');

        const takeFiles = await multiTakeManager.getTakeFiles(project);

        const analyses = await multiTakeAnalyzer.analyzeAllTakes(
          project,
          takeFiles,
          parallel,
          (progress, current) => {
            console.error(`Analysis progress: ${Math.round(progress)}% - ${current}`);
          }
        );

        // Save analyses to project
        project.takes = analyses;
        await multiTakeManager.updateStatus(project, 'selecting', 100, 'Analysis complete');
        await multiTakeManager.saveProject(project);

        const stats = await multiTakeManager.getProjectStats(project);

        return {
          content: [
            {
              type: 'text',
              text: `Analysis complete!\n\nTakes analyzed: ${stats.takes.analyzed}/${stats.takes.total}\nAverage quality: ${stats.quality.averageScore}/100\nScript coverage: ${stats.coverage.coveredSections}/${stats.coverage.totalSections} sections\nIssues found: ${stats.quality.errors} error(s), ${stats.quality.warnings} warning(s)\n\nUse get_project_analysis to view detailed results.`,
            },
          ],
        };
      }

      case 'get_project_analysis': {
        const projectId = args.projectId as string;
        const format = (args.format as string) || 'summary';

        const project = await multiTakeManager.loadProject(projectId);

        let report: string;
        switch (format) {
          case 'detailed':
            report = reportGenerator.generateAnalysisReport(project);
            break;
          case 'coverage':
            report = reportGenerator.generateCoverageReport(project);
            break;
          case 'issues':
            report = reportGenerator.generateIssuesReport(project);
            break;
          case 'json':
            report = reportGenerator.generateJSONReport(project);
            break;
          case 'summary':
          default:
            report = reportGenerator.generateProjectOverview(project);
            break;
        }

        return {
          content: [
            {
              type: 'text',
              text: report,
            },
          ],
        };
      }

      case 'select_best_takes': {
        const projectId = args.projectId as string;

        const project = await multiTakeManager.loadProject(projectId);

        const validation = multiTakeManager.validateReadyForAnalysis(project);
        if (!validation.valid) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${validation.error}`,
              },
            ],
            isError: true,
          };
        }

        const selections = bestTakeSelector.selectBestTakes(project);
        const plan = bestTakeSelector.createAssemblyPlan(project, selections);

        const planValidation = bestTakeSelector.validateAssemblyPlan(plan);
        if (!planValidation.valid) {
          return {
            content: [
              {
                type: 'text',
                text: `Warning: ${planValidation.error}\n\n${reportGenerator.generateAssemblyReport(project, plan)}`,
              },
            ],
          };
        }

        project.bestTakes = selections;
        await multiTakeManager.saveProject(project);

        return {
          content: [
            {
              type: 'text',
              text: reportGenerator.generateAssemblyReport(project, plan),
            },
          ],
        };
      }

      case 'assemble_best_takes': {
        const projectId = args.projectId as string;
        const outputPath = args.outputPath as string | undefined;

        const project = await multiTakeManager.loadProject(projectId);

        const validation = multiTakeManager.validateReadyForAssembly(project);
        if (!validation.valid) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${validation.error}`,
              },
            ],
            isError: true,
          };
        }

        // Extract segments from best takes
        const segments: string[] = [];
        for (const selection of project.bestTakes!) {
          if (!selection.takeId || !selection.segment) {
            continue; // Skip sections without coverage
          }

          const segmentPath = path.join(
            project.directories.temp,
            `segment_${selection.sectionId}.mp4`
          );

          await videoOps.trim({
            input: selection.filePath!,
            output: segmentPath,
            startTime: selection.segment.start,
            endTime: selection.segment.end,
          });

          segments.push(segmentPath);
        }

        // Concatenate segments
        const finalOutput = outputPath || path.join(
          project.directories.output,
          `${project.name}_assembled.mp4`
        );

        await videoOps.concatenate({
          inputs: segments,
          output: finalOutput,
        });

        await multiTakeManager.updateStatus(project, 'complete', 100, 'Assembly complete');

        return {
          content: [
            {
              type: 'text',
              text: `Video assembled successfully!\n\nOutput: ${finalOutput}\nSegments: ${segments.length}\n\nUse export_final_video to transcode for web delivery.`,
            },
          ],
        };
      }

      case 'export_final_video': {
        const projectId = args.projectId as string;
        const quality = (args.quality as 'high' | 'medium' | 'low') || 'medium';
        const exportPath = args.exportPath as string | undefined;

        const project = await multiTakeManager.loadProject(projectId);

        // Find assembled video
        const assembledPath = path.join(
          project.directories.output,
          `${project.name}_assembled.mp4`
        );

        const finalExportPath = exportPath || path.join(
          project.directories.exports,
          `${project.name}_final.mp4`
        );

        await videoOps.transcodeForWeb({
          input: assembledPath,
          output: finalExportPath,
          quality,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Video exported successfully!\n\nOutput: ${finalExportPath}\nQuality: ${quality}`,
            },
          ],
        };
      }

      case 'get_project_issues': {
        const projectId = args.projectId as string;

        const project = await multiTakeManager.loadProject(projectId);
        const report = reportGenerator.generateIssuesReport(project);

        return {
          content: [
            {
              type: 'text',
              text: report,
            },
          ],
        };
      }

      case 'list_multi_take_projects': {
        const projects = await multiTakeManager.listProjects();

        if (projects.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No multi-take projects found.\n\nCreate one with: create_multi_take_project',
              },
            ],
          };
        }

        const lines = ['MULTI-TAKE PROJECTS', '='.repeat(80), ''];
        for (const project of projects) {
          lines.push(`${project.name} (${project.projectId})`);
          lines.push(`  Created: ${project.created.toLocaleString()}`);
          lines.push(`  Modified: ${project.modified.toLocaleString()}`);
          lines.push(`  Status: ${project.status.phase} (${project.status.progress}%)`);
          lines.push(`  Takes: ${project.takeCount}`);
          lines.push('');
        }

        return {
          content: [
            {
              type: 'text',
              text: lines.join('\n'),
            },
          ],
        };
      }

      case 'cleanup_project_temp': {
        const projectId = args.projectId as string;
        const force = (args.force as boolean) || false;

        const project = await multiTakeManager.loadProject(projectId);
        const result = await multiTakeManager.cleanTempFiles(project, force);

        return {
          content: [
            {
              type: 'text',
              text: result.cleaned
                ? `Temporary files cleaned!\n\nDeleted: ${result.deletedCount} file(s)\nFreed space: ${((result.freedSpace || 0) / 1024 / 1024).toFixed(2)} MB`
                : `Cleanup skipped: ${result.reason}`,
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
