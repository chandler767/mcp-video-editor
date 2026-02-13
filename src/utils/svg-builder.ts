/**
 * SVG builder utility for creating SVG graphics programmatically
 */

import { Position, Size, Color } from '../types/visual-types.js';
import * as fs from 'fs/promises';

export interface SVGElement {
  type: string;
  attributes: Record<string, string | number>;
  children?: SVGElement[];
  text?: string;
}

export class SVGBuilder {
  private width: number;
  private height: number;
  private elements: SVGElement[] = [];
  private defs: SVGElement[] = [];
  private viewBox?: string;
  private backgroundColor?: Color;

  constructor(width: number, height: number, backgroundColor?: Color) {
    this.width = width;
    this.height = height;
    this.backgroundColor = backgroundColor;
    this.viewBox = `0 0 ${width} ${height}`;
  }

  /**
   * Set custom viewBox
   */
  setViewBox(x: number, y: number, width: number, height: number): this {
    this.viewBox = `${x} ${y} ${width} ${height}`;
    return this;
  }

  /**
   * Add a rectangle
   */
  rect(
    x: number,
    y: number,
    width: number,
    height: number,
    options: {
      fill?: Color;
      stroke?: Color;
      strokeWidth?: number;
      rx?: number;
      ry?: number;
      opacity?: number;
      id?: string;
      class?: string;
    } = {}
  ): this {
    const attrs: Record<string, string | number> = {
      x,
      y,
      width,
      height,
    };

    if (options.fill) attrs.fill = options.fill;
    if (options.stroke) attrs.stroke = options.stroke;
    if (options.strokeWidth) attrs['stroke-width'] = options.strokeWidth;
    if (options.rx) attrs.rx = options.rx;
    if (options.ry) attrs.ry = options.ry;
    if (options.opacity) attrs.opacity = options.opacity;
    if (options.id) attrs.id = options.id;
    if (options.class) attrs.class = options.class;

    this.elements.push({ type: 'rect', attributes: attrs });
    return this;
  }

  /**
   * Add a circle
   */
  circle(
    cx: number,
    cy: number,
    r: number,
    options: {
      fill?: Color;
      stroke?: Color;
      strokeWidth?: number;
      opacity?: number;
      id?: string;
      class?: string;
    } = {}
  ): this {
    const attrs: Record<string, string | number> = { cx, cy, r };

    if (options.fill) attrs.fill = options.fill;
    if (options.stroke) attrs.stroke = options.stroke;
    if (options.strokeWidth) attrs['stroke-width'] = options.strokeWidth;
    if (options.opacity) attrs.opacity = options.opacity;
    if (options.id) attrs.id = options.id;
    if (options.class) attrs.class = options.class;

    this.elements.push({ type: 'circle', attributes: attrs });
    return this;
  }

