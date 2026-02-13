/**
 * Type definitions for visual effects and animation system
 */

// ============================================================================
// Core Types
// ============================================================================

export type Position = {
  x: number;
  y: number;
};

export type Size = {
  width: number;
  height: number;
};

export type Color = string; // Hex color (#FF0000) or color name (red)

export type AnchorPoint =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type FitMode = 'cover' | 'contain' | 'fill' | 'scale-down' | 'none';

export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten';

// ============================================================================
// Visual Elements
// ============================================================================

export interface ImageOverlayOptions {
  input: string; // Video file path
  image: string; // Image file path
  output: string; // Output file path
  position?: Position; // Default: {x: 0, y: 0}
  anchor?: AnchorPoint; // Default: 'top-left'
  size?: Size; // Default: image's original size
  fitMode?: FitMode; // Default: 'none'
  rotation?: number; // Degrees, default: 0
  opacity?: number; // 0-1, default: 1
  blendMode?: BlendMode; // Default: 'normal'
  startTime?: number; // Seconds, default: 0
  duration?: number; // Seconds, default: entire video
  zIndex?: number; // Layer order, default: 1
}

export type ShapeType = 'rectangle' | 'circle' | 'ellipse' | 'line' | 'arrow' | 'polygon';

export interface ShapeOptions {
  input: string; // Video file path
  output: string; // Output file path
  type: ShapeType;
  position: Position;
  size: Size;
  color: Color;
  thickness?: number; // For lines and outlines, default: 2
  filled?: boolean; // Default: true
  opacity?: number; // 0-1, default: 1
  rotation?: number; // Degrees, default: 0
  startTime?: number; // Seconds, default: 0
  duration?: number; // Seconds, default: entire video
  zIndex?: number; // Default: 1
  // For polygon
  points?: Position[]; // Array of points for polygon
  // For arrow
  arrowStyle?: 'simple' | 'double' | 'triangle'; // Default: 'simple'
}

export interface IconOptions {
  input: string; // Video file path
  icon: string; // SVG file path
  output: string; // Output file path
  position: Position;
  size: Size;
  color?: Color; // Tint color for SVG
  opacity?: number; // 0-1, default: 1
  rotation?: number; // Degrees, default: 0
  startTime?: number; // Seconds, default: 0
  duration?: number; // Seconds, default: entire video
  zIndex?: number; // Default: 1
}

export interface LayerVisualOptions {
  input: string; // Video file path
  output: string; // Output file path
  layers: Array<{
    type: 'image' | 'shape' | 'icon' | 'text';
    options: ImageOverlayOptions | ShapeOptions | IconOptions | any;
  }>;
}

// ============================================================================
// Animation System
// ============================================================================

export type EasingFunction =
  | 'linear'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'ease-in-quad'
  | 'ease-out-quad'
  | 'ease-in-out-quad'
  | 'ease-in-cubic'
  | 'ease-out-cubic'
  | 'ease-in-out-cubic'
  | 'ease-in-quart'
  | 'ease-out-quart'
  | 'ease-in-out-quart';

