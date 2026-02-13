/**
 * Path utilities for bezier curves and path-based animations
 */

import { Position, BezierPath, CircularPath } from '../types/visual-types.js';

/**
 * Calculate a point on a bezier curve at parameter t (0-1)
 * Uses De Casteljau's algorithm for any number of control points
 */
export function bezierPoint(controlPoints: Position[], t: number): Position {
  if (controlPoints.length === 0) {
    throw new Error('Bezier curve requires at least one control point');
  }

  if (controlPoints.length === 1) {
    return controlPoints[0];
  }

  // Recursive De Casteljau's algorithm
  const newPoints: Position[] = [];
  for (let i = 0; i < controlPoints.length - 1; i++) {
    const p0 = controlPoints[i];
    const p1 = controlPoints[i + 1];
    newPoints.push({
      x: p0.x + (p1.x - p0.x) * t,
      y: p0.y + (p1.y - p0.y) * t,
    });
  }

  return bezierPoint(newPoints, t);
}

/**
 * Calculate a point on a quadratic bezier curve (3 control points)
 * Optimized version for quadratic curves
 */
export function quadraticBezierPoint(p0: Position, p1: Position, p2: Position, t: number): Position {
  const oneMinusT = 1 - t;
  return {
    x: oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x,
    y: oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * p1.y + t * t * p2.y,
  };
}

/**
 * Calculate a point on a cubic bezier curve (4 control points)
 * Optimized version for cubic curves
 */
export function cubicBezierPoint(
  p0: Position,
  p1: Position,
  p2: Position,
  p3: Position,
  t: number
): Position {
  const oneMinusT = 1 - t;
  const oneMinusT2 = oneMinusT * oneMinusT;
  const oneMinusT3 = oneMinusT2 * oneMinusT;
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x: oneMinusT3 * p0.x + 3 * oneMinusT2 * t * p1.x + 3 * oneMinusT * t2 * p2.x + t3 * p3.x,
    y: oneMinusT3 * p0.y + 3 * oneMinusT2 * t * p1.y + 3 * oneMinusT * t2 * p2.y + t3 * p3.y,
  };
}

/**
 * Calculate the length of a bezier curve
 * Uses numerical integration (Simpson's rule)
 */
export function bezierLength(controlPoints: Position[], segments: number = 100): number {
  let length = 0;
  let prevPoint = controlPoints[0];

  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const point = bezierPoint(controlPoints, t);
    length += distance(prevPoint, point);
    prevPoint = point;
  }

  return length;
}

/**
 * Sample points along a bezier curve at regular intervals
 */
export function sampleBezierCurve(
  controlPoints: Position[],
  numSamples: number
): Position[] {
  const samples: Position[] = [];

  for (let i = 0; i < numSamples; i++) {
    const t = i / (numSamples - 1);
    samples.push(bezierPoint(controlPoints, t));
  }

  return samples;
}

/**
 * Calculate the tangent (direction) vector at a point on a bezier curve
 */
export function bezierTangent(controlPoints: Position[], t: number): Position {
  const epsilon = 0.001;
  const t1 = Math.max(0, t - epsilon);
  const t2 = Math.min(1, t + epsilon);

  const p1 = bezierPoint(controlPoints, t1);
  const p2 = bezierPoint(controlPoints, t2);

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  return {
    x: dx / length,
    y: dy / length,
  };
}

/**
 * Calculate the angle (in degrees) of the tangent at a point on a bezier curve
 */
export function bezierAngle(controlPoints: Position[], t: number): number {
  const tangent = bezierTangent(controlPoints, t);
  return (Math.atan2(tangent.y, tangent.x) * 180) / Math.PI;
}

/**
 * Calculate a point on a circular path
 */
export function circularPathPoint(
  center: Position,
  radius: number,
  angle: number,
  clockwise: boolean = true
): Position {
  const radians = (angle * Math.PI) / 180;
  const direction = clockwise ? 1 : -1;

  return {
    x: center.x + radius * Math.cos(radians * direction),
    y: center.y + radius * Math.sin(radians * direction),
  };
}

/**
 * Sample points along a circular path
 */
export function sampleCircularPath(
  center: Position,
  radius: number,
  startAngle: number,
  endAngle: number,
  numSamples: number,
  clockwise: boolean = true
): Position[] {
  const samples: Position[] = [];
  const angleRange = endAngle - startAngle;

  for (let i = 0; i < numSamples; i++) {
    const t = i / (numSamples - 1);
    const angle = startAngle + angleRange * t;
    samples.push(circularPathPoint(center, radius, angle, clockwise));
  }

  return samples;
}

/**
 * Calculate the angle (in degrees) of the tangent on a circular path
 */
export function circularPathAngle(
  angle: number,
  clockwise: boolean = true
): number {
  const direction = clockwise ? 1 : -1;
  return angle + 90 * direction;
}

/**
 * Convert an array of positions to a bezier path definition
 */
export function positionsToPath(positions: Position[]): Position[] {
  return positions;
}

/**
 * Calculate distance between two positions
 */
export function distance(p1: Position, p2: Position): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Normalize path to fit within bounds
 */
