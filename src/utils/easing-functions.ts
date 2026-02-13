/**
 * Easing functions for smooth animations
 * All functions take a time value t (0-1) and return an eased value (0-1)
 */

import { EasingFunction, CubicBezier } from '../types/visual-types.js';

/**
 * Linear easing - no acceleration
 */
export function linear(t: number): number {
  return t;
}

/**
 * Quadratic easing in - accelerating from zero velocity
 */
export function easeInQuad(t: number): number {
  return t * t;
}

/**
 * Quadratic easing out - decelerating to zero velocity
 */
export function easeOutQuad(t: number): number {
  return t * (2 - t);
}

/**
 * Quadratic easing in and out
 */
export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/**
 * Cubic easing in - accelerating from zero velocity
 */
export function easeInCubic(t: number): number {
  return t * t * t;
}

/**
 * Cubic easing out - decelerating to zero velocity
 */
export function easeOutCubic(t: number): number {
  return --t * t * t + 1;
}

/**
 * Cubic easing in and out
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
}

/**
 * Quartic easing in
 */
export function easeInQuart(t: number): number {
  return t * t * t * t;
}

/**
 * Quartic easing out
 */
export function easeOutQuart(t: number): number {
  return 1 - --t * t * t * t;
}

/**
 * Quartic easing in and out
 */
export function easeInOutQuart(t: number): number {
  return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t;
}

/**
 * Simple ease-in (same as easeInQuad)
 */
export function easeIn(t: number): number {
  return easeInQuad(t);
}

/**
 * Simple ease-out (same as easeOutQuad)
 */
export function easeOut(t: number): number {
  return easeOutQuad(t);
}

/**
 * Simple ease-in-out (same as easeInOutQuad)
 */
export function easeInOut(t: number): number {
  return easeInOutQuad(t);
}

/**
 * Cubic bezier easing function
 * Based on https://en.wikipedia.org/wiki/B%C3%A9zier_curve
 */
export function cubicBezier(bezier: CubicBezier): (t: number) => number {
  const { x1, y1, x2, y2 } = bezier;

  // Validate control points
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
    throw new Error('Bezier x values must be in range [0, 1]');
  }

  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;

    // Binary search to find the t value for the given x
    let start = 0;
    let end = 1;
    let mid = 0;
    const epsilon = 0.0001;

    while (start < end) {
      mid = (start + end) / 2;
      const x = sampleCubicBezierX(mid, x1, x2);

      if (Math.abs(x - t) < epsilon) {
        break;
      }

      if (x < t) {
        start = mid;
      } else {
        end = mid;
      }

      // Prevent infinite loop
      if (end - start < epsilon) {
        break;
      }
    }

    return sampleCubicBezierY(mid, y1, y2);
  };
}

/**
 * Sample x value from cubic bezier curve at parameter t
 */
function sampleCubicBezierX(t: number, x1: number, x2: number): number {
  // Cubic bezier formula: B(t) = (1-t)³*P0 + 3(1-t)²t*P1 + 3(1-t)t²*P2 + t³*P3
  // For x: P0=0, P3=1
  return 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
}

/**
 * Sample y value from cubic bezier curve at parameter t
 */
function sampleCubicBezierY(t: number, y1: number, y2: number): number {
  // Same formula as X but for Y values
  return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
}

/**
 * Get easing function by name or cubic bezier definition
 */
export function getEasingFunction(
  easing: EasingFunction | CubicBezier | undefined
): (t: number) => number {
  if (!easing) {
    return linear;
  }

  if (typeof easing === 'object') {
    // It's a CubicBezier
    return cubicBezier(easing);
  }

  // It's an EasingFunction string
  switch (easing) {
    case 'linear':
      return linear;
    case 'ease-in':
      return easeIn;
    case 'ease-out':
      return easeOut;
    case 'ease-in-out':
      return easeInOut;
    case 'ease-in-quad':
      return easeInQuad;
    case 'ease-out-quad':
      return easeOutQuad;
    case 'ease-in-out-quad':
      return easeInOutQuad;
    case 'ease-in-cubic':
      return easeInCubic;
    case 'ease-out-cubic':
      return easeOutCubic;
    case 'ease-in-out-cubic':
      return easeInOutCubic;
    case 'ease-in-quart':
      return easeInQuart;
    case 'ease-out-quart':
      return easeOutQuart;
    case 'ease-in-out-quart':
      return easeInOutQuart;
    default:
      return linear;
  }
}

/**
 * Interpolate between two values using an easing function
 */
export function interpolate(
  from: number,
  to: number,
  progress: number,
  easing?: EasingFunction | CubicBezier
): number {
  const easingFn = getEasingFunction(easing);
  const easedProgress = easingFn(progress);
  return from + (to - from) * easedProgress;
}

/**
 * Spring physics easing
 * Based on spring damping equations
 */
export function springEasing(
  stiffness: number = 100,
  damping: number = 10,
  mass: number = 1
): (t: number) => number {
  return (t: number) => {
    if (t === 0 || t === 1) return t;

    const w0 = Math.sqrt(stiffness / mass);
    const zeta = damping / (2 * Math.sqrt(stiffness * mass));

    if (zeta < 1) {
      // Under-damped (oscillating)
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      const A = 1;
      const B = (zeta * w0) / wd;
      return 1 - Math.exp(-zeta * w0 * t) * (A * Math.cos(wd * t) + B * Math.sin(wd * t));
    } else if (zeta === 1) {
      // Critically damped
      return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    } else {
      // Over-damped
      const r1 = -w0 * (zeta - Math.sqrt(zeta * zeta - 1));
      const r2 = -w0 * (zeta + Math.sqrt(zeta * zeta - 1));
      const A = -r2 / (r2 - r1);
      const B = r1 / (r2 - r1);
      return 1 - (A * Math.exp(r1 * t) + B * Math.exp(r2 * t));
    }
  };
}

/**
 * Bounce easing out
 */
export function bounceOut(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;

  if (t < 1 / d1) {
    return n1 * t * t;
  } else if (t < 2 / d1) {
    return n1 * (t -= 1.5 / d1) * t + 0.75;
  } else if (t < 2.5 / d1) {
    return n1 * (t -= 2.25 / d1) * t + 0.9375;
  } else {
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }
}

/**
 * Bounce easing in
 */
export function bounceIn(t: number): number {
  return 1 - bounceOut(1 - t);
}

/**
 * Bounce easing in and out
 */
export function bounceInOut(t: number): number {
  return t < 0.5 ? bounceIn(t * 2) * 0.5 : bounceOut(t * 2 - 1) * 0.5 + 0.5;
}

/**
 * Elastic easing out
 */
export function elasticOut(t: number): number {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

/**
 * Elastic easing in
 */
export function elasticIn(t: number): number {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
}

/**
 * Elastic easing in and out
 */
export function elasticInOut(t: number): number {
  const c5 = (2 * Math.PI) / 4.5;

  return t === 0
    ? 0
    : t === 1
      ? 1
      : t < 0.5
        ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
        : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
}
