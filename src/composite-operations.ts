/**
 * Composite Operations - Picture-in-picture, split screen, video grids
 */

import { FFmpegManager } from './ffmpeg-utils.js';
import {
  PictureInPictureOptions,
  SplitScreenOptions,
  VideoGridOptions,
  PiPPosition,
  SplitScreenLayout,
  Position,
} from './types/visual-types.js';
import { toFFmpegColor } from './utils/color-utils.js';
import fs from 'fs/promises';

export class CompositeOperations {
  constructor(private ffmpegManager: FFmpegManager) {}

  /**
   * Create picture-in-picture composition
   */
  async createPictureInPicture(options: PictureInPictureOptions): Promise<string> {
    await this.ffmpegManager.initialize();
    await this.validateFileExists(options.mainVideo, 'Main video');
    await this.validateFileExists(options.pipVideo, 'PiP video');

    const position = await this.calculatePiPPosition(options);
    const filters = await this.buildPiPFilters(options, position);

    return new Promise((resolve, reject) => {
      const command = this.ffmpegManager
        .createCommand(options.mainVideo)
        .input(options.pipVideo);

      command
        .complexFilter(filters)
        .outputOptions(['-map', '[v]'])
        .output(options.output)
        .on('end', () => resolve(options.output))
        .on('error', (err) =>
          reject(new Error(`Failed to create picture-in-picture: ${err.message}`))
        )
        .run();
    });
  }

  /**
   * Create split screen layout
   */
  async createSplitScreen(options: SplitScreenOptions): Promise<string> {
    await this.ffmpegManager.initialize();

    // Validate all video inputs
    for (const video of options.videos) {
      await this.validateFileExists(video, 'Video');
    }

    const filters = await this.buildSplitScreenFilters(options);

    return new Promise((resolve, reject) => {
      const command = this.ffmpegManager.createCommand();

      // Add all video inputs
      for (const video of options.videos) {
        command.input(video);
      }

      command
        .complexFilter(filters)
        .outputOptions(['-map', '[v]'])
        .output(options.output)
        .on('end', () => resolve(options.output))
        .on('error', (err) =>
          reject(new Error(`Failed to create split screen: ${err.message}`))
        )
        .run();
    });
  }

  /**
   * Create video grid layout
   */
  async createVideoGrid(options: VideoGridOptions): Promise<string> {
    await this.ffmpegManager.initialize();

    // Validate all video inputs
    for (const video of options.videos) {
      await this.validateFileExists(video, 'Video');
    }

    // Calculate rows if not provided
    const columns = options.columns;
    const rows = options.rows || Math.ceil(options.videos.length / columns);

    const filters = await this.buildVideoGridFilters(options, columns, rows);

    return new Promise((resolve, reject) => {
      const command = this.ffmpegManager.createCommand();

      // Add all video inputs
      for (const video of options.videos) {
        command.input(video);
      }

      command
        .complexFilter(filters)
        .outputOptions(['-map', '[v]'])
        .output(options.output)
        .on('end', () => resolve(options.output))
        .on('error', (err) =>
          reject(new Error(`Failed to create video grid: ${err.message}`))
        )
        .run();
    });
  }

  /**
   * Calculate PiP position based on options
   */
  private async calculatePiPPosition(
    options: PictureInPictureOptions
  ): Promise<Position> {
    const margin = options.margin || 20;

    // If position is a Position object, return it directly
    if (
      typeof options.position === 'object' &&
      'x' in options.position &&
      'y' in options.position
    ) {
      return options.position;
    }

    // Calculate based on anchor point
    const anchor = options.position || 'bottom-right';
    const mainInfo = await this.getVideoInfo(options.mainVideo);
    const pipInfo = await this.getVideoInfo(options.pipVideo);

    const pipWidth = options.size?.width || Math.floor(mainInfo.width * 0.25);
    const pipHeight = options.size?.height || Math.floor(mainInfo.height * 0.25);

    const positions: Record<string, Position> = {
      'top-left': { x: margin, y: margin },
      'top-center': { x: (mainInfo.width - pipWidth) / 2, y: margin },
      'top-right': { x: mainInfo.width - pipWidth - margin, y: margin },
      'center-left': { x: margin, y: (mainInfo.height - pipHeight) / 2 },
      center: { x: (mainInfo.width - pipWidth) / 2, y: (mainInfo.height - pipHeight) / 2 },
      'center-right': {
        x: mainInfo.width - pipWidth - margin,
        y: (mainInfo.height - pipHeight) / 2,
      },
      'bottom-left': { x: margin, y: mainInfo.height - pipHeight - margin },
      'bottom-center': {
        x: (mainInfo.width - pipWidth) / 2,
        y: mainInfo.height - pipHeight - margin,
      },
      'bottom-right': {
        x: mainInfo.width - pipWidth - margin,
        y: mainInfo.height - pipHeight - margin,
      },
    };

    return positions[anchor] || positions['bottom-right'];
  }