export function normalizePath(
  path: Position[],
  targetWidth: number,
  targetHeight: number,
  padding: number = 0
): Position[] {
  if (path.length === 0) return [];

  // Find bounding box
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const point of path) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  const pathWidth = maxX - minX;
  const pathHeight = maxY - minY;

  // Calculate scale to fit
  const availableWidth = targetWidth - 2 * padding;
  const availableHeight = targetHeight - 2 * padding;
  const scale = Math.min(availableWidth / pathWidth, availableHeight / pathHeight);

  // Calculate offset to center
  const scaledWidth = pathWidth * scale;
  const scaledHeight = pathHeight * scale;
  const offsetX = padding + (availableWidth - scaledWidth) / 2 - minX * scale;
  const offsetY = padding + (availableHeight - scaledHeight) / 2 - minY * scale;

  // Transform path
  return path.map((point) => ({
    x: point.x * scale + offsetX,
    y: point.y * scale + offsetY,
  }));
}

/**
 * Smooth a path using Catmull-Rom splines
 */
export function smoothPath(path: Position[], alpha: number = 0.5): Position[] {
  if (path.length < 3) return path;

  const smoothed: Position[] = [];
  const numSegments = 10; // Points per segment

  for (let i = 0; i < path.length - 1; i++) {
    const p0 = i > 0 ? path[i - 1] : path[i];
    const p1 = path[i];
    const p2 = path[i + 1];
    const p3 = i < path.length - 2 ? path[i + 2] : p2;

    for (let j = 0; j < numSegments; j++) {
      const t = j / numSegments;
      const point = catmullRomPoint(p0, p1, p2, p3, t, alpha);
      smoothed.push(point);
    }
  }

  smoothed.push(path[path.length - 1]);
  return smoothed;
}

/**
 * Calculate a point on a Catmull-Rom spline
 */
function catmullRomPoint(
  p0: Position,
  p1: Position,
  p2: Position,
  p3: Position,
  t: number,
  alpha: number
): Position {
  const t01 = Math.pow(distance(p0, p1), alpha);
  const t12 = Math.pow(distance(p1, p2), alpha);
  const t23 = Math.pow(distance(p2, p3), alpha);

  const m1x = (p2.x - p1.x + t12 * ((p1.x - p0.x) / t01 - (p2.x - p0.x) / (t01 + t12))) * (1 - alpha);
  const m1y = (p2.y - p1.y + t12 * ((p1.y - p0.y) / t01 - (p2.y - p0.y) / (t01 + t12))) * (1 - alpha);

  const m2x = (p2.x - p1.x + t12 * ((p3.x - p2.x) / t23 - (p3.x - p1.x) / (t12 + t23))) * (1 - alpha);
  const m2y = (p2.y - p1.y + t12 * ((p3.y - p2.y) / t23 - (p3.y - p1.y) / (t12 + t23))) * (1 - alpha);

  const a = 2 * (p1.x - p2.x) + m1x + m2x;
  const b = -3 * (p1.x - p2.x) - 2 * m1x - m2x;
  const c = m1x;
  const d = p1.x;

  const e = 2 * (p1.y - p2.y) + m1y + m2y;
  const f = -3 * (p1.y - p2.y) - 2 * m1y - m2y;
  const g = m1y;
  const h = p1.y;

  return {
    x: a * t * t * t + b * t * t + c * t + d,
    y: e * t * t * t + f * t * t + g * t + h,
  };
}

/**
 * Create a path from SVG path data string
 * Supports M, L, C, Q commands
 */
export function parseSVGPath(pathData: string): Position[] {
  const points: Position[] = [];
  const commands = pathData.match(/[MLCQmlcq][^MLCQmlcq]*/g) || [];

  let currentX = 0;
  let currentY = 0;

  for (const command of commands) {
    const type = command[0];
    const values = command
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .map(Number);

    switch (type.toUpperCase()) {
      case 'M': // Move to
        currentX = values[0];
        currentY = values[1];
        points.push({ x: currentX, y: currentY });
        break;

      case 'L': // Line to
        currentX = values[0];
        currentY = values[1];
        points.push({ x: currentX, y: currentY });
        break;

      case 'C': // Cubic bezier
        {
          const samples = sampleBezierCurve(
            [
              { x: currentX, y: currentY },
              { x: values[0], y: values[1] },
              { x: values[2], y: values[3] },
              { x: values[4], y: values[5] },
            ],
            10
          );
          points.push(...samples);
          currentX = values[4];
          currentY = values[5];
        }
        break;

      case 'Q': // Quadratic bezier
        {
          const samples = sampleBezierCurve(
            [
              { x: currentX, y: currentY },
              { x: values[0], y: values[1] },
              { x: values[2], y: values[3] },
            ],
            10
          );
          points.push(...samples);
          currentX = values[2];
          currentY = values[3];
        }
        break;
    }
  }

  return points;
}

/**
 * Create SVG path data string from positions
 */
export function positionsToSVGPath(positions: Position[]): string {
  if (positions.length === 0) return '';

  let pathData = `M ${positions[0].x} ${positions[0].y}`;

  for (let i = 1; i < positions.length; i++) {
    pathData += ` L ${positions[i].x} ${positions[i].y}`;
  }

  return pathData;
}
