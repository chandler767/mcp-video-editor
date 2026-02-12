import {
  TakeAnalysis,
  TakeIssue,
  IssueType,
  QualityThresholds,
  TimeSegment,
  ScriptMatchResult,
  AudioQualityMetrics,
  VideoQualityMetrics,
  CoverageAnalysis
} from '../multi-take/multi-take-types.js';

/**
 * Detect issues in video takes based on quality thresholds
 */
export class IssueDetector {

  /**
   * Detect all issues in a take
   */
  detectIssues(
    take: TakeAnalysis,
    thresholds: QualityThresholds,
    allSectionIds: string[]
  ): TakeIssue[] {
    const issues: TakeIssue[] = [];

    // Check coverage issues
    issues.push(...this.detectCoverageIssues(take.coverage, allSectionIds));

    // Check audio quality issues
    issues.push(...this.detectAudioIssues(take.audioQuality, thresholds));

    // Check video quality issues
    issues.push(...this.detectVideoIssues(take.videoQuality, thresholds));

    // Check script matching issues
    issues.push(...this.detectScriptMatchingIssues(take.scriptMatches, thresholds));

    // Check overall score
    if (take.overallScore < thresholds.minOverallScore) {
      issues.push({
        severity: 'error',
        type: 'retake_needed',
        description: `Overall quality score (${take.overallScore}) is below threshold (${thresholds.minOverallScore})`,
        suggestion: 'Consider retaking this video with attention to audio clarity, video quality, and script coverage'
      });
    }

    return issues;
  }

  /**
   * Detect coverage issues
   */
  private detectCoverageIssues(
    coverage: CoverageAnalysis,
    allSectionIds: string[]
  ): TakeIssue[] {
    const issues: TakeIssue[] = [];

    // Missing sections
    if (coverage.missingSections.length > 0) {
      issues.push({
        severity: 'warning',
        type: 'missing_coverage',
        description: `Missing ${coverage.missingSections.length} script section(s)`,
        suggestion: 'Record additional takes to cover missing sections'
      });
    }

    // Low overall coverage
    if (coverage.scriptCoverage < 0.5) {
      issues.push({
        severity: 'error',
        type: 'missing_coverage',
        description: `Only ${Math.round(coverage.scriptCoverage * 100)}% of script is covered`,
        suggestion: 'This take covers very little of the script. Consider a complete retake.'
      });
    } else if (coverage.scriptCoverage < 0.8) {
      issues.push({
        severity: 'warning',
        type: 'missing_coverage',
        description: `Script coverage is ${Math.round(coverage.scriptCoverage * 100)}% (target: 80%+)`,
        suggestion: 'Record additional footage to improve coverage'
      });
    }

    // Extra content
    if (coverage.extraContent.length > 0) {
      const totalExtraTime = coverage.extraContent.reduce(
        (sum, segment) => sum + (segment.end - segment.start),
        0
      );

      if (totalExtraTime > 30) {
        issues.push({
          severity: 'info',
          type: 'extra_content',
          description: `Contains ${Math.round(totalExtraTime)}s of content not in script`,
          suggestion: 'Extra content will be trimmed during assembly'
        });
      }
    }

    return issues;
  }

