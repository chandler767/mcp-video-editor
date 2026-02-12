import ffmpeg from 'fluent-ffmpeg';
import { FFmpegManager } from './ffmpeg-utils.js';
import { VideoConfig } from './config.js';
import path from 'path';
import { promisify } from 'util';
import fs from 'fs/promises';

export interface VideoInfo {
  format: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  videoCodec: string;
  audioCodec?: string;
  bitrate: number;
  size: number;
}

export interface TrimOptions {
  input: string;
  output: string;
  startTime: string | number;
  endTime?: string | number;
  duration?: string | number;
}

export interface ConcatenateOptions {
  inputs: string[];
  output: string;
}

export interface ConvertOptions {
  input: string;
  output: string;
  format?: string;
  codec?: string;
  quality?: string;
  preset?: string;
  videoBitrate?: string;
  audioBitrate?: string;
}

export interface ResizeOptions {
  input: string;
  output: string;
  width?: number;
  height?: number;
  scale?: string;
  maintainAspectRatio?: boolean;
}

export interface ExtractFramesOptions {
  input: string;
  output: string;
  timestamps?: number[];
  fps?: number;
  startTime?: number;
  duration?: number;
}

export interface SpeedOptions {
  input: string;
  output: string;
  speed: number;
  matchInputQuality?: boolean;
}

export interface TranscodeForWebOptions {
  input: string;
  output: string;
  quality?: 'high' | 'medium' | 'low';
  maxResolution?: '4k' | '1080p' | '720p' | '480p';
}

export interface TimeSegment {
  start: number;
  end: number;
}

export interface RemoveSegmentsOptions {
  input: string;
  output: string;
  segments: TimeSegment[];
}

export interface KeepSegmentsOptions {
  input: string;
  output: string;
  segments: TimeSegment[];
}

export class VideoOperations {
  constructor(
    private ffmpegManager: FFmpegManager,
    private config: VideoConfig
  ) {}

  /**
   * Validate that output path is different from input path(s) to prevent overwriting source files
   */
  private validateOutputPath(output: string, ...inputs: string[]): void {
    const outputResolved = path.resolve(output);
    for (const input of inputs) {
      const inputResolved = path.resolve(input);
      if (outputResolved === inputResolved) {
        throw new Error(`Output path cannot be the same as input path: ${output}. Source files must remain untouched.`);
      }
    }
  }

  /**
   * Get quality settings that match the input video
   */
  private async getMatchingQualitySettings(inputPath: string): Promise<{
    codec: string;
    audioCodec: string;
    quality: string;
    audioBitrate: string;
  }> {
    const info = await this.getVideoInfo(inputPath);

    // Map codec names to FFmpeg encoder names
    const codecMap: Record<string, string> = {
      'h264': 'libx264',
      'hevc': 'libx265',
      'vp9': 'libvpx-vp9',
      'av1': 'libaom-av1',
    };

    const audioCodecMap: Record<string, string> = {
      'aac': 'aac',
      'mp3': 'libmp3lame',
      'opus': 'libopus',
      'vorbis': 'libvorbis',
    };

    return {
      codec: codecMap[info.videoCodec] || 'libx264',
      audioCodec: info.audioCodec ? (audioCodecMap[info.audioCodec] || 'aac') : 'aac',
      quality: '18', // High quality CRF that maintains near-original quality
      audioBitrate: '192k',
    };
  }

  /**
   * Get Final Cut Pro style defaults for modern high-quality output
   */
  private getFinalCutProDefaults(resolution?: '4k' | '2k' | '1080p'): {
    width: number;
    height: number;
    codec: string;
    audioCodec: string;
    quality: string;
    audioBitrate: string;
    preset: string;
  } {
    const resolutions = {
      '4k': { width: 3840, height: 2160 },
      '2k': { width: 2560, height: 1440 },
      '1080p': { width: 1920, height: 1080 },
    };

    const res = resolutions[resolution || '1080p'];

    return {
      width: res.width,
      height: res.height,
      codec: 'libx264', // H.264 for maximum compatibility
      audioCodec: 'aac', // AAC for web compatibility
      quality: '18', // High quality
      audioBitrate: '256k', // High quality audio
      preset: 'slow', // Better compression
    };
  }

