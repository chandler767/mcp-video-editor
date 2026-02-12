import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import { FFmpegManager } from './ffmpeg-utils.js';
import os from 'os';
import { stat } from 'fs/promises';

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
  words?: TranscriptWord[];
}

export interface Transcript {
  text: string;
  segments: TranscriptSegment[];
  duration: number;
  language?: string;
}

export interface TranscriptMatch {
  text: string;
  start: number;
  end: number;
  confidence: number;
}

export class TranscriptOperations {
  private openai: OpenAI | null = null;
  private ffmpegManager: FFmpegManager;
  private readonly MAX_FILE_SIZE = 24 * 1024 * 1024; // 24MB (safe margin under 25MB limit)
  private readonly CHUNK_DURATION = 600; // 10 minutes per chunk

  constructor(apiKey?: string, ffmpegManager?: FFmpegManager) {
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
    this.ffmpegManager = ffmpegManager || new FFmpegManager();
  }

  /**
   * Extract audio from video to a temporary file with optimized settings
   */
  private async extractAudioToFile(videoPath: string, outputPath: string): Promise<void> {
    await this.ffmpegManager.initialize();

    return new Promise((resolve, reject) => {
      this.ffmpegManager
        .createCommand(videoPath)
        .audioCodec('libmp3lame')
        .audioBitrate('64k') // Low bitrate to minimize file size
        .audioChannels(1) // Mono to reduce size
        .audioFrequency(16000) // 16kHz is optimal for Whisper
        .noVideo()
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });
  }

