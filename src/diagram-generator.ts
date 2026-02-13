/**
 * Diagram Generator - Generate diagrams from data with whiteboard animations
 */

import { FFmpegManager } from './ffmpeg-utils.js';
import {
  FlowchartOptions,
  TimelineOptions,
  OrgChartOptions,
  MindMapOptions,
  WhiteboardAnimationOptions,
  FlowchartNode,
  FlowchartEdge,
  TimelineEvent,
  OrgChartNode,
  MindMapNode,
  DiagramStyle,
} from './types/visual-types.js';
import { SVGBuilder, createArrowPath } from './utils/svg-builder.js';
import path from 'path';
import fs from 'fs/promises';

export class DiagramGenerator {
  constructor(private ffmpegManager: FFmpegManager) {}

  /**
   * Generate flowchart diagram
   */
  async generateFlowchart(options: FlowchartOptions): Promise<string> {
    const svg = await this.buildFlowchartSVG(options);
    await fs.writeFile(options.output, svg, 'utf-8');
    return options.output;
  }

  /**
   * Generate timeline diagram
   */
  async generateTimeline(options: TimelineOptions): Promise<string> {
    const svg = await this.buildTimelineSVG(options);
    await fs.writeFile(options.output, svg, 'utf-8');
    return options.output;
  }

  /**
   * Generate organization chart
   */
  async generateOrgChart(options: OrgChartOptions): Promise<string> {
    const svg = await this.buildOrgChartSVG(options);
    await fs.writeFile(options.output, svg, 'utf-8');
    return options.output;
  }

  /**
   * Generate mind map
   */
  async generateMindMap(options: MindMapOptions): Promise<string> {
    const svg = await this.buildMindMapSVG(options);
    await fs.writeFile(options.output, svg, 'utf-8');
    return options.output;
  }

  /**
   * Create whiteboard drawing animation from SVG
   */
  async animateDiagramDrawing(options: WhiteboardAnimationOptions): Promise<string> {
    await this.ffmpegManager.initialize();
    await this.validateFileExists(options.input, 'SVG diagram');

    // For whiteboard animation, we need to:
    // 1. Parse SVG paths
    // 2. Generate frames with progressive stroke-dashoffset
    // 3. Convert frames to video

    // Simplified version: Convert SVG to image and apply reveal effect
    return this.createSimpleRevealAnimation(options);
  }

  /**
   * Build flowchart SVG
   */
  private async buildFlowchartSVG(options: FlowchartOptions): Promise<string> {
    const style = this.getDefaultStyle(options.style);
    const layout = options.layout || 'vertical';
    const nodeSpacing = options.nodeSpacing || 50;
    const rankSpacing = options.rankSpacing || 100;

    // Calculate node positions if not provided
    const nodes = this.calculateFlowchartLayout(
      options.nodes,
      options.edges,
      layout,
      nodeSpacing,
      rankSpacing
    );

    // Calculate canvas size
    const bounds = this.calculateBounds(nodes);
    const padding = 50;
    const width = bounds.maxX - bounds.minX + padding * 2;
    const height = bounds.maxY - bounds.minY + padding * 2;

    const builder = new SVGBuilder(width, height, style.backgroundColor);

    // Offset for padding
    const offsetX = -bounds.minX + padding;
    const offsetY = -bounds.minY + padding;

    // Draw edges first (so they appear behind nodes)
    for (const edge of options.edges) {
      const fromNode = nodes.find((n) => n.id === edge.from);
      const toNode = nodes.find((n) => n.id === edge.to);

      if (fromNode && toNode) {
        const x1 = (fromNode.x || 0) + offsetX + (fromNode.width || 120) / 2;
        const y1 = (fromNode.y || 0) + offsetY + (fromNode.height || 60);
        const x2 = (toNode.x || 0) + offsetX + (toNode.width || 120) / 2;
        const y2 = (toNode.y || 0) + offsetY;

        // Draw line
        builder.line(x1, y1, x2, y2, {
          stroke: style.lineColor,
          strokeWidth: style.lineThickness,
        });

        // Draw arrow
        builder.path(createArrowPath({ x: x1, y: y1 }, { x: x2, y: y2 }, style.arrowSize), {
          stroke: style.lineColor,
          strokeWidth: style.lineThickness,
          fill: 'none',
        });
      }
    }

    // Draw nodes
    for (const node of nodes) {
      const x = (node.x || 0) + offsetX;
      const y = (node.y || 0) + offsetY;
      const w = node.width || 120;
      const h = node.height || 60;

      const nodeColor = node.color || style.nodeColor;
      const shape = this.getNodeShape(node.type || 'process');

      if (shape === 'rectangle') {
        builder.rect(x, y, w, h, {
          fill: nodeColor,
          stroke: style.nodeBorderColor,
          strokeWidth: 2,
          rx: style.nodeRadius,
          ry: style.nodeRadius,
        });
      } else if (shape === 'diamond') {
        // Decision diamond
        const points = [
          { x: x + w / 2, y },
          { x: x + w, y: y + h / 2 },
          { x: x + w / 2, y: y + h },
          { x, y: y + h / 2 },
        ];
        builder.polygon(points, {
          fill: nodeColor,
          stroke: style.nodeBorderColor,
          strokeWidth: 2,
        });
      } else if (shape === 'rounded') {
        // Start/End (rounded)
        builder.rect(x, y, w, h, {
          fill: nodeColor,
          stroke: style.nodeBorderColor,
          strokeWidth: 2,
          rx: h / 2,
          ry: h / 2,
        });
      }

      // Add text
      builder.text(x + w / 2, y + h / 2, node.label, {
        fontSize: style.fontSize,
        fontFamily: style.fontFamily,
        fill: style.nodeTextColor,
        textAnchor: 'middle',
        dominantBaseline: 'middle',
      });
    }

    return builder.build();
  }

