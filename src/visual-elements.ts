/**
 * Visual Elements Module - Handle image overlays, shapes, icons, and layers
 */

import { FFmpegManager } from './ffmpeg-utils.js';
import {
  ImageOverlayOptions,
  ShapeOptions,
  IconOptions,
  LayerVisualOptions,
  Position,
  Size,
  AnchorPoint,
  FitMode,
} from './types/visual-types.js';
import { toFFmpegColor, toFFmpegColorWithAlpha } from './utils/color-utils.js';
import path from 'path';
import fs from 'fs/promises';
import { SVGBuilder } from './utils/svg-builder.js';

export class VisualElements {
  constructor(private ffmpegManager: FFmpegManager) {}

  /**
   * Add image overlay to video
   */
  async addImageOverlay(options: ImageOverlayOptions): Promise<string> {
    await this.ffmpegManager.initialize();

    // Validate input files exist
    await this.validateFileExists(options.input, 'Video');
    await this.validateFileExists(options.image, 'Image');

    // Calculate position based on anchor if provided
    const position = await this.calculateImagePosition(options);

    // Build overlay filter
    const overlayFilter = await this.buildImageOverlayFilter(options, position);

    return new Promise((resolve, reject) => {
      const command = this.ffmpegManager
        .createCommand(options.input)
        .input(options.image);

      // Apply transformations to image if needed
      if (options.size || options.rotation || options.opacity !== undefined) {
        command.complexFilter(overlayFilter);
      } else {
        // Simple overlay
        command.complexFilter([
          {
            filter: 'overlay',
            options: {
              x: position.x,
              y: position.y,
              enable: this.buildEnableExpression(options.startTime, options.duration),
            },
          },
        ]);
      }

      command
        .output(options.output)
        .on('end', () => resolve(options.output))
        .on('error', (err) =>
          reject(new Error(`Failed to add image overlay: ${err.message}`))
        )
        .run();
    });
  }

  /**
   * Add shape to video
   */
  async addShape(options: ShapeOptions): Promise<string> {
    await this.ffmpegManager.initialize();
    await this.validateFileExists(options.input, 'Video');

    const filter = await this.buildShapeFilter(options);

    return new Promise((resolve, reject) => {
      this.ffmpegManager
        .createCommand(options.input)
        .videoFilters(filter)
        .output(options.output)
        .on('end', () => resolve(options.output))
        .on('error', (err) => reject(new Error(`Failed to add shape: ${err.message}`)))
        .run();
    });
  }

  /**
   * Add icon (SVG) overlay to video
   */
  async addIcon(options: IconOptions): Promise<string> {
    await this.ffmpegManager.initialize();
    await this.validateFileExists(options.input, 'Video');
    await this.validateFileExists(options.icon, 'Icon');

    // For SVG files, we need to first convert to PNG
    // For now, treat it like an image overlay
    // In a production system, we'd use a library like sharp to convert SVG to PNG

    const imageOptions: ImageOverlayOptions = {
      input: options.input,
      image: options.icon,
      output: options.output,
      position: options.position,
      size: options.size,
      opacity: options.opacity,
      rotation: options.rotation,
      startTime: options.startTime,
      duration: options.duration,
      zIndex: options.zIndex,
    };

    return this.addImageOverlay(imageOptions);
  }

