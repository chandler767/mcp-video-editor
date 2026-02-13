/**
 * Animation Engine - Keyframe animations, easing, path-based motion
 */

import { FFmpegManager } from './ffmpeg-utils.js';
import {
  AnimatePropertyOptions,
  AnimateAlongPathOptions,
  SpringAnimationOptions,
  AnimationSequence,
  Keyframe,
  AnimatedProperty,
  BezierPath,
  CircularPath,
  Position,
} from './types/visual-types.js';
import {
  getEasingFunction,
  interpolate,
  springEasing,
} from './utils/easing-functions.js';
import {
  bezierPoint,
  circularPathPoint,
  sampleBezierCurve,
  sampleCircularPath,
  bezierAngle,
  circularPathAngle,
} from './utils/path-utils.js';
import path from 'path';
import fs from 'fs/promises';

export class AnimationEngine {
  constructor(private ffmpegManager: FFmpegManager) {}

  /**
   * Animate a single property with keyframes
   */
  async animateProperty(options: AnimatePropertyOptions): Promise<string> {
    await this.ffmpegManager.initialize();
    await this.validateFileExists(options.input, 'Video');
    await this.validateFileExists(options.element, 'Element');

    // Calculate all frame values based on keyframes
    const filterExpression = this.buildPropertyAnimation(options);

    return new Promise((resolve, reject) => {
      const command = this.ffmpegManager
        .createCommand(options.input)
        .input(options.element);

      // Use complexFilter for animated overlay
      command.complexFilter(filterExpression);

      command
        .output(options.output)
        .on('end', () => resolve(options.output))
        .on('error', (err) =>
          reject(new Error(`Failed to animate property: ${err.message}`))
        )
        .run();
    });
  }

  /**
   * Animate element along a path
   */
  async animateAlongPath(options: AnimateAlongPathOptions): Promise<string> {
    await this.ffmpegManager.initialize();
    await this.validateFileExists(options.input, 'Video');
    await this.validateFileExists(options.element, 'Element');

    // Sample path at regular intervals
    const pathPoints = this.samplePath(options.path, options.duration);

    // Build overlay filter with animated position
    const filterExpression = this.buildPathAnimation(options, pathPoints);

    return new Promise((resolve, reject) => {
      const command = this.ffmpegManager
        .createCommand(options.input)
        .input(options.element);

      command.complexFilter(filterExpression);

      command
        .output(options.output)
        .on('end', () => resolve(options.output))
        .on('error', (err) =>
          reject(new Error(`Failed to animate along path: ${err.message}`))
        )
        .run();
    });
  }

  /**
   * Create spring physics animation
   */
  async createSpringAnimation(options: SpringAnimationOptions): Promise<string> {
    await this.ffmpegManager.initialize();
    await this.validateFileExists(options.input, 'Video');
    await this.validateFileExists(options.element, 'Element');

    const keyframes = this.generateSpringKeyframes(options);

    const animOptions: AnimatePropertyOptions = {
      input: options.input,
      element: options.element,
      output: options.output,
      property: options.property,
      keyframes,
      elementPosition: options.elementPosition,
      elementSize: options.elementSize,
    };

    return this.animateProperty(animOptions);
  }

