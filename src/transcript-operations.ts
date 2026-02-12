import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';

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

  constructor(apiKey?: string) {
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
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

    const audioFile = createReadStream(videoPath);

    const response = await this.openai.audio.transcriptions.create({
      file: audioFile,
      model: options?.model || 'whisper-1',
      language: options?.language,
      response_format: 'verbose_json',
      timestamp_granularities: ['segment', 'word'],
    });

    // Parse the verbose JSON response
    const data = response as any;

    const segments: TranscriptSegment[] = (data.segments || []).map((seg: any) => ({
      text: seg.text,
      start: seg.start,
      end: seg.end,
      words: seg.words?.map((w: any) => ({
        word: w.word,
        start: w.start,
        end: w.end,
      })),
    }));

    return {
      text: data.text || '',
      segments,
      duration: segments.length > 0 ? segments[segments.length - 1].end : 0,
      language: data.language,
    };
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
