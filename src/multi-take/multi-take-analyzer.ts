import { randomUUID } from 'crypto';
import path from 'path';
import {
  MultiTakeProject,
  TakeAnalysis,
  ScriptMatchResult,
  CoverageAnalysis,
  TimeSegment,
  MultiTakeError,
  ErrorCode,
  ProgressCallback
} from './multi-take-types.js';
import { TranscriptOperations } from '../transcript-operations.js';
import { VideoOperations } from '../video-operations.js';
import { AudioQualityAnalyzer } from '../quality/audio-analyzer.js';
import { VideoQualityAnalyzer } from '../quality/video-analyzer.js';
import { QualityScorer } from '../quality/scoring.js';
import { IssueDetector } from '../quality/issue-detector.js';
import { FFmpegManager } from '../ffmpeg-utils.js';
import { VideoConfig } from '../config.js';

/**
 * Analyze multiple takes against a script
 */
export class MultiTakeAnalyzer {
  private transcriptOps: TranscriptOperations;
  private videoOps: VideoOperations;
  private audioAnalyzer: AudioQualityAnalyzer;
  private videoAnalyzer: VideoQualityAnalyzer;
  private qualityScorer: QualityScorer;
  private issueDetector: IssueDetector;

  constructor(config: VideoConfig) {
    const ffmpegManager = new FFmpegManager();

    this.transcriptOps = new TranscriptOperations(config.openaiApiKey, ffmpegManager);
    this.videoOps = new VideoOperations(ffmpegManager, config);
    this.audioAnalyzer = new AudioQualityAnalyzer(ffmpegManager);
    this.videoAnalyzer = new VideoQualityAnalyzer(ffmpegManager);
    this.qualityScorer = new QualityScorer();
    this.issueDetector = new IssueDetector();
  }

  /**
   * Analyze all takes in parallel (default)
   */
  async analyzeAllTakes(
    project: MultiTakeProject,
    takeFiles: string[],
    parallel: boolean = true,
    onProgress?: ProgressCallback
  ): Promise<TakeAnalysis[]> {
    if (parallel) {
      return await this.analyzeParallel(project, takeFiles, onProgress);
    } else {
      return await this.analyzeSequential(project, takeFiles, onProgress);
    }
  }

  /**
   * Analyze takes in parallel
   */
  private async analyzeParallel(
    project: MultiTakeProject,
    takeFiles: string[],
    onProgress?: ProgressCallback
  ): Promise<TakeAnalysis[]> {
    const analyses = await Promise.all(
      takeFiles.map(async (filePath, index) => {
        try {
          const analysis = await this.analyzeSingleTake(project, filePath);

          if (onProgress) {
            const progress = ((index + 1) / takeFiles.length) * 100;
            onProgress(progress, `Analyzed ${path.basename(filePath)}`);
          }

          return analysis;
        } catch (error: any) {
          console.error(`Failed to analyze ${filePath}:`, error.message);
          return this.createErrorAnalysis(filePath, error.message);
        }
      })
    );

    return analyses;
  }

  /**
   * Analyze takes sequentially (more stable, slower)
   */
  private async analyzeSequential(
    project: MultiTakeProject,
    takeFiles: string[],
    onProgress?: ProgressCallback
  ): Promise<TakeAnalysis[]> {
    const analyses: TakeAnalysis[] = [];

    for (let i = 0; i < takeFiles.length; i++) {
      const filePath = takeFiles[i];

      try {
        const analysis = await this.analyzeSingleTake(project, filePath);
        analyses.push(analysis);

        if (onProgress) {
          const progress = ((i + 1) / takeFiles.length) * 100;
          onProgress(progress, `Analyzed ${path.basename(filePath)}`);
        }
      } catch (error: any) {
        console.error(`Failed to analyze ${filePath}:`, error.message);
        analyses.push(this.createErrorAnalysis(filePath, error.message));
      }
    }

    return analyses;
  }

  /**
   * Analyze a single take
   */
  async analyzeSingleTake(
    project: MultiTakeProject,
    filePath: string
  ): Promise<TakeAnalysis> {
    const takeId = randomUUID();
    const fileName = path.basename(filePath);

    try {
      // Step 1: Get video metadata
      const metadata = await this.videoOps.getVideoInfo(filePath);

      // Step 2: Extract transcript
      const transcript = await this.transcriptOps.extractTranscript(filePath);

      // Step 3: Match transcript to script sections
      const scriptMatches = await this.matchTranscriptToScript(
        transcript,
        project.script.sections,
        project.settings.scriptMatching
      );

      // Step 4: Calculate coverage
      const coverage = this.calculateCoverage(scriptMatches, project.script.sections.map(s => s.id));

      // Step 5: Analyze audio quality
      const audioQuality = await this.audioAnalyzer.analyzeAudio(filePath, transcript);

      // Step 6: Analyze video quality
      const videoQuality = await this.videoAnalyzer.analyzeVideo(filePath, metadata);

      // Step 7: Calculate overall quality score
      const overallScore = this.qualityScorer.calculateOverallScore(
        audioQuality,
        videoQuality,
        coverage,
        scriptMatches
      );

      // Step 8: Detect issues
      const issues = this.issueDetector.detectIssues(
        {
          takeId,
          filePath,
          fileName,
          fileSize: metadata.size,
          metadata,
          transcript,
          scriptMatches,
          audioQuality,
          videoQuality,
          overallScore,
          coverage,
          issues: [],
          status: 'analyzed',
          analyzedAt: new Date()
        },
        project.settings.qualityThresholds,
        project.script.sections.map(s => s.id)
      );

      return {
        takeId,
        filePath,
        fileName,
        fileSize: metadata.size,
        metadata,
        transcript,
        scriptMatches,
        audioQuality,
        videoQuality,
        overallScore,
        coverage,
        issues,
        status: 'analyzed',
        analyzedAt: new Date()
      };
    } catch (error: any) {
      throw new MultiTakeError(
        ErrorCode.QUALITY_ANALYSIS_FAILED,
        `Failed to analyze take ${fileName}: ${error.message}`,
        { filePath, error }
      );
    }
  }