  /**
   * Detect audio quality issues
   */
  private detectAudioIssues(
    audio: AudioQualityMetrics,
    thresholds: QualityThresholds
  ): TakeIssue[] {
    const issues: TakeIssue[] = [];

    // Low clarity
    if (audio.clarity.score < thresholds.minAudioClarity) {
      const severity = audio.clarity.score < thresholds.minAudioClarity * 0.7 ? 'error' : 'warning';
      issues.push({
        severity,
        type: 'audio_clarity',
        description: `Audio clarity score (${Math.round(audio.clarity.score)}) is below threshold (${thresholds.minAudioClarity})`,
        suggestion: severity === 'error'
          ? 'Audio quality is poor. Consider retaking with better microphone or quieter environment.'
          : 'Audio quality could be improved. Check microphone placement and reduce background noise.'
      });
    }

    // High background noise
    if (audio.clarity.backgroundNoise > 0.3) {
      issues.push({
        severity: 'warning',
        type: 'audio_clarity',
        description: `High background noise detected (${Math.round(audio.clarity.backgroundNoise * 100)}%)`,
        suggestion: 'Try recording in a quieter environment or use noise reduction'
      });
    }

    // Volume consistency
    if (audio.volumeLevel.consistency < 0.7) {
      issues.push({
        severity: 'warning',
        type: 'audio_clarity',
        description: 'Volume levels are inconsistent throughout the recording',
        suggestion: 'Maintain consistent distance from microphone or apply audio normalization'
      });
    }

    // Volume too low
    if (audio.volumeLevel.average < -30) {
      issues.push({
        severity: 'warning',
        type: 'audio_clarity',
        description: `Average volume is very low (${Math.round(audio.volumeLevel.average)}dB)`,
        suggestion: 'Speak louder or move closer to the microphone'
      });
    }

    // Volume too high (clipping risk)
    if (audio.volumeLevel.peak > -3) {
      issues.push({
        severity: 'error',
        type: 'audio_clarity',
        description: `Peak volume is too high (${Math.round(audio.volumeLevel.peak)}dB), risking clipping`,
        suggestion: 'Reduce input gain or speak more softly to prevent distortion'
      });
    }

    // Excessive filler words
    if (audio.speechQuality.fillerWords.rate > thresholds.maxFillerWordRate) {
      const severity = audio.speechQuality.fillerWords.rate > thresholds.maxFillerWordRate * 1.5 ? 'error' : 'warning';
      issues.push({
        severity,
        type: 'excessive_filler',
        description: `High filler word rate: ${Math.round(audio.speechQuality.fillerWords.rate)} per minute (threshold: ${thresholds.maxFillerWordRate})`,
        suggestion: 'Practice script more or retake with fewer filler words for better flow'
      });
    }

    // Poor speaking pace
    const pace = audio.speechQuality.pace;
    if (pace < 80 || pace > 200) {
      issues.push({
        severity: 'warning',
        type: 'poor_pacing',
        description: `Speaking pace (${Math.round(pace)} WPM) is ${pace < 80 ? 'too slow' : 'too fast'}`,
        suggestion: pace < 80
          ? 'Try speaking more quickly for better engagement'
          : 'Try slowing down for better clarity and comprehension'
      });
    }

    // Long pauses
    const longPauses = audio.speechQuality.pauses.filter(p => p.duration > 3);
    if (longPauses.length > 0) {
      issues.push({
        severity: 'info',
        type: 'poor_pacing',
        description: `Contains ${longPauses.length} pause(s) longer than 3 seconds`,
        suggestion: 'Long pauses can be trimmed during editing'
      });
    }

    return issues;
  }

  /**
   * Detect video quality issues
   */
  private detectVideoIssues(
    video: VideoQualityMetrics,
    thresholds: QualityThresholds
  ): TakeIssue[] {
    const issues: TakeIssue[] = [];

    // Low sharpness
    if (video.visual.sharpness < thresholds.minVideoSharpness) {
      const severity = video.visual.sharpness < thresholds.minVideoSharpness * 0.7 ? 'error' : 'warning';
      issues.push({
        severity,
        type: 'video_clarity',
        description: `Video sharpness (${video.visual.sharpness}) is below threshold (${thresholds.minVideoSharpness})`,
        suggestion: severity === 'error'
          ? 'Video is too blurry. Check camera focus and lens cleanliness.'
          : 'Video could be sharper. Ensure proper focus and good lighting.'
      });
    }

    // Poor brightness
    if (video.visual.brightness < 40 || video.visual.brightness > 85) {
      issues.push({
        severity: 'warning',
        type: 'video_clarity',
        description: video.visual.brightness < 40
          ? 'Video is too dark'
          : 'Video is overexposed',
        suggestion: video.visual.brightness < 40
          ? 'Add more lighting or increase exposure'
          : 'Reduce lighting or decrease exposure'
      });
    }

    // Poor contrast
    if (video.visual.contrast < 40) {
      issues.push({
        severity: 'info',
        type: 'video_clarity',
        description: 'Video has low contrast',
        suggestion: 'Improve lighting setup or adjust camera settings'
      });
    }

    // Poor color balance
    if (video.visual.colorBalance < 50) {
      issues.push({
        severity: 'info',
        type: 'video_clarity',
        description: 'Color balance is off',
        suggestion: 'Check white balance settings or lighting color temperature'
      });
    }

    // Low stabilization
    if (video.visual.stabilization < 50) {
      issues.push({
        severity: 'warning',
        type: 'video_clarity',
        description: 'Video appears shaky or unstable',
        suggestion: 'Use a tripod or enable camera stabilization'
      });
    }

    // Low resolution
    const pixels = video.technical.resolution.width * video.technical.resolution.height;
    if (pixels < 900000) { // Less than 720p
      issues.push({
        severity: 'warning',
        type: 'technical',
        description: `Low resolution: ${video.technical.resolution.width}x${video.technical.resolution.height}`,
        suggestion: 'Record at 1080p or higher for better quality'
      });
    }

    // Low frame rate
    if (video.technical.fps < 24) {
      issues.push({
        severity: 'warning',
        type: 'technical',
        description: `Low frame rate: ${Math.round(video.technical.fps)} fps`,
        suggestion: 'Record at 24fps or higher for smooth playback'
      });
    }

    // High compression artifacts
    if (video.technical.compressionArtifacts > 0.5) {
      issues.push({
        severity: 'warning',
        type: 'technical',
        description: 'Video has visible compression artifacts',
        suggestion: 'Increase bitrate or use less compression'
      });
    }

    // Poor framing
    if (video.framing.composition < 40) {
      issues.push({
        severity: 'info',
        type: 'video_clarity',
        description: 'Framing/composition could be improved',
        suggestion: 'Check camera positioning and subject placement'
      });
    }

    if (!video.framing.inFrame) {
      issues.push({
        severity: 'error',
        type: 'video_clarity',
        description: 'Subject is not fully in frame',
        suggestion: 'Adjust camera position to keep subject in frame'
      });
    }

    if (!video.framing.facingCamera) {
      issues.push({
        severity: 'warning',
        type: 'video_clarity',
        description: 'Subject is not facing the camera',
        suggestion: 'Face the camera for better engagement'
      });
    }

    return issues;
  }