  /**
   * Build PiP filters
   */
  private async buildPiPFilters(
    options: PictureInPictureOptions,
    position: Position
  ): Promise<any[]> {
    const filters: any[] = [];
    const mainInfo = await this.getVideoInfo(options.mainVideo);

    // Calculate PiP size
    const pipWidth = options.size?.width || Math.floor(mainInfo.width * 0.25);
    const pipHeight = options.size?.height || Math.floor(mainInfo.height * 0.25);

    // Scale PiP video
    filters.push({
      filter: 'scale',
      options: `${pipWidth}:${pipHeight}`,
      inputs: '[1:v]',
      outputs: '[pip_scaled]',
    });

    let currentPipInput = '[pip_scaled]';

    // Add border if specified
    if (options.borderWidth && options.borderWidth > 0) {
      const borderColor = options.borderColor || 'white';
      filters.push({
        filter: 'drawbox',
        options: `x=0:y=0:w=${pipWidth}:h=${pipHeight}:color=${borderColor}:t=${options.borderWidth}`,
        inputs: currentPipInput,
        outputs: '[pip_bordered]',
      });
      currentPipInput = '[pip_bordered]';
    }

    // Overlay PiP on main video
    const overlayOptions: any = {
      x: position.x,
      y: position.y,
    };

    if (options.startTime !== undefined || options.duration !== undefined) {
      overlayOptions.enable = this.buildEnableExpression(
        options.startTime,
        options.duration
      );
    }

    filters.push({
      filter: 'overlay',
      options: overlayOptions,
      inputs: ['[0:v]', currentPipInput],
      outputs: '[v]',
    });

    return filters;
  }

  /**
   * Build split screen filters
   */
  private async buildSplitScreenFilters(options: SplitScreenOptions): Promise<any[]> {
    const filters: any[] = [];
    const layout = options.layout;
    const borderWidth = options.borderWidth || 2;
    const borderColor = toFFmpegColor(options.borderColor || 'black');

    // Get dimensions of first video to use as reference
    const firstVideoInfo = await this.getVideoInfo(options.videos[0]);
    const outputWidth = firstVideoInfo.width;
    const outputHeight = firstVideoInfo.height;

    // Calculate cell dimensions based on layout
    const layoutConfig = this.getLayoutConfig(layout, options.videos.length);
    const cellPositions = this.calculateCellPositions(
      layoutConfig,
      outputWidth,
      outputHeight,
      borderWidth
    );

    // Scale each video to its cell size
    for (let i = 0; i < options.videos.length; i++) {
      const cell = cellPositions[i];
      filters.push({
        filter: 'scale',
        options: `${cell.width}:${cell.height}`,
        inputs: `[${i}:v]`,
        outputs: `[v${i}]`,
      });
    }

    // Build overlay chain
    let currentInput = '[0:v]';
    for (let i = 1; i < options.videos.length; i++) {
      const cell = cellPositions[i];
      filters.push({
        filter: 'overlay',
        options: { x: cell.x, y: cell.y },
        inputs: [currentInput, `[v${i}]`],
        outputs: i === options.videos.length - 1 ? '[v]' : `[tmp${i}]`,
      });
      if (i < options.videos.length - 1) {
        currentInput = `[tmp${i}]`;
      }
    }

    return filters;
  }

