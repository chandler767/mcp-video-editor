/**
 * Transition Effects - Video transitions between clips
 */

import { FFmpegManager } from './ffmpeg-utils.js';
import {
  TransitionOptions,
  CrossfadeOptions,
  CustomTransitionOptions,
  TransitionType,
} from './types/visual-types.js';
import { getEasingFunction } from './utils/easing-functions.js';
import fs from 'fs/promises';

export class TransitionEffects {
  constructor(private ffmpegManager: FFmpegManager) {}

  /**
   * Add transition between two videos
   */
  async addTransition(options: TransitionOptions): Promise<string> {
    await this.ffmpegManager.initialize();
    await this.validateFileExists(options.input1, 'First video');
    await this.validateFileExists(options.input2, 'Second video');

    const duration = options.duration || 1;
    const offset = options.offset;

    return new Promise(async (resolve, reject) => {
      try {
        // Get video durations to calculate offset if not provided
        const finalOffset = offset !== undefined
          ? offset
          : await this.getVideoDuration(options.input1) - duration;

        const command = this.ffmpegManager
          .createCommand()
          .input(options.input1)
          .input(options.input2);

        // Build xfade filter
        const xfadeFilter = `xfade=transition=${options.type}:duration=${duration}:offset=${finalOffset}`;

        command
          .complexFilter([
            xfadeFilter,
            // Also crossfade audio
            `[0:a][1:a]acrossfade=d=${duration}:c1=tri:c2=tri`,
          ])
          .outputOptions(['-map', '[v]', '-map', '[a]'])
          .output(options.output)
          .on('end', () => resolve(options.output))
          .on('error', (err) =>
            reject(new Error(`Failed to add transition: ${err.message}`))
          )
          .run();
      } catch (err: any) {
        reject(new Error(`Failed to add transition: ${err.message}`));
      }
    });
  }

  /**
   * Crossfade between two videos
   */
  async crossfade(options: CrossfadeOptions): Promise<string> {
    const transitionOptions: TransitionOptions = {
      input1: options.input1,
      input2: options.input2,
      output: options.output,
      type: 'fade',
      duration: options.duration || 1,
      offset: options.offset,
    };

    return this.addTransition(transitionOptions);
  }

  /**
   * Create custom transition with expression
   */
  async createCustomTransition(options: CustomTransitionOptions): Promise<string> {
    await this.ffmpegManager.initialize();
    await this.validateFileExists(options.input1, 'First video');
    await this.validateFileExists(options.input2, 'Second video');

    const duration = options.duration || 1;
    const offset = options.offset;

    return new Promise(async (resolve, reject) => {
      try {
        const finalOffset =
          offset !== undefined
            ? offset
            : (await this.getVideoDuration(options.input1)) - duration;

        const command = this.ffmpegManager
          .createCommand()
          .input(options.input1)
          .input(options.input2);

        // Use custom xfade expression
        const xfadeFilter = `xfade=transition=${options.expression}:duration=${duration}:offset=${finalOffset}`;

        command
          .complexFilter([xfadeFilter, `[0:a][1:a]acrossfade=d=${duration}`])
          .outputOptions(['-map', '[v]', '-map', '[a]'])
          .output(options.output)
          .on('end', () => resolve(options.output))
          .on('error', (err) =>
            reject(new Error(`Failed to create custom transition: ${err.message}`))
          )
          .run();
      } catch (err: any) {
        reject(new Error(`Failed to create custom transition: ${err.message}`));
      }
    });
  }

  /**
   * Preview transition effect (generate short clip)
   */
  async previewTransition(
    input1: string,
    input2: string,
    output: string,
    type: TransitionType,
    duration: number = 1
  ): Promise<string> {
    await this.ffmpegManager.initialize();
    await this.validateFileExists(input1, 'First video');
    await this.validateFileExists(input2, 'Second video');

    // Extract last few seconds of first video and first few seconds of second video
    const previewDuration = duration + 2; // 1s before, transition, 1s after

    return new Promise(async (resolve, reject) => {
      try {
        const video1Duration = await this.getVideoDuration(input1);
        const startTime1 = Math.max(0, video1Duration - previewDuration);

        const command = this.ffmpegManager
          .createCommand()
          .input(input1)
          .inputOptions([`-ss ${startTime1}`, `-t ${previewDuration}`])
          .input(input2)
          .inputOptions(['-t', String(previewDuration)]);

        // Build transition at the overlap point
        const offset = previewDuration - duration;
        const xfadeFilter = `xfade=transition=${type}:duration=${duration}:offset=${offset}`;

        command
          .complexFilter([xfadeFilter, `[0:a][1:a]acrossfade=d=${duration}`])
          .outputOptions(['-map', '[v]', '-map', '[a]'])
          .output(output)
          .on('end', () => resolve(output))
          .on('error', (err) =>
            reject(new Error(`Failed to create transition preview: ${err.message}`))
          )
          .run();
      } catch (err: any) {
        reject(new Error(`Failed to create transition preview: ${err.message}`));
      }
    });
  }

  /**
   * Concatenate multiple videos with transitions
   */
  async concatenateWithTransitions(
    inputs: string[],
    output: string,
    transitionType: TransitionType,
    transitionDuration: number = 1
  ): Promise<string> {
    if (inputs.length < 2) {
      throw new Error('Need at least 2 videos for transitions');
    }

    await this.ffmpegManager.initialize();

    // Validate all inputs
    for (const input of inputs) {
      await this.validateFileExists(input, 'Video');
    }

    // Apply transitions sequentially
    let currentInput = inputs[0];

    for (let i = 1; i < inputs.length; i++) {
      const tempOutput = i === inputs.length - 1
        ? output
        : `${output}.temp${i}.mp4`;

      await this.addTransition({
        input1: currentInput,
        input2: inputs[i],
        output: tempOutput,
        type: transitionType,
        duration: transitionDuration,
      });

      // Clean up temp files
      if (i > 1) {
        try {
          await fs.unlink(currentInput);
        } catch (err) {
          // Ignore cleanup errors
        }
      }

      currentInput = tempOutput;
    }

    return output;
  }

  /**
   * Get list of available transition types
   */
  getAvailableTransitions(): TransitionType[] {
    return [
      'fade',
      'fadeblack',
      'fadewhite',
      'wipeleft',
      'wiperight',
      'wipeup',
      'wipedown',
      'slideleft',
      'slideright',
      'slideup',
      'slidedown',
      'smoothleft',
      'smoothright',
      'smoothup',
      'smoothdown',
      'circlecrop',
      'rectcrop',
      'distance',
      'fadefast',
      'fadeslow',
      'dissolve',
      'pixelize',
      'radial',
      'hblur',
      'vblur',
    ];
  }

  /**
   * Validate transition type
   */
  private validateTransitionType(type: TransitionType): void {
    const availableTransitions = this.getAvailableTransitions();
    if (!availableTransitions.includes(type)) {
      throw new Error(
        `Invalid transition type: ${type}. Available: ${availableTransitions.join(', ')}`
      );
    }
  }

  /**
   * Get video duration in seconds
   */
  private async getVideoDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      this.ffmpegManager
        .createCommand(filePath)
        .ffprobe((err, data) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(data.format.duration || 0);
        });
    });
  }

  /**
   * Validate file exists
   */
  private async validateFileExists(filePath: string, fileType: string): Promise<void> {
    try {
      await fs.access(filePath);
    } catch (error) {
      throw new Error(`${fileType} file not found: ${filePath}`);
    }
  }
}
