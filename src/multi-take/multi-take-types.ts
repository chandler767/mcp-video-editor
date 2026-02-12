import { VideoInfo } from '../video-operations.js';
import { Transcript, TranscriptMatch } from '../transcript-operations.js';

// ============================================================================
// PROJECT & WORKSPACE TYPES
// ============================================================================

export interface MultiTakeProject {
  projectId: string;
  name: string;
  created: Date;
  modified: Date;
  script: ScriptDefinition;
  takes: TakeAnalysis[];
  bestTakes?: BestTakeSelection[];
  directories: ProjectDirectories;
  settings: ProjectSettings;
  status: ProjectStatus;
}

export interface ScriptDefinition {
  fullScript: string;
  sections: ScriptSection[];
}

export interface ScriptSection {
  id: string;
  text: string;
  startLine: number;
  endLine: number;
  expectedDuration?: number; // seconds
  tags?: string[];
}

export interface ProjectDirectories {
  root: string;
  source: string;
  temp: string;
  output: string;
  exports: string;
  analysis: string;
}

export interface ProjectSettings {
  qualityThresholds: QualityThresholds;
  scriptMatching: ScriptMatchingSettings;
  fileOrganization: FileOrganizationSettings;
}

export interface QualityThresholds {
  minAudioClarity: number; // 0-100
  minVideoSharpness: number; // 0-100
  maxFillerWordRate: number; // per minute
  minScriptCoverage: number; // 0-1
  minOverallScore: number; // 0-100
}

export interface ScriptMatchingSettings {
  fuzzyMatch: boolean;
  matchThreshold: number; // 0-1
  ignoreCase: boolean;
  ignorePunctuation: boolean;
}

export interface FileOrganizationSettings {
  autoCleanTemp: boolean;
  tempFileMaxAge: number; // hours
  keepIntermediateFiles: boolean;
  outputFormat: string;
}

export interface ProjectStatus {
  phase: 'setup' | 'analyzing' | 'selecting' | 'assembling' | 'complete' | 'error';
  progress: number; // 0-100
  currentTask?: string;
  errors: string[];
}

// ============================================================================
// TAKE ANALYSIS TYPES
// ============================================================================

export interface TakeAnalysis {
  takeId: string;
  filePath: string;
  fileName: string;
  fileSize: number;

  metadata: VideoInfo;
  transcript?: Transcript;
  scriptMatches: ScriptMatchResult[];

  audioQuality: AudioQualityMetrics;
  videoQuality: VideoQualityMetrics;
  overallScore: number; // 0-100

  coverage: CoverageAnalysis;
  issues: TakeIssue[];

  status: 'pending' | 'analyzing' | 'analyzed' | 'error';
  analyzedAt?: Date;
  error?: string;
}

export interface ScriptMatchResult {
  sectionId: string;
  sectionText: string;
  matches: TranscriptMatch[];
  coverage: number; // 0-1
  quality: number; // 0-100
}

export interface CoverageAnalysis {
  scriptCoverage: number; // 0-1
  coveredSections: string[];
  missingSections: string[];
  extraContent: TimeSegment[];
  timeRanges: Map<string, TimeSegment[]>;
}

export interface TimeSegment {
  start: number;
  end: number;
}

// ============================================================================
// AUDIO QUALITY TYPES
// ============================================================================

export interface AudioQualityMetrics {
  volumeLevel: VolumeLevel;
  clarity: ClarityMetrics;
  speechQuality: SpeechQuality;
}

export interface VolumeLevel {
  average: number; // dB
  peak: number;
  min: number;
  consistency: number; // 0-1
}

export interface ClarityMetrics {
  score: number; // 0-100
  signalToNoiseRatio: number; // dB
  backgroundNoise: number; // 0-1
}

export interface SpeechQuality {
  pace: number; // words per minute
  pauses: PauseAnalysis[];
  fillerWords: FillerWordAnalysis;
}

export interface PauseAnalysis {
  start: number;
  end: number;
  duration: number;
  context: string;
}

export interface FillerWordAnalysis {
  count: number;
  rate: number; // per minute
  locations: Array<{ word: string; timestamp: number }>;
  types: Map<string, number>;
}

// ============================================================================
// VIDEO QUALITY TYPES
// ============================================================================

export interface VideoQualityMetrics {
  technical: TechnicalQuality;
  visual: VisualQuality;
  framing: FramingAnalysis;
}

export interface TechnicalQuality {
  resolution: { width: number; height: number };
  bitrate: number;
  fps: number;
  codec: string;
  compressionArtifacts: number; // 0-1
}

export interface VisualQuality {
  brightness: number; // 0-100
  contrast: number; // 0-100
  sharpness: number; // 0-100
  colorBalance: number; // 0-100
  stabilization: number; // 0-100
}

export interface FramingAnalysis {
  composition: number; // 0-100
  facingCamera: boolean;
  inFrame: boolean;
}

