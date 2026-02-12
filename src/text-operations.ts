import { FFmpegManager } from './ffmpeg-utils.js';
import path from 'path';

export interface TextOverlayOptions {
  input: string;
  output: string;
  text: string;

  // Position
  x?: number | string; // Can be number or expressions like "w/2", "(w-text_w)/2"
  y?: number | string;
  position?: 'top-left' | 'top-center' | 'top-right' | 'center' | 'bottom-left' | 'bottom-center' | 'bottom-right';

  // Timing
  startTime?: number; // seconds
  endTime?: number; // seconds
  duration?: number; // seconds

  // Font styling
  fontFile?: string;
  fontSize?: number;
  fontColor?: string; // Color name or hex (e.g., 'white', '0xFFFFFF')

  // Effects
  borderWidth?: number;
  borderColor?: string;
  shadowX?: number;
  shadowY?: number;
  shadowColor?: string;

  // Box background
  box?: boolean;
  boxColor?: string;
  boxOpacity?: number; // 0-1
  boxBorderWidth?: number;

  // Animation
  fadeIn?: number; // seconds
  fadeOut?: number; // seconds
}

export interface AnimatedTextOptions extends TextOverlayOptions {
  animation: 'fade' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'zoom';
  animationDuration?: number; // seconds for animation effect
}

export interface SubtitleOptions {
  input: string;
  output: string;
  subtitleFile: string; // SRT or VTT file

  // Styling
  fontSize?: number;
  fontColor?: string;
  fontFile?: string;

  // Effects
  borderWidth?: number;
  borderColor?: string;

  // Box background
  box?: boolean;
  boxColor?: string;
  boxOpacity?: number;
}

export class TextOperations {
  constructor(private ffmpegManager: FFmpegManager) {}

  /**
   * Add text overlay to video
   */
  async addTextOverlay(options: TextOverlayOptions): Promise<string> {
    await this.ffmpegManager.initialize();

    const drawTextFilter = this.buildDrawTextFilter(options);

    return new Promise((resolve, reject) => {
      this.ffmpegManager
        .createCommand(options.input)
        .videoFilters(drawTextFilter)
        .output(options.output)
        .on('end', () => resolve(options.output))
        .on('error', (err) => reject(new Error(`Failed to add text overlay: ${err.message}`)))
        .run();
    });
  }

  /**
   * Add animated text to video
   */
  async addAnimatedText(options: AnimatedTextOptions): Promise<string> {
    await this.ffmpegManager.initialize();

    const drawTextFilter = this.buildAnimatedTextFilter(options);

    return new Promise((resolve, reject) => {
      this.ffmpegManager
        .createCommand(options.input)
        .videoFilters(drawTextFilter)
        .output(options.output)
        .on('end', () => resolve(options.output))
        .on('error', (err) => reject(new Error(`Failed to add animated text: ${err.message}`)))
        .run();
    });
  }

  /**
   * Burn subtitles into video
   */
  async burnSubtitles(options: SubtitleOptions): Promise<string> {
    await this.ffmpegManager.initialize();

    // Check subtitle file extension
    const ext = path.extname(options.subtitleFile).toLowerCase();

    let filter: string;
    if (ext === '.srt') {
      // Use subtitles filter for SRT
      filter = this.buildSubtitlesFilter(options);
    } else if (ext === '.vtt' || ext === '.ass') {
      // Use subtitles filter for VTT/ASS
      filter = this.buildSubtitlesFilter(options);
    } else {
      throw new Error(`Unsupported subtitle format: ${ext}. Supported: .srt, .vtt, .ass`);
    }

    return new Promise((resolve, reject) => {
      this.ffmpegManager
        .createCommand(options.input)
        .videoFilters(filter)
        .output(options.output)
        .on('end', () => resolve(options.output))
        .on('error', (err) => reject(new Error(`Failed to burn subtitles: ${err.message}`)))
        .run();
    });
  }

  /**
   * Add multiple text overlays to video
   */
  async addMultipleTextOverlays(
    input: string,
    output: string,
    textOverlays: TextOverlayOptions[]
  ): Promise<string> {
    await this.ffmpegManager.initialize();

    // Build filter chain for multiple text overlays
    const filters = textOverlays.map(overlay => this.buildDrawTextFilter(overlay));
    const filterComplex = filters.join(',');

    return new Promise((resolve, reject) => {
      this.ffmpegManager
        .createCommand(input)
        .videoFilters(filterComplex)
        .output(output)
        .on('end', () => resolve(output))
        .on('error', (err) => reject(new Error(`Failed to add text overlays: ${err.message}`)))
        .run();
    });
  }

