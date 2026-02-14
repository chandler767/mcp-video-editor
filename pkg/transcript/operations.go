package transcript

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/chandler-mayo/mcp-video-editor/pkg/ffmpeg"
	openai "github.com/sashabaranov/go-openai"
)

// Word represents a single word with timing
type Word struct {
	Word  string  `json:"word"`
	Start float64 `json:"start"`
	End   float64 `json:"end"`
}

// Segment represents a transcript segment
type Segment struct {
	Text  string  `json:"text"`
	Start float64 `json:"start"`
	End   float64 `json:"end"`
	Words []Word  `json:"words,omitempty"`
}

// Transcript represents a full transcript
type Transcript struct {
	Text     string    `json:"text"`
	Segments []Segment `json:"segments"`
	Duration float64   `json:"duration"`
	Language string    `json:"language,omitempty"`
}

// Match represents a search result in transcript
type Match struct {
	Text       string  `json:"text"`
	Start      float64 `json:"start"`
	End        float64 `json:"end"`
	Confidence float64 `json:"confidence"`
}

// TimeRange represents a time range
type TimeRange struct {
	Start float64 `json:"start"`
	End   float64 `json:"end"`
}

// Operations handles transcript operations
type Operations struct {
	client         *openai.Client
	ffmpeg         *ffmpeg.Manager
	maxFileSize    int64
	chunkDuration  float64
}

const (
	MaxFileSize   = 24 * 1024 * 1024 // 24MB
	ChunkDuration = 600.0             // 10 minutes
)

// NewOperations creates a new transcript operations handler
func NewOperations(apiKey string, mgr *ffmpeg.Manager) *Operations {
	var client *openai.Client
	if apiKey != "" {
		client = openai.NewClient(apiKey)
	}
	return &Operations{
		client:        client,
		ffmpeg:        mgr,
		maxFileSize:   MaxFileSize,
		chunkDuration: ChunkDuration,
	}
}

// ExtractTranscript transcribes video using OpenAI Whisper
func (o *Operations) ExtractTranscript(ctx context.Context, videoPath string, language string) (*Transcript, error) {
	if o.client == nil {
		return nil, fmt.Errorf("OpenAI API key not configured")
	}

	// Create temp directory
	tempDir, err := os.MkdirTemp("", "whisper-")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp dir: %w", err)
	}
	defer os.RemoveAll(tempDir)

	// Extract audio with optimized settings
	audioPath := filepath.Join(tempDir, "audio.mp3")
	if err := o.extractAudio(ctx, videoPath, audioPath); err != nil {
		return nil, fmt.Errorf("failed to extract audio: %w", err)
	}

	// Check file size
	stat, err := os.Stat(audioPath)
	if err != nil {
		return nil, fmt.Errorf("failed to stat audio file: %w", err)
	}

	var segments []Segment
	var fullText string
	var detectedLang string

	if stat.Size() > o.maxFileSize {
		// Need to chunk the file
		chunkPaths, err := o.splitAudio(ctx, audioPath, tempDir)
		if err != nil {
			return nil, fmt.Errorf("failed to split audio: %w", err)
		}

		timeOffset := 0.0
		for i, chunkPath := range chunkPaths {
			fmt.Printf("Processing chunk %d/%d...\n", i+1, len(chunkPaths))

			response, err := o.transcribeFile(ctx, chunkPath, language)
			if err != nil {
				return nil, fmt.Errorf("failed to transcribe chunk %d: %w", i, err)
			}

			// Adjust timestamps
			for _, seg := range response.Segments {
				adjustedSeg := Segment{
					Text:  seg.Text,
					Start: seg.Start + timeOffset,
					End:   seg.End + timeOffset,
				}
				for _, w := range seg.Words {
					adjustedSeg.Words = append(adjustedSeg.Words, Word{
						Word:  w.Word,
						Start: w.Start + timeOffset,
						End:   w.End + timeOffset,
					})
				}
				segments = append(segments, adjustedSeg)
			}

			if fullText != "" {
				fullText += " "
			}
			fullText += response.Text

			if detectedLang == "" && response.Language != "" {
				detectedLang = response.Language
			}

			// Update offset
			if len(response.Segments) > 0 {
				lastSeg := response.Segments[len(response.Segments)-1]
				timeOffset = lastSeg.End + timeOffset
			}
		}
	} else {
		// File is small enough
		response, err := o.transcribeFile(ctx, audioPath, language)
		if err != nil {
			return nil, fmt.Errorf("failed to transcribe: %w", err)
		}
		segments = response.Segments
		fullText = response.Text
		detectedLang = response.Language
	}

	duration := 0.0
	if len(segments) > 0 {
		duration = segments[len(segments)-1].End
	}

	return &Transcript{
		Text:     fullText,
		Segments: segments,
		Duration: duration,
		Language: detectedLang,
	}, nil
}