export interface CubicBezier {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type AnimatedProperty = 'x' | 'y' | 'scale' | 'rotation' | 'opacity' | 'width' | 'height';

export interface Keyframe {
  time: number; // Seconds
  value: number; // Property value at this time
  easing?: EasingFunction | CubicBezier; // Easing to next keyframe
}

export interface AnimatePropertyOptions {
  input: string; // Video file path
  element: string; // Image/icon file path
  output: string; // Output file path
  property: AnimatedProperty;
  keyframes: Keyframe[];
  elementPosition?: Position; // Initial position
  elementSize?: Size; // Initial size
}

export interface BezierPath {
  points: Position[]; // Control points for bezier curve
  closed?: boolean; // Connect last point to first, default: false
}

export interface CircularPath {
  center: Position;
  radius: number;
  startAngle?: number; // Degrees, default: 0
  endAngle?: number; // Degrees, default: 360
  clockwise?: boolean; // Default: true
}

export interface AnimateAlongPathOptions {
  input: string; // Video file path
  element: string; // Image/icon file path
  output: string; // Output file path
  path: BezierPath | CircularPath | Position[]; // Path definition
  duration: number; // Seconds
  easing?: EasingFunction | CubicBezier;
  startTime?: number; // When to start animation, default: 0
  rotate?: boolean; // Rotate element along path, default: false
  elementSize?: Size; // Element size
}

export interface SpringAnimationOptions {
  input: string; // Video file path
  element: string; // Image/icon file path
  output: string; // Output file path
  property: AnimatedProperty;
  from: number;
  to: number;
  duration: number; // Seconds
  stiffness?: number; // Spring stiffness, default: 100
  damping?: number; // Damping ratio, default: 10
  mass?: number; // Mass, default: 1
  startTime?: number; // Default: 0
  elementPosition?: Position;
  elementSize?: Size;
}

export interface AnimationSequence {
  animations: Array<{
    options: AnimatePropertyOptions | AnimateAlongPathOptions | SpringAnimationOptions;
    delay?: number; // Delay before this animation starts (relative to previous)
  }>;
}

// ============================================================================
// Transitions
// ============================================================================

export type TransitionType =
  | 'fade'
  | 'fadeblack'
  | 'fadewhite'
  | 'wipeleft'
  | 'wiperight'
  | 'wipeup'
  | 'wipedown'
  | 'slideleft'
  | 'slideright'
  | 'slideup'
  | 'slidedown'
  | 'smoothleft'
  | 'smoothright'
  | 'smoothup'
  | 'smoothdown'
  | 'circlecrop'
  | 'rectcrop'
  | 'distance'
  | 'fadefast'
  | 'fadeslow'
  | 'dissolve'
  | 'pixelize'
  | 'radial'
  | 'hblur'
  | 'vblur';

export interface TransitionOptions {
  input1: string; // First video file
  input2: string; // Second video file
  output: string; // Output file path
  type: TransitionType;
  duration?: number; // Transition duration in seconds, default: 1
  offset?: number; // When to start transition in input1, default: end of input1
  easing?: EasingFunction | CubicBezier;
}

export interface CrossfadeOptions {
  input1: string; // First video file
  input2: string; // Second video file
  output: string; // Output file path
  duration?: number; // Crossfade duration in seconds, default: 1
  offset?: number; // When to start crossfade in input1, default: end of input1
  audioFade?: boolean; // Also crossfade audio, default: true
}

export interface CustomTransitionOptions {
  input1: string;
  input2: string;
  output: string;
  expression: string; // Custom FFmpeg xfade expression
  duration?: number; // Default: 1
  offset?: number;
}

// ============================================================================
// Diagrams
// ============================================================================

export interface DiagramStyle {
  backgroundColor?: Color; // Default: 'white'
  nodeColor?: Color; // Default: '#4A90E2'
  nodeTextColor?: Color; // Default: 'white'
  nodeBorderColor?: Color; // Default: '#357ABD'
  nodeRadius?: number; // Border radius for nodes, default: 5
  fontSize?: number; // Default: 14
  fontFamily?: string; // Default: 'Arial'
  lineColor?: Color; // Default: '#333333'
  lineThickness?: number; // Default: 2
  arrowSize?: number; // Default: 10
}

export interface FlowchartNode {
  id: string;
  label: string;
  type?: 'start' | 'process' | 'decision' | 'end'; // Default: 'process'
  x?: number; // Auto-calculated if not provided
  y?: number; // Auto-calculated if not provided
  width?: number; // Default: 120
  height?: number; // Default: 60
  color?: Color; // Override default node color
}

export interface FlowchartEdge {
  from: string; // Node ID
  to: string; // Node ID
  label?: string; // Label on the edge
  style?: 'solid' | 'dashed' | 'dotted'; // Default: 'solid'
}

export interface FlowchartOptions {
  output: string; // Output SVG file path
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
  style?: DiagramStyle;
  layout?: 'vertical' | 'horizontal'; // Default: 'vertical'
  nodeSpacing?: number; // Spacing between nodes, default: 50
  rankSpacing?: number; // Spacing between ranks, default: 100
}

export interface TimelineEvent {
  id: string;
  label: string;
  date: string | number; // Date string or timestamp
  description?: string;
  color?: Color;
  icon?: string; // SVG path or emoji
}

export interface TimelineOptions {
  output: string; // Output SVG file path
  events: TimelineEvent[];
  style?: DiagramStyle;
  orientation?: 'horizontal' | 'vertical'; // Default: 'horizontal'
  eventSpacing?: number; // Default: 100
  showDates?: boolean; // Default: true
}

export interface OrgChartNode {
  id: string;
  name: string;
  title?: string;
  parentId?: string; // ID of parent node (null for root)
  avatar?: string; // Image path
  color?: Color;
}

export interface OrgChartOptions {
  output: string; // Output SVG file path
  nodes: OrgChartNode[];
  style?: DiagramStyle;
  nodeWidth?: number; // Default: 150
  nodeHeight?: number; // Default: 80
  horizontalSpacing?: number; // Default: 50
  verticalSpacing?: number; // Default: 100
}

export interface MindMapNode {
  id: string;
  label: string;
  parentId?: string; // null for root
  children?: MindMapNode[];
  color?: Color;
  icon?: string;
}

export interface MindMapOptions {
  output: string; // Output SVG file path
  root: MindMapNode;
  style?: DiagramStyle;
  branchSpacing?: number; // Default: 80
  levelSpacing?: number; // Default: 120
}

export interface WhiteboardAnimationOptions {
  input: string; // SVG diagram file path
  output: string; // Output video file path
  duration: number; // Total animation duration in seconds
  fps?: number; // Frames per second, default: 30
  backgroundColor?: Color; // Default: 'white'
  drawColor?: Color; // Color of drawing line, default: 'black'
  drawThickness?: number; // Thickness of drawing line, default: 2
  style?: 'draw' | 'write' | 'reveal'; // Animation style, default: 'draw'
  showCursor?: boolean; // Show drawing cursor, default: false
}

// ============================================================================
// Composite Operations
// ============================================================================

export type PiPPosition =
  | AnchorPoint
  | Position; // Can use anchor point names or custom position

export interface PictureInPictureOptions {
  mainVideo: string; // Main video file
  pipVideo: string; // PiP video file
  output: string; // Output file path
  position?: PiPPosition; // Default: 'bottom-right'
  size?: Size; // PiP size, default: 25% of main video
  margin?: number; // Margin from edge in pixels, default: 20
  borderWidth?: number; // Border width, default: 0
  borderColor?: Color; // Border color, default: 'white'
  shadow?: boolean; // Add drop shadow, default: false
  startTime?: number; // When PiP starts, default: 0
  duration?: number; // PiP duration, default: min of both videos
  animated?: boolean; // Animate PiP entrance, default: false
}

export type SplitScreenLayout =
  | 'horizontal' // 2-way horizontal split
  | 'vertical' // 2-way vertical split
  | 'grid-2x2' // 4-way grid
  | 'grid-3x3' // 9-way grid
  | 'triple-horizontal' // 3 equal horizontal strips
  | 'triple-vertical' // 3 equal vertical strips
  | 'main-right' // Main video on left, 2 small on right
  | 'main-left' // Main video on right, 2 small on left
  | 'main-bottom' // Main video on top, 2 small on bottom
  | 'main-top'; // Main video on bottom, 2 small on top

export interface SplitScreenOptions {
  videos: string[]; // Array of video file paths
  output: string; // Output file path
  layout: SplitScreenLayout;
  borderWidth?: number; // Border between videos, default: 2
  borderColor?: Color; // Default: 'black'
  backgroundColor?: Color; // Background fill color, default: 'black'
}

export interface VideoGridOptions {
  videos: string[]; // Array of video file paths
  output: string; // Output file path
  columns: number; // Number of columns
  rows?: number; // Auto-calculated if not provided
  cellWidth?: number; // Width of each cell, auto-calculated if not provided
  cellHeight?: number; // Height of each cell, auto-calculated if not provided
  gap?: number; // Gap between cells, default: 2
  backgroundColor?: Color; // Default: 'black'
}

// ============================================================================
// Visual Effects
// ============================================================================

export type BlurType = 'gaussian' | 'box' | 'motion' | 'radial';

export interface BlurEffectOptions {
  input: string; // Video file path
  output: string; // Output file path
  type?: BlurType; // Default: 'gaussian'
  strength?: number; // Blur strength (0-10), default: 5
  angle?: number; // For motion blur, degrees, default: 0
  center?: Position; // For radial blur, center point
  startTime?: number; // When to start effect, default: 0
  duration?: number; // Effect duration, default: entire video
}

export interface ColorGradeOptions {
  input: string; // Video file path
  output: string; // Output file path
  brightness?: number; // -1 to 1, default: 0
  contrast?: number; // -1 to 1, default: 0
  saturation?: number; // -1 to 1, default: 0
  gamma?: number; // 0.1 to 10, default: 1
  hue?: number; // Hue rotation in degrees, default: 0
  temperature?: number; // Color temperature (-100 to 100), default: 0
  tint?: number; // Green/magenta tint (-100 to 100), default: 0
}

export interface ChromaKeyOptions {
  input: string; // Video file path
  output: string; // Output file path
  keyColor?: Color; // Color to key out, default: 'green' (#00FF00)
  similarity?: number; // Color similarity threshold (0-1), default: 0.3
  blend?: number; // Edge blend (0-1), default: 0.1
  backgroundImage?: string; // Optional background image
  backgroundColor?: Color; // Optional background color
}

export interface KenBurnsOptions {
  input: string; // Image file path
  output: string; // Output video file path
  duration: number; // Video duration in seconds
  startPosition?: Position; // Starting position, default: {x: 0, y: 0}
  endPosition?: Position; // Ending position
  startZoom?: number; // Starting zoom level (1 = original size), default: 1
  endZoom?: number; // Ending zoom level, default: 1.2
  easing?: EasingFunction | CubicBezier; // Default: 'ease-in-out'
  fps?: number; // Output FPS, default: 30
}

export interface GlowEffectOptions {
  input: string; // Video file path
  output: string; // Output file path
  intensity?: number; // Glow intensity (0-10), default: 5
  color?: Color; // Glow color, default: 'white'
  threshold?: number; // Brightness threshold for glow (0-1), default: 0.7
  spread?: number; // Glow spread (1-10), default: 3
}

export interface VignetteOptions {
  input: string; // Video file path
  output: string; // Output file path
  intensity?: number; // Vignette intensity (0-1), default: 0.5
  angle?: number; // Vignette angle, default: Math.PI/4
  softness?: number; // Edge softness (0-1), default: 0.5
}

export interface SharpenOptions {
  input: string; // Video file path
  output: string; // Output file path
  strength?: number; // Sharpen strength (0-10), default: 5
  radius?: number; // Sharpen radius (1-10), default: 3
}