  /**
   * Build drawtext filter string
   */
  private buildDrawTextFilter(options: TextOverlayOptions): string {
    const params: string[] = [];

    // Escape text for FFmpeg
    const escapedText = this.escapeText(options.text);
    params.push(`text='${escapedText}'`);

    // Position
    const { x, y } = this.resolvePosition(options);
    params.push(`x=${x}`);
    params.push(`y=${y}`);

    // Font
    if (options.fontFile) {
      params.push(`fontfile='${options.fontFile}'`);
    }
    params.push(`fontsize=${options.fontSize || 24}`);
    params.push(`fontcolor=${options.fontColor || 'white'}`);

    // Border/Outline
    if (options.borderWidth) {
      params.push(`borderw=${options.borderWidth}`);
      params.push(`bordercolor=${options.borderColor || 'black'}`);
    }

    // Shadow
    if (options.shadowX !== undefined || options.shadowY !== undefined) {
      params.push(`shadowx=${options.shadowX || 2}`);
      params.push(`shadowy=${options.shadowY || 2}`);
      params.push(`shadowcolor=${options.shadowColor || 'black'}`);
    }

    // Box background
    if (options.box) {
      params.push('box=1');
      params.push(`boxcolor=${options.boxColor || 'black'}@${options.boxOpacity || 0.5}`);
      if (options.boxBorderWidth) {
        params.push(`boxborderw=${options.boxBorderWidth}`);
      }
    }

    // Timing
    if (options.startTime !== undefined || options.endTime !== undefined || options.duration !== undefined) {
      const enable = this.buildEnableExpression(options);
      params.push(`enable='${enable}'`);
    }

    // Fade effects
    if (options.fadeIn || options.fadeOut) {
      const alpha = this.buildFadeExpression(options);
      params.push(`alpha='${alpha}'`);
    }

    return `drawtext=${params.join(':')}`;
  }

  /**
   * Build animated text filter
   */
  private buildAnimatedTextFilter(options: AnimatedTextOptions): string {
    const params: string[] = [];

    const escapedText = this.escapeText(options.text);
    params.push(`text='${escapedText}'`);

    // Animation position
    const { x, y } = this.resolveAnimatedPosition(options);
    params.push(`x=${x}`);
    params.push(`y=${y}`);

    // Font
    if (options.fontFile) {
      params.push(`fontfile='${options.fontFile}'`);
    }
    params.push(`fontsize=${options.fontSize || 24}`);
    params.push(`fontcolor=${options.fontColor || 'white'}`);

    // Border
    if (options.borderWidth) {
      params.push(`borderw=${options.borderWidth}`);
      params.push(`bordercolor=${options.borderColor || 'black'}`);
    }

    // Box
    if (options.box) {
      params.push('box=1');
      params.push(`boxcolor=${options.boxColor || 'black'}@${options.boxOpacity || 0.5}`);
    }

    // Timing and fade
    if (options.startTime !== undefined || options.endTime !== undefined) {
      const enable = this.buildEnableExpression(options);
      params.push(`enable='${enable}'`);
    }

    // Animation fade
    const alpha = this.buildAnimatedFadeExpression(options);
    if (alpha) {
      params.push(`alpha='${alpha}'`);
    }

    return `drawtext=${params.join(':')}`;
  }

  /**
   * Build subtitles filter
   */
  private buildSubtitlesFilter(options: SubtitleOptions): string {
    // Escape path for FFmpeg
    const escapedPath = options.subtitleFile.replace(/\\/g, '\\\\').replace(/:/g, '\\:');

    const params: string[] = [`filename='${escapedPath}'`];

    // Styling
    if (options.fontSize) {
      params.push(`force_style='FontSize=${options.fontSize}'`);
    }

    return `subtitles=${params.join(':')}`;
  }