  /**
   * Build video grid filters
   */
  private async buildVideoGridFilters(
    options: VideoGridOptions,
    columns: number,
    rows: number
  ): Promise<any[]> {
    const filters: any[] = [];
    const gap = options.gap || 2;
    const bgColor = toFFmpegColor(options.backgroundColor || 'black');

    // Get dimensions from first video
    const firstVideoInfo = await this.getVideoInfo(options.videos[0]);
    const totalWidth = options.cellWidth
      ? options.cellWidth * columns + gap * (columns - 1)
      : firstVideoInfo.width;
    const totalHeight = options.cellHeight
      ? options.cellHeight * rows + gap * (rows - 1)
      : firstVideoInfo.height;

    const cellWidth = options.cellWidth || Math.floor(totalWidth / columns);
    const cellHeight = options.cellHeight || Math.floor(totalHeight / rows);

    // Scale each video
    for (let i = 0; i < options.videos.length; i++) {
      filters.push({
        filter: 'scale',
        options: `${cellWidth}:${cellHeight}`,
        inputs: `[${i}:v]`,
        outputs: `[v${i}]`,
      });
    }

    // Create base layer with background color
    filters.push({
      filter: 'color',
      options: `c=${bgColor}:s=${totalWidth}x${totalHeight}`,
      outputs: '[base]',
    });

    // Overlay each video in grid
    let currentInput = '[base]';
    for (let i = 0; i < options.videos.length; i++) {
      const row = Math.floor(i / columns);
      const col = i % columns;
      const x = col * (cellWidth + gap);
      const y = row * (cellHeight + gap);

      filters.push({
        filter: 'overlay',
        options: { x, y },
        inputs: [currentInput, `[v${i}]`],
        outputs: i === options.videos.length - 1 ? '[v]' : `[tmp${i}]`,
      });

      if (i < options.videos.length - 1) {
        currentInput = `[tmp${i}]`;
      }
    }

    return filters;
  }

  /**
   * Get layout configuration
   */
  private getLayoutConfig(
    layout: SplitScreenLayout,
    numVideos: number
  ): { rows: number; columns: number; cells: number } {
    const layouts: Record<
      SplitScreenLayout,
      { rows: number; columns: number; cells: number }
    > = {
      horizontal: { rows: 1, columns: 2, cells: 2 },
      vertical: { rows: 2, columns: 1, cells: 2 },
      'grid-2x2': { rows: 2, columns: 2, cells: 4 },
      'grid-3x3': { rows: 3, columns: 3, cells: 9 },
      'triple-horizontal': { rows: 1, columns: 3, cells: 3 },
      'triple-vertical': { rows: 3, columns: 1, cells: 3 },
      'main-right': { rows: 2, columns: 2, cells: 3 },
      'main-left': { rows: 2, columns: 2, cells: 3 },
      'main-bottom': { rows: 2, columns: 2, cells: 3 },
      'main-top': { rows: 2, columns: 2, cells: 3 },
    };

    return layouts[layout];
  }

  /**
   * Calculate cell positions for layout
   */
  private calculateCellPositions(
    config: { rows: number; columns: number; cells: number },
    width: number,
    height: number,
    borderWidth: number
  ): Array<{ x: number; y: number; width: number; height: number }> {
    const cells: Array<{ x: number; y: number; width: number; height: number }> = [];

    const cellWidth = Math.floor(width / config.columns);
    const cellHeight = Math.floor(height / config.rows);

    for (let row = 0; row < config.rows; row++) {
      for (let col = 0; col < config.columns; col++) {
        cells.push({
          x: col * cellWidth,
          y: row * cellHeight,
          width: cellWidth - borderWidth,
          height: cellHeight - borderWidth,
        });
      }
    }

    return cells;
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
   * Get video info
   */
  private async getVideoInfo(
    filePath: string
  ): Promise<{ width: number; height: number; duration: number }> {
    return new Promise((resolve, reject) => {
      this.ffmpegManager.createCommand(filePath).ffprobe((err, data) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = data.streams.find((s) => s.codec_type === 'video');
        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

        resolve({
          width: videoStream.width || 1920,
          height: videoStream.height || 1080,
          duration: data.format.duration || 0,
        });
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
