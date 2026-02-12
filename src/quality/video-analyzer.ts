import { execFile as execFileCallback } from 'child_process';
import { promisify } from 'util';
import { VideoQualityMetrics, TechnicalQuality, VisualQuality, FramingAnalysis, FrameAnalysis } from '../multi-take/multi-take-types.js';
import { VideoInfo } from '../video-operations.js';
import { FFmpegManager } from '../ffmpeg-utils.js';

const execFileAsync = promisify(execFileCallback);

/**
 * Analyze video quality using FFmpeg filters
 */
export class VideoQualityAnalyzer {
  private ffmpegManager: FFmpegManager;

  constructor(ffmpegManager: FFmpegManager) {
    this.ffmpegManager = ffmpegManager;
  }

  /**
   * Perform complete video quality analysis
   */
  async analyzeVideo(videoPath: string, videoInfo: VideoInfo): Promise<VideoQualityMetrics> {
    await this.ffmpegManager.initialize();

    // Run parallel analysis where possible
    const [visualMetrics, framingMetrics] = await Promise.all([
      this.analyzeVisualQuality(videoPath),
      this.analyzeFraming(videoPath)
    ]);

    const technicalMetrics = this.analyzeTechnicalQuality(videoInfo);

    return {
      technical: technicalMetrics,
      visual: visualMetrics,
      framing: framingMetrics
    };
  }

  /**
   * Analyze technical quality from video metadata
   */
  private analyzeTechnicalQuality(videoInfo: VideoInfo): TechnicalQuality {
    // Extract technical parameters from simplified VideoInfo
    const width = videoInfo.width || 0;
    const height = videoInfo.height || 0;
    const bitrate = videoInfo.bitrate || 0;
    const fps = videoInfo.fps || 30;
    const codec = videoInfo.videoCodec || 'unknown';

    // Estimate compression artifacts based on bitrate-to-resolution ratio
    const pixels = width * height;
    const bitsPerPixel = pixels > 0 ? bitrate / pixels : 0;
    const compressionArtifacts = this.estimateCompressionArtifacts(bitsPerPixel);

    return {
      resolution: { width, height },
      bitrate,
      fps,
      codec,
      compressionArtifacts
    };
  }

  /**
   * Analyze visual quality using FFmpeg signalstats filter
   */
  private async analyzeVisualQuality(videoPath: string): Promise<VisualQuality> {
    try {
      // Sample frames throughout the video
      const frameAnalyses = await this.sampleFrames(videoPath, 10);

      if (frameAnalyses.length === 0) {
        // Return default values if analysis fails
        return {
          brightness: 50,
          contrast: 50,
          sharpness: 50,
          colorBalance: 50,
          stabilization: 50
        };
      }

      // Calculate average metrics
      const avgBrightness = frameAnalyses.reduce((sum, f) => sum + f.brightness, 0) / frameAnalyses.length;
      const avgContrast = frameAnalyses.reduce((sum, f) => sum + f.contrast, 0) / frameAnalyses.length;
      const avgSharpness = frameAnalyses.reduce((sum, f) => sum + f.sharpness, 0) / frameAnalyses.length;
      const avgColorBalance = frameAnalyses.reduce((sum, f) => sum + f.colorBalance, 0) / frameAnalyses.length;

      // Calculate stabilization based on frame-to-frame variance
      const stabilization = this.calculateStabilization(frameAnalyses);

      return {
        brightness: Math.round(avgBrightness),
        contrast: Math.round(avgContrast),
        sharpness: Math.round(avgSharpness),
        colorBalance: Math.round(avgColorBalance),
        stabilization: Math.round(stabilization)
      };
    } catch (error: any) {
      console.warn('Visual quality analysis failed, using defaults:', error.message);
      return {
        brightness: 50,
        contrast: 50,
        sharpness: 50,
        colorBalance: 50,
        stabilization: 50
      };
    }
  }

  /**
   * Sample frames throughout the video and analyze them
   */
  private async sampleFrames(videoPath: string, numSamples: number = 10): Promise<FrameAnalysis[]> {
    const ffmpegPath = this.ffmpegManager.getPath();
    const analyses: FrameAnalysis[] = [];

    try {
      // Use signalstats filter to analyze video quality metrics
      // We'll sample at regular intervals
      const args = [
        '-i', videoPath,
        '-vf', `select='not(mod(n\\,${Math.max(1, Math.floor(30 / numSamples))}))',signalstats=stat=tout+vrep+brng,scale=640:-1`,
        '-f', 'null',
        '-'
      ];

      const { stderr } = await execFileAsync(ffmpegPath, args);

      // Parse signalstats output
      const lines = stderr.split('\n');
      let frameIndex = 0;

      for (const line of lines) {
        if (line.includes('Parsed_signalstats')) {
          const brightness = this.extractMetric(line, 'YAVG:');
          const contrast = this.extractMetric(line, 'YDIF:');
          const sharpness = this.extractMetric(line, 'YMAX:') - this.extractMetric(line, 'YMIN:');
          const colorBalance = (this.extractMetric(line, 'UAVG:') + this.extractMetric(line, 'VAVG:')) / 2;

          if (brightness !== null && contrast !== null) {
            analyses.push({
              timestamp: frameIndex / 30, // Approximate timestamp
              brightness: this.normalizeBrightness(brightness),
              contrast: this.normalizeContrast(contrast),
              sharpness: this.normalizeSharpness(sharpness),
              colorBalance: this.normalizeColorBalance(colorBalance)
            });
            frameIndex++;
          }
        }
      }

      return analyses.slice(0, numSamples);
    } catch (error: any) {
      console.warn('Frame sampling failed:', error.message);
      return [];
    }
  }