  /**
   * Add an ellipse
   */
  ellipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    options: {
      fill?: Color;
      stroke?: Color;
      strokeWidth?: number;
      opacity?: number;
      id?: string;
      class?: string;
    } = {}
  ): this {
    const attrs: Record<string, string | number> = { cx, cy, rx, ry };

    if (options.fill) attrs.fill = options.fill;
    if (options.stroke) attrs.stroke = options.stroke;
    if (options.strokeWidth) attrs['stroke-width'] = options.strokeWidth;
    if (options.opacity) attrs.opacity = options.opacity;
    if (options.id) attrs.id = options.id;
    if (options.class) attrs.class = options.class;

    this.elements.push({ type: 'ellipse', attributes: attrs });
    return this;
  }

  /**
   * Add a line
   */
  line(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    options: {
      stroke?: Color;
      strokeWidth?: number;
      opacity?: number;
      strokeDasharray?: string;
      id?: string;
      class?: string;
    } = {}
  ): this {
    const attrs: Record<string, string | number> = { x1, y1, x2, y2 };

    attrs.stroke = options.stroke || 'black';
    if (options.strokeWidth) attrs['stroke-width'] = options.strokeWidth;
    if (options.opacity) attrs.opacity = options.opacity;
    if (options.strokeDasharray) attrs['stroke-dasharray'] = options.strokeDasharray;
    if (options.id) attrs.id = options.id;
    if (options.class) attrs.class = options.class;

    this.elements.push({ type: 'line', attributes: attrs });
    return this;
  }

  /**
   * Add a polyline
   */
  polyline(
    points: Position[],
    options: {
      fill?: Color;
      stroke?: Color;
      strokeWidth?: number;
      opacity?: number;
      id?: string;
      class?: string;
    } = {}
  ): this {
    const pointsStr = points.map((p) => `${p.x},${p.y}`).join(' ');
    const attrs: Record<string, string | number> = { points: pointsStr };

    attrs.fill = options.fill || 'none';
    if (options.stroke) attrs.stroke = options.stroke;
    if (options.strokeWidth) attrs['stroke-width'] = options.strokeWidth;
    if (options.opacity) attrs.opacity = options.opacity;
    if (options.id) attrs.id = options.id;
    if (options.class) attrs.class = options.class;

    this.elements.push({ type: 'polyline', attributes: attrs });
    return this;
  }

  /**
   * Add a polygon
   */
  polygon(
    points: Position[],
    options: {
      fill?: Color;
      stroke?: Color;
      strokeWidth?: number;
      opacity?: number;
      id?: string;
      class?: string;
    } = {}
  ): this {
    const pointsStr = points.map((p) => `${p.x},${p.y}`).join(' ');
    const attrs: Record<string, string | number> = { points: pointsStr };

    if (options.fill) attrs.fill = options.fill;
    if (options.stroke) attrs.stroke = options.stroke;
    if (options.strokeWidth) attrs['stroke-width'] = options.strokeWidth;
    if (options.opacity) attrs.opacity = options.opacity;
    if (options.id) attrs.id = options.id;
    if (options.class) attrs.class = options.class;

    this.elements.push({ type: 'polygon', attributes: attrs });
    return this;
  }

  /**
   * Add a path
   */
  path(
    d: string,
    options: {
      fill?: Color;
      stroke?: Color;
      strokeWidth?: number;
      opacity?: number;
      strokeDasharray?: string;
      id?: string;
      class?: string;
    } = {}
  ): this {
    const attrs: Record<string, string | number> = { d };

    if (options.fill) attrs.fill = options.fill;
    if (options.stroke) attrs.stroke = options.stroke;
    if (options.strokeWidth) attrs['stroke-width'] = options.strokeWidth;
    if (options.opacity) attrs.opacity = options.opacity;
    if (options.strokeDasharray) attrs['stroke-dasharray'] = options.strokeDasharray;
    if (options.id) attrs.id = options.id;
    if (options.class) attrs.class = options.class;

    this.elements.push({ type: 'path', attributes: attrs });
    return this;
  }

  /**
   * Add text
   */
  text(
    x: number,
    y: number,
    text: string,
    options: {
      fontSize?: number;
      fontFamily?: string;
      fill?: Color;
      textAnchor?: 'start' | 'middle' | 'end';
      dominantBaseline?: 'auto' | 'middle' | 'hanging';
      fontWeight?: string | number;
      id?: string;
      class?: string;
    } = {}
  ): this {
    const attrs: Record<string, string | number> = { x, y };

    if (options.fontSize) attrs['font-size'] = options.fontSize;
    if (options.fontFamily) attrs['font-family'] = options.fontFamily;
    if (options.fill) attrs.fill = options.fill;
    if (options.textAnchor) attrs['text-anchor'] = options.textAnchor;
    if (options.dominantBaseline) attrs['dominant-baseline'] = options.dominantBaseline;
    if (options.fontWeight) attrs['font-weight'] = options.fontWeight;
    if (options.id) attrs.id = options.id;
    if (options.class) attrs.class = options.class;

    this.elements.push({ type: 'text', attributes: attrs, text });
    return this;
  }

  /**
   * Add a group
   */
  group(
    options: {
      transform?: string;
      opacity?: number;
      id?: string;
      class?: string;
    } = {}
  ): SVGGroup {
    const attrs: Record<string, string | number> = {};

    if (options.transform) attrs.transform = options.transform;
    if (options.opacity) attrs.opacity = options.opacity;
    if (options.id) attrs.id = options.id;
    if (options.class) attrs.class = options.class;

    const groupElement: SVGElement = { type: 'g', attributes: attrs, children: [] };
    this.elements.push(groupElement);

    return new SVGGroup(groupElement);
  }

  /**
   * Add an arrow marker definition
   */
  addArrowMarker(
    id: string,
    color: Color = 'black',
    size: number = 10
  ): this {
    const marker: SVGElement = {
      type: 'marker',
      attributes: {
        id,
        markerWidth: size,
        markerHeight: size,
        refX: size - 1,
        refY: size / 2,
        orient: 'auto',
        markerUnits: 'strokeWidth',
      },
      children: [
        {
          type: 'path',
          attributes: {
            d: `M0,0 L0,${size} L${size},${size / 2} z`,
            fill: color,
          },
        },
      ],
    };

    this.defs.push(marker);
    return this;
  }

  /**
   * Add a gradient definition
   */
  addLinearGradient(
    id: string,
    stops: Array<{ offset: number; color: Color; opacity?: number }>,
    x1: number = 0,
    y1: number = 0,
    x2: number = 1,
    y2: number = 0
  ): this {
    const gradient: SVGElement = {
      type: 'linearGradient',
      attributes: { id, x1, y1, x2, y2 },
      children: stops.map((stop) => ({
        type: 'stop',
        attributes: {
          offset: `${stop.offset}%`,
          'stop-color': stop.color,
          ...(stop.opacity !== undefined && { 'stop-opacity': stop.opacity }),
        },
      })),
    };

    this.defs.push(gradient);
    return this;
  }

  /**
   * Build the SVG string
   */
  build(): string {
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}"`;

    if (this.viewBox) {
      svg += ` viewBox="${this.viewBox}"`;
    }

    svg += '>\n';

    // Add background if specified
    if (this.backgroundColor) {
      svg += `  <rect width="100%" height="100%" fill="${this.backgroundColor}"/>\n`;
    }

    // Add defs
    if (this.defs.length > 0) {
      svg += '  <defs>\n';
      for (const def of this.defs) {
        svg += this.elementToString(def, 4);
      }
      svg += '  </defs>\n';
    }

    // Add elements
    for (const element of this.elements) {
      svg += this.elementToString(element, 2);
    }

    svg += '</svg>';
    return svg;
  }

  /**
   * Convert SVG element to string
   */
  private elementToString(element: SVGElement, indent: number = 0): string {
    const indentStr = ' '.repeat(indent);
    let str = `${indentStr}<${element.type}`;

    // Add attributes
    for (const [key, value] of Object.entries(element.attributes)) {
      str += ` ${key}="${value}"`;
    }

    // Self-closing tag or with children/text
    if (!element.children && !element.text) {
      str += '/>\n';
    } else {
      str += '>';

      if (element.text) {
        str += element.text;
      }

      if (element.children) {
        str += '\n';
        for (const child of element.children) {
          str += this.elementToString(child, indent + 2);
        }
        str += indentStr;
      }

      str += `</${element.type}>\n`;
    }

    return str;
  }

  /**
   * Save SVG to file
   */
  async save(filePath: string): Promise<void> {
    const svg = this.build();
    await fs.writeFile(filePath, svg, 'utf-8');
  }
}