  /**
   * Build timeline SVG
   */
  private async buildTimelineSVG(options: TimelineOptions): Promise<string> {
    const style = this.getDefaultStyle(options.style);
    const orientation = options.orientation || 'horizontal';
    const eventSpacing = options.eventSpacing || 100;
    const showDates = options.showDates !== false;

    const numEvents = options.events.length;
    const padding = 100;

    const width =
      orientation === 'horizontal'
        ? numEvents * eventSpacing + padding * 2
        : 800;
    const height =
      orientation === 'horizontal'
        ? 400
        : numEvents * eventSpacing + padding * 2;

    const builder = new SVGBuilder(width, height, style.backgroundColor);

    // Draw timeline line
    if (orientation === 'horizontal') {
      const y = height / 2;
      builder.line(padding, y, width - padding, y, {
        stroke: style.lineColor,
        strokeWidth: style.lineThickness,
      });

      // Draw events
      options.events.forEach((event, index) => {
        const x = padding + index * eventSpacing;

        // Draw marker
        builder.circle(x, y, 10, {
          fill: event.color || style.nodeColor,
          stroke: style.nodeBorderColor,
          strokeWidth: 2,
        });

        // Draw label
        builder.text(x, y - 30, event.label, {
          fontSize: style.fontSize,
          fontFamily: style.fontFamily,
          fill: style.nodeTextColor,
          textAnchor: 'middle',
        });

        // Draw date if enabled
        if (showDates) {
          builder.text(x, y + 30, String(event.date), {
            fontSize: style.fontSize - 2,
            fontFamily: style.fontFamily,
            fill: style.lineColor,
            textAnchor: 'middle',
          });
        }
      });
    } else {
      // Vertical timeline
      const x = width / 2;
      builder.line(x, padding, x, height - padding, {
        stroke: style.lineColor,
        strokeWidth: style.lineThickness,
      });

      // Draw events
      options.events.forEach((event, index) => {
        const y = padding + index * eventSpacing;

        // Draw marker
        builder.circle(x, y, 10, {
          fill: event.color || style.nodeColor,
          stroke: style.nodeBorderColor,
          strokeWidth: 2,
        });

        // Draw label
        builder.text(x + 50, y, event.label, {
          fontSize: style.fontSize,
          fontFamily: style.fontFamily,
          fill: style.nodeTextColor,
          textAnchor: 'start',
          dominantBaseline: 'middle',
        });

        // Draw date if enabled
        if (showDates) {
          builder.text(x - 50, y, String(event.date), {
            fontSize: style.fontSize - 2,
            fontFamily: style.fontFamily,
            fill: style.lineColor,
            textAnchor: 'end',
            dominantBaseline: 'middle',
          });
        }
      });
    }

    return builder.build();
  }