  /**
   * Detect script matching issues
   */
  private detectScriptMatchingIssues(
    scriptMatches: ScriptMatchResult[],
    thresholds: QualityThresholds
  ): TakeIssue[] {
    const issues: TakeIssue[] = [];

    // Low match quality for covered sections
    const lowQualityMatches = scriptMatches.filter(m => m.quality < 60);
    if (lowQualityMatches.length > 0) {
      issues.push({
        severity: 'warning',
        type: 'missing_coverage',
        description: `${lowQualityMatches.length} section(s) have low match quality`,
        suggestion: 'Script deviations detected. Consider retaking with closer adherence to script.'
      });
    }

    // Sections with very low coverage
    const poorCoverage = scriptMatches.filter(m => m.coverage < 0.5);
    if (poorCoverage.length > 0) {
      issues.push({
        severity: 'warning',
        type: 'missing_coverage',
        description: `${poorCoverage.length} section(s) are only partially covered`,
        suggestion: 'Some script sections are incomplete in this take'
      });
    }

    return issues;
  }

  /**
   * Categorize issues by severity
   */
  categorizeIssues(issues: TakeIssue[]): {
    errors: TakeIssue[];
    warnings: TakeIssue[];
    info: TakeIssue[];
  } {
    return {
      errors: issues.filter(i => i.severity === 'error'),
      warnings: issues.filter(i => i.severity === 'warning'),
      info: issues.filter(i => i.severity === 'info')
    };
  }

  /**
   * Get issue summary text
   */
  getIssueSummary(issues: TakeIssue[]): string {
    const categorized = this.categorizeIssues(issues);

    const parts: string[] = [];
    if (categorized.errors.length > 0) {
      parts.push(`${categorized.errors.length} error(s)`);
    }
    if (categorized.warnings.length > 0) {
      parts.push(`${categorized.warnings.length} warning(s)`);
    }
    if (categorized.info.length > 0) {
      parts.push(`${categorized.info.length} info`);
    }

    return parts.length > 0 ? parts.join(', ') : 'No issues detected';
  }

  /**
   * Check if take is acceptable based on issues
   */
  isAcceptable(issues: TakeIssue[]): boolean {
    const categorized = this.categorizeIssues(issues);
    // Take is acceptable if it has no errors
    return categorized.errors.length === 0;
  }

  /**
   * Get most critical issue
   */
  getMostCritical(issues: TakeIssue[]): TakeIssue | undefined {
    const categorized = this.categorizeIssues(issues);

    if (categorized.errors.length > 0) {
      return categorized.errors[0];
    }
    if (categorized.warnings.length > 0) {
      return categorized.warnings[0];
    }
    if (categorized.info.length > 0) {
      return categorized.info[0];
    }

    return undefined;
  }
}