  /**
   * Layer multiple visual elements
   */
  async layerVisuals(options: LayerVisualOptions): Promise<string> {
    await this.ffmpegManager.initialize();
    await this.validateFileExists(options.input, 'Video');

    // Sort layers by z-index
    const sortedLayers = [...options.layers].sort((a, b) => {
      const aZ = (a.options as any).zIndex || 1;
      const bZ = (b.options as any).zIndex || 1;
      return aZ - bZ;
    });

    // Apply layers sequentially for now
    // In a more advanced implementation, we'd build a complex filter graph
    let currentInput = options.input;

    for (let i = 0; i < sortedLayers.length; i++) {
      const layer = sortedLayers[i];
      const tempOutput = i === sortedLayers.length - 1
        ? options.output
        : path.join(path.dirname(options.output), `.temp_layer_${i}.mp4`);

      if (layer.type === 'image') {
        await this.addImageOverlay({
          ...(layer.options as ImageOverlayOptions),
          input: currentInput,
          output: tempOutput,
        });
      } else if (layer.type === 'shape') {
        await this.addShape({
          ...(layer.options as ShapeOptions),
          input: currentInput,
          output: tempOutput,
        });
      } else if (layer.type === 'icon') {
        await this.addIcon({
          ...(layer.options as IconOptions),
          input: currentInput,
          output: tempOutput,
        });
      }

      // Clean up temp files from previous iteration
      if (i > 0 && currentInput !== options.input) {
        try {
          await fs.unlink(currentInput);
        } catch (err) {
          // Ignore cleanup errors
        }
      }

      currentInput = tempOutput;
    }

    return options.output;
  }

  /**
   * Calculate image position based on anchor point
   */
  private async calculateImagePosition(
    options: ImageOverlayOptions
  ): Promise<Position> {
    if (options.position) {
      return options.position;
    }

    if (!options.anchor) {
      return { x: 0, y: 0 };
    }

    // For anchor-based positioning, we need to use FFmpeg expressions
    // These will be evaluated at runtime based on video and image dimensions
    const anchor = options.anchor;
    const expressions = this.getAnchorExpressions(anchor);

    return {
      x: expressions.x as any, // Will be an expression string
      y: expressions.y as any,
    };
  }

  /**
   * Get FFmpeg expressions for anchor points
   */
  private getAnchorExpressions(anchor: AnchorPoint): { x: string; y: string } {
    const expressions: Record<AnchorPoint, { x: string; y: string }> = {
      'top-left': { x: '0', y: '0' },
      'top-center': { x: '(main_w-overlay_w)/2', y: '0' },
      'top-right': { x: 'main_w-overlay_w', y: '0' },
      'center-left': { x: '0', y: '(main_h-overlay_h)/2' },
      'center': { x: '(main_w-overlay_w)/2', y: '(main_h-overlay_h)/2' },
      'center-right': { x: 'main_w-overlay_w', y: '(main_h-overlay_h)/2' },
      'bottom-left': { x: '0', y: 'main_h-overlay_h' },
      'bottom-center': { x: '(main_w-overlay_w)/2', y: 'main_h-overlay_h' },
      'bottom-right': { x: 'main_w-overlay_w', y: 'main_h-overlay_h' },
    };

    return expressions[anchor];
  }