  /**
   * Analyze framing and composition
   */
  private async analyzeFraming(videoPath: string): Promise<FramingAnalysis> {
    // For now, we'll use heuristics based on frame content
    // In a more advanced implementation, this could use ML models for face detection, etc.

    try {
      // Sample a middle frame for composition analysis
      const frameAnalyses = await this.sampleFrames(videoPath, 1);

      if (frameAnalyses.length === 0) {
        return {
          composition: 50,
          facingCamera: true, // Assume true by default
          inFrame: true // Assume true by default
        };
      }

      // Heuristic: good composition typically has balanced brightness/color
      const frame = frameAnalyses[0];
      const composition = (frame.brightness + frame.colorBalance) / 2;

      return {
        composition: Math.round(composition),
        facingCamera: true, // Would need face detection
        inFrame: true // Would need object detection
      };
    } catch (error: any) {
      console.warn('Framing analysis failed:', error.message);
      return {
        composition: 50,
        facingCamera: true,
        inFrame: true
      };
    }
  }

  /**
   * Estimate compression artifacts based on bits per pixel
   */
  private estimateCompressionArtifacts(bitsPerPixel: number): number {
    // 0 = no artifacts, 1 = severe artifacts
    // Optimal: 0.1-0.2 bpp (no artifacts)
    // Acceptable: 0.05-0.3 bpp (minimal artifacts)
    // Poor: <0.05 bpp (visible artifacts)

    if (bitsPerPixel >= 0.1) {
      return 0; // No visible artifacts
    } else if (bitsPerPixel >= 0.05) {
      return 0.2; // Minimal artifacts
    } else if (bitsPerPixel >= 0.03) {
      return 0.5; // Moderate artifacts
    } else {
      return 0.8; // Severe artifacts
    }
  }

  /**
   * Extract a numeric metric from FFmpeg output line
   */
  private extractMetric(line: string, key: string): number {
    const match = line.match(new RegExp(`${key}\\s*([0-9.]+)`));
    return match ? parseFloat(match[1]) : 0;
  }

  /**
   * Normalize brightness from YAVG (0-255) to score (0-100)
   */
  private normalizeBrightness(yavg: number): number {
    // Optimal brightness: 100-150 (normalize to 80-100)
    // Acceptable: 80-180 (normalize to 60-80)
    // Poor: <80 or >180 (normalize to 0-60)

    if (yavg >= 100 && yavg <= 150) {
      return 80 + ((yavg - 100) / 50) * 20;
    } else if (yavg >= 80 && yavg <= 180) {
      const distanceFromOptimal = Math.min(
        Math.abs(yavg - 100),
        Math.abs(yavg - 150)
      );
      return Math.max(60, 80 - (distanceFromOptimal / 50) * 20);
    } else if (yavg < 80) {
      return (yavg / 80) * 60;
    } else {
      return Math.max(0, 60 - ((yavg - 180) / 75) * 60);
    }
  }

  /**
   * Normalize contrast from YDIF to score (0-100)
   */
  private normalizeContrast(ydif: number): number {
    // Higher YDIF = better contrast
    // Optimal: >40
    // Acceptable: 20-40
    // Poor: <20

    if (ydif >= 40) {
      return Math.min(100, 80 + (ydif - 40) * 0.5);
    } else if (ydif >= 20) {
      return 60 + ((ydif - 20) / 20) * 20;
    } else {
      return (ydif / 20) * 60;
    }
  }

  /**
   * Normalize sharpness from Y range to score (0-100)
   */
  private normalizeSharpness(yRange: number): number {
    // Higher range typically indicates more detail/sharpness
    // Optimal: >150
    // Acceptable: 100-150
    // Poor: <100

    if (yRange >= 150) {
      return Math.min(100, 80 + (yRange - 150) * 0.2);
    } else if (yRange >= 100) {
      return 60 + ((yRange - 100) / 50) * 20;
    } else {
      return (yRange / 100) * 60;
    }
  }

  /**
   * Normalize color balance from UV averages to score (0-100)
   */
  private normalizeColorBalance(uvAvg: number): number {
    // Color balance should be close to 128 (neutral)
    // Optimal: 118-138
    // Acceptable: 108-148
    // Poor: <108 or >148

    const distance = Math.abs(uvAvg - 128);

    if (distance <= 10) {
      return 90 + (10 - distance);
    } else if (distance <= 20) {
      return 70 + (20 - distance);
    } else {
      return Math.max(0, 70 - (distance - 20) * 2);
    }
  }

  /**
   * Calculate stabilization score based on frame-to-frame variance
   */
  private calculateStabilization(frames: FrameAnalysis[]): number {
    if (frames.length < 2) {
      return 50; // Not enough data
    }

    // Calculate variance in brightness and color balance
    let brightnessVariance = 0;
    let colorVariance = 0;

    for (let i = 1; i < frames.length; i++) {
      brightnessVariance += Math.abs(frames[i].brightness - frames[i - 1].brightness);
      colorVariance += Math.abs(frames[i].colorBalance - frames[i - 1].colorBalance);
    }

    brightnessVariance /= (frames.length - 1);
    colorVariance /= (frames.length - 1);

    // Lower variance = better stabilization
    // Optimal: <5 variance
    // Acceptable: 5-15
    // Poor: >15

    const avgVariance = (brightnessVariance + colorVariance) / 2;

    if (avgVariance < 5) {
      return 90 + (5 - avgVariance) * 2;
    } else if (avgVariance < 15) {
      return 70 + (15 - avgVariance) * 2;
    } else {
      return Math.max(0, 70 - (avgVariance - 15) * 3);
    }
  }
}