  async getVideoInfo(filePath: string): Promise<VideoInfo> {
    return new Promise((resolve, reject) => {
      this.ffmpegManager.createCommand(filePath)
        .ffprobe((err, data) => {
          if (err) {
            reject(err);
            return;
          }

          const videoStream = data.streams.find(s => s.codec_type === 'video');
          const audioStream = data.streams.find(s => s.codec_type === 'audio');

          if (!videoStream) {
            reject(new Error('No video stream found'));
            return;
          }

          const stats = {
            format: data.format.format_name || 'unknown',
            duration: data.format.duration || 0,
            width: videoStream.width || 0,
            height: videoStream.height || 0,
            fps: eval(videoStream.r_frame_rate || '0') || 0,
            videoCodec: videoStream.codec_name || 'unknown',
            audioCodec: audioStream?.codec_name,
            bitrate: data.format.bit_rate || 0,
            size: data.format.size || 0
          };

          resolve(stats);
        });
    });
  }

  async trim(options: TrimOptions): Promise<string> {
    this.validateOutputPath(options.output, options.input);

    return new Promise((resolve, reject) => {
      const cmd = this.ffmpegManager.createCommand(options.input)
        .setStartTime(options.startTime);

      if (options.endTime) {
        cmd.setDuration(options.endTime);
      } else if (options.duration) {
        cmd.setDuration(options.duration);
      }

      cmd
        .output(options.output)
        .videoCodec('copy') // Copy codec to maintain quality
        .audioCodec('copy') // Copy audio to maintain quality
        .on('end', () => resolve(options.output))
        .on('error', reject)
        .run();
    });
  }

  async concatenate(options: ConcatenateOptions): Promise<string> {
    this.validateOutputPath(options.output, ...options.inputs);

    // Create a temporary file list for ffmpeg concat
    const fileListPath = path.join(
      this.config.workingDirectory || process.cwd(),
      `concat-list-${Date.now()}.txt`
    );

    try {
      const fileList = options.inputs.map(f => `file '${path.resolve(f)}'`).join('\n');
      await fs.writeFile(fileListPath, fileList, 'utf-8');

      return new Promise((resolve, reject) => {
        this.ffmpegManager.createCommand()
          .input(fileListPath)
          .inputOptions(['-f concat', '-safe 0'])
          .videoCodec('copy')
          .audioCodec('copy')
          .output(options.output)
          .on('end', async () => {
            await fs.unlink(fileListPath);
            resolve(options.output);
          })
          .on('error', async (err) => {
            await fs.unlink(fileListPath).catch(() => {});
            reject(err);
          })
          .run();
      });
    } catch (error) {
      await fs.unlink(fileListPath).catch(() => {});
      throw error;
    }
  }

  async extractAudio(input: string, output: string): Promise<string> {
    this.validateOutputPath(output, input);

    return new Promise((resolve, reject) => {
      // Auto-detect codec based on output extension
      const ext = path.extname(output).toLowerCase();
      const cmd = this.ffmpegManager.createCommand(input);

      // Configure based on output format
      cmd.noVideo();

      if (ext === '.mp3') {
        cmd.format('mp3');
        cmd.audioCodec('libmp3lame');
        cmd.audioBitrate(this.config.defaultAudioBitrate || '192k');
      } else if (ext === '.wav') {
        cmd.format('wav');
        cmd.audioCodec('pcm_s16le');
      } else if (ext === '.aac') {
        cmd.audioCodec('aac');
        cmd.audioBitrate(this.config.defaultAudioBitrate || '192k');
      } else if (ext === '.m4a') {
        cmd.format('ipod');
        cmd.audioCodec('aac');
        cmd.audioBitrate(this.config.defaultAudioBitrate || '192k');
      } else if (ext === '.opus') {
        cmd.audioCodec('libopus');
        cmd.audioBitrate('128k');
      } else if (ext === '.ogg') {
        cmd.audioCodec('libvorbis');
        cmd.audioBitrate(this.config.defaultAudioBitrate || '192k');
      } else {
        // Default to WAV for maximum compatibility
        cmd.format('wav');
        cmd.audioCodec('pcm_s16le');
      }

      cmd
        .output(output)
        .on('end', () => resolve(output))
        .on('error', (err) => reject(err))
        .run();
    });
  }