// extractAudio extracts audio from video with optimized settings
func (o *Operations) extractAudio(ctx context.Context, videoPath, outputPath string) error {
	args := []string{
		"-i", videoPath,
		"-vn", // No video
		"-acodec", "libmp3lame",
		"-ab", "64k", // Low bitrate
		"-ac", "1", // Mono
		"-ar", "16000", // 16kHz (optimal for Whisper)
		"-y",
		outputPath,
	}
	return o.ffmpeg.Execute(ctx, args...)
}

// splitAudio splits audio into chunks
func (o *Operations) splitAudio(ctx context.Context, audioPath, tempDir string) ([]string, error) {
	chunkDir := filepath.Join(tempDir, "chunks")
	if err := os.MkdirAll(chunkDir, 0755); err != nil {
		return nil, err
	}

	outputPattern := filepath.Join(chunkDir, "chunk_%03d.mp3")
	args := []string{
		"-i", audioPath,
		"-f", "segment",
		"-segment_time", fmt.Sprintf("%.0f", o.chunkDuration),
		"-c", "copy",
		"-y",
		outputPattern,
	}

	if err := o.ffmpeg.Execute(ctx, args...); err != nil {
		return nil, err
	}

	// Get all chunk files
	files, err := os.ReadDir(chunkDir)
	if err != nil {
		return nil, err
	}

	var chunkPaths []string
	for _, file := range files {
		if !file.IsDir() {
			chunkPaths = append(chunkPaths, filepath.Join(chunkDir, file.Name()))
		}
	}
	sort.Strings(chunkPaths)

	return chunkPaths, nil
}

// transcribeFile transcribes a single audio file
func (o *Operations) transcribeFile(ctx context.Context, audioPath, language string) (*Transcript, error) {
	req := openai.AudioRequest{
		Model:    openai.Whisper1,
		FilePath: audioPath,
		Format:   openai.AudioResponseFormatVerboseJSON,
		TimestampGranularities: []openai.TranscriptionTimestampGranularity{
			openai.TranscriptionTimestampGranularityWord,
		},
	}

	if language != "" {
		req.Language = language
	}

	resp, err := o.client.CreateTranscription(ctx, req)
	if err != nil {
		return nil, err
	}

	// Parse the response
	segments := make([]Segment, len(resp.Segments))
	for i, seg := range resp.Segments {
		segment := Segment{
			Text:  seg.Text,
			Start: float64(seg.Start),
			End:   float64(seg.End),
		}

		// Parse word-level timestamps from response.Words
		// Words are at the top level, so we need to match them to segments by timing
		if len(resp.Words) > 0 {
			var segmentWords []Word
			for _, word := range resp.Words {
				// Check if word falls within this segment's time range
				if word.Start >= seg.Start && word.End <= seg.End {
					segmentWords = append(segmentWords, Word{
						Word:  word.Word,
						Start: word.Start,
						End:   word.End,
					})
				}
			}
			segment.Words = segmentWords
		}

		segments[i] = segment
	}

	return &Transcript{
		Text:     resp.Text,
		Segments: segments,
		Duration: float64(resp.Duration),
		Language: resp.Language,
	}, nil
}

// FindInTranscript searches for text in transcript
func (o *Operations) FindInTranscript(transcript *Transcript, searchText string) []Match {
	var matches []Match
	normalizedSearch := strings.ToLower(strings.TrimSpace(searchText))

	for _, segment := range transcript.Segments {
		normalizedSegment := strings.ToLower(segment.Text)
		if strings.Contains(normalizedSegment, normalizedSearch) {
			// Try word-level matching if words available
			if len(segment.Words) > 0 {
				matches = append(matches, o.findWordLevelMatches(segment, normalizedSearch)...)
			} else {
				// Fallback to segment-level
				matches = append(matches, Match{
					Text:       segment.Text,
					Start:      segment.Start,
					End:        segment.End,
					Confidence: 0.8,
				})
			}
		}
	}

	return matches
}

// findWordLevelMatches finds matches at word level
func (o *Operations) findWordLevelMatches(segment Segment, normalizedSearch string) []Match {
	var matches []Match
	searchWords := strings.Fields(normalizedSearch)
	words := segment.Words

	for i := 0; i <= len(words)-len(searchWords); i++ {
		candidateWords := words[i : i+len(searchWords)]
		candidateText := strings.ToLower(strings.Join(wordsToStrings(candidateWords), " "))

		if strings.Contains(candidateText, normalizedSearch) {
			matches = append(matches, Match{
				Text:       strings.Join(wordsToStrings(candidateWords), " "),
				Start:      candidateWords[0].Start,
				End:        candidateWords[len(candidateWords)-1].End,
				Confidence: 1.0,
			})
		}
	}

	return matches
}

// wordsToStrings converts Word slice to string slice
func wordsToStrings(words []Word) []string {
	result := make([]string, len(words))
	for i, w := range words {
		result[i] = w.Word
	}
	return result
}

