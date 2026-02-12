import {
  AudioQualityMetrics,
  VideoQualityMetrics,
  CoverageAnalysis,
  ScriptMatchResult
} from '../multi-take/multi-take-types.js';

export class QualityScorer {

  /**
   * Calculate overall quality score (0-100)
   * Weighted composite of audio, video, coverage, and script matching
   */
  calculateOverallScore(
    audio: AudioQualityMetrics,
    video: VideoQualityMetrics,
    coverage: CoverageAnalysis,
    scriptMatches: ScriptMatchResult[]
  ): number {

    // Weighted components
    const weights = {
      audio: 0.35,      // 35% - Audio is critical for spoken content
      video: 0.25,      // 25% - Video quality matters for presentation
      coverage: 0.30,   // 30% - Script coverage is key for completeness
      scriptMatch: 0.10 // 10% - How well it matches the script
    };

    const audioScore = this.scoreAudio(audio);
    const videoScore = this.scoreVideo(video);
    const coverageScore = coverage.scriptCoverage * 100;
    const matchScore = this.calculateAverageMatchQuality(scriptMatches);

    const overall = (
      audioScore * weights.audio +
      videoScore * weights.video +
      coverageScore * weights.coverage +
      matchScore * weights.scriptMatch
    );

    return Math.round(Math.max(0, Math.min(100, overall)));
  }

  /**
   * Score audio quality (0-100)
   */
  scoreAudio(audio: AudioQualityMetrics): number {
    // Volume consistency: 0-30 points
    const volumeScore = this.normalizeScore(audio.volumeLevel.consistency * 30, 0, 30);

    // Clarity: 0-40 points
    const clarityScore = audio.clarity.score * 0.4;

    // Speech quality: 0-30 points
    const paceScore = this.scorePace(audio.speechQuality.pace);
    const fillerPenalty = Math.min(audio.speechQuality.fillerWords.rate * 2, 15);
    const pausePenalty = Math.min(audio.speechQuality.pauses.length * 0.5, 5);
    const speechScore = Math.max(0, 30 - fillerPenalty - pausePenalty) * (paceScore);

    const total = volumeScore + clarityScore + speechScore;
    return Math.round(Math.max(0, Math.min(100, total)));
  }

  /**
   * Score video quality (0-100)
   */
  scoreVideo(video: VideoQualityMetrics): number {
    // Technical quality: 0-40 points
    const resolutionScore = this.scoreResolution(
      video.technical.resolution.width,
      video.technical.resolution.height
    );
    const bitrateScore = this.scoreBitrate(
      video.technical.bitrate,
      video.technical.resolution.width * video.technical.resolution.height
    );
    const fpsScore = this.scoreFPS(video.technical.fps);
    const codecScore = this.scoreCodec(video.technical.codec);

    const technicalScore = (
      resolutionScore * 0.4 +
      bitrateScore * 0.3 +
      fpsScore * 0.2 +
      codecScore * 0.1
    ) * 40;

    // Visual quality: 0-60 points
    const visualScore = (
      video.visual.brightness * 0.15 +
      video.visual.contrast * 0.15 +
      video.visual.sharpness * 0.25 +
      video.visual.colorBalance * 0.15 +
      video.visual.stabilization * 0.15 +
      video.framing.composition * 0.15
    ) * 0.6;

    const total = technicalScore + visualScore;
    return Math.round(Math.max(0, Math.min(100, total)));
  }

  /**
   * Score speaking pace (0-1)
   */
  private scorePace(wordsPerMinute: number): number {
    // Optimal: 120-160 WPM
    // Good: 100-180 WPM
    // Poor: <80 or >200 WPM

    if (wordsPerMinute >= 120 && wordsPerMinute <= 160) {
      return 1.0; // Perfect
    } else if (wordsPerMinute >= 100 && wordsPerMinute <= 180) {
      // Calculate distance from optimal range
      const distance = Math.min(
        Math.abs(wordsPerMinute - 120),
        Math.abs(wordsPerMinute - 160)
      );
      return Math.max(0.7, 1.0 - (distance / 80));
    } else if (wordsPerMinute >= 80 && wordsPerMinute <= 200) {
      return 0.5; // Acceptable
    } else {
      return 0.2; // Poor
    }
  }

  /**
   * Score video resolution (0-1)
   */
  private scoreResolution(width: number, height: number): number {
    const pixels = width * height;

    // 4K (3840x2160): 8.3M pixels
    if (pixels >= 8000000) return 1.0;

    // 1080p (1920x1080): 2.1M pixels
    if (pixels >= 2000000) return 0.9;

    // 720p (1280x720): 0.9M pixels
    if (pixels >= 900000) return 0.7;

    // 480p (854x480): 0.4M pixels
    if (pixels >= 400000) return 0.5;

    // Below 480p
    return 0.3;
  }

  /**
   * Score video bitrate relative to resolution (0-1)
   */
  private scoreBitrate(bitrate: number, pixels: number): number {
    // Calculate bits per pixel
    const bitsPerPixel = pixels > 0 ? bitrate / pixels : 0;

    // Ideal: 0.1-0.2 bits per pixel
    // Acceptable: 0.05-0.3
    // Poor: <0.05 or >0.5

    if (bitsPerPixel >= 0.1 && bitsPerPixel <= 0.2) {
      return 1.0;
    } else if (bitsPerPixel >= 0.05 && bitsPerPixel <= 0.3) {
      return 0.8;
    } else if (bitsPerPixel >= 0.03 && bitsPerPixel <= 0.5) {
      return 0.6;
    } else {
      return 0.4;
    }
  }

  /**
   * Score frames per second (0-1)
   */
  private scoreFPS(fps: number): number {
    // 60 FPS: Perfect
    if (fps >= 60) return 1.0;

    // 30 FPS: Good
    if (fps >= 29) return 0.9;

    // 24-25 FPS: Acceptable (cinematic)
    if (fps >= 23) return 0.7;

    // Below 20 FPS: Poor
    return 0.4;
  }

  /**
   * Score video codec (0-1)
   */
  private scoreCodec(codec: string): number {
    const lowerCodec = codec.toLowerCase();

    // Modern efficient codecs
    if (lowerCodec.includes('av1') || lowerCodec.includes('libaom')) {
      return 1.0;
    }

    // H.265/HEVC
    if (lowerCodec.includes('hevc') || lowerCodec.includes('h265') || lowerCodec.includes('265')) {
      return 0.95;
    }

    // H.264/AVC (most common)
    if (lowerCodec.includes('h264') || lowerCodec.includes('avc') || lowerCodec.includes('264')) {
      return 0.9;
    }

    // VP9
    if (lowerCodec.includes('vp9')) {
      return 0.85;
    }

    // VP8
    if (lowerCodec.includes('vp8')) {
      return 0.7;
    }

    // Older codecs
    return 0.5;
  }

  /**
   * Calculate average match quality across script sections
   */
  private calculateAverageMatchQuality(scriptMatches: ScriptMatchResult[]): number {
    if (scriptMatches.length === 0) {
      return 0;
    }

    const sum = scriptMatches.reduce((acc, match) => acc + match.quality, 0);
    return sum / scriptMatches.length;
  }

  /**
   * Normalize a score to a range
   */
  private normalizeScore(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Get quality grade from score
   */
  getQualityGrade(score: number): string {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 60) return 'Fair';
    if (score >= 40) return 'Poor';
    return 'Very Poor';
  }

  /**
   * Get quality letter grade
   */
  getLetterGrade(score: number): string {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }
}