  async convert(options: ConvertOptions): Promise<string> {
    this.validateOutputPath(options.output, options.input);

    return new Promise(async (resolve, reject) => {
      try {
        const cmd = this.ffmpegManager.createCommand(options.input);

        // If no codec specified, match input quality
        let codec = options.codec || this.config.defaultCodec;
        let quality = options.quality || this.config.defaultQuality;
        let audioBitrate = options.audioBitrate || this.config.defaultAudioBitrate;

        if (!codec || !quality) {
          const matchSettings = await this.getMatchingQualitySettings(options.input);
          codec = codec || matchSettings.codec;
          quality = quality || matchSettings.quality;
          audioBitrate = audioBitrate || matchSettings.audioBitrate;
        }

        if (codec) {
          cmd.videoCodec(codec);
        }

        if (quality) {
          cmd.outputOptions([`-crf ${quality}`]);
        }

        if (options.preset || this.config.defaultPreset) {
          cmd.outputOptions([`-preset ${options.preset || this.config.defaultPreset}`]);
        }

        if (options.videoBitrate) {
          cmd.videoBitrate(options.videoBitrate);
        }

        if (audioBitrate) {
          cmd.audioBitrate(audioBitrate);
        }

        cmd
          .output(options.output)
          .on('end', () => resolve(options.output))
          .on('error', reject)
          .run();
      } catch (error) {
        reject(error);
      }
    });
  }

  async resize(options: ResizeOptions): Promise<string> {
    this.validateOutputPath(options.output, options.input);

    return new Promise((resolve, reject) => {
      const cmd = this.ffmpegManager.createCommand(options.input);

      let scaleFilter: string;
      if (options.scale) {
        scaleFilter = options.scale;
      } else if (options.width && options.height) {
        scaleFilter = `${options.width}:${options.height}`;
      } else if (options.width) {
        scaleFilter = `${options.width}:${options.maintainAspectRatio !== false ? '-2' : options.height || '-2'}`;
      } else if (options.height) {
        scaleFilter = `${options.maintainAspectRatio !== false ? '-2' : options.width || '-2'}:${options.height}`;
      } else {
        reject(new Error('Must specify width, height, or scale'));
        return;
      }

      cmd
        .videoFilters(`scale=${scaleFilter}`)
        .output(options.output)
        .on('end', () => resolve(options.output))
        .on('error', reject)
        .run();
    });
  }

  async extractFrames(options: ExtractFramesOptions): Promise<string> {
    // Note: For frames, we validate the first output file only (pattern-based outputs)
    const firstOutput = options.output.replace('%d', '1');
    this.validateOutputPath(firstOutput, options.input);

    if (options.timestamps && options.timestamps.length > 0) {
      // Extract specific frames
      const promises = options.timestamps.map((timestamp, index) => {
        return new Promise<void>((resolve, reject) => {
          const outputPath = options.output.replace('%d', String(index + 1));
          this.ffmpegManager.createCommand(options.input)
            .seekInput(timestamp)
            .frames(1)
            .output(outputPath)
            .on('end', () => resolve())
            .on('error', reject)
            .run();
        });
      });

      await Promise.all(promises);
      return options.output;
    } else {
      // Extract frames at FPS or range
      return new Promise((resolve, reject) => {
        const cmd = this.ffmpegManager.createCommand(options.input);

        if (options.startTime !== undefined) {
          cmd.seekInput(options.startTime);
        }

        if (options.duration !== undefined) {
          cmd.duration(options.duration);
        }

        if (options.fps) {
          cmd.fps(options.fps);
        }

        cmd
          .output(options.output)
          .on('end', () => resolve(options.output))
          .on('error', reject)
          .run();
      });
    }
  }

  async adjustSpeed(options: SpeedOptions): Promise<string> {
    this.validateOutputPath(options.output, options.input);

    return new Promise(async (resolve, reject) => {
      try {
        const videoSpeed = options.speed;
        const audioSpeed = options.speed;

        // Video PTS filter and audio tempo filter
        const videoFilter = `setpts=${1 / videoSpeed}*PTS`;
        const audioFilter = `atempo=${audioSpeed > 2 ? 2 : audioSpeed < 0.5 ? 0.5 : audioSpeed}`;

        const cmd = this.ffmpegManager.createCommand(options.input)
          .videoFilters(videoFilter)
          .audioFilters(audioFilter);

        // Match input quality if requested (default behavior)
        if (options.matchInputQuality !== false) {
          const matchSettings = await this.getMatchingQualitySettings(options.input);
          cmd.videoCodec(matchSettings.codec);
          cmd.outputOptions([`-crf ${matchSettings.quality}`]);
          cmd.audioBitrate(matchSettings.audioBitrate);
        }

        cmd
          .output(options.output)
          .on('end', () => resolve(options.output))
          .on('error', reject)
          .run();
      } catch (error) {
        reject(error);
      }
    });
  }