// ============================================================================
// ISSUE TYPES
// ============================================================================

export interface TakeIssue {
  severity: 'error' | 'warning' | 'info';
  type: IssueType;
  description: string;
  location?: TimeSegment;
  suggestion?: string;
}

export type IssueType =
  | 'missing_coverage'
  | 'retake_needed'
  | 'audio_clarity'
  | 'video_clarity'
  | 'excessive_filler'
  | 'poor_pacing'
  | 'technical'
  | 'extra_content';

// ============================================================================
// BEST TAKE SELECTION TYPES
// ============================================================================

export interface BestTakeSelection {
  sectionId: string;
  takeId: string | null;
  filePath: string | null;
  segment: TimeSegment | null;
  score: number;
  reason: string;
}

export interface TakeCandidate {
  takeId: string;
  filePath: string;
  segment: TimeSegment;
  matchQuality: number;
  overallScore: number;
  audioQuality: AudioQualityMetrics;
  videoQuality: VideoQualityMetrics;
  issues: TakeIssue[];
}

export interface AssemblyPlan {
  sections: BestTakeSelection[];
  totalDuration: number;
  transitionsNeeded: number;
  qualityReport: AssemblyQualityReport;
}

export interface AssemblyQualityReport {
  averageScore: number;
  sectionsWithIssues: string[];
  recommendations: string[];
}

// ============================================================================
// WORKSPACE & PERSISTENCE TYPES
// ============================================================================

export interface ProjectSummary {
  projectId: string;
  name: string;
  created: Date;
  modified: Date;
  takeCount: number;
  status: ProjectStatus;
}

export interface OrganizedFiles {
  copied: Array<{ original: string; destination: string; size: number }>;
  failed: Array<{ path: string; error: string }>;
  totalSize: number;
}

export interface CleanupReport {
  cleaned: boolean;
  reason?: string;
  deletedCount?: number;
  freedSpace?: number;
}

export interface ExportSettings {
  quality?: 'high' | 'medium' | 'low';
  maxResolution?: '4k' | '1080p' | '720p' | '480p';
  format?: string;
}

export interface ExportResult {
  exportPath: string;
  size: number;
  duration: number;
  timestamp: Date;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class MultiTakeError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'MultiTakeError';
  }
}

export enum ErrorCode {
  // Project errors
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
  PROJECT_EXISTS = 'PROJECT_EXISTS',
  INVALID_PROJECT_STATE = 'INVALID_PROJECT_STATE',

  // File errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_NOT_ACCESSIBLE = 'FILE_NOT_ACCESSIBLE',
  INSUFFICIENT_DISK_SPACE = 'INSUFFICIENT_DISK_SPACE',

  // Analysis errors
  TRANSCRIPT_EXTRACTION_FAILED = 'TRANSCRIPT_EXTRACTION_FAILED',
  QUALITY_ANALYSIS_FAILED = 'QUALITY_ANALYSIS_FAILED',
  NO_OPENAI_KEY = 'NO_OPENAI_KEY',

  // Selection errors
  NO_TAKES_ANALYZED = 'NO_TAKES_ANALYZED',
  INSUFFICIENT_COVERAGE = 'INSUFFICIENT_COVERAGE',
  NO_SUITABLE_TAKE = 'NO_SUITABLE_TAKE',

  // Assembly errors
  SEGMENT_EXTRACTION_FAILED = 'SEGMENT_EXTRACTION_FAILED',
  CONCATENATION_FAILED = 'CONCATENATION_FAILED',
  EXPORT_FAILED = 'EXPORT_FAILED'
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface ProgressCallback {
  (progress: number, current: string): void;
}

export interface AudioStats {
  meanVolume: number;
  maxVolume: number;
  minVolume: number;
  rms: number;
  silences: Array<{ start: number; end: number; duration: number }>;
}

export interface FrameAnalysis {
  timestamp: number;
  brightness: number;
  contrast: number;
  sharpness: number;
  colorBalance: number;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

export const DEFAULT_QUALITY_THRESHOLDS: QualityThresholds = {
  minAudioClarity: 60,
  minVideoSharpness: 50,
  maxFillerWordRate: 10,
  minScriptCoverage: 0.8,
  minOverallScore: 60
};

export const DEFAULT_SCRIPT_MATCHING: ScriptMatchingSettings = {
  fuzzyMatch: true,
  matchThreshold: 0.8,
  ignoreCase: true,
  ignorePunctuation: true
};

export const DEFAULT_FILE_ORGANIZATION: FileOrganizationSettings = {
  autoCleanTemp: true,
  tempFileMaxAge: 24, // 24 hours
  keepIntermediateFiles: false,
  outputFormat: 'mp4'
};

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  qualityThresholds: DEFAULT_QUALITY_THRESHOLDS,
  scriptMatching: DEFAULT_SCRIPT_MATCHING,
  fileOrganization: DEFAULT_FILE_ORGANIZATION
};