  /**
   * Sequence multiple animations
   */
  async sequenceAnimations(
    input: string,
    output: string,
    sequence: AnimationSequence
  ): Promise<string> {
    await this.ffmpegManager.initialize();

    let currentInput = input;
    let totalDelay = 0;

    for (let i = 0; i < sequence.animations.length; i++) {
      const anim = sequence.animations[i];
      const delay = anim.delay || 0;
      totalDelay += delay;

      const tempOutput =
        i === sequence.animations.length - 1
          ? output
          : path.join(path.dirname(output), `.temp_anim_${i}.mp4`);

      // Adjust start time based on accumulated delay
      const animOptions = { ...anim.options };
      if ('startTime' in animOptions) {
        animOptions.startTime = (animOptions.startTime || 0) + totalDelay;
      }

      // Execute animation based on type
      if ('keyframes' in animOptions) {
        await this.animateProperty(animOptions as AnimatePropertyOptions);
      } else if ('path' in animOptions) {
        await this.animateAlongPath(animOptions as AnimateAlongPathOptions);
      } else if ('stiffness' in animOptions) {
        await this.createSpringAnimation(animOptions as SpringAnimationOptions);
      }

      // Clean up temp files
      if (i > 0 && currentInput !== input) {
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
   * Build property animation filter expression
   */
  private buildPropertyAnimation(options: AnimatePropertyOptions): any[] {
    const { property, keyframes, elementPosition, elementSize } = options;

    // Sort keyframes by time
    const sortedKeyframes = [...keyframes].sort((a, b) => a.time - b.time);

    // Build FFmpeg expression based on property
    let overlayX = elementPosition?.x || 0;
    let overlayY = elementPosition?.y || 0;
    let scaleW = elementSize?.width;
    let scaleH = elementSize?.height;
    let rotation = 0;
    let opacity = 1;

    // Build time-based expression
    const expression = this.buildKeyframeExpression(property, sortedKeyframes);

    const filters: any[] = [];

    // Apply transformations
    if (property === 'scale' || scaleW || scaleH) {
      const scaleExpr =
        property === 'scale'
          ? `iw*${expression}:ih*${expression}`
          : `${scaleW || 'iw'}:${scaleH || 'ih'}`;

      filters.push({
        filter: 'scale',
        options: scaleExpr,
        inputs: '[1:v]',
        outputs: '[scaled]',
      });
    }

    if (property === 'rotation') {
      filters.push({
        filter: 'rotate',
        options: `'${expression}':c=none`,
        inputs: filters.length > 0 ? '[scaled]' : '[1:v]',
        outputs: '[rotated]',
      });
    }

    if (property === 'opacity') {
      const currentInput =
        filters.length > 0 ? `[${filters[filters.length - 1].outputs}]` : '[1:v]';

      filters.push({
        filter: 'format',
        options: 'rgba',
        inputs: currentInput,
        outputs: '[formatted]',
      });

      filters.push({
        filter: 'colorchannelmixer',
        options: `aa=${expression}`,
        inputs: '[formatted]',
        outputs: '[opaque]',
      });
    }

    // Build overlay with animated position
    const overlayInput =
      filters.length > 0 ? `[${filters[filters.length - 1].outputs}]` : '[1:v]';

    let xExpr = String(overlayX);
    let yExpr = String(overlayY);

    if (property === 'x') {
      xExpr = expression;
    } else if (property === 'y') {
      yExpr = expression;
    }

    filters.push({
      filter: 'overlay',
      options: {
        x: xExpr,
        y: yExpr,
      },
      inputs: ['[0:v]', overlayInput],
    });

    return filters;
  }

  /**
   * Build keyframe expression for FFmpeg
   */
  private buildKeyframeExpression(
    property: AnimatedProperty,
    keyframes: Keyframe[]
  ): string {
    // For complex keyframe animations, we need to build piecewise expressions
    // This is a simplified version - production would handle more cases

    if (keyframes.length === 0) {
      return '0';
    }

    if (keyframes.length === 1) {
      return String(keyframes[0].value);
    }

    // Build between() expressions for each keyframe segment
    const segments: string[] = [];

    for (let i = 0; i < keyframes.length - 1; i++) {
      const k1 = keyframes[i];
      const k2 = keyframes[i + 1];

      const easingFn = getEasingFunction(k1.easing);

      // Calculate interpolation at various points
      const startTime = k1.time;
      const endTime = k2.time;
      const startValue = k1.value;
      const endValue = k2.value;

      // Simple linear interpolation for now
      // In production, we'd sample the easing function and build lookup table
      const slope = (endValue - startValue) / (endTime - startTime);
      const segment = `if(between(t,${startTime},${endTime}),${startValue}+(t-${startTime})*${slope},`;
      segments.push(segment);
    }

    // Build nested if expression
    let expression = String(keyframes[keyframes.length - 1].value);
    for (const segment of segments.reverse()) {
      expression = segment + expression + ')';
    }

    return expression;
  }

  /**
   * Sample path at regular intervals for animation
   */
  private samplePath(
    path: BezierPath | CircularPath | Position[],
    duration: number
  ): Position[] {
    const fps = 30; // Sample at 30 FPS
    const numSamples = Math.ceil(duration * fps);

    if (Array.isArray(path)) {
      // Array of positions - interpolate between them
      return this.interpolatePositions(path, numSamples);
    } else if ('points' in path) {
      // Bezier path
      return sampleBezierCurve(path.points, numSamples);
    } else {
      // Circular path
      const startAngle = path.startAngle || 0;
      const endAngle = path.endAngle || 360;
      const clockwise = path.clockwise !== false;
      return sampleCircularPath(
        path.center,
        path.radius,
        startAngle,
        endAngle,
        numSamples,
        clockwise
      );
    }
  }

  /**
   * Interpolate between array of positions
   */
  private interpolatePositions(positions: Position[], numSamples: number): Position[] {
    if (positions.length === 0) return [];
    if (positions.length === 1) return Array(numSamples).fill(positions[0]);

    const samples: Position[] = [];
    const segmentLength = (numSamples - 1) / (positions.length - 1);

    for (let i = 0; i < numSamples; i++) {
      const segment = Math.floor(i / segmentLength);
      const t = (i % segmentLength) / segmentLength;

      const p1 = positions[Math.min(segment, positions.length - 1)];
      const p2 = positions[Math.min(segment + 1, positions.length - 1)];

      samples.push({
        x: p1.x + (p2.x - p1.x) * t,
        y: p1.y + (p2.y - p1.y) * t,
      });
    }

    return samples;
  }

  /**
   * Build path animation filter expression
   */
  private buildPathAnimation(
    options: AnimateAlongPathOptions,
    pathPoints: Position[]
  ): any[] {
    const filters: any[] = [];
    const fps = 30;
    const numFrames = pathPoints.length;

    // For path animation, we need to use zoompan or overlay with expressions
    // This is simplified - production would use more sophisticated approach

    // Build position keyframes from path
    const positionExpression = this.buildPathPositionExpression(
      pathPoints,
      options.duration,
      fps
    );

    if (options.elementSize) {
      filters.push({
        filter: 'scale',
        options: `${options.elementSize.width}:${options.elementSize.height}`,
        inputs: '[1:v]',
        outputs: '[scaled]',
      });
    }

    const overlayInput = filters.length > 0 ? '[scaled]' : '[1:v]';

    filters.push({
      filter: 'overlay',
      options: {
        x: positionExpression.x,
        y: positionExpression.y,
      },
      inputs: ['[0:v]', overlayInput],
    });

    return filters;
  }

  /**
   * Build path position expression
   */
  private buildPathPositionExpression(
    pathPoints: Position[],
    duration: number,
    fps: number
  ): { x: string; y: string } {
    // For simplicity, use the first and last points
    // In production, we'd build a more complex piecewise expression
    const start = pathPoints[0];
    const end = pathPoints[pathPoints.length - 1];

    const dx = end.x - start.x;
    const dy = end.y - start.y;

    return {
      x: `${start.x}+(t/${duration})*${dx}`,
      y: `${start.y}+(t/${duration})*${dy}`,
    };
  }

  /**
   * Generate keyframes for spring animation
   */
  private generateSpringKeyframes(options: SpringAnimationOptions): Keyframe[] {
    const { from, to, duration, stiffness, damping, mass, startTime } = options;

    const fps = 30;
    const numFrames = Math.ceil(duration * fps);
    const springFn = springEasing(stiffness, damping, mass);

    const keyframes: Keyframe[] = [];

    for (let i = 0; i <= numFrames; i++) {
      const t = i / numFrames;
      const easedT = springFn(t);
      const value = from + (to - from) * easedT;
      const time = (startTime || 0) + t * duration;

      keyframes.push({
        time,
        value,
        easing: 'linear', // Spring easing is already applied
      });
    }

    return keyframes;
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