  /**
   * Resolve position from preset or coordinates
   */
  private resolvePosition(options: TextOverlayOptions): { x: string; y: string } {
    if (options.x !== undefined && options.y !== undefined) {
      return {
        x: options.x.toString(),
        y: options.y.toString()
      };
    }

    switch (options.position) {
      case 'top-left':
        return { x: '10', y: '10' };
      case 'top-center':
        return { x: '(w-text_w)/2', y: '10' };
      case 'top-right':
        return { x: 'w-text_w-10', y: '10' };
      case 'center':
        return { x: '(w-text_w)/2', y: '(h-text_h)/2' };
      case 'bottom-left':
        return { x: '10', y: 'h-text_h-10' };
      case 'bottom-center':
        return { x: '(w-text_w)/2', y: 'h-text_h-10' };
      case 'bottom-right':
        return { x: 'w-text_w-10', y: 'h-text_h-10' };
      default:
        return { x: '(w-text_w)/2', y: 'h-text_h-10' }; // Default to bottom-center
    }
  }

  /**
   * Resolve animated position
   */
  private resolveAnimatedPosition(options: AnimatedTextOptions): { x: string; y: string } {
    const duration = options.animationDuration || 1;
    const startTime = options.startTime || 0;

    switch (options.animation) {
      case 'slide-left':
        return {
          x: `if(lt(t-${startTime}\\,${duration})\\,w-(w+text_w)*(t-${startTime})/${duration}\\,w-text_w-10)`,
          y: '(h-text_h)/2'
        };
      case 'slide-right':
        return {
          x: `if(lt(t-${startTime}\\,${duration})\\,-text_w+(w+text_w)*(t-${startTime})/${duration}\\,10)`,
          y: '(h-text_h)/2'
        };
      case 'slide-up':
        return {
          x: '(w-text_w)/2',
          y: `if(lt(t-${startTime}\\,${duration})\\,h-(h+text_h)*(t-${startTime})/${duration}\\,10)`
        };
      case 'slide-down':
        return {
          x: '(w-text_w)/2',
          y: `if(lt(t-${startTime}\\,${duration})\\,-text_h+(h+text_h)*(t-${startTime})/${duration}\\,h-text_h-10)`
        };
      case 'fade':
      case 'zoom':
      default:
        return this.resolvePosition(options);
    }
  }

  /**
   * Build enable expression for timing
   */
  private buildEnableExpression(options: TextOverlayOptions): string {
    const start = options.startTime || 0;

    if (options.endTime !== undefined) {
      return `between(t,${start},${options.endTime})`;
    } else if (options.duration !== undefined) {
      return `between(t,${start},${start + options.duration})`;
    } else if (options.startTime !== undefined) {
      return `gte(t,${start})`;
    }

    return '1'; // Always visible
  }

  /**
   * Build fade expression
   */
  private buildFadeExpression(options: TextOverlayOptions): string {
    const fadeIn = options.fadeIn || 0;
    const fadeOut = options.fadeOut || 0;
    const start = options.startTime || 0;
    const end = options.endTime || (options.duration ? start + options.duration : 0);

    const expressions: string[] = [];

    if (fadeIn > 0) {
      expressions.push(`if(lt(t-${start}\\,${fadeIn})\\,(t-${start})/${fadeIn}\\,1)`);
    }

    if (fadeOut > 0 && end > 0) {
      expressions.push(`if(gt(t\\,${end - fadeOut})\\,(${end}-t)/${fadeOut}\\,1)`);
    }

    if (expressions.length === 0) {
      return '1';
    } else if (expressions.length === 1) {
      return expressions[0];
    } else {
      return `${expressions[0]}*${expressions[1]}`;
    }
  }

  /**
   * Build animated fade expression
   */
  private buildAnimatedFadeExpression(options: AnimatedTextOptions): string | null {
    const duration = options.animationDuration || 1;
    const start = options.startTime || 0;
    const end = options.endTime || (options.duration ? start + options.duration : 0);

    if (options.animation === 'fade') {
      // Fade in at start
      let fadeExpr = `if(lt(t-${start}\\,${duration})\\,(t-${start})/${duration}\\,1)`;

      // Fade out at end
      if (end > 0 && options.fadeOut) {
        fadeExpr += `*if(gt(t\\,${end - duration})\\,(${end}-t)/${duration}\\,1)`;
      }

      return fadeExpr;
    } else if (options.animation === 'zoom') {
      // Zoom effect via alpha (placeholder - zoom would need fontsize animation)
      return this.buildFadeExpression(options);
    }

    return this.buildFadeExpression(options);
  }

  /**
   * Escape text for FFmpeg drawtext filter
   */
  private escapeText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/:/g, '\\:')
      .replace(/\n/g, '\\n')
      .replace(/%/g, '\\%');
  }
}
