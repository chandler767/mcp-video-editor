/**
 * Color utilities for parsing, converting, and manipulating colors
 */

import { Color } from '../types/visual-types.js';

export interface RGB {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

export interface RGBA extends RGB {
  a: number; // 0-1
}

export interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

export interface HSV {
  h: number; // 0-360
  s: number; // 0-100
  v: number; // 0-100
}

/**
 * Named colors map (common HTML colors)
 */
const namedColors: Record<string, string> = {
  black: '#000000',
  white: '#FFFFFF',
  red: '#FF0000',
  green: '#00FF00',
  blue: '#0000FF',
  yellow: '#FFFF00',
  cyan: '#00FFFF',
  magenta: '#FF00FF',
  orange: '#FFA500',
  purple: '#800080',
  pink: '#FFC0CB',
  brown: '#A52A2A',
  gray: '#808080',
  grey: '#808080',
  transparent: '#00000000',
};

/**
 * Parse color string to RGB
 * Supports hex (#RGB, #RRGGBB, #RRGGBBAA), rgb(), rgba(), and named colors
 */
export function parseColor(color: Color): RGBA {
  // Handle transparent
  if (color === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  // Handle named colors
  const namedColor = namedColors[color.toLowerCase()];
  if (namedColor) {
    return parseColor(namedColor);
  }

  // Handle hex colors
  if (color.startsWith('#')) {
    return parseHexColor(color);
  }

  // Handle rgb/rgba
  if (color.startsWith('rgb')) {
    return parseRGBColor(color);
  }

  // Handle hsl/hsla
  if (color.startsWith('hsl')) {
    return parseHSLColor(color);
  }

  // Default to black
  return { r: 0, g: 0, b: 0, a: 1 };
}

/**
 * Parse hex color (#RGB, #RRGGBB, #RRGGBBAA)
 */
function parseHexColor(hex: string): RGBA {
  hex = hex.replace('#', '');

  let r, g, b, a = 255;

  if (hex.length === 3) {
    // #RGB
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length === 6) {
    // #RRGGBB
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  } else if (hex.length === 8) {
    // #RRGGBBAA
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
    a = parseInt(hex.substring(6, 8), 16);
  } else {
    return { r: 0, g: 0, b: 0, a: 1 };
  }

  return { r, g, b, a: a / 255 };
}

/**
 * Parse rgb/rgba color
 */
function parseRGBColor(rgb: string): RGBA {
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) {
    return { r: 0, g: 0, b: 0, a: 1 };
  }

  return {
    r: parseInt(match[1]),
    g: parseInt(match[2]),
    b: parseInt(match[3]),
    a: match[4] ? parseFloat(match[4]) : 1,
  };
}

/**
 * Parse hsl/hsla color
 */
function parseHSLColor(hsl: string): RGBA {
  const match = hsl.match(/hsla?\((\d+),\s*([\d.]+)%,\s*([\d.]+)%(?:,\s*([\d.]+))?\)/);
  if (!match) {
    return { r: 0, g: 0, b: 0, a: 1 };
  }

  const h = parseInt(match[1]);
  const s = parseFloat(match[2]);
  const l = parseFloat(match[3]);
  const a = match[4] ? parseFloat(match[4]) : 1;

  const rgb = hslToRgb({ h, s, l });
  return { ...rgb, a };
}

/**
 * Convert RGB to hex color
 */
export function rgbToHex(rgb: RGB | RGBA): string {
  const r = Math.round(rgb.r).toString(16).padStart(2, '0');
  const g = Math.round(rgb.g).toString(16).padStart(2, '0');
  const b = Math.round(rgb.b).toString(16).padStart(2, '0');

  if ('a' in rgb && rgb.a < 1) {
    const a = Math.round(rgb.a * 255)
      .toString(16)
      .padStart(2, '0');
    return `#${r}${g}${b}${a}`;
  }

  return `#${r}${g}${b}`;
}

/**
 * Convert RGB to HSL
 */
export function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    if (max === r) {
      h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      h = ((b - r) / delta + 2) / 6;
    } else {
      h = ((r - g) / delta + 4) / 6;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Convert HSL to RGB
 */
export function hslToRgb(hsl: HSL): RGB {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Convert RGB to HSV
 */
export function rgbToHsv(rgb: RGB): HSV {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  const s = max === 0 ? 0 : delta / max;
  const v = max;

  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      h = ((b - r) / delta + 2) / 6;
    } else {
      h = ((r - g) / delta + 4) / 6;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    v: Math.round(v * 100),
  };
}

/**
 * Convert HSV to RGB
 */
export function hsvToRgb(hsv: HSV): RGB {
  const h = hsv.h / 360;
  const s = hsv.s / 100;
  const v = hsv.v / 100;

  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  let r, g, b;

  switch (i % 6) {
    case 0:
      (r = v), (g = t), (b = p);
      break;
    case 1:
      (r = q), (g = v), (b = p);
      break;
    case 2:
      (r = p), (g = v), (b = t);
      break;
    case 3:
      (r = p), (g = q), (b = v);
      break;
    case 4:
      (r = t), (g = p), (b = v);
      break;
    case 5:
      (r = v), (g = p), (b = q);
      break;
    default:
      (r = 0), (g = 0), (b = 0);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Lighten a color by a percentage
 */
export function lighten(color: Color, amount: number): string {
  const rgb = parseColor(color);
  const hsl = rgbToHsl(rgb);
  hsl.l = Math.min(100, hsl.l + amount);
  const newRgb = hslToRgb(hsl);
  return rgbToHex({ ...newRgb, a: rgb.a });
}

/**
 * Darken a color by a percentage
 */
export function darken(color: Color, amount: number): string {
  const rgb = parseColor(color);
  const hsl = rgbToHsl(rgb);
  hsl.l = Math.max(0, hsl.l - amount);
  const newRgb = hslToRgb(hsl);
  return rgbToHex({ ...newRgb, a: rgb.a });
}

/**
 * Saturate a color by a percentage
 */
export function saturate(color: Color, amount: number): string {
  const rgb = parseColor(color);
  const hsl = rgbToHsl(rgb);
  hsl.s = Math.min(100, hsl.s + amount);
  const newRgb = hslToRgb(hsl);
  return rgbToHex({ ...newRgb, a: rgb.a });
}

/**
 * Desaturate a color by a percentage
 */
export function desaturate(color: Color, amount: number): string {
  const rgb = parseColor(color);
  const hsl = rgbToHsl(rgb);
  hsl.s = Math.max(0, hsl.s - amount);
  const newRgb = hslToRgb(hsl);
  return rgbToHex({ ...newRgb, a: rgb.a });
}

/**
 * Adjust color opacity
 */
export function opacity(color: Color, alpha: number): string {
  const rgb = parseColor(color);
  return rgbToHex({ ...rgb, a: Math.max(0, Math.min(1, alpha)) });
}

/**
 * Mix two colors
 */
export function mix(color1: Color, color2: Color, weight: number = 0.5): string {
  const rgb1 = parseColor(color1);
  const rgb2 = parseColor(color2);

  const w = weight * 2 - 1;
  const a = rgb1.a - rgb2.a;

  const w1 = ((w * a === -1 ? w : (w + a) / (1 + w * a)) + 1) / 2;
  const w2 = 1 - w1;

  return rgbToHex({
    r: Math.round(rgb1.r * w1 + rgb2.r * w2),
    g: Math.round(rgb1.g * w1 + rgb2.g * w2),
    b: Math.round(rgb1.b * w1 + rgb2.b * w2),
    a: rgb1.a * weight + rgb2.a * (1 - weight),
  });
}

/**
 * Get complementary color (opposite on color wheel)
 */
export function complementary(color: Color): string {
  const rgb = parseColor(color);
  const hsl = rgbToHsl(rgb);
  hsl.h = (hsl.h + 180) % 360;
  const newRgb = hslToRgb(hsl);
  return rgbToHex({ ...newRgb, a: rgb.a });
}

/**
 * Get triadic colors (evenly spaced on color wheel)
 */
export function triadic(color: Color): [string, string, string] {
  const rgb = parseColor(color);
  const hsl = rgbToHsl(rgb);

  const hsl2 = { ...hsl, h: (hsl.h + 120) % 360 };
  const hsl3 = { ...hsl, h: (hsl.h + 240) % 360 };

  return [
    rgbToHex({ ...hslToRgb(hsl), a: rgb.a }),
    rgbToHex({ ...hslToRgb(hsl2), a: rgb.a }),
    rgbToHex({ ...hslToRgb(hsl3), a: rgb.a }),
  ];
}

/**
 * Get analogous colors (adjacent on color wheel)
 */
export function analogous(color: Color, angle: number = 30): [string, string, string] {
  const rgb = parseColor(color);
  const hsl = rgbToHsl(rgb);

  const hsl1 = { ...hsl, h: (hsl.h - angle + 360) % 360 };
  const hsl2 = { ...hsl, h: (hsl.h + angle) % 360 };

  return [
    rgbToHex({ ...hslToRgb(hsl1), a: rgb.a }),
    rgbToHex({ ...hslToRgb(hsl), a: rgb.a }),
    rgbToHex({ ...hslToRgb(hsl2), a: rgb.a }),
  ];
}

/**
 * Convert color to grayscale
 */
export function grayscale(color: Color): string {
  const rgb = parseColor(color);
  const gray = Math.round(0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b);
  return rgbToHex({ r: gray, g: gray, b: gray, a: rgb.a });
}

/**
 * Invert color
 */
export function invert(color: Color): string {
  const rgb = parseColor(color);
  return rgbToHex({
    r: 255 - rgb.r,
    g: 255 - rgb.g,
    b: 255 - rgb.b,
    a: rgb.a,
  });
}

/**
 * Format color for FFmpeg filters
 * FFmpeg typically uses hex format (#RRGGBB) or 0xRRGGBB
 */
export function toFFmpegColor(color: Color): string {
  const rgb = parseColor(color);
  const hex = rgbToHex(rgb);
  // Remove # and convert to 0x format
  return '0x' + hex.replace('#', '').substring(0, 6);
}

/**
 * Format color with alpha for FFmpeg (0xRRGGBBAA)
 */
export function toFFmpegColorWithAlpha(color: Color, alpha?: number): string {
  const rgb = parseColor(color);
  const finalAlpha = alpha !== undefined ? alpha : rgb.a;
  const hex = rgbToHex({ ...rgb, a: finalAlpha });
  return '0x' + hex.replace('#', '');
}