  /**
   * Build image overlay filter with transformations
   */
  private async buildImageOverlayFilter(
    options: ImageOverlayOptions,
    position: Position
  ): Promise<any[]> {
    const filters: any[] = [];

    // Build scaling filter for image
    if (options.size) {
      filters.push({
        filter: 'scale',
        options: `${options.size.width}:${options.size.height}`,
        inputs: '[1:v]',
        outputs: '[scaled]',
      });
    }

    // Build rotation filter
    let currentInput = options.size ? '[scaled]' : '[1:v]';
    if (options.rotation) {
      filters.push({
        filter: 'rotate',
        options: `${(options.rotation * Math.PI) / 180}:c=none:ow=rotw(${(options.rotation * Math.PI) / 180}):oh=roth(${(options.rotation * Math.PI) / 180})`,
        inputs: currentInput,
        outputs: '[rotated]',
      });
      currentInput = '[rotated]';
    }

    // Build overlay filter
    const overlayOptions: any = {
      x: position.x,
      y: position.y,
    };

    if (options.opacity !== undefined && options.opacity < 1) {
      // Add format filter to support alpha
      filters.push({
        filter: 'format',
        options: 'rgba',
        inputs: currentInput,
        outputs: '[formatted]',
      });

      // Add colorchannelmixer to adjust opacity
      filters.push({
        filter: 'colorchannelmixer',
        options: `aa=${options.opacity}`,
        inputs: '[formatted]',
        outputs: '[opaque]',
      });
      currentInput = '[opaque]';
    }

    // Enable expression for timing
    if (options.startTime !== undefined || options.duration !== undefined) {
      overlayOptions.enable = this.buildEnableExpression(
        options.startTime,
        options.duration
      );
    }

    filters.push({
      filter: 'overlay',
      options: overlayOptions,
      inputs: ['[0:v]', currentInput],
    });

    return filters;
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
   * Build shape filter
   */
  private async buildShapeFilter(options: ShapeOptions): Promise<string> {
    const { type, position, size, color, opacity, thickness, filled } = options;

    const ffmpegColor = toFFmpegColor(color);
    const alpha = opacity !== undefined ? opacity : 1;

    switch (type) {
      case 'rectangle':
        return this.buildRectangleFilter(options, ffmpegColor, alpha);
      case 'circle':
        return this.buildCircleFilter(options, ffmpegColor, alpha);
      case 'ellipse':
        return this.buildEllipseFilter(options, ffmpegColor, alpha);
      case 'line':
        return this.buildLineFilter(options, ffmpegColor, alpha);
      case 'arrow':
        return this.buildArrowFilter(options, ffmpegColor, alpha);
      case 'polygon':
        return this.buildPolygonFilter(options, ffmpegColor, alpha);
      default:
        throw new Error(`Unsupported shape type: ${type}`);
    }
  }

  /**
   * Build rectangle filter using drawbox
   */
  private buildRectangleFilter(
    options: ShapeOptions,
    color: string,
    alpha: number
  ): string {
    const { position, size, thickness, filled } = options;
    const isFilled = filled !== false;

    let filter = `drawbox=x=${position.x}:y=${position.y}:w=${size.width}:h=${size.height}`;
    filter += `:color=${color}@${alpha}`;
    filter += `:t=${isFilled ? 'fill' : thickness || 2}`;

    if (options.startTime !== undefined || options.duration !== undefined) {
      filter += `:enable='${this.buildEnableExpression(options.startTime, options.duration)}'`;
    }

    return filter;
  }

  /**
   * Build circle filter using drawtext (approximation)
   * For a true circle, we'd need to generate an SVG and overlay it
   */
  private buildCircleFilter(
    options: ShapeOptions,
    color: string,
    alpha: number
  ): string {
    // FFmpeg doesn't have a native circle drawing filter
    // We'll create a workaround using drawtext with a circle character
    // Or we could generate an SVG circle and use image overlay

    // For now, return an approximation using drawbox (square)
    // In production, we'd generate an SVG circle and overlay it
    const radius = Math.min(options.size.width, options.size.height) / 2;
    const cx = options.position.x + radius;
    const cy = options.position.y + radius;

    // This is a placeholder - in production we'd generate an SVG
    return this.buildRectangleFilter(
      {
        ...options,
        position: { x: cx - radius, y: cy - radius },
        size: { width: radius * 2, height: radius * 2 },
      },
      color,
      alpha
    );
  }

  /**
   * Build ellipse filter
   */
  private buildEllipseFilter(
    options: ShapeOptions,
    color: string,
    alpha: number
  ): string {
    // Similar to circle, FFmpeg doesn't have native ellipse support
    // We'd generate an SVG in production
    return this.buildRectangleFilter(options, color, alpha);
  }

  /**
   * Build line filter using drawbox with height=1
   */
  private buildLineFilter(
    options: ShapeOptions,
    color: string,
    alpha: number
  ): string {
    const { position, size, thickness } = options;
    const t = thickness || 2;

    // Horizontal or vertical line
    const isHorizontal = size.width > size.height;

    if (isHorizontal) {
      return `drawbox=x=${position.x}:y=${position.y}:w=${size.width}:h=${t}:color=${color}@${alpha}:t=fill`;
    } else {
      return `drawbox=x=${position.x}:y=${position.y}:w=${t}:h=${size.height}:color=${color}@${alpha}:t=fill`;
    }
  }

  /**
   * Build arrow filter
   * This requires generating an SVG and overlaying it
   */
  private buildArrowFilter(
    options: ShapeOptions,
    color: string,
    alpha: number
  ): string {
    // Placeholder - in production we'd generate an SVG arrow
    return this.buildLineFilter(options, color, alpha);
  }

  /**
   * Build polygon filter
   * This requires generating an SVG and overlaying it
   */
  private buildPolygonFilter(
    options: ShapeOptions,
    color: string,
    alpha: number
  ): string {
    if (!options.points || options.points.length < 3) {
      throw new Error('Polygon requires at least 3 points');
    }

    // Placeholder - in production we'd generate an SVG polygon
    return this.buildRectangleFilter(options, color, alpha);
  }

  /**
   * Generate SVG for complex shapes
   */
  private async generateShapeSVG(
    options: ShapeOptions,
    outputPath: string
  ): Promise<string> {
    const builder = new SVGBuilder(options.size.width, options.size.height, 'transparent');

    switch (options.type) {
      case 'circle':
        {
          const radius = Math.min(options.size.width, options.size.height) / 2;
          const cx = options.size.width / 2;
          const cy = options.size.height / 2;
          builder.circle(cx, cy, radius, {
            fill: options.filled !== false ? options.color : 'none',
            stroke: options.filled === false ? options.color : undefined,
            strokeWidth: options.thickness || 2,
            opacity: options.opacity,
          });
        }
        break;

      case 'ellipse':
        {
          const rx = options.size.width / 2;
          const ry = options.size.height / 2;
          const cx = options.size.width / 2;
          const cy = options.size.height / 2;
          builder.ellipse(cx, cy, rx, ry, {
            fill: options.filled !== false ? options.color : 'none',
            stroke: options.filled === false ? options.color : undefined,
            strokeWidth: options.thickness || 2,
            opacity: options.opacity,
          });
        }
        break;

      case 'polygon':
        if (options.points) {
          builder.polygon(options.points, {
            fill: options.filled !== false ? options.color : 'none',
            stroke: options.filled === false ? options.color : undefined,
            strokeWidth: options.thickness || 2,
            opacity: options.opacity,
          });
        }
        break;

      case 'arrow':
        {
          // Draw arrow as a path
          const x1 = 0;
          const y1 = options.size.height / 2;
          const x2 = options.size.width;
          const y2 = options.size.height / 2;
          const arrowSize = Math.min(options.size.width, options.size.height) * 0.2;

          const angle = Math.atan2(y2 - y1, x2 - x1);
          const arrowAngle = Math.PI / 6;

          const arrowPoint1 = {
            x: x2 - arrowSize * Math.cos(angle - arrowAngle),
            y: y2 - arrowSize * Math.sin(angle - arrowAngle),
          };

          const arrowPoint2 = {
            x: x2 - arrowSize * Math.cos(angle + arrowAngle),
            y: y2 - arrowSize * Math.sin(angle + arrowAngle),
          };

          builder.line(x1, y1, x2, y2, {
            stroke: options.color,
            strokeWidth: options.thickness || 2,
            opacity: options.opacity,
          });

          builder.line(arrowPoint1.x, arrowPoint1.y, x2, y2, {
            stroke: options.color,
            strokeWidth: options.thickness || 2,
            opacity: options.opacity,
          });

          builder.line(arrowPoint2.x, arrowPoint2.y, x2, y2, {
            stroke: options.color,
            strokeWidth: options.thickness || 2,
            opacity: options.opacity,
          });
        }
        break;
    }

    await builder.save(outputPath);
    return outputPath;
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