/**
 * SVG Group helper class
 */
export class SVGGroup {
  constructor(private element: SVGElement) {}

  rect(
    x: number,
    y: number,
    width: number,
    height: number,
    options: Record<string, any> = {}
  ): this {
    const attrs: Record<string, string | number> = { x, y, width, height, ...options };
    this.element.children!.push({ type: 'rect', attributes: attrs });
    return this;
  }

  circle(cx: number, cy: number, r: number, options: Record<string, any> = {}): this {
    const attrs: Record<string, string | number> = { cx, cy, r, ...options };
    this.element.children!.push({ type: 'circle', attributes: attrs });
    return this;
  }

  line(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    options: Record<string, any> = {}
  ): this {
    const attrs: Record<string, string | number> = { x1, y1, x2, y2, ...options };
    this.element.children!.push({ type: 'line', attributes: attrs });
    return this;
  }

  path(d: string, options: Record<string, any> = {}): this {
    const attrs: Record<string, string | number> = { d, ...options };
    this.element.children!.push({ type: 'path', attributes: attrs });
    return this;
  }

  text(x: number, y: number, text: string, options: Record<string, any> = {}): this {
    const attrs: Record<string, string | number> = { x, y, ...options };
    this.element.children!.push({ type: 'text', attributes: attrs, text });
    return this;
  }
}

/**
 * Helper function to create an arrow path
 */
export function createArrowPath(
  from: Position,
  to: Position,
  arrowSize: number = 10
): string {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const arrowAngle = Math.PI / 6; // 30 degrees

  const arrowPoint1 = {
    x: to.x - arrowSize * Math.cos(angle - arrowAngle),
    y: to.y - arrowSize * Math.sin(angle - arrowAngle),
  };

  const arrowPoint2 = {
    x: to.x - arrowSize * Math.cos(angle + arrowAngle),
    y: to.y - arrowSize * Math.sin(angle + arrowAngle),
  };

  return `M ${from.x} ${from.y} L ${to.x} ${to.y} M ${arrowPoint1.x} ${arrowPoint1.y} L ${to.x} ${to.y} L ${arrowPoint2.x} ${arrowPoint2.y}`;
}

/**
 * Helper function to create a rounded rectangle path
 */
export function createRoundedRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): string {
  return `M ${x + radius} ${y} L ${x + width - radius} ${y} Q ${x + width} ${y} ${x + width} ${y + radius} L ${x + width} ${y + height - radius} Q ${x + width} ${y + height} ${x + width - radius} ${y + height} L ${x + radius} ${y + height} Q ${x} ${y + height} ${x} ${y + height - radius} L ${x} ${y + radius} Q ${x} ${y} ${x + radius} ${y} Z`;
}
