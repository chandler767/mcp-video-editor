import { FFmpegManager } from '../ffmpeg-utils.js';
import {
  AudioQualityMetrics,
  VolumeLevel,
  ClarityMetrics,
  SpeechQuality,
  PauseAnalysis,
  FillerWordAnalysis,
  AudioStats
} from '../multi-take/multi-take-types.js';
import { Transcript } from '../transcript-operations.js';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export class AudioQualityAnalyzer {
  constructor(private ffmpegManager: FFmpegManager) {}

  /**
   * Analyze audio quality for a video file
   */
  async analyzeAudio(
    videoPath: string,
    transcript?: Transcript
  ): Promise<AudioQualityMetrics> {
    await this.ffmpegManager.initialize();

    // Extract audio statistics using FFmpeg
    const audioStats = await this.extractAudioStats(videoPath);

    // Analyze volume levels
    const volumeLevel = this.analyzeVolumeLevel(audioStats);

    // Calculate clarity metrics
    const clarity = this.calculateClarity(audioStats);

    // Analyze speech quality from transcript (if available)
    const speechQuality = transcript
      ? this.analyzeSpeechQuality(transcript)
      : this.getDefaultSpeechQuality();

    return {
      volumeLevel,
      clarity,
      speechQuality
    };
  }

  /**
   * Extract audio statistics using FFmpeg filters
   */
  private async extractAudioStats(videoPath: string): Promise<AudioStats> {
    const ffmpegPath = this.ffmpegManager.getPath();

    // Use volumedetect and astats filters to get audio metrics
    const args = [
      '-i', videoPath,
      '-af', 'volumedetect,astats=metadata=1:reset=1',
      '-f', 'null',
      '-'
    ];

    try {
      const { stderr } = await execFileAsync(ffmpegPath, args);

      // Parse FFmpeg output
      return this.parseAudioStats(stderr);
    } catch (error: any) {
      // If analysis fails, return default values
      console.warn('Audio analysis failed, using defaults:', error.message);
      return this.getDefaultAudioStats();
    }
  }

  /**
   * Parse FFmpeg audio statistics output
   */
  private parseAudioStats(output: string): AudioStats {
    const stats: Partial<AudioStats> = {
      silences: []
    };

    // Parse volumedetect output
    const meanVolumeMatch = output.match(/mean_volume:\s*([-\d.]+)\s*dB/);
    const maxVolumeMatch = output.match(/max_volume:\s*([-\d.]+)\s*dB/);

    if (meanVolumeMatch) {
      stats.meanVolume = parseFloat(meanVolumeMatch[1]);
    }
    if (maxVolumeMatch) {
      stats.maxVolume = parseFloat(maxVolumeMatch[1]);
    }

    // Parse astats output for RMS
    const rmsMatch = output.match(/RMS\s+level\s+dB:\s*([-\d.]+)/);
    if (rmsMatch) {
      stats.rms = parseFloat(rmsMatch[1]);
    }

    // Estimate min volume (use mean - 10dB as approximation)
    stats.minVolume = (stats.meanVolume || -20) - 10;

    return stats as AudioStats;
  }

  /**
   * Get default audio stats if analysis fails
   */
  private getDefaultAudioStats(): AudioStats {
    return {
      meanVolume: -20,
      maxVolume: -5,
      minVolume: -30,
      rms: -18,
      silences: []
    };
  }

  /**
   * Analyze volume level metrics
   */
  private analyzeVolumeLevel(stats: AudioStats): VolumeLevel {
    const average = stats.meanVolume;
    const peak = stats.maxVolume;
    const min = stats.minVolume;

    // Calculate consistency (lower variance = more consistent)
    // Ideal range is -20dB to -10dB for mean volume
    const range = peak - min;
    const idealRange = 15; // dB
    const consistency = Math.max(0, Math.min(1, 1 - (range - idealRange) / 30));

    return {
      average,
      peak,
      min,
      consistency
    };
  }

  /**
   * Calculate audio clarity metrics
   */
  private calculateClarity(stats: AudioStats): ClarityMetrics {
    // Estimate SNR based on RMS and volume characteristics
    // Higher RMS relative to mean volume indicates better clarity
    const snrEstimate = Math.abs(stats.rms - stats.meanVolume) + 20;

    // Background noise estimation (inverse of SNR)
    const backgroundNoise = Math.max(0, Math.min(1, 1 - snrEstimate / 40));

    // Calculate clarity score (0-100)
    // Based on volume level and estimated SNR
    let clarityScore = 50;

    // Penalize if too quiet (mean < -30dB) or too loud (mean > -10dB)
    if (stats.meanVolume < -30) {
      clarityScore -= ((-30 - stats.meanVolume) / 2);
    } else if (stats.meanVolume > -10) {
      clarityScore -= ((stats.meanVolume + 10) / 2);
    } else {
      // Bonus for good range (-20 to -15dB is ideal)
      if (stats.meanVolume >= -20 && stats.meanVolume <= -15) {
        clarityScore += 20;
      } else {
        clarityScore += 10;
      }
    }

    // Bonus for high SNR
    if (snrEstimate > 30) {
      clarityScore += 20;
    } else if (snrEstimate > 20) {
      clarityScore += 10;
    }

    clarityScore = Math.max(0, Math.min(100, clarityScore));

    return {
      score: clarityScore,
      signalToNoiseRatio: snrEstimate,
      backgroundNoise
    };
  }

  /**
   * Analyze speech quality from transcript
   */
  private analyzeSpeechQuality(transcript: Transcript): SpeechQuality {
    const pace = this.calculatePace(transcript);
    const pauses = this.detectPauses(transcript);
    const fillerWords = this.detectFillerWords(transcript);

    return {
      pace,
      pauses,
      fillerWords
    };
  }

  /**
   * Calculate speaking pace (words per minute)
   */
  private calculatePace(transcript: Transcript): number {
    if (!transcript || transcript.duration === 0) {
      return 130; // Default average
    }

    const wordCount = transcript.text.split(/\s+/).filter(w => w.length > 0).length;
    const durationMinutes = transcript.duration / 60;

    return Math.round(wordCount / durationMinutes);
  }

  /**
   * Detect pauses in speech
   */
  private detectPauses(transcript: Transcript): PauseAnalysis[] {
    const pauses: PauseAnalysis[] = [];
    const segments = transcript.segments;

    if (!segments || segments.length === 0) {
      return pauses;
    }

    // Detect gaps between segments
    for (let i = 0; i < segments.length - 1; i++) {
      const currentEnd = segments[i].end;
      const nextStart = segments[i + 1].start;
      const gap = nextStart - currentEnd;

      // Consider gaps > 1 second as significant pauses
      if (gap > 1.0) {
        pauses.push({
          start: currentEnd,
          end: nextStart,
          duration: gap,
          context: `Between: "${segments[i].text.slice(-20)}" and "${segments[i + 1].text.slice(0, 20)}"`
        });
      }
    }

    // Also check within segments if we have word-level timing
    for (const segment of segments) {
      if (segment.words && segment.words.length > 1) {
        for (let i = 0; i < segment.words.length - 1; i++) {
          const currentEnd = segment.words[i].end;
          const nextStart = segment.words[i + 1].start;
          const gap = nextStart - currentEnd;

          if (gap > 0.8) {
            pauses.push({
              start: currentEnd,
              end: nextStart,
              duration: gap,
              context: `Between words: "${segment.words[i].word}" and "${segment.words[i + 1].word}"`
            });
          }
        }
      }
    }

    return pauses;
  }

  /**
   * Detect filler words in transcript
   */
  private detectFillerWords(transcript: Transcript): FillerWordAnalysis {
    const fillerWordList = [
      'um', 'uh', 'like', 'you know', 'sort of', 'kind of',
      'basically', 'actually', 'literally', 'so', 'well',
      'i mean', 'right', 'okay', 'yeah'
    ];

    const locations: Array<{ word: string; timestamp: number }> = [];
    const typeCounts = new Map<string, number>();

    const text = transcript.text.toLowerCase();
    const words = transcript.segments.flatMap(seg =>
      seg.words || [{ word: seg.text, start: seg.start, end: seg.end }]
    );

    // Search for filler words
    for (const fillerWord of fillerWordList) {
      const regex = new RegExp(`\\b${fillerWord}\\b`, 'gi');
      let match;

      while ((match = regex.exec(text)) !== null) {
        // Find approximate timestamp
        const wordIndex = text.substring(0, match.index).split(/\s+/).length;
        const word = words[Math.min(wordIndex, words.length - 1)];

        locations.push({
          word: fillerWord,
          timestamp: word.start
        });

        typeCounts.set(fillerWord, (typeCounts.get(fillerWord) || 0) + 1);
      }
    }

    const count = locations.length;
    const durationMinutes = transcript.duration / 60;
    const rate = durationMinutes > 0 ? count / durationMinutes : 0;

    return {
      count,
      rate,
      locations,
      types: typeCounts
    };
  }

  /**
   * Get default speech quality if transcript not available
   */
  private getDefaultSpeechQuality(): SpeechQuality {
    return {
      pace: 130,
      pauses: [],
      fillerWords: {
        count: 0,
        rate: 0,
        locations: [],
        types: new Map()
      }
    };
  }
}