  /**
   * Split audio file into chunks based on duration
   */
  private async splitAudioIntoChunks(
    audioPath: string,
    chunkDuration: number
  ): Promise<string[]> {
    await this.ffmpegManager.initialize();
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'whisper-chunks-'));
    const chunkPaths: string[] = [];

    return new Promise((resolve, reject) => {
      this.ffmpegManager
        .createCommand(audioPath)
        .outputOptions([
          '-f segment',
          `-segment_time ${chunkDuration}`,
          '-c copy',
        ])
        .output(path.join(tempDir, 'chunk_%03d.mp3'))
        .on('end', async () => {
          try {
            const files = await fs.readdir(tempDir);
            for (const file of files.sort()) {
              chunkPaths.push(path.join(tempDir, file));
            }
            resolve(chunkPaths);
          } catch (err) {
            reject(err);
          }
        })
        .on('error', (err) => reject(err))
        .run();
    });
  }

  /**
   * Transcribe a single audio file
   */
  private async transcribeAudioFile(
    audioPath: string,
    options?: {
      language?: string;
      model?: 'whisper-1';
    }
  ): Promise<any> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY in config.');
    }

    const audioFile = createReadStream(audioPath);

    const response = await this.openai.audio.transcriptions.create({
      file: audioFile,
      model: options?.model || 'whisper-1',
      language: options?.language,
      response_format: 'verbose_json',
      timestamp_granularities: ['segment', 'word'],
    });

    return response;
  }

  async extractTranscript(
    videoPath: string,
    options?: {
      language?: string;
      model?: 'whisper-1';
      responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
    }
  ): Promise<Transcript> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY in config.');
    }

    // Create temporary directory for processing
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'whisper-'));
    const audioPath = path.join(tempDir, 'audio.mp3');

    try {
      // Extract audio from video with optimized settings
      console.log('Extracting audio from video...');
      await this.extractAudioToFile(videoPath, audioPath);

      // Check if the audio file exceeds the size limit
      const audioStats = await stat(audioPath);
      const needsChunking = audioStats.size > this.MAX_FILE_SIZE;

      let allSegments: TranscriptSegment[] = [];
      let fullText = '';
      let language: string | undefined;

      if (needsChunking) {
        console.log(`Audio file (${(audioStats.size / 1024 / 1024).toFixed(2)}MB) exceeds limit. Splitting into chunks...`);

        // Split audio into chunks
        const chunkPaths = await this.splitAudioIntoChunks(audioPath, this.CHUNK_DURATION);
        console.log(`Split into ${chunkPaths.length} chunks. Processing...`);

        let timeOffset = 0;

        // Process each chunk
        for (let i = 0; i < chunkPaths.length; i++) {
          console.log(`Processing chunk ${i + 1}/${chunkPaths.length}...`);
          const chunkPath = chunkPaths[i];

          const response = await this.transcribeAudioFile(chunkPath, options);
          const data = response as any;

          // Adjust timestamps by adding offset
          const segments: TranscriptSegment[] = (data.segments || []).map((seg: any) => ({
            text: seg.text,
            start: seg.start + timeOffset,
            end: seg.end + timeOffset,
            words: seg.words?.map((w: any) => ({
              word: w.word,
              start: w.start + timeOffset,
              end: w.end + timeOffset,
            })),
          }));

          allSegments.push(...segments);
          fullText += (fullText ? ' ' : '') + (data.text || '');

          if (!language && data.language) {
            language = data.language;
          }

          // Update offset for next chunk
          if (segments.length > 0) {
            timeOffset = segments[segments.length - 1].end;
          }

          // Clean up chunk file
          await fs.unlink(chunkPath).catch(() => {});
        }

        // Clean up chunk directory
        await fs.rmdir(path.dirname(chunkPaths[0])).catch(() => {});
      } else {
        // File is small enough, process directly
        console.log(`Audio file (${(audioStats.size / 1024 / 1024).toFixed(2)}MB) is within limit. Processing...`);
        const response = await this.transcribeAudioFile(audioPath, options);
        const data = response as any;

        allSegments = (data.segments || []).map((seg: any) => ({
          text: seg.text,
          start: seg.start,
          end: seg.end,
          words: seg.words?.map((w: any) => ({
            word: w.word,
            start: w.start,
            end: w.end,
          })),
        }));

        fullText = data.text || '';
        language = data.language;
      }

      return {
        text: fullText,
        segments: allSegments,
        duration: allSegments.length > 0 ? allSegments[allSegments.length - 1].end : 0,
        language,
      };
    } finally {
      // Clean up temporary files
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  findTextInTranscript(transcript: Transcript, searchText: string): TranscriptMatch[] {
    const matches: TranscriptMatch[] = [];
    const normalizedSearch = searchText.toLowerCase().trim();

    // Search through segments
    for (const segment of transcript.segments) {
      const normalizedSegment = segment.text.toLowerCase();
      const index = normalizedSegment.indexOf(normalizedSearch);

      if (index !== -1) {
        // Found a match - try to get precise timing from words if available
        if (segment.words && segment.words.length > 0) {
          const words = segment.words;
          const searchWords = normalizedSearch.split(/\s+/);

          // Find word-level matches
          for (let i = 0; i <= words.length - searchWords.length; i++) {
            const candidateWords = words.slice(i, i + searchWords.length);
            const candidateText = candidateWords
              .map(w => w.word.toLowerCase().trim())
              .join(' ');

            if (candidateText.includes(normalizedSearch)) {
              matches.push({
                text: candidateWords.map(w => w.word).join(' '),
                start: candidateWords[0].start,
                end: candidateWords[candidateWords.length - 1].end,
                confidence: 1.0,
              });
            }
          }
        } else {
          // Fallback to segment-level timing
          matches.push({
            text: segment.text,
            start: segment.start,
            end: segment.end,
            confidence: 0.8,
          });
        }
      }
    }

    return matches;
  }

  matchToScript(
    transcript: Transcript,
    script: string
  ): { matches: TranscriptMatch[]; unmatchedScript: string[] } {
    const scriptLines = script.split('\n').filter(line => line.trim());
    const matches: TranscriptMatch[] = [];
    const unmatchedScript: string[] = [];

    for (const line of scriptLines) {
      const lineMatches = this.findTextInTranscript(transcript, line);

      if (lineMatches.length > 0) {
        matches.push(...lineMatches);
      } else {
        unmatchedScript.push(line);
      }
    }

    return { matches, unmatchedScript };
  }

  calculateTimestampsToKeep(
    transcript: Transcript,
    script: string
  ): Array<{ start: number; end: number }> {
    const scriptResult = this.matchToScript(transcript, script);
    const matches = scriptResult.matches;

    // Sort matches by start time
    const sortedMatches = matches.sort((a: TranscriptMatch, b: TranscriptMatch) => a.start - b.start);

    // Merge overlapping or adjacent segments
    const segments: Array<{ start: number; end: number }> = [];

    for (const match of sortedMatches) {
      if (segments.length === 0) {
        segments.push({ start: match.start, end: match.end });
      } else {
        const lastSegment = segments[segments.length - 1];

        // If matches overlap or are close (within 0.5 seconds), merge them
        if (match.start <= lastSegment.end + 0.5) {
          lastSegment.end = Math.max(lastSegment.end, match.end);
        } else {
          segments.push({ start: match.start, end: match.end });
        }
      }
    }

    return segments;
  }

  calculateTimestampsToRemove(
    transcript: Transcript,
    textToRemove: string
  ): Array<{ start: number; end: number }> {
    const matches = this.findTextInTranscript(transcript, textToRemove);

    return matches.map(match => ({
      start: Math.max(0, match.start - 0.1), // Add small buffer
      end: match.end + 0.1,
    }));
  }

  invertTimeRanges(
    ranges: Array<{ start: number; end: number }>,
    totalDuration: number
  ): Array<{ start: number; end: number }> {
    if (ranges.length === 0) {
      return [{ start: 0, end: totalDuration }];
    }

    // Sort ranges by start time
    const sorted = ranges.sort((a, b) => a.start - b.start);
    const inverted: Array<{ start: number; end: number }> = [];

    // Add segment before first range
    if (sorted[0].start > 0) {
      inverted.push({ start: 0, end: sorted[0].start });
    }

    // Add segments between ranges
    for (let i = 0; i < sorted.length - 1; i++) {
      inverted.push({
        start: sorted[i].end,
        end: sorted[i + 1].start,
      });
    }

    // Add segment after last range
    if (sorted[sorted.length - 1].end < totalDuration) {
      inverted.push({
        start: sorted[sorted.length - 1].end,
        end: totalDuration,
      });
    }

    return inverted;
  }

  formatTranscriptAsText(transcript: Transcript): string {
    return transcript.segments
      .map(seg => `[${this.formatTime(seg.start)} - ${this.formatTime(seg.end)}] ${seg.text}`)
      .join('\n');
  }

  formatTranscriptAsSRT(transcript: Transcript): string {
    return transcript.segments
      .map((seg, i) => {
        const start = this.formatSRTTime(seg.start);
        const end = this.formatSRTTime(seg.end);
        return `${i + 1}\n${start} --> ${end}\n${seg.text.trim()}\n`;
      })
      .join('\n');
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  private formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }
}