  async keepSegments(options: KeepSegmentsOptions): Promise<string> {
    this.validateOutputPath(options.output, options.input);

    // Sort segments by start time
    const sortedSegments = options.segments.sort((a, b) => a.start - b.start);

    if (sortedSegments.length === 0) {
      throw new Error('No segments specified to keep');
    }

    // Create temporary files for each segment
    const tempDir = path.join(
      this.config.workingDirectory || process.cwd(),
      `temp-segments-${Date.now()}`
    );
    await fs.mkdir(tempDir, { recursive: true });

    try {
      const segmentFiles: string[] = [];

      // Extract each segment
      for (let i = 0; i < sortedSegments.length; i++) {
        const segment = sortedSegments[i];
        const segmentFile = path.join(tempDir, `segment-${i}.mp4`);

        await this.trim({
          input: options.input,
          output: segmentFile,
          startTime: segment.start,
          endTime: segment.end,
        });

        segmentFiles.push(segmentFile);
      }

      // Concatenate all segments
      await this.concatenate({
        inputs: segmentFiles,
        output: options.output,
      });

      // Clean up temp files
      await fs.rm(tempDir, { recursive: true, force: true });

      return options.output;
    } catch (error) {
      // Clean up on error
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
  }

  async removeSegments(options: RemoveSegmentsOptions): Promise<string> {
    this.validateOutputPath(options.output, options.input);

    // Get video duration
    const info = await this.getVideoInfo(options.input);

    // Invert the segments to get the parts to keep
    const segmentsToRemove = options.segments.sort((a, b) => a.start - b.start);
    const segmentsToKeep: TimeSegment[] = [];

    // Add segment before first removal
    if (segmentsToRemove[0].start > 0) {
      segmentsToKeep.push({ start: 0, end: segmentsToRemove[0].start });
    }

    // Add segments between removals
    for (let i = 0; i < segmentsToRemove.length - 1; i++) {
      segmentsToKeep.push({
        start: segmentsToRemove[i].end,
        end: segmentsToRemove[i + 1].start,
      });
    }

    // Add segment after last removal
    const lastRemoval = segmentsToRemove[segmentsToRemove.length - 1];
    if (lastRemoval.end < info.duration) {
      segmentsToKeep.push({ start: lastRemoval.end, end: info.duration });
    }

    if (segmentsToKeep.length === 0) {
      throw new Error('All video content would be removed');
    }

    // Use keepSegments to keep the inverted segments
    return this.keepSegments({
      input: options.input,
      output: options.output,
      segments: segmentsToKeep,
    });
  }

  /**
   * Transcode video for web sharing with optimized file size and quality
   * Uses modern codecs and smart compression for portability
   */
  async transcodeForWeb(options: TranscodeForWebOptions): Promise<string> {
    this.validateOutputPath(options.output, options.input);

    const quality = options.quality || 'medium';
    const info = await this.getVideoInfo(options.input);

    // Quality settings (CRF values - lower is better quality)
    const qualitySettings = {
      high: { crf: '20', audioBitrate: '192k' },
      medium: { crf: '25', audioBitrate: '128k' },
      low: { crf: '30', audioBitrate: '96k' },
    };

    const settings = qualitySettings[quality];

    // Resolution limits
    const maxResolutions = {
      '4k': { width: 3840, height: 2160 },
      '1080p': { width: 1920, height: 1080 },
      '720p': { width: 1280, height: 720 },
      '480p': { width: 854, height: 480 },
    };

    return new Promise((resolve, reject) => {
      const cmd = this.ffmpegManager.createCommand(options.input);

      // Use H.264 for maximum compatibility
      cmd.videoCodec('libx264');
      cmd.outputOptions([
        `-crf ${settings.crf}`,
        '-preset slow', // Better compression
        '-movflags +faststart', // Web streaming optimization
      ]);

      // AAC audio for web compatibility
      cmd.audioCodec('aac');
      cmd.audioBitrate(settings.audioBitrate);

      // Scale down if needed
      if (options.maxResolution) {
        const maxRes = maxResolutions[options.maxResolution];
        if (info.width > maxRes.width || info.height > maxRes.height) {
          // Scale maintaining aspect ratio
          cmd.videoFilters(`scale='min(${maxRes.width},iw)':min'(${maxRes.height},ih)':force_original_aspect_ratio=decrease`);
        }
      }

      cmd
        .output(options.output)
        .on('end', () => resolve(options.output))
        .on('error', reject)
        .run();
    });
  }
}