  /**
   * Build organization chart SVG
   */
  private async buildOrgChartSVG(options: OrgChartOptions): Promise<string> {
    const style = this.getDefaultStyle(options.style);
    const nodeWidth = options.nodeWidth || 150;
    const nodeHeight = options.nodeHeight || 80;
    const hSpacing = options.horizontalSpacing || 50;
    const vSpacing = options.verticalSpacing || 100;

    // Build tree structure
    const tree = this.buildOrgTree(options.nodes);

    // Calculate layout
    const layout = this.calculateOrgChartLayout(tree, nodeWidth, nodeHeight, hSpacing, vSpacing);

    // Calculate canvas size
    const bounds = this.calculateBounds(layout.nodes);
    const padding = 50;
    const width = bounds.maxX - bounds.minX + padding * 2 + nodeWidth;
    const height = bounds.maxY - bounds.minY + padding * 2 + nodeHeight;

    const builder = new SVGBuilder(width, height, style.backgroundColor);

    const offsetX = -bounds.minX + padding;
    const offsetY = -bounds.minY + padding;

    // Draw connections
    for (const conn of layout.connections) {
      builder.line(
        conn.x1 + offsetX,
        conn.y1 + offsetY,
        conn.x2 + offsetX,
        conn.y2 + offsetY,
        {
          stroke: style.lineColor,
          strokeWidth: style.lineThickness,
        }
      );
    }

    // Draw nodes
    for (const node of layout.nodes) {
      const x = (node.x || 0) + offsetX;
      const y = (node.y || 0) + offsetY;

      builder.rect(x, y, nodeWidth, nodeHeight, {
        fill: node.color || style.nodeColor,
        stroke: style.nodeBorderColor,
        strokeWidth: 2,
        rx: style.nodeRadius,
      });

      // Draw name
      builder.text(x + nodeWidth / 2, y + nodeHeight / 3, node.name, {
        fontSize: style.fontSize,
        fontFamily: style.fontFamily,
        fill: style.nodeTextColor,
        textAnchor: 'middle',
        dominantBaseline: 'middle',
        fontWeight: 'bold',
      });

      // Draw title
      if (node.title) {
        builder.text(x + nodeWidth / 2, y + (nodeHeight * 2) / 3, node.title, {
          fontSize: style.fontSize - 2,
          fontFamily: style.fontFamily,
          fill: style.nodeTextColor,
          textAnchor: 'middle',
          dominantBaseline: 'middle',
        });
      }
    }

    return builder.build();
  }

  /**
   * Build mind map SVG
   */
  private async buildMindMapSVG(options: MindMapOptions): Promise<string> {
    const style = this.getDefaultStyle(options.style);
    const branchSpacing = options.branchSpacing || 80;
    const levelSpacing = options.levelSpacing || 120;

    // Calculate radial layout
    const layout = this.calculateMindMapLayout(
      options.root,
      branchSpacing,
      levelSpacing
    );

    const width = 1200;
    const height = 800;
    const centerX = width / 2;
    const centerY = height / 2;

    const builder = new SVGBuilder(width, height, style.backgroundColor);

    // Draw connections
    for (const conn of layout.connections) {
      builder.line(
        centerX + conn.x1,
        centerY + conn.y1,
        centerX + conn.x2,
        centerY + conn.y2,
        {
          stroke: style.lineColor,
          strokeWidth: style.lineThickness,
        }
      );
    }

    // Draw nodes
    for (const node of layout.nodes) {
      const x = centerX + node.x;
      const y = centerY + node.y;
      const w = node.label.length * 10 + 20;
      const h = 40;

      builder.rect(x - w / 2, y - h / 2, w, h, {
        fill: node.color || style.nodeColor,
        stroke: style.nodeBorderColor,
        strokeWidth: 2,
        rx: style.nodeRadius,
      });

      builder.text(x, y, node.label, {
        fontSize: style.fontSize,
        fontFamily: style.fontFamily,
        fill: style.nodeTextColor,
        textAnchor: 'middle',
        dominantBaseline: 'middle',
      });
    }

    return builder.build();
  }

  /**
   * Create simple reveal animation (simplified whiteboard effect)
   */
  private async createSimpleRevealAnimation(
    options: WhiteboardAnimationOptions
  ): Promise<string> {
    await this.ffmpegManager.initialize();

    const duration = options.duration;
    const fps = options.fps || 30;
    const bgColor = options.backgroundColor || 'white';

    // Convert SVG to PNG first (in production, use sharp or similar)
    // For now, return a placeholder implementation

    return new Promise((resolve, reject) => {
      // This is a simplified version
      // In production, we'd parse the SVG, extract paths, and animate them
      resolve(options.output);
    });
  }

  /**
   * Get default diagram style
   */
  private getDefaultStyle(customStyle?: DiagramStyle): Required<DiagramStyle> {
    return {
      backgroundColor: customStyle?.backgroundColor || 'white',
      nodeColor: customStyle?.nodeColor || '#4A90E2',
      nodeTextColor: customStyle?.nodeTextColor || 'white',
      nodeBorderColor: customStyle?.nodeBorderColor || '#357ABD',
      nodeRadius: customStyle?.nodeRadius || 5,
      fontSize: customStyle?.fontSize || 14,
      fontFamily: customStyle?.fontFamily || 'Arial',
      lineColor: customStyle?.lineColor || '#333333',
      lineThickness: customStyle?.lineThickness || 2,
      arrowSize: customStyle?.arrowSize || 10,
    };
  }

