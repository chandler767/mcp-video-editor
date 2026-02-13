/**
 * Visual Effects - Blur, color grading, chroma key, glow, vignette, Ken Burns
 */

import { FFmpegManager } from './ffmpeg-utils.js';
import {
  BlurEffectOptions,
  ColorGradeOptions,
  ChromaKeyOptions,
  KenBurnsOptions,
  GlowEffectOptions,
  VignetteOptions,
  SharpenOptions,
} from './types/visual-types.js';
import { toFFmpegColor, parseColor } from './utils/color-utils.js';
import fs from 'fs/promises';

export class VisualEffects {
  constructor(private ffmpegManager: FFmpegManager) {}

  /**
   * Apply blur effect
   */
  async applyBlur(options: BlurEffectOptions): Promise<string> {
    await this.ffmpegManager.initialize();
    await this.validateFileExists(options.input, 'Video');

    const filter = this.buildBlurFilter(options);

    return new Promise((resolve, reject) => {
      this.ffmpegManager
        .createCommand(options.input)
        .videoFilters(filter)
        .output(options.output)
        .on('end', () => resolve(options.output))
        .on('error', (err) =>
          reject(new Error(`Failed to apply blur: ${err.message}`))
        )
        .run();
    });
  }

  /**
   * Apply color grading
   */
  async applyColorGrade(options: ColorGradeOptions): Promise<string> {
    await this.ffmpegManager.initialize();
    await this.validateFileExists(options.input, 'Video');

    const filters = this.buildColorGradeFilters(options);

    return new Promise((resolve, reject) => {
      this.ffmpegManager
        .createCommand(options.input)
        .videoFilters(filters.join(','))
        .output(options.output)
        .on('end', () => resolve(options.output))
        .on('error', (err) =>
          reject(new Error(`Failed to apply color grade: ${err.message}`))
        )
        .run();
    });
  }

  /**
   * Apply chroma key (green screen removal)
   */
  async applyChromaKey(options: ChromaKeyOptions): Promise<string> {
    await this.ffmpegManager.initialize();
    await this.validateFileExists(options.input, 'Video');

    const filter = this.buildChromaKeyFilter(options);

    // If background image/color is specified, overlay it
    if (options.backgroundImage) {
      await this.validateFileExists(options.backgroundImage, 'Background image');

      return new Promise((resolve, reject) => {
        this.ffmpegManager
          .createCommand(options.backgroundImage)
          .input(options.input)
          .complexFilter([filter, 'overlay=0:0'])
          .output(options.output)
          .on('end', () => resolve(options.output))
          .on('error', (err) =>
            reject(new Error(`Failed to apply chroma key: ${err.message}`))
          )
          .run();
      });
    } else {
      return new Promise((resolve, reject) => {
        this.ffmpegManager
          .createCommand(options.input)
          .videoFilters(filter)
          .output(options.output)
          .on('end', () => resolve(options.output))
          .on('error', (err) =>
            reject(new Error(`Failed to apply chroma key: ${err.message}`))
          )
          .run();
      });
    }
  }

  /**
   * Apply Ken Burns effect (zoom and pan on still image)
   */
  async applyKenBurns(options: KenBurnsOptions): Promise<string> {
    await this.ffmpegManager.initialize();
    await this.validateFileExists(options.input, 'Image');

    const filter = this.buildKenBurnsFilter(options);

    return new Promise((resolve, reject) => {
      this.ffmpegManager
        .createCommand()
        .input(options.input)
        .inputOptions(['-loop', '1'])
        .videoFilters(filter)
        .outputOptions([
          `-t ${options.duration}`,
          `-r ${options.fps || 30}`,
        ])
        .output(options.output)
        .on('end', () => resolve(options.output))
        .on('error', (err) =>
          reject(new Error(`Failed to apply Ken Burns effect: ${err.message}`))
        )
        .run();
    });
  }

  /**
   * Apply glow effect
   */
  async applyGlow(options: GlowEffectOptions): Promise<string> {
    await this.ffmpegManager.initialize();
    await this.validateFileExists(options.input, 'Video');

    const filters = this.buildGlowFilters(options);

    return new Promise((resolve, reject) => {
      this.ffmpegManager
        .createCommand(options.input)
        .complexFilter(filters)
        .output(options.output)
        .on('end', () => resolve(options.output))
        .on('error', (err) =>
          reject(new Error(`Failed to apply glow: ${err.message}`))
        )
        .run();
    });
  }

  /**
   * Apply vignette effect
   */
  async applyVignette(options: VignetteOptions): Promise<string> {
    await this.ffmpegManager.initialize();
    await this.validateFileExists(options.input, 'Video');

    const filter = this.buildVignetteFilter(options);

    return new Promise((resolve, reject) => {
      this.ffmpegManager
        .createCommand(options.input)
        .videoFilters(filter)
        .output(options.output)
        .on('end', () => resolve(options.output))
        .on('error', (err) =>
          reject(new Error(`Failed to apply vignette: ${err.message}`))
        )
        .run();
    });
  }

  /**
   * Apply sharpen effect
   */
  async applySharpen(options: SharpenOptions): Promise<string> {
    await this.ffmpegManager.initialize();
    await this.validateFileExists(options.input, 'Video');

    const filter = this.buildSharpenFilter(options);

    return new Promise((resolve, reject) => {
      this.ffmpegManager
        .createCommand(options.input)
        .videoFilters(filter)
        .output(options.output)
        .on('end', () => resolve(options.output))
        .on('error', (err) =>
          reject(new Error(`Failed to apply sharpen: ${err.message}`))
        )
        .run();
    });
  }

