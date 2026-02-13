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
import { TextOperations } from './text-operations.js';
import { TimelineManager } from './timeline-manager.js';
import { VideoVisionAnalyzer } from './video-vision-analyzer.js';
import { VisualElements } from './visual-elements.js';
import { AnimationEngine } from './animation-engine.js';
import { TransitionEffects } from './transition-effects.js';
import { DiagramGenerator } from './diagram-generator.js';
import { CompositeOperations } from './composite-operations.js';
import { VisualEffects } from './visual-effects.js';

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
let textOps: TextOperations;
let timelineManager: TimelineManager;
let multiTakeManager: MultiTakeProjectManager;
let multiTakeAnalyzer: MultiTakeAnalyzer;
let bestTakeSelector: BestTakeSelector;
let reportGenerator: ReportGenerator;
let visionAnalyzer: VideoVisionAnalyzer;
let visualElements: VisualElements;
let animationEngine: AnimationEngine;
let transitionEffects: TransitionEffects;
let diagramGenerator: DiagramGenerator;
let compositeOps: CompositeOperations;
let visualEffects: VisualEffects;

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
  textOps = new TextOperations(ffmpegManager);
  timelineManager = new TimelineManager(process.cwd());
  multiTakeManager = new MultiTakeProjectManager(process.cwd());
  multiTakeAnalyzer = new MultiTakeAnalyzer(config);
  bestTakeSelector = new BestTakeSelector();
  reportGenerator = new ReportGenerator();
  visionAnalyzer = new VideoVisionAnalyzer(config.openaiApiKey, ffmpegManager, config);
  visualElements = new VisualElements(ffmpegManager);
  animationEngine = new AnimationEngine(ffmpegManager);
  transitionEffects = new TransitionEffects(ffmpegManager);
  diagramGenerator = new DiagramGenerator(ffmpegManager);
  compositeOps = new CompositeOperations(ffmpegManager);
  visualEffects = new VisualEffects(ffmpegManager);

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
  {
    name: 'add_text_overlay',
    description: 'Add text overlay to video with styling, positioning, and timing options. Great for titles, captions, watermarks.',
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
        text: {
          type: 'string',
          description: 'Text to display',
        },
        position: {
          type: 'string',
          enum: ['top-left', 'top-center', 'top-right', 'center', 'bottom-left', 'bottom-center', 'bottom-right'],
          description: 'Text position preset (default: bottom-center)',
        },
        x: {
          type: 'number',
          description: 'Custom X coordinate (overrides position preset)',
        },
        y: {
          type: 'number',
          description: 'Custom Y coordinate (overrides position preset)',
        },
        startTime: {
          type: 'number',
          description: 'Start time in seconds (when text appears)',
        },
        endTime: {
          type: 'number',
          description: 'End time in seconds (when text disappears)',
        },
        duration: {
          type: 'number',
          description: 'Duration in seconds (alternative to endTime)',
        },
        fontSize: {
          type: 'number',
          description: 'Font size in pixels (default: 24)',
        },
        fontColor: {
          type: 'string',
          description: 'Font color name or hex (e.g., "white", "0xFFFFFF") (default: white)',
        },
        fontFile: {
          type: 'string',
          description: 'Path to custom font file (.ttf)',
        },
        borderWidth: {
          type: 'number',
          description: 'Border/outline width in pixels',
        },
        borderColor: {
          type: 'string',
          description: 'Border color (default: black)',
        },
        shadowX: {
          type: 'number',
          description: 'Shadow X offset in pixels',
        },
        shadowY: {
          type: 'number',
          description: 'Shadow Y offset in pixels',
        },
        shadowColor: {
          type: 'string',
          description: 'Shadow color (default: black)',
        },
        box: {
          type: 'boolean',
          description: 'Add background box for better readability',
        },
        boxColor: {
          type: 'string',
          description: 'Box background color (default: black)',
        },
        boxOpacity: {
          type: 'number',
          description: 'Box opacity 0-1 (default: 0.5)',
        },
        fadeIn: {
          type: 'number',
          description: 'Fade in duration in seconds',
        },
        fadeOut: {
          type: 'number',
          description: 'Fade out duration in seconds',
        },
      },
      required: ['input', 'output', 'text'],
    },
  },
  {
    name: 'add_animated_text',
    description: 'Add animated text overlay to video with motion effects (slide, fade, zoom)',
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
        text: {
          type: 'string',
          description: 'Text to display',
        },
        animation: {
          type: 'string',
          enum: ['fade', 'slide-left', 'slide-right', 'slide-up', 'slide-down', 'zoom'],
          description: 'Animation type',
        },
        animationDuration: {
          type: 'number',
          description: 'Animation duration in seconds (default: 1)',
        },
        position: {
          type: 'string',
          enum: ['top-left', 'top-center', 'top-right', 'center', 'bottom-left', 'bottom-center', 'bottom-right'],
          description: 'Final text position (default: center)',
        },
        startTime: {
          type: 'number',
          description: 'Start time in seconds',
        },
        endTime: {
          type: 'number',
          description: 'End time in seconds',
        },
        duration: {
          type: 'number',
          description: 'Total display duration in seconds',
        },
        fontSize: {
          type: 'number',
          description: 'Font size in pixels (default: 24)',
        },
        fontColor: {
          type: 'string',
          description: 'Font color (default: white)',
        },
        fontFile: {
          type: 'string',
          description: 'Path to custom font file',
        },
        borderWidth: {
          type: 'number',
          description: 'Border width in pixels',
        },
        borderColor: {
          type: 'string',
          description: 'Border color (default: black)',
        },
        box: {
          type: 'boolean',
          description: 'Add background box',
        },
        boxColor: {
          type: 'string',
          description: 'Box color (default: black)',
        },
        boxOpacity: {
          type: 'number',
          description: 'Box opacity 0-1 (default: 0.5)',
        },
      },
      required: ['input', 'output', 'text', 'animation'],
    },
  },
  {
    name: 'burn_subtitles',
    description: 'Burn subtitles from SRT/VTT file permanently into video',
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
        subtitleFile: {
          type: 'string',
          description: 'Path to subtitle file (.srt, .vtt, or .ass)',
        },
        fontSize: {
          type: 'number',
          description: 'Font size for subtitles',
        },
        fontColor: {
          type: 'string',
          description: 'Font color for subtitles',
        },
        fontFile: {
          type: 'string',
          description: 'Path to custom font file',
        },
        borderWidth: {
          type: 'number',
          description: 'Border width',
        },
        borderColor: {
          type: 'string',
          description: 'Border color',
        },
        box: {
          type: 'boolean',
          description: 'Add background box',
        },
        boxColor: {
          type: 'string',
          description: 'Box color',
        },
        boxOpacity: {
          type: 'number',
          description: 'Box opacity 0-1',
        },
      },
      required: ['input', 'output', 'subtitleFile'],
    },
  },
  {
    name: 'create_timeline',
    description: 'Create a new editing timeline to track operations and enable undo/redo',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Timeline name',
        },
        baseFile: {
          type: 'string',
          description: 'Base video file (starting point)',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'add_to_timeline',
    description: 'Record an operation to timeline (automatically tracks changes for undo/redo)',
    inputSchema: {
      type: 'object',
      properties: {
        timelineId: {
          type: 'string',
          description: 'Timeline ID',
        },
        operation: {
          type: 'string',
          description: 'Operation name (e.g., "trim", "add_text", "concatenate")',
        },
        description: {
          type: 'string',
          description: 'Human-readable description of what was done',
        },
        input: {
          type: ['string', 'array'],
          description: 'Input file path(s)',
        },
        output: {
          type: 'string',
          description: 'Output file path',
        },
        parameters: {
          type: 'object',
          description: 'Operation parameters as JSON object',
        },
      },
      required: ['timelineId', 'operation', 'description', 'input', 'output'],
    },
  },
  {
    name: 'undo_operation',
    description: 'Undo the last operation in timeline (moves back one step)',
    inputSchema: {
      type: 'object',
      properties: {
        timelineId: {
          type: 'string',
          description: 'Timeline ID',
        },
      },
      required: ['timelineId'],
    },
  },
  {
    name: 'redo_operation',
    description: 'Redo the next operation in timeline (moves forward one step)',
    inputSchema: {
      type: 'object',
      properties: {
        timelineId: {
          type: 'string',
          description: 'Timeline ID',
        },
      },
      required: ['timelineId'],
    },
  },
  {
    name: 'view_timeline',
    description: 'View timeline history showing all operations, current position, and undo/redo availability',
    inputSchema: {
      type: 'object',
      properties: {
        timelineId: {
          type: 'string',
          description: 'Timeline ID',
        },
      },
      required: ['timelineId'],
    },
  },
  {
    name: 'jump_to_timeline_point',
    description: 'Jump to a specific point in timeline by operation index',
    inputSchema: {
      type: 'object',
      properties: {
        timelineId: {
          type: 'string',
          description: 'Timeline ID',
        },
        index: {
          type: 'number',
          description: 'Operation index to jump to (0-based, -1 for base file)',
        },
      },
      required: ['timelineId', 'index'],
    },
  },
  {
    name: 'list_timelines',
    description: 'List all editing timelines',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_timeline_stats',
    description: 'Get statistics about timeline operations (total, completed, failed, duration, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        timelineId: {
          type: 'string',
          description: 'Timeline ID',
        },
      },
      required: ['timelineId'],
    },
  },
  {
    name: 'analyze_video_content',
    description: 'Analyze visual content of video by extracting and analyzing frames with GPT-4 Vision. Returns frame descriptions, objects detected, and overall summary.',
    inputSchema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Input video file path',
        },
        interval: {
          type: 'number',
          description: 'Interval in seconds between frame extractions (default: 5)',
        },
        count: {
          type: 'number',
          description: 'Number of evenly-spaced frames to analyze (alternative to interval)',
        },
        timestamps: {
          type: 'array',
          items: { type: 'number' },
          description: 'Specific timestamps in seconds to analyze (alternative to interval/count)',
        },
      },
      required: ['input'],
    },
  },
  {
    name: 'search_visual_content',
    description: 'Search for specific visual content in video (objects, people, scenes, text, etc.). Returns timestamps where the content appears.',
    inputSchema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Input video file path',
        },
        query: {
          type: 'string',
          description: 'What to search for (e.g., "person wearing red shirt", "laptop on desk", "text saying hello")',
        },
        interval: {
          type: 'number',
          description: 'Interval in seconds between frame checks (default: 5). Smaller = more accurate but slower',
        },
      },
      required: ['input', 'query'],
    },
  },
  {
    name: 'describe_scene',
    description: 'Get detailed description of what\'s happening at a specific moment in the video',
    inputSchema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Input video file path',
        },
        timestamp: {
          type: 'number',
          description: 'Timestamp in seconds to describe',
        },
        detailLevel: {
          type: 'string',
          enum: ['brief', 'detailed', 'comprehensive'],
          description: 'Level of detail in description (default: detailed)',
        },
      },
      required: ['input', 'timestamp'],
    },
  },
  {
    name: 'find_objects_in_video',
    description: 'Track when specific objects, people, or things appear in the video. Returns time ranges of appearances.',
    inputSchema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Input video file path',
        },
        targetDescription: {
          type: 'string',
          description: 'Description of what to find (e.g., "person", "car", "logo")',
        },
        interval: {
          type: 'number',
          description: 'Check interval in seconds (default: 2). Smaller = more accurate tracking',
        },
      },
      required: ['input', 'targetDescription'],
    },
  },
  {
    name: 'compare_video_frames',
    description: 'Compare two moments in a video to detect what changed between them',
    inputSchema: {
      type: 'object',
      properties: {
        input: {
          type: 'string',
          description: 'Input video file path',
        },
        timestamp1: {
          type: 'number',
          description: 'First timestamp in seconds',
        },
        timestamp2: {
          type: 'number',
          description: 'Second timestamp in seconds',
        },
      },
      required: ['input', 'timestamp1', 'timestamp2'],
    },
  },
  // Visual Effects & Animation Tools
  {
    name: 'add_image_overlay',
    description: 'Overlay an image on video with positioning, scaling, rotation, and opacity control',
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input video path' },
        image: { type: 'string', description: 'Image path to overlay' },
        output: { type: 'string', description: 'Output video path' },
        x: { type: 'number', description: 'X position (optional)' },
        y: { type: 'number', description: 'Y position (optional)' },
        anchor: { type: 'string', description: 'Anchor point: top-left, center, bottom-right, etc (optional)' },
        width: { type: 'number', description: 'Image width (optional)' },
        height: { type: 'number', description: 'Image height (optional)' },
        rotation: { type: 'number', description: 'Rotation in degrees (optional)' },
        opacity: { type: 'number', description: 'Opacity 0-1 (optional)' },
        startTime: { type: 'number', description: 'Start time in seconds (optional)' },
        duration: { type: 'number', description: 'Duration in seconds (optional)' },
      },
      required: ['input', 'image', 'output'],
    },
  },
  {
    name: 'add_shape',
    description: 'Draw shapes (rectangle, circle, line, arrow, polygon) on video',
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input video path' },
        output: { type: 'string', description: 'Output video path' },
        type: { type: 'string', description: 'Shape type: rectangle, circle, line, arrow, polygon' },
        x: { type: 'number', description: 'X position' },
        y: { type: 'number', description: 'Y position' },
        width: { type: 'number', description: 'Width' },
        height: { type: 'number', description: 'Height' },
        color: { type: 'string', description: 'Color (hex or name)' },
        thickness: { type: 'number', description: 'Line thickness (optional)' },
        filled: { type: 'boolean', description: 'Fill shape (optional)' },
        opacity: { type: 'number', description: 'Opacity 0-1 (optional)' },
      },
      required: ['input', 'output', 'type', 'x', 'y', 'width', 'height', 'color'],
    },
  },
  {
    name: 'add_transition',
    description: 'Add transition effect between two video clips',
    inputSchema: {
      type: 'object',
      properties: {
        input1: { type: 'string', description: 'First video path' },
        input2: { type: 'string', description: 'Second video path' },
        output: { type: 'string', description: 'Output video path' },
        type: { type: 'string', description: 'Transition type: fade, wipeleft, wiperight, slideup, slidedown, etc' },
        duration: { type: 'number', description: 'Transition duration in seconds (default: 1)' },
        offset: { type: 'number', description: 'When to start transition (optional)' },
      },
      required: ['input1', 'input2', 'output', 'type'],
    },
  },
  {
    name: 'crossfade_videos',
    description: 'Smoothly crossfade between two videos',
    inputSchema: {
      type: 'object',
      properties: {
        input1: { type: 'string', description: 'First video path' },
        input2: { type: 'string', description: 'Second video path' },
        output: { type: 'string', description: 'Output video path' },
        duration: { type: 'number', description: 'Crossfade duration in seconds (default: 1)' },
      },
      required: ['input1', 'input2', 'output'],
    },
  },
  {
    name: 'create_picture_in_picture',
    description: 'Create picture-in-picture effect with main video and smaller overlay video',
    inputSchema: {
      type: 'object',
      properties: {
        mainVideo: { type: 'string', description: 'Main video path' },
        pipVideo: { type: 'string', description: 'Picture-in-picture video path' },
        output: { type: 'string', description: 'Output video path' },
        position: { type: 'string', description: 'PiP position: bottom-right, top-left, center, etc (default: bottom-right)' },
        width: { type: 'number', description: 'PiP width (optional)' },
        height: { type: 'number', description: 'PiP height (optional)' },
        margin: { type: 'number', description: 'Margin from edge in pixels (default: 20)' },
        borderWidth: { type: 'number', description: 'Border width (optional)' },
        borderColor: { type: 'string', description: 'Border color (optional)' },
      },
      required: ['mainVideo', 'pipVideo', 'output'],
    },
  },
  {
    name: 'create_split_screen',
    description: 'Create split screen layout with multiple videos',
    inputSchema: {
      type: 'object',
      properties: {
        videos: { type: 'array', items: { type: 'string' }, description: 'Array of video paths' },
        output: { type: 'string', description: 'Output video path' },
        layout: { type: 'string', description: 'Layout: horizontal, vertical, grid-2x2, grid-3x3, etc' },
        borderWidth: { type: 'number', description: 'Border width (optional)' },
        borderColor: { type: 'string', description: 'Border color (optional)' },
      },
      required: ['videos', 'output', 'layout'],
    },
  },
  {
    name: 'apply_blur_effect',
    description: 'Apply blur effect to video (gaussian, box, motion, radial)',
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input video path' },
        output: { type: 'string', description: 'Output video path' },
        type: { type: 'string', description: 'Blur type: gaussian, box, motion, radial (default: gaussian)' },
        strength: { type: 'number', description: 'Blur strength 0-10 (default: 5)' },
        angle: { type: 'number', description: 'For motion blur: angle in degrees (optional)' },
        startTime: { type: 'number', description: 'Start time in seconds (optional)' },
        duration: { type: 'number', description: 'Effect duration in seconds (optional)' },
      },
      required: ['input', 'output'],
    },
  },
  {
    name: 'apply_color_grade',
    description: 'Apply color grading adjustments (brightness, contrast, saturation, temperature)',
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input video path' },
        output: { type: 'string', description: 'Output video path' },
        brightness: { type: 'number', description: 'Brightness adjustment -1 to 1 (optional)' },
        contrast: { type: 'number', description: 'Contrast adjustment -1 to 1 (optional)' },
        saturation: { type: 'number', description: 'Saturation adjustment -1 to 1 (optional)' },
        gamma: { type: 'number', description: 'Gamma 0.1 to 10 (optional)' },
        hue: { type: 'number', description: 'Hue rotation in degrees (optional)' },
        temperature: { type: 'number', description: 'Temperature -100 to 100 (optional)' },
        tint: { type: 'number', description: 'Tint -100 to 100 (optional)' },
      },
      required: ['input', 'output'],
    },
  },
  {
    name: 'apply_chroma_key',
    description: 'Remove green screen (chroma key) and optionally add background',
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input video path' },
        output: { type: 'string', description: 'Output video path' },
        keyColor: { type: 'string', description: 'Color to key out (default: green)' },
        similarity: { type: 'number', description: 'Color similarity threshold 0-1 (default: 0.3)' },
        blend: { type: 'number', description: 'Edge blend 0-1 (default: 0.1)' },
        backgroundImage: { type: 'string', description: 'Background image path (optional)' },
        backgroundColor: { type: 'string', description: 'Background color (optional)' },
      },
      required: ['input', 'output'],
    },
  },
  {
    name: 'apply_ken_burns',
    description: 'Apply Ken Burns effect (zoom and pan) to still image',
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input image path' },
        output: { type: 'string', description: 'Output video path' },
        duration: { type: 'number', description: 'Video duration in seconds' },
        startZoom: { type: 'number', description: 'Starting zoom level (default: 1)' },
        endZoom: { type: 'number', description: 'Ending zoom level (default: 1.2)' },
        startX: { type: 'number', description: 'Starting X position (optional)' },
        startY: { type: 'number', description: 'Starting Y position (optional)' },
        endX: { type: 'number', description: 'Ending X position (optional)' },
        endY: { type: 'number', description: 'Ending Y position (optional)' },
        fps: { type: 'number', description: 'Output FPS (default: 30)' },
      },
      required: ['input', 'output', 'duration'],
    },
  },
  {
    name: 'generate_flowchart',
    description: 'Generate flowchart diagram from data',
    inputSchema: {
      type: 'object',
      properties: {
        output: { type: 'string', description: 'Output SVG file path' },
        nodes: { type: 'array', description: 'Array of nodes with id, label, type' },
        edges: { type: 'array', description: 'Array of edges with from, to, label' },
        layout: { type: 'string', description: 'Layout: vertical or horizontal (default: vertical)' },
      },
      required: ['output', 'nodes', 'edges'],
    },
  },
  {
    name: 'generate_timeline',
    description: 'Generate timeline diagram',
    inputSchema: {
      type: 'object',
      properties: {
        output: { type: 'string', description: 'Output SVG file path' },
        events: { type: 'array', description: 'Array of events with id, label, date' },
        orientation: { type: 'string', description: 'Orientation: horizontal or vertical (default: horizontal)' },
        showDates: { type: 'boolean', description: 'Show dates (default: true)' },
      },
      required: ['output', 'events'],
    },
  },
  {
    name: 'generate_org_chart',
    description: 'Generate organization chart diagram',
    inputSchema: {
      type: 'object',
      properties: {
        output: { type: 'string', description: 'Output SVG file path' },
        nodes: { type: 'array', description: 'Array of nodes with id, name, title, parentId' },
      },
      required: ['output', 'nodes'],
    },
  },
  {
    name: 'apply_vignette',
    description: 'Apply vignette effect (darkened edges)',
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input video path' },
        output: { type: 'string', description: 'Output video path' },
        intensity: { type: 'number', description: 'Vignette intensity 0-1 (default: 0.5)' },
      },
      required: ['input', 'output'],
    },
  },
  {
    name: 'apply_sharpen',
    description: 'Apply sharpen effect to video',
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input video path' },
        output: { type: 'string', description: 'Output video path' },
        strength: { type: 'number', description: 'Sharpen strength 0-10 (default: 5)' },
      },
      required: ['input', 'output'],
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

      case 'add_text_overlay': {
        const result = await textOps.addTextOverlay({
          input: args.input as string,
          output: args.output as string,
          text: args.text as string,
          position: args.position as any,
          x: args.x as number | undefined,
          y: args.y as number | undefined,
          startTime: args.startTime as number | undefined,
          endTime: args.endTime as number | undefined,
          duration: args.duration as number | undefined,
          fontSize: args.fontSize as number | undefined,
          fontColor: args.fontColor as string | undefined,
          fontFile: args.fontFile as string | undefined,
          borderWidth: args.borderWidth as number | undefined,
          borderColor: args.borderColor as string | undefined,
          shadowX: args.shadowX as number | undefined,
          shadowY: args.shadowY as number | undefined,
          shadowColor: args.shadowColor as string | undefined,
          box: args.box as boolean | undefined,
          boxColor: args.boxColor as string | undefined,
          boxOpacity: args.boxOpacity as number | undefined,
          fadeIn: args.fadeIn as number | undefined,
          fadeOut: args.fadeOut as number | undefined,
        });

        const timingInfo = args.startTime !== undefined
          ? `\nTiming: ${args.startTime}s - ${args.endTime || (Number(args.startTime) + (Number(args.duration) || 0))}s`
          : '';

        return {
          content: [
            {
              type: 'text',
              text: `Text overlay added successfully!\n\nOutput: ${result}\nText: "${args.text}"\nPosition: ${args.position || 'custom'}${timingInfo}`,
            },
          ],
        };
      }

      case 'add_animated_text': {
        const result = await textOps.addAnimatedText({
          input: args.input as string,
          output: args.output as string,
          text: args.text as string,
          animation: args.animation as any,
          animationDuration: args.animationDuration as number | undefined,
          position: args.position as any,
          startTime: args.startTime as number | undefined,
          endTime: args.endTime as number | undefined,
          duration: args.duration as number | undefined,
          fontSize: args.fontSize as number | undefined,
          fontColor: args.fontColor as string | undefined,
          fontFile: args.fontFile as string | undefined,
          borderWidth: args.borderWidth as number | undefined,
          borderColor: args.borderColor as string | undefined,
          box: args.box as boolean | undefined,
          boxColor: args.boxColor as string | undefined,
          boxOpacity: args.boxOpacity as number | undefined,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Animated text added successfully!\n\nOutput: ${result}\nAnimation: ${args.animation}\nText: "${args.text}"`,
            },
          ],
        };
      }

      case 'burn_subtitles': {
        const result = await textOps.burnSubtitles({
          input: args.input as string,
          output: args.output as string,
          subtitleFile: args.subtitleFile as string,
          fontSize: args.fontSize as number | undefined,
          fontColor: args.fontColor as string | undefined,
          fontFile: args.fontFile as string | undefined,
          borderWidth: args.borderWidth as number | undefined,
          borderColor: args.borderColor as string | undefined,
          box: args.box as boolean | undefined,
          boxColor: args.boxColor as string | undefined,
          boxOpacity: args.boxOpacity as number | undefined,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Subtitles burned successfully!\n\nOutput: ${result}\nSubtitle file: ${args.subtitleFile}`,
            },
          ],
        };
      }

      case 'create_timeline': {
        const name = args.name as string;
        const baseFile = args.baseFile as string | undefined;

        const timeline = await timelineManager.createTimeline(name, baseFile);

        return {
          content: [
            {
              type: 'text',
              text: `Timeline created successfully!\n\nTimeline ID: ${timeline.id}\nName: ${timeline.name}${baseFile ? `\nBase file: ${baseFile}` : ''}\n\nUse add_to_timeline to record operations and enable undo/redo.`,
            },
          ],
        };
      }

      case 'add_to_timeline': {
        const timelineId = args.timelineId as string;
        const operation = args.operation as string;
        const description = args.description as string;
        const input = args.input as string | string[];
        const output = args.output as string;
        const parameters = (args.parameters as Record<string, any>) || {};

        const timeline = await timelineManager.addOperation(
          timelineId,
          operation,
          description,
          input,
          output,
          parameters
        );

        return {
          content: [
            {
              type: 'text',
              text: `Operation added to timeline!\n\nOperation: ${operation}\nDescription: ${description}\nOutput: ${output}\n\nTimeline position: ${timeline.currentIndex + 1}/${timeline.operations.length}\n\nUse undo_operation to revert this change.`,
            },
          ],
        };
      }

      case 'undo_operation': {
        const timelineId = args.timelineId as string;

        const { timeline, previousOutput } = await timelineManager.undo(timelineId);

        if (!previousOutput) {
          return {
            content: [
              {
                type: 'text',
                text: 'Already at the beginning of timeline. Cannot undo further.',
              },
            ],
          };
        }

        const currentOp = timeline.currentIndex >= 0
          ? timeline.operations[timeline.currentIndex]
          : null;

        return {
          content: [
            {
              type: 'text',
              text: `Undo successful!\n\n${currentOp ? `Current state: ${currentOp.description}\nCurrent file: ${currentOp.output}` : `Reverted to base file: ${previousOutput}`}\n\nPosition: ${timeline.currentIndex + 1}/${timeline.operations.length}\n\n${timeline.currentIndex < timeline.operations.length - 1 ? 'Use redo_operation to move forward.' : ''}`,
            },
          ],
        };
      }

      case 'redo_operation': {
        const timelineId = args.timelineId as string;

        const { timeline, nextOutput } = await timelineManager.redo(timelineId);

        if (!nextOutput) {
          return {
            content: [
              {
                type: 'text',
                text: 'Already at the end of timeline. Cannot redo further.',
              },
            ],
          };
        }

        const currentOp = timeline.operations[timeline.currentIndex];

        return {
          content: [
            {
              type: 'text',
              text: `Redo successful!\n\nCurrent state: ${currentOp.description}\nCurrent file: ${currentOp.output}\n\nPosition: ${timeline.currentIndex + 1}/${timeline.operations.length}`,
            },
          ],
        };
      }

      case 'view_timeline': {
        const timelineId = args.timelineId as string;

        const history = await timelineManager.getTimelineHistory(timelineId);

        return {
          content: [
            {
              type: 'text',
              text: history,
            },
          ],
        };
      }

      case 'jump_to_timeline_point': {
        const timelineId = args.timelineId as string;
        const index = args.index as number;

        const { timeline, output } = await timelineManager.jumpTo(timelineId, index);

        const targetOp = index >= 0 ? timeline.operations[index] : null;

        return {
          content: [
            {
              type: 'text',
              text: `Jumped to timeline point ${index + 1}!\n\n${targetOp ? `State: ${targetOp.description}\nFile: ${targetOp.output}` : `Jumped to base file: ${output}`}\n\nPosition: ${timeline.currentIndex + 1}/${timeline.operations.length}`,
            },
          ],
        };
      }

      case 'list_timelines': {
        const timelines = await timelineManager.listTimelines();

        if (timelines.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No timelines found.\n\nCreate one with: create_timeline',
              },
            ],
          };
        }

        const lines = ['EDITING TIMELINES', '='.repeat(80), ''];
        for (const timeline of timelines) {
          lines.push(`${timeline.name} (${timeline.id})`);
          lines.push(`  Created: ${timeline.created.toLocaleString()}`);
          lines.push(`  Modified: ${timeline.modified.toLocaleString()}`);
          lines.push(`  Operations: ${timeline.operationCount}`);
          lines.push(`  Position: ${timeline.currentIndex + 1}/${timeline.operationCount}`);
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

      case 'get_timeline_stats': {
        const timelineId = args.timelineId as string;

        const stats = await timelineManager.getStatistics(timelineId);

        const lines = [
          'TIMELINE STATISTICS',
          '='.repeat(80),
          '',
          `Total operations: ${stats.totalOperations}`,
          `Completed: ${stats.completedOperations}`,
          `Failed: ${stats.failedOperations}`,
          '',
          `Total duration: ${(stats.totalDuration / 1000).toFixed(2)}s`,
          `Average duration: ${(stats.averageDuration / 1000).toFixed(2)}s`,
          '',
          'Operations by type:',
        ];

        for (const [type, count] of Object.entries(stats.operationsByType)) {
          lines.push(`  ${type}: ${count}`);
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

      case 'analyze_video_content': {
        if (!configManager.get().openaiApiKey) {
          return {
            content: [
              {
                type: 'text',
                text: 'Vision analysis requires OpenAI API key. Set openaiApiKey in config.',
              },
            ],
            isError: true,
          };
        }

        const input = args.input as string;
        const interval = args.interval as number | undefined;
        const count = args.count as number | undefined;
        const timestamps = args.timestamps as number[] | undefined;

        const analysis = await visionAnalyzer.analyzeVideo(input, {
          interval,
          count,
          timestamps,
        });

        const lines = [
          'VIDEO CONTENT ANALYSIS',
          '='.repeat(80),
          '',
          `Video: ${analysis.videoPath}`,
          `Duration: ${analysis.duration.toFixed(1)}s`,
          `Frames analyzed: ${analysis.frames.length}`,
          '',
          'SUMMARY',
          '-'.repeat(80),
          analysis.summary,
          '',
          'FRAME DESCRIPTIONS',
          '-'.repeat(80),
        ];

        for (const frame of analysis.frames) {
          lines.push(`\n[${frame.timestamp.toFixed(1)}s] Frame ${frame.frameNumber}:`);
          lines.push(frame.description);
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

      case 'search_visual_content': {
        if (!configManager.get().openaiApiKey) {
          return {
            content: [
              {
                type: 'text',
                text: 'Vision analysis requires OpenAI API key. Set openaiApiKey in config.',
              },
            ],
            isError: true,
          };
        }

        const input = args.input as string;
        const query = args.query as string;
        const interval = args.interval as number | undefined;

        const result = await visionAnalyzer.searchVisualContent(input, query, {
          interval,
        });

        if (!result.found) {
          return {
            content: [
              {
                type: 'text',
                text: `No matches found for: "${query}"`,
              },
            ],
          };
        }

        const lines = [
          `SEARCH RESULTS FOR: "${query}"`,
          '='.repeat(80),
          '',
          `Matches found: ${result.matches.length}`,
          '',
          'INDIVIDUAL MATCHES',
          '-'.repeat(80),
        ];

        for (const match of result.matches) {
          lines.push(`\n[${match.timestamp.toFixed(1)}s] Confidence: ${match.confidence}%`);
          lines.push(match.description);
        }

        if (result.segments && result.segments.length > 0) {
          lines.push('');
          lines.push('TIME SEGMENTS WHERE CONTENT APPEARS');
          lines.push('-'.repeat(80));
          for (const segment of result.segments) {
            lines.push(`${segment.start.toFixed(1)}s - ${segment.end.toFixed(1)}s`);
          }
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

      case 'describe_scene': {
        if (!configManager.get().openaiApiKey) {
          return {
            content: [
              {
                type: 'text',
                text: 'Vision analysis requires OpenAI API key. Set openaiApiKey in config.',
              },
            ],
            isError: true,
          };
        }

        const input = args.input as string;
        const timestamp = args.timestamp as number;
        const detailLevel = (args.detailLevel as 'brief' | 'detailed' | 'comprehensive') || 'detailed';

        const scene = await visionAnalyzer.describeScene(input, timestamp, detailLevel);

        const lines = [
          `SCENE DESCRIPTION AT ${timestamp.toFixed(1)}s`,
          '='.repeat(80),
          '',
          scene.description,
          '',
          'OBJECTS DETECTED',
          '-'.repeat(80),
          scene.objects.length > 0 ? scene.objects.join(', ') : 'None detected',
          '',
          'ACTIONS/ACTIVITIES',
          '-'.repeat(80),
          scene.actions.length > 0 ? scene.actions.join(', ') : 'None detected',
          '',
          'SETTING/ENVIRONMENT',
          '-'.repeat(80),
          scene.setting || 'Not determined',
        ];

        return {
          content: [
            {
              type: 'text',
              text: lines.join('\n'),
            },
          ],
        };
      }

      case 'find_objects_in_video': {
        if (!configManager.get().openaiApiKey) {
          return {
            content: [
              {
                type: 'text',
                text: 'Vision analysis requires OpenAI API key. Set openaiApiKey in config.',
              },
            ],
            isError: true,
          };
        }

        const input = args.input as string;
        const targetDescription = args.targetDescription as string;
        const interval = args.interval as number | undefined;

        const result = await visionAnalyzer.findAppearances(input, targetDescription, {
          interval,
        });

        if (result.appearances.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `"${targetDescription}" not found in video`,
              },
            ],
          };
        }

        const lines = [
          `TRACKING: "${targetDescription}"`,
          '='.repeat(80),
          '',
          `Total appearances: ${result.appearances.length}`,
          `Total duration on screen: ${result.totalDuration.toFixed(1)}s`,
          '',
          'APPEARANCE SEGMENTS',
          '-'.repeat(80),
        ];

        for (let i = 0; i < result.appearances.length; i++) {
          const app = result.appearances[i];
          const duration = app.end - app.start;
          lines.push(`\n${i + 1}. ${app.start.toFixed(1)}s - ${app.end.toFixed(1)}s (${duration.toFixed(1)}s)`);
          lines.push(`   ${app.description}`);
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

      case 'compare_video_frames': {
        if (!configManager.get().openaiApiKey) {
          return {
            content: [
              {
                type: 'text',
                text: 'Vision analysis requires OpenAI API key. Set openaiApiKey in config.',
              },
            ],
            isError: true,
          };
        }

        const input = args.input as string;
        const timestamp1 = args.timestamp1 as number;
        const timestamp2 = args.timestamp2 as number;

        const comparison = await visionAnalyzer.compareFrames(input, timestamp1, timestamp2);

        const lines = [
          `FRAME COMPARISON: ${timestamp1.toFixed(1)}s vs ${timestamp2.toFixed(1)}s`,
          '='.repeat(80),
          '',
          `Change detected: ${comparison.changeDetected ? 'YES' : 'NO'}`,
          '',
          'WHAT CHANGED',
          '-'.repeat(80),
          comparison.changeDescription,
          '',
          'FRAME DESCRIPTIONS',
          '-'.repeat(80),
          comparison.differences,
        ];

        return {
          content: [
            {
              type: 'text',
              text: lines.join('\n'),
            },
          ],
        };
      }

      case 'add_image_overlay': {
        const options = {
          input: args.input as string,
          image: args.image as string,
          output: args.output as string,
          position: args.x !== undefined && args.y !== undefined ? { x: args.x as number, y: args.y as number } : undefined,
          anchor: args.anchor as any,
          size: args.width !== undefined && args.height !== undefined ? { width: args.width as number, height: args.height as number } : undefined,
          rotation: args.rotation as number | undefined,
          opacity: args.opacity as number | undefined,
          startTime: args.startTime as number | undefined,
          duration: args.duration as number | undefined,
        };
        const result = await visualElements.addImageOverlay(options);
        return { content: [{ type: 'text', text: `Image overlay added successfully: ${result}` }] };
      }

      case 'add_shape': {
        const options = {
          input: args.input as string,
          output: args.output as string,
          type: args.type as any,
          position: { x: args.x as number, y: args.y as number },
          size: { width: args.width as number, height: args.height as number },
          color: args.color as string,
          thickness: args.thickness as number | undefined,
          filled: args.filled as boolean | undefined,
          opacity: args.opacity as number | undefined,
        };
        const result = await visualElements.addShape(options);
        return { content: [{ type: 'text', text: `Shape added successfully: ${result}` }] };
      }

      case 'add_transition': {
        const options = {
          input1: args.input1 as string,
          input2: args.input2 as string,
          output: args.output as string,
          type: args.type as any,
          duration: args.duration as number | undefined,
          offset: args.offset as number | undefined,
        };
        const result = await transitionEffects.addTransition(options);
        return { content: [{ type: 'text', text: `Transition added successfully: ${result}` }] };
      }

      case 'crossfade_videos': {
        const options = {
          input1: args.input1 as string,
          input2: args.input2 as string,
          output: args.output as string,
          duration: args.duration as number | undefined,
        };
        const result = await transitionEffects.crossfade(options);
        return { content: [{ type: 'text', text: `Crossfade applied successfully: ${result}` }] };
      }

      case 'create_picture_in_picture': {
        const options = {
          mainVideo: args.mainVideo as string,
          pipVideo: args.pipVideo as string,
          output: args.output as string,
          position: args.position as any,
          size: args.width !== undefined && args.height !== undefined ? { width: args.width as number, height: args.height as number } : undefined,
          margin: args.margin as number | undefined,
          borderWidth: args.borderWidth as number | undefined,
          borderColor: args.borderColor as string | undefined,
        };
        const result = await compositeOps.createPictureInPicture(options);
        return { content: [{ type: 'text', text: `Picture-in-picture created successfully: ${result}` }] };
      }

      case 'create_split_screen': {
        const options = {
          videos: args.videos as string[],
          output: args.output as string,
          layout: args.layout as any,
          borderWidth: args.borderWidth as number | undefined,
          borderColor: args.borderColor as string | undefined,
        };
        const result = await compositeOps.createSplitScreen(options);
        return { content: [{ type: 'text', text: `Split screen created successfully: ${result}` }] };
      }

      case 'apply_blur_effect': {
        const options = {
          input: args.input as string,
          output: args.output as string,
          type: args.type as any,
          strength: args.strength as number | undefined,
          angle: args.angle as number | undefined,
          startTime: args.startTime as number | undefined,
          duration: args.duration as number | undefined,
        };
        const result = await visualEffects.applyBlur(options);
        return { content: [{ type: 'text', text: `Blur effect applied successfully: ${result}` }] };
      }

      case 'apply_color_grade': {
        const options = {
          input: args.input as string,
          output: args.output as string,
          brightness: args.brightness as number | undefined,
          contrast: args.contrast as number | undefined,
          saturation: args.saturation as number | undefined,
          gamma: args.gamma as number | undefined,
          hue: args.hue as number | undefined,
          temperature: args.temperature as number | undefined,
          tint: args.tint as number | undefined,
        };
        const result = await visualEffects.applyColorGrade(options);
        return { content: [{ type: 'text', text: `Color grading applied successfully: ${result}` }] };
      }

      case 'apply_chroma_key': {
        const options = {
          input: args.input as string,
          output: args.output as string,
          keyColor: args.keyColor as string | undefined,
          similarity: args.similarity as number | undefined,
          blend: args.blend as number | undefined,
          backgroundImage: args.backgroundImage as string | undefined,
          backgroundColor: args.backgroundColor as string | undefined,
        };
        const result = await visualEffects.applyChromaKey(options);
        return { content: [{ type: 'text', text: `Chroma key applied successfully: ${result}` }] };
      }

      case 'apply_ken_burns': {
        const options = {
          input: args.input as string,
          output: args.output as string,
          duration: args.duration as number,
          startZoom: args.startZoom as number | undefined,
          endZoom: args.endZoom as number | undefined,
          startPosition: args.startX !== undefined && args.startY !== undefined ? { x: args.startX as number, y: args.startY as number } : undefined,
          endPosition: args.endX !== undefined && args.endY !== undefined ? { x: args.endX as number, y: args.endY as number } : undefined,
          fps: args.fps as number | undefined,
        };
        const result = await visualEffects.applyKenBurns(options);
        return { content: [{ type: 'text', text: `Ken Burns effect applied successfully: ${result}` }] };
      }

      case 'generate_flowchart': {
        const options = {
          output: args.output as string,
          nodes: args.nodes as any[],
          edges: args.edges as any[],
          layout: args.layout as any,
        };
        const result = await diagramGenerator.generateFlowchart(options);
        return { content: [{ type: 'text', text: `Flowchart generated successfully: ${result}` }] };
      }

      case 'generate_timeline': {
        const options = {
          output: args.output as string,
          events: args.events as any[],
          orientation: args.orientation as any,
          showDates: args.showDates as boolean | undefined,
        };
        const result = await diagramGenerator.generateTimeline(options);
        return { content: [{ type: 'text', text: `Timeline generated successfully: ${result}` }] };
      }

      case 'generate_org_chart': {
        const options = {
          output: args.output as string,
          nodes: args.nodes as any[],
        };
        const result = await diagramGenerator.generateOrgChart(options);
        return { content: [{ type: 'text', text: `Organization chart generated successfully: ${result}` }] };
      }

      case 'apply_vignette': {
        const options = {
          input: args.input as string,
          output: args.output as string,
          intensity: args.intensity as number | undefined,
        };
        const result = await visualEffects.applyVignette(options);
        return { content: [{ type: 'text', text: `Vignette applied successfully: ${result}` }] };
      }

      case 'apply_sharpen': {
        const options = {
          input: args.input as string,
          output: args.output as string,
          strength: args.strength as number | undefined,
        };
        const result = await visualEffects.applySharpen(options);
        return { content: [{ type: 'text', text: `Sharpen effect applied successfully: ${result}` }] };
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