  /**
   * Match transcript to script sections
   */
  private async matchTranscriptToScript(
    transcript: any,
    sections: any[],
    matchingSettings: any
  ): Promise<ScriptMatchResult[]> {
    const results: ScriptMatchResult[] = [];

    for (const section of sections) {
      try {
        // Use existing matchToScript functionality
        const matchResult = this.transcriptOps.matchToScript(
          transcript,
          section.text
        );

        // Calculate match quality based on coverage and accuracy
        const scriptLines = section.text.split('\n').filter((line: string) => line.trim());
        const matchedLines = scriptLines.length - matchResult.unmatchedScript.length;
        const coverage = scriptLines.length > 0 ? matchedLines / scriptLines.length : 0;

        // Quality score based on match confidence
        const avgConfidence = matchResult.matches.length > 0
          ? matchResult.matches.reduce((sum: number, m: any) => sum + (m.confidence || 0.8), 0) / matchResult.matches.length
          : 0;

        const quality = (coverage * 0.7 + avgConfidence * 0.3) * 100;

        results.push({
          sectionId: section.id,
          sectionText: section.text,
          matches: matchResult.matches,
          coverage,
          quality
        });
      } catch (error: any) {
        console.warn(`Failed to match section ${section.id}:`, error.message);
        results.push({
          sectionId: section.id,
          sectionText: section.text,
          matches: [],
          coverage: 0,
          quality: 0
        });
      }
    }

    return results;
  }

  /**
   * Calculate coverage analysis
   */
  private calculateCoverage(
    scriptMatches: ScriptMatchResult[],
    allSectionIds: string[]
  ): CoverageAnalysis {
    const coveredSections: string[] = [];
    const missingSections: string[] = [];
    const timeRanges = new Map<string, TimeSegment[]>();

    for (const match of scriptMatches) {
      if (match.coverage > 0.5) {
        coveredSections.push(match.sectionId);

        // Extract time ranges from matches
        const ranges: TimeSegment[] = match.matches.map(m => ({
          start: m.start,
          end: m.end
        }));

        timeRanges.set(match.sectionId, ranges);
      }
    }

    for (const sectionId of allSectionIds) {
      if (!coveredSections.includes(sectionId)) {
        missingSections.push(sectionId);
      }
    }

    const scriptCoverage = allSectionIds.length > 0
      ? coveredSections.length / allSectionIds.length
      : 0;

    // Identify extra content (segments not matching any script section)
    // For now, we'll leave this empty - could be enhanced with more detailed analysis
    const extraContent: TimeSegment[] = [];

    return {
      scriptCoverage,
      coveredSections,
      missingSections,
      extraContent,
      timeRanges
    };
  }

  /**
   * Create an error analysis when a take fails
   */
  private createErrorAnalysis(filePath: string, errorMessage: string): TakeAnalysis {
    return {
      takeId: randomUUID(),
      filePath,
      fileName: path.basename(filePath),
      fileSize: 0,
      metadata: {
        format: 'unknown',
        duration: 0,
        width: 0,
        height: 0,
        fps: 0,
        videoCodec: 'unknown',
        bitrate: 0,
        size: 0
      },
      scriptMatches: [],
      audioQuality: {
        volumeLevel: {
          average: 0,
          peak: 0,
          min: 0,
          consistency: 0
        },
        clarity: {
          score: 0,
          signalToNoiseRatio: 0,
          backgroundNoise: 1
        },
        speechQuality: {
          pace: 0,
          pauses: [],
          fillerWords: {
            count: 0,
            rate: 0,
            locations: [],
            types: new Map()
          }
        }
      },
      videoQuality: {
        technical: {
          resolution: { width: 0, height: 0 },
          bitrate: 0,
          fps: 0,
          codec: 'unknown',
          compressionArtifacts: 1
        },
        visual: {
          brightness: 0,
          contrast: 0,
          sharpness: 0,
          colorBalance: 0,
          stabilization: 0
        },
        framing: {
          composition: 0,
          facingCamera: false,
          inFrame: false
        }
      },
      overallScore: 0,
      coverage: {
        scriptCoverage: 0,
        coveredSections: [],
        missingSections: [],
        extraContent: [],
        timeRanges: new Map()
      },
      issues: [
        {
          severity: 'error',
          type: 'technical',
          description: `Analysis failed: ${errorMessage}`,
          suggestion: 'Check that the file is a valid video file and try again'
        }
      ],
      status: 'error',
      error: errorMessage
    };
  }
}