  /**
   * Build blur filter
   */
  private buildBlurFilter(options: BlurEffectOptions): string {
    const type = options.type || 'gaussian';
    const strength = options.strength || 5;

    const filters: string[] = [];

    switch (type) {
      case 'gaussian':
        filters.push(`gblur=sigma=${strength}`);
        break;
      case 'box':
        filters.push(`boxblur=${strength}:${strength}`);
        break;
      case 'motion':
        {
          const angle = options.angle || 0;
          filters.push(`mblur=amount=${strength}:angle=${angle}`);
        }
        break;
      case 'radial':
        // Radial blur requires complex filter graph
        // Simplified version using gblur
        filters.push(`gblur=sigma=${strength}`);
        break;
    }

    // Add timing if specified
    if (options.startTime !== undefined || options.duration !== undefined) {
      const enable = this.buildEnableExpression(options.startTime, options.duration);
      filters[0] += `:enable='${enable}'`;
    }

    return filters.join(',');
  }

  /**
   * Build color grading filters
   */
  private buildColorGradeFilters(options: ColorGradeOptions): string[] {
    const filters: string[] = [];

    // Build eq (equalizer) filter
    const eqParams: string[] = [];

    if (options.brightness !== undefined) {
      eqParams.push(`brightness=${options.brightness}`);
    }
    if (options.contrast !== undefined) {
      eqParams.push(`contrast=${options.contrast + 1}`);
    }
    if (options.saturation !== undefined) {
      eqParams.push(`saturation=${options.saturation + 1}`);
    }
    if (options.gamma !== undefined) {
      eqParams.push(`gamma=${options.gamma}`);
    }

    if (eqParams.length > 0) {
      filters.push(`eq=${eqParams.join(':')}`);
    }

    // Hue adjustment
    if (options.hue !== undefined) {
      filters.push(`hue=h=${options.hue}`);
    }

    // Temperature and tint adjustments (using colorbalance)
    if (options.temperature !== undefined || options.tint !== undefined) {
      const temp = options.temperature || 0;
      const tint = options.tint || 0;

      // Approximate temperature/tint with colorbalance
      const rs = temp > 0 ? temp / 100 : 0;
      const bs = temp < 0 ? -temp / 100 : 0;
      const gs = tint / 100;

      filters.push(`colorbalance=rs=${rs}:gs=${gs}:bs=${bs}`);
    }

    return filters;
  }

  /**
   * Build chroma key filter
   */
  private buildChromaKeyFilter(options: ChromaKeyOptions): string {
    const keyColor = options.keyColor || 'green';
    const similarity = options.similarity || 0.3;
    const blend = options.blend || 0.1;

    // Parse color to get RGB values
    const rgb = parseColor(keyColor);
    const hexColor = `0x${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`;

    return `chromakey=color=${hexColor}:similarity=${similarity}:blend=${blend}`;
  }

  /**
   * Build Ken Burns filter
   */
  private buildKenBurnsFilter(options: KenBurnsOptions): string {
    const duration = options.duration;
    const startZoom = options.startZoom || 1;
    const endZoom = options.endZoom || 1.2;
    const startPos = options.startPosition || { x: 0, y: 0 };
    const endPos = options.endPosition || startPos;

    // Calculate zoom and pan parameters
    const zoomDelta = endZoom - startZoom;
    const panXDelta = endPos.x - startPos.x;
    const panYDelta = endPos.y - startPos.y;

    // Build zoompan filter
    // z = zoom, x/y = position, d = duration in frames
    const fps = options.fps || 30;
    const totalFrames = duration * fps;

    return `zoompan=z='${startZoom}+${zoomDelta}*(in/${totalFrames})':x='${startPos.x}+${panXDelta}*(in/${totalFrames})':y='${startPos.y}+${panYDelta}*(in/${totalFrames})':d=${totalFrames}:s=1920x1080:fps=${fps}`;
  }

  /**
   * Build glow filters
   */
  private buildGlowFilters(options: GlowEffectOptions): any[] {
    const intensity = options.intensity || 5;
    const spread = options.spread || 3;

    // Glow effect: duplicate, blur, lighten, overlay
    return [
      { filter: 'split', outputs: ['[original]', '[glow]'] },
      { filter: 'gblur', options: `sigma=${spread}`, inputs: '[glow]', outputs: '[glowed]' },
      {
        filter: 'eq',
        options: `brightness=${intensity / 10}`,
        inputs: '[glowed]',
        outputs: '[bright]',
      },
      { filter: 'overlay', inputs: ['[original]', '[bright]'], outputs: '[v]' },
    ];
  }

  /**
   * Build vignette filter
   */
  private buildVignetteFilter(options: VignetteOptions): string {
    const intensity = options.intensity || 0.5;
    const angle = options.angle || Math.PI / 4;

    return `vignette=angle=${angle}:mode=forward`;
  }

  /**
   * Build sharpen filter
   */
  private buildSharpenFilter(options: SharpenOptions): string {
    const strength = options.strength || 5;
    const radius = options.radius || 3;

    // unsharp filter: luma_msize:luma_amount
    // luma_msize controls radius, luma_amount controls strength
    const amount = strength / 5; // Normalize to reasonable range
    return `unsharp=5:5:${amount}:5:5:0`;
  }

  /**
   * Build enable expression for timing
   */
  private buildEnableExpression(
    startTime?: number,
    duration?: number
  ): string | undefined {
    if (startTime === undefined && duration === undefined) {
      return undefined;
    }

    const start = startTime || 0;
    if (duration === undefined) {
      return `gte(t,${start})`;
    }

    const end = start + duration;
    return `between(t,${start},${end})`;
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