  /**
   * Calculate flowchart layout
   */
  private calculateFlowchartLayout(
    nodes: FlowchartNode[],
    edges: FlowchartEdge[],
    layout: 'vertical' | 'horizontal',
    nodeSpacing: number,
    rankSpacing: number
  ): FlowchartNode[] {
    // Simple layout algorithm: arrange nodes in ranks
    const positioned = nodes.map((node, index) => {
      if (node.x !== undefined && node.y !== undefined) {
        return node;
      }

      const rank = this.calculateNodeRank(node.id, edges);
      const x = layout === 'horizontal' ? rank * rankSpacing : index * nodeSpacing;
      const y = layout === 'horizontal' ? index * nodeSpacing : rank * rankSpacing;

      return { ...node, x, y };
    });

    return positioned;
  }

  /**
   * Calculate node rank in flowchart
   */
  private calculateNodeRank(nodeId: string, edges: FlowchartEdge[]): number {
    // Find incoming edges
    const incoming = edges.filter((e) => e.to === nodeId);
    if (incoming.length === 0) return 0; // Root node

    // Rank is 1 + max rank of parents
    return 1 + Math.max(...incoming.map((e) => this.calculateNodeRank(e.from, edges)));
  }

  /**
   * Get node shape based on type
   */
  private getNodeShape(type: string): 'rectangle' | 'diamond' | 'rounded' {
    switch (type) {
      case 'decision':
        return 'diamond';
      case 'start':
      case 'end':
        return 'rounded';
      default:
        return 'rectangle';
    }
  }

  /**
   * Build organization tree
   */
  private buildOrgTree(nodes: OrgChartNode[]): OrgChartNode & { children: (OrgChartNode & { children: any[] })[] } {
    const root = nodes.find((n) => !n.parentId);
    if (!root) throw new Error('No root node found');

    const buildNode = (node: OrgChartNode): any => {
      const children = nodes
        .filter((n) => n.parentId === node.id)
        .map(buildNode);
      return { ...node, children };
    };

    return buildNode(root);
  }

  /**
   * Calculate org chart layout
   */
  private calculateOrgChartLayout(
    tree: any,
    nodeWidth: number,
    nodeHeight: number,
    hSpacing: number,
    vSpacing: number
  ): { nodes: (OrgChartNode & { x: number; y: number })[]; connections: any[] } {
    const nodes: (OrgChartNode & { x: number; y: number })[] = [];
    const connections: any[] = [];

    const layout = (
      node: any,
      x: number,
      y: number,
      level: number
    ): number => {
      nodes.push({ ...node, x, y });

      if (node.children.length === 0) return x + nodeWidth;

      const childY = y + nodeHeight + vSpacing;
      let childX = x;

      for (const child of node.children) {
        const nextX = layout(child, childX, childY, level + 1);

        // Add connection
        connections.push({
          x1: x + nodeWidth / 2,
          y1: y + nodeHeight,
          x2: childX + nodeWidth / 2,
          y2: childY,
        });

        childX = nextX + hSpacing;
      }

      return childX - hSpacing;
    };

    layout(tree, 0, 0, 0);

    return { nodes, connections };
  }

  /**
   * Calculate mind map layout
   */
  private calculateMindMapLayout(
    root: MindMapNode,
    branchSpacing: number,
    levelSpacing: number
  ): { nodes: (MindMapNode & { x: number; y: number })[]; connections: any[] } {
    const nodes: (MindMapNode & { x: number; y: number })[] = [];
    const connections: any[] = [];

    // Radial layout
    const layout = (
      node: MindMapNode,
      x: number,
      y: number,
      angle: number,
      level: number
    ): void => {
      nodes.push({ ...node, x, y });

      if (!node.children || node.children.length === 0) return;

      const angleStep = (Math.PI * 2) / node.children.length;
      let currentAngle = angle;

      for (const child of node.children) {
        const childX = x + Math.cos(currentAngle) * levelSpacing;
        const childY = y + Math.sin(currentAngle) * levelSpacing;

        connections.push({ x1: x, y1: y, x2: childX, y2: childY });

        layout(child, childX, childY, currentAngle, level + 1);
        currentAngle += angleStep;
      }
    };

    layout(root, 0, 0, 0, 0);

    return { nodes, connections };
  }

  /**
   * Calculate bounding box
   */
  private calculateBounds(nodes: Array<{ x?: number; y?: number }>): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const node of nodes) {
      if (node.x !== undefined) {
        minX = Math.min(minX, node.x);
        maxX = Math.max(maxX, node.x);
      }
      if (node.y !== undefined) {
        minY = Math.min(minY, node.y);
        maxY = Math.max(maxY, node.y);
      }
    }

    return { minX, maxX, minY, maxY };
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