// MatchToScript matches transcript against a script
func (o *Operations) MatchToScript(transcript *Transcript, script string) ([]Match, []string) {
	scriptLines := strings.Split(script, "\n")
	var matches []Match
	var unmatched []string

	for _, line := range scriptLines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		lineMatches := o.FindInTranscript(transcript, line)
		if len(lineMatches) > 0 {
			matches = append(matches, lineMatches...)
		} else {
			unmatched = append(unmatched, line)
		}
	}

	return matches, unmatched
}

// CalculateTimestampsToKeep calculates which parts to keep based on script
func (o *Operations) CalculateTimestampsToKeep(transcript *Transcript, script string) []TimeRange {
	matches, _ := o.MatchToScript(transcript, script)

	// Sort by start time
	sort.Slice(matches, func(i, j int) bool {
		return matches[i].Start < matches[j].Start
	})

	// Merge overlapping or adjacent segments
	var segments []TimeRange
	for _, match := range matches {
		if len(segments) == 0 {
			segments = append(segments, TimeRange{Start: match.Start, End: match.End})
		} else {
			last := &segments[len(segments)-1]
			// Merge if within 0.5 seconds
			if match.Start <= last.End+0.5 {
				if match.End > last.End {
					last.End = match.End
				}
			} else {
				segments = append(segments, TimeRange{Start: match.Start, End: match.End})
			}
		}
	}

	return segments
}

// CalculateTimestampsToRemove calculates which parts to remove
func (o *Operations) CalculateTimestampsToRemove(transcript *Transcript, textToRemove string) []TimeRange {
	matches := o.FindInTranscript(transcript, textToRemove)

	ranges := make([]TimeRange, len(matches))
	for i, match := range matches {
		// Add small buffer
		ranges[i] = TimeRange{
			Start: max(0, match.Start-0.1),
			End:   match.End + 0.1,
		}
	}

	return ranges
}

// InvertTimeRanges inverts time ranges (what to keep becomes what to remove)
func (o *Operations) InvertTimeRanges(ranges []TimeRange, totalDuration float64) []TimeRange {
	if len(ranges) == 0 {
		return []TimeRange{{Start: 0, End: totalDuration}}
	}

	// Sort ranges
	sort.Slice(ranges, func(i, j int) bool {
		return ranges[i].Start < ranges[j].Start
	})

	var inverted []TimeRange

	// Add segment before first range
	if ranges[0].Start > 0 {
		inverted = append(inverted, TimeRange{Start: 0, End: ranges[0].Start})
	}

	// Add segments between ranges
	for i := 0; i < len(ranges)-1; i++ {
		inverted = append(inverted, TimeRange{
			Start: ranges[i].End,
			End:   ranges[i+1].Start,
		})
	}

	// Add segment after last range
	if ranges[len(ranges)-1].End < totalDuration {
		inverted = append(inverted, TimeRange{
			Start: ranges[len(ranges)-1].End,
			End:   totalDuration,
		})
	}

	return inverted
}

// FormatAsText formats transcript as readable text
func (o *Operations) FormatAsText(transcript *Transcript) string {
	var lines []string
	for _, seg := range transcript.Segments {
		line := fmt.Sprintf("[%s - %s] %s",
			formatTime(seg.Start),
			formatTime(seg.End),
			seg.Text)
		lines = append(lines, line)
	}
	return strings.Join(lines, "\n")
}

// FormatAsSRT formats transcript as SRT subtitle file
func (o *Operations) FormatAsSRT(transcript *Transcript) string {
	var lines []string
	for i, seg := range transcript.Segments {
		lines = append(lines,
			fmt.Sprintf("%d", i+1),
			fmt.Sprintf("%s --> %s", formatSRTTime(seg.Start), formatSRTTime(seg.End)),
			strings.TrimSpace(seg.Text),
			"",
		)
	}
	return strings.Join(lines, "\n")
}

// SaveTranscript saves transcript to JSON file
func (o *Operations) SaveTranscript(transcript *Transcript, outputPath string) error {
	data, err := json.MarshalIndent(transcript, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(outputPath, data, 0644)
}

// LoadTranscript loads transcript from JSON file
func (o *Operations) LoadTranscript(inputPath string) (*Transcript, error) {
	data, err := os.ReadFile(inputPath)
	if err != nil {
		return nil, err
	}

	var transcript Transcript
	if err := json.Unmarshal(data, &transcript); err != nil {
		return nil, err
	}

	return &transcript, nil
}

// Helper functions

func formatTime(seconds float64) string {
	mins := int(seconds / 60)
	secs := int(seconds) % 60
	ms := int((seconds - float64(int(seconds))) * 1000)
	return fmt.Sprintf("%d:%02d.%03d", mins, secs, ms)
}

func formatSRTTime(seconds float64) string {
	hours := int(seconds / 3600)
	mins := int(seconds/60) % 60
	secs := int(seconds) % 60
	ms := int((seconds - float64(int(seconds))) * 1000)
	return fmt.Sprintf("%02d:%02d:%02d,%03d", hours, mins, secs, ms)
}

func max(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}
